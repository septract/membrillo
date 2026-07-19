// Browser controller: story menu, the four-verb UI, click-to-walk, dialogue
// and cutscene overlays, saves, and the render loop. All game *rules* live in
// core/ — this file only sequences outcomes the core produces.
//
// SCUMM-style presentation: speech floats over the speaker's head (the DOM log
// is a secondary transcript), sprites scale with depth and animate by pose,
// the actor paths through walkboxes and behind props, room changes fade, and
// a following camera lets scenes be larger than the story's view resolution.

import type { Character, DialogueOption, Point, Scene, SeqStep, Size, State, Target } from './core/types.ts';
import { applyRule, initialState } from './core/rules.ts';
import {
  act,
  applyItem,
  applySequenceEffects,
  chooseOption,
  combine,
  currentScene,
  dialogueNode,
  enterScene,
  enterSequenceId,
  isCutscene,
  lookAtItem,
  stepRule,
  useExit,
  visibleCharacters,
  visibleOptions,
  type PlayerVerb,
} from './core/verbs.ts';
import { objectiveViews } from './core/objectives.ts';
import { followGap, pushTrail, trailPointAt, type Trail } from './followers.ts';
import * as audio from './audio/engine.ts';
import { loadStories, type LoadedStory, type StorySources } from './loader.ts';
import {
  bodyBox,
  drawSpeech,
  FONT,
  overlayText,
  renderScene,
  resetTextCache,
  sceneSize,
  sceneTargets,
  storyView,
  targetAt,
  wrapWords,
  type ActorPose,
  type FollowerView,
  type Speech,
  type TargetRef,
} from './render.ts';
import { clampToWalkable, depthScale, findPath, walkBoxes } from './walk.ts';
import { P, css, rgba, type RGB } from './art/palette.ts';
import {
  ACTOR_SPEECH_OFFSET,
  CHARACTER_SPEECH_OFFSET,
  PORTRAIT,
  type Facing,
  type PortraitPainter,
} from './art/sprites.ts';
import type { Outcome } from './core/rules.ts';

// Look / Talk / Interact. There is deliberately no Combine verb: with
// Interact, clicking an inventory item arms it ("Use X with …"), and the next
// click — another item OR a scene target — completes the sentence. One mental
// model whether Y is in the inventory or the world.
type ArmedVerb = PlayerVerb;

type PendingAction = { kind: 'verb'; verb: PlayerVerb } | { kind: 'apply'; itemId: string };

interface Pending {
  target: TargetRef;
  action: PendingAction;
}

interface RunningSequence {
  steps: SeqStep[];
  index: number;
  /** Timestamp the current step completes at (null: waiting on the walk). */
  until: number | null;
  /** Scene to travel to once the sequence ends (a rule's play+goto). */
  afterGoto: string | null;
}

interface Session {
  id: string;
  loaded: LoadedStory;
  view: Size;
  state: State;
  actor: ActorPose;
  camera: Point;
  /** Remaining walk waypoints. */
  path: Point[] | null;
  pending: Pending | null;
  /** Open dialogue, if any; speaker anchors the floating line. */
  dialogue: { id: string; node: string; anchor: Point; color: RGB; speakerId: string } | null;
  /** Cutscene beat index, if the current scene is a cutscene. */
  beat: number | null;
  /** In-room scripted sequence currently playing (blocks input). */
  sequence: RunningSequence | null;
  /** Companion follower presentation state, keyed by companion id. */
  followers: Map<string, ActorPose>;
  trail: Trail;
  /** Runtime positions of sequence-moved scene characters (presentation only). */
  charPoses: Map<string, ActorPose>;
  /** In-flight scripted character walks: id -> destination. */
  charWalks: Map<string, Point>;
  /** Sequence-set facing overrides for scene characters; reset per scene. */
  facingOverrides: Record<string, Facing>;
  finished: boolean;
}

const WALK_SPEED = 80; // px/s at scale 1
const STEP_PHASE = 0.45; // walk-cycle radians per px covered
const SPEECH_MS_MIN = 1600;
const SPEECH_MS_PER_CHAR = 55;
const FADE_MS = 440;
const CAMERA_LERP = 5; // 1/s
let stories!: Map<string, LoadedStory>;

/** Framework attribution shown on the menu — a link back to Membrillo. */
const MEMBRILLO_URL = 'https://github.com/septract/membrillo';

// --- DOM skeleton -----------------------------------------------------------

let el!: {
  title: HTMLElement;
  menu: HTMLElement;
  game: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  dialogue: HTMLElement;
  sentence: HTMLElement;
  verbs: HTMLElement;
  inventory: HTMLElement;
  objectives: HTMLElement;
  log: HTMLElement;
  btnLog: HTMLElement;
  btnEye: HTMLElement;
  btnSkip: HTMLElement;
  btnMute: HTMLElement;
  btnMenu: HTMLElement;
  btnRestart: HTMLElement;
};
let ctx!: CanvasRenderingContext2D;
let octx!: CanvasRenderingContext2D;

function initDom(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <header>
      <h1 id="title">Membrillo</h1>
      <nav><button id="btn-eye" title="highlight clickable things">👁</button><button id="btn-mute" title="mute">♪</button><button id="btn-menu">Stories</button><button id="btn-restart" hidden>Restart</button></nav>
    </header>
    <div id="menu"></div>
    <div id="game" hidden>
      <div class="stage">
        <canvas id="view"></canvas>
        <canvas id="overlay"></canvas>
        <button id="btn-skip" hidden>skip ≫</button>
        <div id="dialogue" hidden></div>
      </div>
      <div class="panel">
        <div id="sentence">&nbsp;</div>
        <div id="verbs"></div>
        <div id="inventory"></div>
        <div id="objectives" hidden></div>
        <button id="btn-log" class="secondary log-toggle">history ▸</button>
        <div id="log" hidden></div>
      </div>
    </div>`;

  el = {
    title: document.getElementById('title')!,
    menu: document.getElementById('menu')!,
    game: document.getElementById('game')!,
    canvas: document.getElementById('view') as HTMLCanvasElement,
    overlay: document.getElementById('overlay') as HTMLCanvasElement,
    dialogue: document.getElementById('dialogue')!,
    sentence: document.getElementById('sentence')!,
    verbs: document.getElementById('verbs')!,
    inventory: document.getElementById('inventory')!,
    objectives: document.getElementById('objectives')!,
    log: document.getElementById('log')!,
    btnLog: document.getElementById('btn-log')!,
    btnEye: document.getElementById('btn-eye')!,
    btnSkip: document.getElementById('btn-skip')!,
    btnMute: document.getElementById('btn-mute')!,
    btnMenu: document.getElementById('btn-menu')!,
    btnRestart: document.getElementById('btn-restart')!,
  };
  ctx = el.canvas.getContext('2d')!;
  // Text renders on a separate display-resolution overlay stacked above the
  // pixel-art buffer — crisp glyphs on top of chunky art, the SCUMM-remaster way.
  octx = el.overlay.getContext('2d')!;
}

/** Keep the overlay's backing store matched to the displayed canvas size. */
function syncOverlay(): void {
  const rect = el.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (el.overlay.width !== w || el.overlay.height !== h) {
    el.overlay.width = w;
    el.overlay.height = h;
  }
}

/** World-units → overlay-pixels scale factor. */
function overlayScale(): number {
  return session ? el.overlay.width / session.view.w : 1;
}

// Interact is the default verb: a plain click on a door goes through it,
// on a pickup takes it. Look/Talk are deliberate modes.
let session: Session | null = null;
let armed: ArmedVerb = 'interact';
let armedItem: string | null = null;
let hover: TargetRef | undefined;
// Highlight = held Space (desktop, momentary) OR the 👁 toggle (touch, latched).
let spaceHeld = false;
let eyeLock = false;
/** Transient one-shot speech; the floating dialogue line derives live from session.dialogue. */
let speech: (Speech & { expires: number; speakerId: string }) | null = null;
let fade: { t0: number; apply: () => void; fired: boolean } | null = null;

// --- Saves & debug params ---------------------------------------------------

function saveKey(id: string): string {
  return `pcc:${id}`;
}

function save(): void {
  if (session && !session.finished) {
    localStorage.setItem(saveKey(session.id), JSON.stringify(session.state));
  }
}

function loadSave(id: string): State | null {
  const raw = localStorage.getItem(saveKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as State;
  } catch {
    // Corrupt save (interrupted write, manual edit): discard rather than
    // crashing the menu/boot for every future visit.
    localStorage.removeItem(saveKey(id));
    return null;
  }
}

function debugState(loaded: LoadedStory): State | null {
  const q = new URLSearchParams(location.search);
  const start = q.get('start');
  if (!start && !q.get('flags') && !q.get('items') && !q.get('companions')) return null;
  const list = (k: string) => (q.get(k) ?? '').split(',').filter(Boolean).sort();
  return {
    scene: start ?? loaded.story.manifest.start,
    flags: list('flags'),
    inventory: list('items'),
    companions: list('companions'),
  };
}

// --- Menu -------------------------------------------------------------------

/** One story card: title, spoiler-free blurb, Play (and Continue if saved). */
function storyCard(id: string, loaded: LoadedStory): HTMLElement {
  const card = document.createElement('div');
  card.className = 'story-card';
  const done = localStorage.getItem(`pcc:done:${id}`) === '1';

  const text = document.createElement('div');
  text.className = 'story-text';
  const h = document.createElement('h3');
  h.textContent = loaded.story.manifest.title;
  if (done) {
    const tick = document.createElement('span');
    tick.className = 'done-tick';
    tick.textContent = '✓';
    tick.title = 'completed';
    h.append(' ', tick);
  }
  text.append(h);
  const desc = loaded.story.manifest.description;
  if (desc) {
    const p = document.createElement('p');
    p.textContent = desc;
    text.append(p);
  }
  card.append(text);

  const actions = document.createElement('div');
  actions.className = 'story-actions';
  const saved = loadSave(id);
  const play = document.createElement('button');
  play.textContent = saved ? 'Restart' : 'Play';
  play.addEventListener('click', () => startStory(id, null));
  if (saved) {
    const cont = document.createElement('button');
    cont.textContent = 'Continue';
    cont.className = 'primary';
    cont.addEventListener('click', () => startStory(id, saved));
    actions.append(cont);
    play.className = 'secondary';
  }
  actions.append(play);
  card.append(actions);
  return card;
}

function showMenu(): void {
  session = null;
  speech = null;
  fade = null;
  audio.setTheme(null); // the menu is quiet (Mike's nit)
  el.game.hidden = true;
  el.btnRestart.hidden = true;
  el.btnMenu.hidden = true; // no "Stories" button while the menu IS the stories
  el.menu.hidden = false;
  el.title.textContent = 'Membrillo';
  el.menu.innerHTML = '';

  const games = [...stories].filter(([, l]) => (l.story.manifest.category ?? 'story') !== 'demo');
  const demos = [...stories].filter(([, l]) => l.story.manifest.category === 'demo');

  for (const [id, loaded] of games) el.menu.append(storyCard(id, loaded));

  // Engine-honesty fixtures live under a collapsed section — present for
  // developers, out of the way of players.
  if (demos.length > 0) {
    const details = document.createElement('details');
    details.className = 'demo-section';
    const summary = document.createElement('summary');
    summary.textContent = `Engine demos (${demos.length})`;
    details.append(summary);
    for (const [id, loaded] of demos) details.append(storyCard(id, loaded));
    el.menu.append(details);
  }

  const footer = document.createElement('p');
  footer.className = 'menu-footer';
  const link = document.createElement('a');
  link.href = MEMBRILLO_URL;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'made with Membrillo';
  footer.append(link);
  el.menu.append(footer);
}

function startStory(id: string, state: State | null): void {
  const loaded = stories.get(id);
  if (!loaded) return;
  // A save or debug URL may reference a scene that no longer exists after a
  // content change — fall back to a fresh start instead of crashing boot.
  if (state && !loaded.story.scenes[state.scene]) {
    console.warn(`Scene "${state.scene}" no longer exists in "${id}" — starting fresh.`);
    localStorage.removeItem(saveKey(id));
    state = null;
  }
  const view = storyView(loaded);
  el.menu.hidden = true;
  el.game.hidden = false;
  el.btnRestart.hidden = false;
  el.btnMenu.hidden = false; // Stories button returns while in a story
  el.title.textContent = loaded.story.manifest.title;
  el.log.innerHTML = '';
  el.canvas.width = view.w;
  el.canvas.height = view.h;
  el.canvas.style.aspectRatio = `${view.w} / ${view.h}`;
  ctx.imageSmoothingEnabled = false;
  armed = 'interact';
  armedItem = null;
  speech = null;
  fade = null;
  audio.ensureRunning(); // startStory always runs from a user gesture
  session = {
    id,
    loaded,
    view,
    state: state ?? initialState(loaded.story.manifest.start),
    actor: { x: 0, y: 0, facing: 'right', phase: 0, walking: false },
    camera: { x: 0, y: 0 },
    path: null,
    pending: null,
    dialogue: null,
    beat: null,
    sequence: null,
    followers: new Map(),
    trail: { points: [] },
    charPoses: new Map(),
    charWalks: new Map(),
    facingOverrides: {},
    finished: false,
  };
  placeInScene(sceneOf(session), null);
  renderPanel();
  renderDialogue();
}

// --- Scene flow -------------------------------------------------------------

function sceneOf(s: Session): Scene {
  return currentScene(s.loaded.story, s.state);
}

function cameraTargetFor(s: Session): Point {
  const size = sceneSize(sceneOf(s), s.view);
  return {
    x: Math.min(Math.max(s.actor.x - s.view.w / 2, 0), Math.max(size.w - s.view.w, 0)),
    y: Math.min(Math.max(s.actor.y - s.view.h / 2, 0), Math.max(size.h - s.view.h, 0)),
  };
}

function applyTheme(scene: Scene): void {
  if (!session) return;
  const cfg = session.loaded.story.manifest.audio;
  const themeName = cfg?.sceneTheme[scene.id];
  audio.setTheme(themeName !== undefined ? (cfg!.themes[themeName] ?? null) : null);
}

function placeInScene(scene: Scene, entry: Point | null): void {
  if (!session) return;
  session.path = null;
  session.pending = null;
  session.dialogue = null;
  session.sequence = null;
  session.facingOverrides = {};
  session.charPoses.clear();
  session.charWalks.clear();
  renderDialogue();
  speech = null;
  hover = undefined;
  applyTheme(scene);
  if (isCutscene(scene)) {
    session.beat = 0;
  } else {
    session.beat = null;
    const at = entry ?? scene.start ?? { x: session.view.w / 2, y: session.view.h - 20 };
    session.actor = { ...session.actor, x: at.x, y: at.y, walking: false };
    session.camera = cameraTargetFor(session); // snap, don't pan, on entry
    // Seed the breadcrumb trail with a tail behind the actor, so followers
    // fan out in file on entry instead of stacking on the actor. Vertical
    // facings seed horizontally — rooms are wide, and a vertical tail gets
    // clamped to nothing at the walkbox edge (followers would stack).
    const boxes = walkBoxes(scene);
    const bx = session.actor.facing === 'left' ? 1 : -1;
    session.trail.points = [];
    for (let d = 78; d >= 0; d -= 6) {
      pushTrail(session.trail, clampToWalkable({ x: at.x + bx * d, y: at.y }, boxes));
    }
    session.followers.clear(); // re-seeded next tick along the new trail
    const seqId = enterSequenceId(scene, session.state);
    if (seqId !== null) startSequence(seqId, null);
  }
  save();
}

function changeSceneNow(sceneId: string, entry: Point | null, withState?: State): void {
  if (!session) return;
  seqPortrait = null; // a beat never survives the room change
  session.state = withState ?? enterScene(session.state, sceneId);
  const scene = sceneOf(session);
  if (scene.ending && !isCutscene(scene)) {
    finish();
    return;
  }
  placeInScene(scene, entry);
  renderPanel();
}

/**
 * Room changes go through a fade; the switch happens at full black.
 * `withState` (e.g. an exit outcome's state) is also applied at the midpoint,
 * so the render keeps showing the departing scene until then.
 */
function changeScene(sceneId: string, entry: Point | null, withState?: State): void {
  fade = {
    t0: performance.now(),
    fired: false,
    apply: () => changeSceneNow(sceneId, entry, withState),
  };
}

function finish(): void {
  if (!session) return;
  session.finished = true;
  localStorage.removeItem(saveKey(session.id));
  localStorage.setItem(`pcc:done:${session.id}`, '1');
  audio.setTheme(null);
  audio.sfx('success');
  log('— The End —');
}

function log(text: string): void {
  const p = document.createElement('p');
  p.textContent = text;
  el.log.append(p);
  while (el.log.childElementCount > 80) el.log.firstElementChild?.remove();
  el.log.scrollTop = el.log.scrollHeight;
}

// --- Speech -----------------------------------------------------------------

function say(text: string, anchor: Point, color: RGB, speakerId: string): void {
  speech = {
    text,
    color,
    x: anchor.x,
    y: anchor.y,
    speakerId,
    expires: performance.now() + Math.min(SPEECH_MS_MIN + text.length * SPEECH_MS_PER_CHAR, 7000),
  };
  log(text);
}

function actorHead(): Point {
  if (!session) return { x: 0, y: 0 };
  const scale = depthScale(sceneOf(session), session.actor.y);
  return { x: session.actor.x, y: session.actor.y - ACTOR_SPEECH_OFFSET * scale };
}

function characterHead(scene: Scene, c: Character): Point {
  const rp = session?.charPoses.get(c.id);
  const p = rp ? { x: rp.x, y: rp.y } : c.pos;
  return { x: p.x, y: p.y - CHARACTER_SPEECH_OFFSET * depthScale(scene, p.y) };
}

interface Speaker {
  anchor: Point;
  color: RGB;
  id: string;
}

/** Where (and as whom) a line should float: the acting player, or a target. */
function speakerFor(target: TargetRef | undefined): Speaker {
  if (target && session) {
    const scene = sceneOf(session);
    if (target.kind === 'character') {
      const c = visibleCharacters(scene, session.state).find((x) => x.id === target.id);
      if (c) return { anchor: characterHead(scene, c), color: c.color ?? P.white, id: c.id };
    }
    if (target.kind === 'companion') {
      const f = session.followers.get(target.id);
      const c = session.loaded.story.companions[target.id];
      if (f) {
        const y = f.y - CHARACTER_SPEECH_OFFSET * depthScale(scene, f.y);
        return { anchor: { x: f.x, y }, color: c?.color ?? P.white, id: target.id };
      }
    }
    // A talking hotspot (intercom, door grille): float above its region.
    return {
      anchor: { x: target.region.x + target.region.w / 2, y: target.region.y - 6 },
      color: P.white,
      id: target.id,
    };
  }
  return { anchor: actorHead(), color: P.glow, id: 'actor' };
}

/** The authored rule surface behind a clicked target, whatever its kind. */
function targetDef(target: TargetRef): Target | undefined {
  if (!session) return undefined;
  const scene = sceneOf(session);
  if (target.kind === 'character') {
    return visibleCharacters(scene, session.state).find((c) => c.id === target.id);
  }
  if (target.kind === 'companion') return session.loaded.story.companions[target.id];
  if (target.kind === 'hotspot') return (scene.hotspots ?? []).find((h) => h.id === target.id);
  return undefined;
}

/**
 * What a DEFAULT (Interact) click means, by target kind — the ontology of
 * defaults: people are talked to, things are operated, and anything with
 * nothing to operate is looked at. Explicitly armed Look/Talk always win.
 */
function resolveClickVerb(target: TargetRef): PlayerVerb {
  if (armed !== 'interact') return armed;
  const def = targetDef(target);
  if (!def) return 'interact';
  if (def.defaultVerb !== undefined) return def.defaultVerb; // authored override
  const person = target.kind === 'character' || target.kind === 'companion';
  if (person && def.talk !== undefined) return 'talk';
  if (def.use !== undefined || def.take !== undefined) return 'interact';
  return 'look';
}

/** Hit-test the companion followers (they sit on top of scene targets). */
function followerTargetAt(p: Point): TargetRef | undefined {
  if (!session) return undefined;
  const scene = sceneOf(session);
  for (const [id, pose] of session.followers) {
    const region = bodyBox({ x: pose.x, y: pose.y }, depthScale(scene, pose.y));
    if (p.x >= region.x && p.x < region.x + region.w && p.y >= region.y && p.y < region.y + region.h) {
      const c = session.loaded.story.companions[id];
      // The party keeps formation around the actor, so acting on a companion
      // needs no approach: its walkTo is the actor's own position, and the
      // normal walk-then-act pipeline degenerates to acting in place.
      return {
        kind: 'companion',
        id,
        name: c?.name ?? id,
        region,
        walkTo: { x: session.actor.x, y: session.actor.y },
      };
    }
  }
  return undefined;
}

/** The speech to show this frame: the open dialogue's line, else the transient bark. */
function currentSpeech(): (Speech & { speakerId: string }) | null {
  // A scripted portrait beat captions its line under the close-up.
  if (seqPortrait) return null;
  if (session?.dialogue) {
    // Under VN staging the line lives in the dialogue box, not over a head.
    if (vnRight) return null;
    const d = session.dialogue;
    const dlg = session.loaded.story.dialogues[d.id];
    if (dlg) {
      return {
        text: dialogueNode(dlg, d.node).line,
        color: d.color,
        x: d.anchor.x,
        y: d.anchor.y,
        speakerId: d.speakerId,
      };
    }
  }
  return speech;
}

// --- Scripted sequences -----------------------------------------------------

function seqSpeaker(who: string | undefined): Speaker {
  if (!session || who === undefined || who === 'actor') return speakerFor(undefined);
  const scene = sceneOf(session);
  const c = visibleCharacters(scene, session.state).find((x) => x.id === who);
  if (c) return { anchor: characterHead(scene, c), color: c.color ?? P.white, id: c.id };
  const f = session.followers.get(who);
  if (f) {
    const region = bodyBox({ x: f.x, y: f.y }, depthScale(scene, f.y));
    return speakerFor({ kind: 'companion', id: who, name: who, region, walkTo: { x: f.x, y: f.y } });
  }
  return speakerFor(undefined);
}

/** A scripted-say portrait beat, active while a `portrait: true` say plays. */
let seqPortrait: { paint: PortraitPainter; name: string; color: RGB; text: string; talking: boolean } | null =
  null;

/** Resolve the portrait painter + name/colour for a sequence speaker. */
function seqPortraitOf(who: string | undefined): { paint: PortraitPainter; name: string; color: RGB } | null {
  if (!session) return null;
  const id = who ?? 'actor';
  if (id === 'actor') {
    const p = actorPortrait();
    return p ? { paint: p, name: '', color: P.glow } : null;
  }
  const scene = sceneOf(session);
  const def =
    (scene.characters ?? []).find((c) => c.id === id) ?? session.loaded.story.companions[id];
  if (def?.portrait !== undefined) {
    const p = session.loaded.paint.portraits?.[def.portrait];
    if (p) return { paint: p, name: def.name, color: (def.color as RGB | undefined) ?? P.white };
  }
  return null;
}

function startSequence(seqId: string, afterGoto: string | null): void {
  if (!session) return;
  const steps = sceneOf(session).sequences?.[seqId];
  if (!steps || steps.length === 0) {
    if (afterGoto !== null) changeScene(afterGoto, null);
    return;
  }
  session.sequence = { steps, index: -1, until: null, afterGoto };
  advanceSequence();
}

function advanceSequence(): void {
  if (!session || !session.sequence) return;
  const seq = session.sequence;
  seq.index++;
  seqPortrait = null; // each step starts fresh; a portrait say re-arms it below
  if (seq.index >= seq.steps.length) {
    session.sequence = null;
    // The click (or timer) that ends a sequence dismisses its final line too —
    // otherwise the line lingers on its own timer and the click looks eaten.
    speech = null;
    if (seq.afterGoto !== null) changeScene(seq.afterGoto, null);
    return;
  }
  const step = seq.steps[seq.index]!;
  session.state = applyRule(session.state, stepRule(step)).state;
  if (step.face !== undefined) {
    if ((step.who ?? 'actor') === 'actor') session.actor.facing = step.face;
    else session.facingOverrides[step.who!] = step.face;
  }
  seq.until = 0; // effect-only steps advance next tick
  if (step.say !== undefined) {
    const who = seqSpeaker(step.who);
    say(step.say, who.anchor, who.color, who.id);
    seq.until = speech?.expires ?? 0;
    // A portrait beat: show the speaker's close-up and caption the line
    // instead of floating it. A letter-free line ("...") keeps the mouth shut.
    if (step.portrait) {
      const p = seqPortraitOf(step.who);
      if (p) seqPortrait = { ...p, text: step.say, talking: /[a-z]/i.test(step.say) };
    }
  } else if (step.walkTo !== undefined) {
    const who = step.who ?? 'actor';
    if (who === 'actor') {
      session.path = findPath({ x: session.actor.x, y: session.actor.y }, step.walkTo, walkBoxes(sceneOf(session)));
      session.pending = null;
    } else {
      // Scripted character walk: straight line (author-controlled ground).
      const def = (sceneOf(session).characters ?? []).find((c) => c.id === who);
      if (!session.charPoses.has(who) && def) {
        session.charPoses.set(who, {
          x: def.pos.x,
          y: def.pos.y,
          facing: def.facing ?? 'left',
          phase: 0,
          walking: false,
        });
      }
      if (session.charPoses.has(who)) session.charWalks.set(who, { ...step.walkTo });
    }
    seq.until = null; // completes when the walk does
  } else if (step.wait !== undefined) {
    seq.until = performance.now() + step.wait * 1000;
  }
  save();
  renderPanel();
}

/** Esc: apply the remaining steps' effects instantly and end the sequence. */
function skipSequence(): void {
  if (!session || !session.sequence) return;
  const seq = session.sequence;
  session.state = applySequenceEffects(session.state, seq.steps, seq.index + 1);
  session.sequence = null;
  session.path = null;
  seqPortrait = null;
  for (const id of [...session.charWalks.keys()]) snapCharWalk(id);
  speech = null;
  if (seq.afterGoto !== null) changeScene(seq.afterGoto, null);
  save();
  renderPanel();
}

// --- Outcome handling -------------------------------------------------------

function handleOutcome(outcome: Outcome, target?: TargetRef): void {
  if (!session) return;
  const hadItems = session.state.inventory.length;
  session.state = outcome.state;
  if (outcome.state.inventory.length > hadItems) audio.sfx('pickup');
  if (outcome.text !== undefined) {
    const who = speakerFor(outcome.speaker === 'target' ? target : undefined);
    say(outcome.text, who.anchor, who.color, who.id);
  }
  if (outcome.dialogue !== undefined) openDialogue(outcome.dialogue, target);
  if (outcome.play !== undefined) startSequence(outcome.play, outcome.goto ?? null);
  else if (outcome.goto !== undefined) changeScene(outcome.goto, null);
  save();
  renderPanel();
}

function facingFromDelta(dx: number, dy: number): Facing {
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

function faceTarget(target: TargetRef): void {
  if (!session) return;
  const c = { x: target.region.x + target.region.w / 2, y: target.region.y + target.region.h / 2 };
  session.actor.facing = facingFromDelta(c.x - session.actor.x, c.y - session.actor.y);
}

/**
 * Armed verbs are one-shot: once an interaction resolves against a target,
 * the mode snaps back to the default, so the next plain click gets the
 * target's own default verb instead of repeating a stale Look/Talk. (Armed
 * items already clear on completion; this is the verb-bar equivalent.)
 * Clicks on empty ground just walk and do NOT disarm — the player is
 * approaching, not interacting.
 */
function disarmVerb(): void {
  if (armed === 'interact') return;
  armed = 'interact';
  renderPanel();
}

function runPending(): void {
  if (!session || !session.pending) return;
  const { target, action } = session.pending;
  session.pending = null;
  disarmVerb();
  faceTarget(target);
  // An addressed companion turns to face the actor.
  if (target.kind === 'companion') {
    const f = session.followers.get(target.id);
    if (f) f.facing = facingFromDelta(session.actor.x - f.x, session.actor.y - f.y);
  }
  if (target.kind === 'exit') {
    const scene = sceneOf(session);
    const exit = (scene.exits ?? []).find((e) => e.id === target.id);
    // useExit applies exit effects and validates the gate; the state switch
    // happens at fade midpoint so the render stays in this scene until then.
    const outcome = exit ? useExit(session.loaded.story, session.state, target.id) : null;
    if (exit && outcome) {
      if (outcome.text !== undefined) say(outcome.text, actorHead(), P.glow, 'actor');
      audio.sfx('door');
      changeScene(exit.to, exit.entry ?? null, outcome.state);
    }
    return;
  }
  const outcome =
    action.kind === 'apply'
      ? applyItem(session.loaded.story, session.state, target.id, action.itemId)
      : act(session.loaded.story, session.state, target.id, action.verb);
  if (action.kind === 'apply') armedItem = null;
  if (outcome) handleOutcome(outcome, target);
}

// --- Dialogue ---------------------------------------------------------------

function openDialogue(dlgId: string, target?: TargetRef): void {
  if (!session) return;
  const dlg = session.loaded.story.dialogues[dlgId];
  if (!dlg) return;
  // The speaker is whoever was talked to; fall back to scanning talk rules
  // when a dialogue is opened without a target (not currently possible).
  let who: Speaker;
  if (target) {
    who = speakerFor(target);
  } else {
    const scene = sceneOf(session);
    const c = visibleCharacters(scene, session.state).find((ch) =>
      (ch.talk ?? []).some((r) => r.dialogue === dlgId),
    );
    who = c
      ? { anchor: characterHead(scene, c), color: c.color ?? P.white, id: c.id }
      : speakerFor(undefined);
  }
  session.dialogue = { id: dlgId, node: dlg.start, anchor: who.anchor, color: who.color, speakerId: who.id };
  log(dialogueNode(dlg, dlg.start).line);
  startPortraitLine(dialogueNode(dlg, dlg.start).line);
  renderDialogue();
}

// VN dialogue staging (Mike, 2026-07-19): while a dialogue tree is open and
// the INTERLOCUTOR declares a `portrait`, both parties stand floor-to-
// ceiling over the dimmed scene — the hero (manifest.actorPortrait) stage
// left, the interlocutor stage right (mirrored, so they face each other) —
// and the spoken line moves into the dialogue box under a name tag. Purely
// presentational: a portrait-less speaker keeps the classic floating-line
// dialogue exactly as before, and no state ever depends on portraits.
let vnLeft: PortraitPainter | null = null;
let vnRight: PortraitPainter | null = null;
/** performance.now() deadline while the current line counts as "talking". */
let portraitTalkUntil = 0;
/** Offscreen logical-resolution buffers the portrait painters draw into. */
let vnBuf: { l: HTMLCanvasElement; r: HTMLCanvasElement } | null = null;

/** The open dialogue speaker's portrait painter, if they declare one. */
function portraitFor(speakerId: string): PortraitPainter | null {
  if (!session) return null;
  const scene = sceneOf(session);
  const def =
    (scene.characters ?? []).find((c) => c.id === speakerId) ??
    session.loaded.story.companions[speakerId];
  return def?.portrait !== undefined
    ? (session.loaded.paint.portraits?.[def.portrait] ?? null)
    : null;
}

/** The hero's portrait painter (manifest.actorPortrait), if declared. */
function actorPortrait(): PortraitPainter | null {
  if (!session) return null;
  const name = session.loaded.story.manifest.actorPortrait;
  return name !== undefined ? (session.loaded.paint.portraits?.[name] ?? null) : null;
}

/** The display name of the open dialogue's speaker, for the name tag. */
function speakerName(speakerId: string): string {
  if (!session) return '';
  const scene = sceneOf(session);
  const def =
    (scene.characters ?? []).find((c) => c.id === speakerId) ??
    session.loaded.story.companions[speakerId];
  return def?.name ?? '';
}

/** Nominal speaking time for a line — the portrait's mouth runs this long. */
function startPortraitLine(line: string): void {
  portraitTalkUntil = performance.now() + Math.min(1200 + line.length * 45, 7000);
}

// The dialogue box pulls in between the portraits so the busts stand fully
// visible at the edges (the box was covering their lower halves). On narrow
// screens where that would crush the text window below ~45% width, the
// insets drop and portraits stand behind the box as before.
let vnInsets = { l: 0, r: 0 };

function syncVnInsets(): void {
  let l = 0;
  let r = 0;
  if (session?.dialogue && vnRight) {
    const rect = el.canvas.getBoundingClientRect();
    // Portraits stand flush to the scene edges (see drawVnPortraits); the box
    // tucks just inside them. Engage only while the middle stays a usable
    // text column (≥30% of the width) — narrow/portrait screens fall back to
    // the classic full-width box under the portraits.
    const pw = rect.height * (PORTRAIT.w / PORTRAIT.h);
    const rIn = Math.round(pw + 6);
    const lIn = vnLeft ? rIn : 0;
    if (rect.width - rIn - lIn >= rect.width * 0.3) {
      l = lIn;
      r = rIn;
    }
  }
  if (l !== vnInsets.l || r !== vnInsets.r) {
    vnInsets = { l, r };
    el.dialogue.style.setProperty('--vn-inset-l', l > 0 ? `${l}px` : '0');
    el.dialogue.style.setProperty('--vn-inset-r', r > 0 ? `${r}px` : '0');
  }
}

function ensureVnBuf(): void {
  if (vnBuf) return;
  const make = (): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = PORTRAIT.w;
    c.height = PORTRAIT.h;
    return c;
  };
  vnBuf = { l: make(), r: make() };
}

/**
 * A scripted portrait beat: dim the scene, stand the speaker's close-up stage
 * right (mirrored to face the room), and caption the line under a name tag —
 * a wordless "..." reads as deliberate, not a dropped line.
 */
function drawSeqPortrait(t: number): void {
  if (!session || !seqPortrait) return;
  const W = el.overlay.width;
  const H = el.overlay.height;
  octx.fillStyle = 'rgba(10, 9, 14, 0.5)';
  octx.fillRect(0, 0, W, H);
  ensureVnBuf();
  const w = Math.round(H * (PORTRAIT.w / PORTRAIT.h));
  const rx = W - w;
  const rctx = vnBuf!.r.getContext('2d')!;
  rctx.clearRect(0, 0, PORTRAIT.w, PORTRAIT.h);
  seqPortrait.paint(rctx, session.state, t, seqPortrait.talking);
  const prevSmooth = octx.imageSmoothingEnabled;
  octx.imageSmoothingEnabled = false;
  octx.fillStyle = 'rgba(20, 18, 26, 0.55)';
  octx.fillRect(rx, 0, w, H);
  octx.save();
  octx.translate(rx + w, 0);
  octx.scale(-1, 1);
  octx.drawImage(vnBuf!.r, 0, 0, w, H);
  octx.restore();
  octx.imageSmoothingEnabled = prevSmooth;

  // Caption centred in the open area left of the portrait.
  const scale = overlayScale();
  const cx = rx / 2;
  const size = 8 * scale;
  const midY = H / 2;
  if (seqPortrait.name) {
    overlayText(octx, seqPortrait.name, cx, midY - 9 * scale, seqPortrait.color, size, 'center');
  }
  octx.font = `${Math.round(size)}px ${FONT}`;
  const lines = wrapWords(seqPortrait.text, (s) => octx.measureText(s).width <= rx - 12 * scale);
  lines.forEach((line, i) =>
    overlayText(octx, line, cx, midY + 6 * scale + i * 11 * scale, P.white, size, 'center'),
  );
}

/** Draw the VN layer on the overlay: scrim, then both standing portraits. */
function drawVnPortraits(t: number): void {
  syncVnInsets();
  if (!session?.dialogue || !vnRight) return;
  octx.fillStyle = 'rgba(10, 9, 14, 0.45)'; // dim the room; the scene waits
  octx.fillRect(0, 0, el.overlay.width, el.overlay.height);
  ensureVnBuf();
  const h = el.overlay.height;
  const w = Math.round(h * (PORTRAIT.w / PORTRAIT.h));
  const prevSmooth = octx.imageSmoothingEnabled;
  octx.imageSmoothingEnabled = false;

  // Each portrait stands on its own darker backing panel — so chroma-keyed
  // art reads as an opaque figure on a stage flat, not a translucent ghost
  // with the room showing through (Mike's note). The listener's panel is a
  // touch darker so the speaker still reads as the one talking.
  const panel = (x: number, dim: boolean): void => {
    octx.fillStyle = dim ? 'rgba(12, 11, 16, 0.72)' : 'rgba(20, 18, 26, 0.55)';
    octx.fillRect(x, 0, w, h);
  };

  if (vnLeft) {
    const lctx = vnBuf!.l.getContext('2d')!;
    lctx.clearRect(0, 0, PORTRAIT.w, PORTRAIT.h); // image portraits may be transparent
    vnLeft(lctx, session.state, t, false);
    panel(0, true); // hero listens: opaque on a slightly darker panel
    octx.drawImage(vnBuf!.l, 0, 0, w, h);
  }
  // the interlocutor speaks, stage right, mirrored to face the hero
  const talking = performance.now() < portraitTalkUntil;
  const rctx = vnBuf!.r.getContext('2d')!;
  rctx.clearRect(0, 0, PORTRAIT.w, PORTRAIT.h);
  vnRight(rctx, session.state, t, talking);
  const rx = el.overlay.width - w;
  panel(rx, false);
  octx.save();
  octx.translate(rx + w, 0);
  octx.scale(-1, 1);
  octx.drawImage(vnBuf!.r, 0, 0, w, h);
  octx.restore();
  octx.imageSmoothingEnabled = prevSmooth;
}

function renderDialogue(): void {
  vnLeft = null;
  vnRight = null;
  if (!session || !session.dialogue) {
    el.dialogue.hidden = true;
    return;
  }
  const d = session.dialogue;
  const dlg = session.loaded.story.dialogues[d.id]!;
  const node = dialogueNode(dlg, d.node);
  el.dialogue.hidden = false;
  el.dialogue.innerHTML = '';
  vnRight = portraitFor(d.speakerId);
  if (vnRight) {
    vnLeft = actorPortrait();
    // VN staging: the line lives in the box, under the speaker's name tag.
    const line = document.createElement('p');
    line.className = 'npc-line';
    const name = speakerName(d.speakerId);
    if (name) {
      const tag = document.createElement('strong');
      tag.textContent = name;
      tag.style.color = css(d.color);
      line.append(tag, ` — ${node.line}`);
    } else {
      line.textContent = node.line;
    }
    el.dialogue.append(line);
  }
  const options = visibleOptions(session.state, node);
  if (options.length === 0) {
    // Safety net: a node whose options are all condition-gated must never
    // trap the player (the validator warns about these at author time).
    options.push({ text: '(leave)', to: 'end' });
  }
  for (const option of options) {
    const btn = document.createElement('button');
    btn.textContent = option.text;
    // Options that END the conversation get one consistent marker, engine-
    // wide — the player learns the signal once (no hand-written "(leave)").
    if (option.to === 'end') btn.classList.add('dialogue-end');
    btn.addEventListener('click', () => pickOption(option));
    el.dialogue.append(btn);
  }
}

function pickOption(option: DialogueOption): void {
  if (!session || !session.dialogue) return;
  const dlg = session.loaded.story.dialogues[session.dialogue.id]!;
  const step = chooseOption(session.state, option);
  session.state = step.state;
  log(`> ${option.text}`);
  if (step.to === 'end') {
    session.dialogue = null;
  } else {
    session.dialogue.node = step.to;
    log(dialogueNode(dlg, step.to).line);
    startPortraitLine(dialogueNode(dlg, step.to).line);
  }
  save();
  renderDialogue();
  renderPanel();
}

/**
 * A canvas click during dialogue: single-option nodes are acknowledgments —
 * click anywhere to take them (Mike's "dialog isn't done" trap). Multi-choice
 * nodes still require an actual pick.
 */
function clickThroughDialogue(): void {
  if (!session || !session.dialogue) return;
  const dlg = session.loaded.story.dialogues[session.dialogue.id]!;
  const options = visibleOptions(session.state, dialogueNode(dlg, session.dialogue.node));
  if (options.length === 0) pickOption({ text: '(leave)', to: 'end' });
  else if (options.length === 1) pickOption(options[0]!);
}

// --- Panel (sentence line, verbs, inventory) --------------------------------

// The hotkey and the underlined initial are both the label's first letter.
const VERBS: { id: ArmedVerb; label: string }[] = [
  { id: 'look', label: 'Look' },
  { id: 'talk', label: 'Talk' },
  { id: 'interact', label: 'Interact' },
];

function verbKey(v: { label: string }): string {
  return v.label[0]!.toLowerCase();
}

function sentenceText(): string {
  if (!session) return ' ';
  const itemName = (id: string | null) =>
    id === null ? null : (session!.loaded.story.items[id]?.name ?? id);
  const targetName = hover?.name;
  // Exits: the sentence must promise what a click DOES — Look describes,
  // everything else travels, armed item or not.
  if (hover?.kind === 'exit') {
    return armed === 'look' ? `Look at ${targetName}` : `Go to ${targetName}`;
  }
  const held = itemName(armedItem);
  if (held !== null) {
    return `Use ${held} with ${targetName ?? '…'}`;
  }
  // Mirror what a click will actually do (kind-resolved defaults).
  const effective = hover ? resolveClickVerb(hover) : armed;
  const verbPhrase =
    effective === 'look' ? 'Look at' : effective === 'talk' ? 'Talk to' : 'Interact with';
  if (targetName) return `${verbPhrase} ${targetName}`;
  return `${verbPhrase} …`;
}

function renderSentence(): void {
  el.sentence.textContent = sentenceText();
}

function renderPanel(): void {
  el.verbs.innerHTML = '';
  for (const v of VERBS) {
    const btn = document.createElement('button');
    btn.innerHTML = `<u>${v.label.slice(0, 1)}</u>${v.label.slice(1)}`;
    btn.className = armed === v.id ? 'armed' : '';
    btn.addEventListener('click', () => armVerb(v.id));
    el.verbs.append(btn);
  }
  el.inventory.innerHTML = '';
  if (session) {
    for (const itemId of session.state.inventory) {
      const item = session.loaded.story.items[itemId];
      const selected = itemId === armedItem;
      const chip = document.createElement('button');
      chip.className = 'chip' + (selected ? ' armed' : '');
      chip.textContent = item?.name ?? itemId;
      chip.addEventListener('click', () => onItemClick(itemId));
      el.inventory.append(chip);
    }
  }
  renderObjectives();
  renderSentence();
}

function renderObjectives(): void {
  if (!session) {
    el.objectives.hidden = true;
    return;
  }
  const views = objectiveViews(session.loaded.story, session.state);
  el.objectives.hidden = views.length === 0;
  el.objectives.innerHTML = '';
  for (const view of views) {
    const p = document.createElement('p');
    p.className = view.done ? 'objective done' : 'objective';
    p.textContent = `${view.done ? '✓' : '·'} ${view.text}`;
    el.objectives.append(p);
  }
}

function armVerb(id: ArmedVerb): void {
  armed = id;
  armedItem = null;
  renderPanel();
}

function onItemClick(itemId: string): void {
  if (!session) return;
  if (armed === 'interact') {
    if (armedItem === null) {
      armedItem = itemId; // arm: "Use <item> with …"
    } else if (armedItem === itemId) {
      armedItem = null; // disarm
    } else {
      // Second item completes the sentence: combine the pair.
      const outcome = combine(session.loaded.story, session.state, armedItem, itemId);
      armedItem = null;
      handleOutcome(outcome);
      return;
    }
  } else {
    const outcome = lookAtItem(session.loaded.story, session.state, itemId);
    handleOutcome(outcome);
    return;
  }
  renderPanel();
}

// --- Canvas input -----------------------------------------------------------

/**
 * Screen position → WORLD coordinates (view scaling + camera). The camera is
 * ROUNDED to match renderScene's translate exactly, so drawn and hit-tested
 * positions can never disagree mid-lerp.
 */
function worldFromClient(clientX: number, clientY: number, rect: DOMRect): Point {
  const view = session?.view ?? { w: 320, h: 180 };
  const cam = session?.camera ?? { x: 0, y: 0 };
  return {
    x: Math.floor(((clientX - rect.left) / rect.width) * view.w + Math.round(cam.x)),
    y: Math.floor(((clientY - rect.top) / rect.height) * view.h + Math.round(cam.y)),
  };
}

function worldPoint(ev: MouseEvent): Point {
  return worldFromClient(ev.clientX, ev.clientY, el.canvas.getBoundingClientRect());
}

/** Last known mouse position, so hover can be refreshed when the camera pans under a still cursor. */
let lastMouse: { clientX: number; clientY: number } | null = null;

function updateHover(clientX: number, clientY: number): void {
  if (!session || session.beat !== null || session.dialogue || session.sequence) {
    hover = undefined;
    return;
  }
  const rect = el.canvas.getBoundingClientRect();
  const p = worldFromClient(clientX, clientY, rect);
  hover = followerTargetAt(p) ?? targetAt(sceneOf(session), session.state, p.x, p.y);
  el.canvas.style.cursor = hover ? 'pointer' : 'crosshair';
  renderSentence();
}

// Touch has no "pointer leaves": without this, the last tap's hover label
// and outline squat on screen forever (and overlap later dialogue).
let touchInput = false;
/**
 * Click-to-hurry during mandatory dialog: complete the current say/wait step
 * and fast-forward through any following non-presentational steps (waits,
 * bare effects), so the player's next click always addresses something
 * visible — a trailing pacing `wait` must never eat an action click.
 */
function hurrySequence(): void {
  if (!session || !session.sequence) return;
  const current = session.sequence.steps[session.sequence.index];
  if (current && current.walkTo !== undefined) {
    // Snap the scripted walk to its destination rather than ignoring the click.
    const who = current.who ?? 'actor';
    if (who === 'actor') {
      const end = session.path?.[session.path.length - 1];
      if (end) {
        session.actor.x = end.x;
        session.actor.y = end.y;
      }
      session.path = null;
      session.actor.walking = false;
    } else {
      snapCharWalk(who);
    }
  }
  advanceSequence();
  while (session.sequence) {
    const step = session.sequence.steps[session.sequence.index];
    if (!step || step.say !== undefined || step.walkTo !== undefined) break;
    advanceSequence();
  }
}

// A tap is a click, not a lingering hover.
// Double-click hurries any walk: snap to the destination and, if a target
// was clicked, act on it immediately (exits travel, hotspots operate).
function advanceBeat(scene: Scene): void {
  if (!session || session.beat === null) return;
  const beats = scene.beats ?? [];
  if (session.beat < beats.length - 1) {
    session.beat += 1;
    return;
  }
  if (scene.ending) {
    finish();
  } else if (scene.next !== undefined) {
    changeScene(scene.next, null);
  }
}

/** Skip whatever is skippable: speech, the running sequence, or the cutscene.
 *  Shared by the Esc key and the on-canvas skip button (touch). */
function skipCurrent(): void {
  if (!session) return;
  if (speech) speech = null;
  if (session.sequence) {
    skipSequence();
    return;
  }
  if (session.beat !== null && !session.finished) {
    // Skip the whole cutscene by advancing through every beat, so any
    // future per-beat effects still run exactly as if clicked through.
    const scene = sceneOf(session);
    let prev = -1;
    while (session.beat !== null && session.beat !== prev && !session.finished) {
      prev = session.beat;
      advanceBeat(scene);
    }
  }
}

// --- Render loop ------------------------------------------------------------

// Card backgrounds go on the pixel buffer; their TEXT goes on the crisp
// display-resolution overlay, like all other in-scene text.

function drawCutscene(scene: Scene, scale: number, t: number): void {
  if (!session || session.beat === null) return;
  const { w, h } = session.view;
  // Full-screen card: a cutscene with a painter shows its painting (drawn at
  // view size) with the beats as lower-third subtitles — the SCUMM close-up.
  const painter = scene.paint !== undefined ? session.loaded.paint.scenes?.[scene.paint] : undefined;
  if (painter) {
    painter(ctx, session.state, t);
  } else {
    ctx.fillStyle = css(P.black);
    ctx.fillRect(0, 0, w, h);
  }
  const beat = (scene.beats ?? [])[session.beat] ?? '';
  const size = 8 * scale;
  octx.font = `${Math.round(size)}px ${FONT}`;
  const maxW = w * scale * 0.86;
  const lines = wrapWords(beat, (s) => octx.measureText(s).width <= maxW);
  const yCentre = painter ? h - 26 - (lines.length - 1) * 6 : h / 2;
  const y0 = yCentre * scale - (lines.length - 1) * 6 * scale;
  lines.forEach((line, i) =>
    overlayText(octx, line, (w / 2) * scale, y0 + i * 12 * scale, P.white, size, 'center'),
  );
  if (!session.finished) {
    overlayText(octx, '· click ·', (w / 2) * scale, (h - 10) * scale, P.stoneLit, size, 'center');
  }
}

function drawEndCard(scale: number): void {
  if (!session) return;
  const { w, h } = session.view;
  ctx.fillStyle = css(P.black);
  ctx.fillRect(0, 0, w, h);
  overlayText(octx, 'The End', (w / 2) * scale, (h / 2) * scale, P.glow, 12 * scale, 'center');
  overlayText(octx, 'Restart to play again', (w / 2) * scale, (h / 2 + 16) * scale, P.stoneLit, 8 * scale, 'center');
}

function fadeAlpha(now: number): number {
  if (!fade) return 0;
  const elapsed = now - fade.t0;
  const half = FADE_MS / 2;
  if (elapsed >= half && !fade.fired) {
    fade.fired = true;
    fade.apply();
    if (!fade) return 0; // apply() may clear the fade (e.g. showMenu)
  }
  if (elapsed >= FADE_MS) {
    fade = null;
    return 0;
  }
  return elapsed < half ? elapsed / half : 2 - elapsed / half;
}

let lastTime = performance.now();

function tick(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (speech && now > speech.expires) speech = null;
  const alpha = fadeAlpha(now);
  if (session) {
    // A hovered target that no longer exists (picked up, recruited, hidden by
    // state) must not leave its outline/label behind.
    if (hover && session.beat === null) {
      const h = hover;
      const stillThere =
        h.kind === 'companion'
          ? session.followers.has(h.id)
          : sceneTargets(sceneOf(session), session.state).some(
              (t) => t.kind === h.kind && t.id === h.id,
            );
      if (!stillThere) {
        hover = undefined;
        el.canvas.style.cursor = 'crosshair';
        renderSentence();
      }
    }
    // On-canvas skip appears whenever something is skippable (touch's Esc).
    const skippable = !session.finished && (session.beat !== null || session.sequence !== null);
    if (el.btnSkip.hidden === skippable) el.btnSkip.hidden = !skippable;
    syncOverlay();
    octx.clearRect(0, 0, el.overlay.width, el.overlay.height);
    octx.globalAlpha = Math.max(0, 1 - alpha); // overlay text fades with the scene
    const scale = overlayScale();
    const scene = sceneOf(session);
    if (session.finished && !isCutscene(scene)) {
      drawEndCard(scale);
    } else if (session.beat !== null) {
      if (session.finished) drawEndCard(scale);
      else drawCutscene(scene, scale, now / 1000);
      if (alpha > 0) {
        ctx.fillStyle = rgba(P.black, alpha);
        ctx.fillRect(0, 0, session.view.w, session.view.h);
      }
    } else {
      updateWalk(dt);
      updateFollowers(dt);
      updateCharWalks(dt);
      updateSequence(now);
      updateCamera(dt);
      const sp = currentSpeech();
      // A speaker recruited mid-dialogue stays visible until the dialog ends.
      let pinnedCharacter: Character | undefined;
      if (session.dialogue && session.dialogue.speakerId !== 'actor') {
        const id = session.dialogue.speakerId;
        const scene = sceneOf(session);
        if (!visibleCharacters(scene, session.state).some((c) => c.id === id)) {
          pinnedCharacter = (scene.characters ?? []).find((c) => c.id === id);
        }
      }
      renderScene(ctx, session.loaded, session.state, {
        t: now / 1000,
        actor: session.actor,
        camera: session.camera,
        view: session.view,
        hover,
        highlight: spaceHeld || eyeLock,
        speakingId: sp?.speakerId ?? null,
        followers: followerViews(),
        pinnedCharacter,
        characterPoses: session.charPoses,
        facingOverrides: session.facingOverrides,
        fade: alpha,
      });
      if (sp) drawSpeech(octx, sp, session.camera, session.view, scale);
      if (hover && lastMouse) {
        // The hover name rides the cursor — clamped inside the view, flipping
        // to the left of the cursor near the right edge.
        const rect = el.canvas.getBoundingClientRect();
        const dpr = el.overlay.width / rect.width;
        const size = 8 * scale;
        octx.font = `${Math.round(size)}px ${FONT}`;
        const w = octx.measureText(hover.name).width;
        const pad = 4 * dpr;
        let x = (lastMouse.clientX - rect.left) * dpr + 12 * dpr;
        if (x + w > el.overlay.width - pad) x = (lastMouse.clientX - rect.left) * dpr - 12 * dpr - w;
        x = Math.min(Math.max(x, pad), Math.max(pad, el.overlay.width - w - pad));
        const y = Math.min(
          Math.max((lastMouse.clientY - rect.top) * dpr - 8 * dpr, size + pad),
          el.overlay.height - pad,
        );
        overlayText(octx, hover.name, x, y, P.glow, size);
      }
      drawVnPortraits(now / 1000); // over speech + hover; the scrim owns the frame
      drawSeqPortrait(now / 1000);
      if (session.finished) drawEndCard(scale);
    }
    octx.globalAlpha = 1;
  }
  requestAnimationFrame(tick);
}

/** Advance the running scripted sequence when its current step completes. */
function updateSequence(now: number): void {
  if (!session || !session.sequence || fade) return;
  const seq = session.sequence;
  const step = seq.steps[seq.index];
  if (!step) return;
  const done =
    step.walkTo !== undefined
      ? (step.who ?? 'actor') === 'actor'
        ? session.path === null
        : !session.charWalks.has(step.who!)
      : seq.until !== null && now >= seq.until;
  if (done) advanceSequence();
}

/** Keep the follower roster synced with state and walk them along the trail. */
function updateFollowers(dt: number): void {
  if (!session) return;
  // Recruiting happens mid-dialogue, but the JOINING should read as part of
  // completing the conversation: no follower spawns or moves while a dialog
  // is open (they fall in behind you as it closes).
  if (session.dialogue) return;
  const scene = sceneOf(session);
  const party = session.state.companions;
  for (const id of [...session.followers.keys()]) {
    if (!party.includes(id)) session.followers.delete(id);
  }
  party.forEach((id, i) => {
    if (!session!.followers.has(id)) {
      session!.followers.set(id, {
        x: session!.actor.x - 12 * (i + 1),
        y: session!.actor.y,
        facing: session!.actor.facing,
        phase: 0,
        walking: false,
      });
    }
  });
  if (session.actor.walking) pushTrail(session.trail, { x: session.actor.x, y: session.actor.y });
  let index = 0;
  for (const id of party) {
    const f = session.followers.get(id);
    if (!f) continue;
    const target = trailPointAt(session.trail, followGap(index));
    const dx = target.x - f.x;
    const dy = target.y - f.y;
    const dist = Math.hypot(dx, dy);
    const step = WALK_SPEED * depthScale(scene, f.y) * dt;
    if (dist <= Math.max(step, 1)) {
      f.x = target.x;
      f.y = target.y;
      f.walking = false;
    } else {
      f.x += (dx / dist) * step;
      f.y += (dy / dist) * step;
      f.phase += step * STEP_PHASE;
      f.walking = true;
      f.facing = facingFromDelta(dx, dy);
    }
    index++;
  }
}

function followerViews(): FollowerView[] {
  if (!session) return [];
  const views: FollowerView[] = [];
  for (const [id, pose] of session.followers) {
    views.push({ id, pose, paint: session.loaded.story.companions[id]?.paint });
  }
  return views;
}

function snapCharWalk(id: string): void {
  if (!session) return;
  const target = session.charWalks.get(id);
  const pose = session.charPoses.get(id);
  if (target && pose) {
    pose.x = target.x;
    pose.y = target.y;
    pose.walking = false;
  }
  session.charWalks.delete(id);
}

/** Move sequence-scripted characters toward their destinations. */
function updateCharWalks(dt: number): void {
  if (!session) return;
  const scene = sceneOf(session);
  for (const [id, target] of session.charWalks) {
    const pose = session.charPoses.get(id);
    if (!pose) {
      session.charWalks.delete(id);
      continue;
    }
    const dx = target.x - pose.x;
    const dy = target.y - pose.y;
    const dist = Math.hypot(dx, dy);
    const step = WALK_SPEED * depthScale(scene, pose.y) * dt;
    if (dist <= step) {
      snapCharWalk(id);
      continue;
    }
    pose.x += (dx / dist) * step;
    pose.y += (dy / dist) * step;
    pose.phase += step * STEP_PHASE;
    pose.walking = true;
    pose.facing = facingFromDelta(dx, dy);
  }
}

function updateCamera(dt: number): void {
  if (!session) return;
  const target = cameraTargetFor(session);
  const k = Math.min(CAMERA_LERP * dt, 1);
  const before = Math.round(session.camera.x) + Math.round(session.camera.y) * 1e5;
  session.camera.x += (target.x - session.camera.x) * k;
  session.camera.y += (target.y - session.camera.y) * k;
  // The world moved under a stationary cursor: refresh the hover affordance
  // so the label/outline always describe what a click would actually hit.
  const after = Math.round(session.camera.x) + Math.round(session.camera.y) * 1e5;
  if (before !== after && lastMouse) updateHover(lastMouse.clientX, lastMouse.clientY);
}

function updateWalk(dt: number): void {
  if (!session || !session.path || session.path.length === 0) {
    if (session) session.actor.walking = false;
    return;
  }
  const a = session.actor;
  const t = session.path[0]!;
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const dist = Math.hypot(dx, dy);
  const step = WALK_SPEED * depthScale(sceneOf(session), a.y) * dt;
  if (dist <= step) {
    a.x = t.x;
    a.y = t.y;
    session.path.shift();
    if (session.path.length === 0) {
      a.walking = false;
      session.path = null;
      runPending();
    }
    return;
  }
  a.x += (dx / dist) * step;
  a.y += (dy / dist) * step;
  a.phase += step * STEP_PHASE;
  a.walking = true;
  a.facing = facingFromDelta(dx, dy);
}

// --- Debug hook (read-only; used by headless verification and humans) -------

declare global {
  interface Window {
    __pcc?: () => object | null;
  }
}
window.__pcc = () =>
  session
    ? {
        scene: session.state.scene,
        state: session.state,
        actor: { x: session.actor.x, y: session.actor.y, facing: session.actor.facing },
        camera: { ...session.camera },
        view: { ...session.view },
        beat: session.beat,
        dialogue: session.dialogue ? { id: session.dialogue.id, node: session.dialogue.node } : null,
        sequence: session.sequence !== null,
        speech: currentSpeech()?.text ?? null,
        portraitBeat: seqPortrait ? { name: seqPortrait.name, text: seqPortrait.text } : null,
        followers: [...session.followers.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y })),
        vnPortraits: (vnLeft ? 1 : 0) + (vnRight ? 1 : 0),
        finished: session.finished,
      }
    : null;

// --- Boot -------------------------------------------------------------------

function wireInput(): void {
  el.canvas.addEventListener('pointerdown', (ev) => {
    touchInput = ev.pointerType === 'touch';
  });

  el.canvas.addEventListener('mousemove', (ev) => {
    lastMouse = { clientX: ev.clientX, clientY: ev.clientY };
    updateHover(ev.clientX, ev.clientY);
  });

  el.canvas.addEventListener('click', (ev) => {
    if (!session) return;
    if (session.finished) {
      showMenu(); // the end card's click-anywhere response
      return;
    }
    if (session.dialogue) {
      clickThroughDialogue(); // single-option acknowledgments click through
      return;
    }
    if (session.sequence) {
      // Hurrying works even during the fade-in — a running sequence means the
      // scene switch already happened, and arrival clicks must never be eaten.
      hurrySequence();
      return;
    }
    // Only the fade-OUT (pre-switch) blocks input; once the switch has fired,
    // beats/clicks act normally so no arrival click is ever lost.
    if (fade && !fade.fired) return;
    if (speech) speech = null; // click skips the line
    const scene = sceneOf(session);
    if (session.beat !== null) {
      advanceBeat(scene);
      return;
    }
    const p = worldPoint(ev);
    const boxes = walkBoxes(scene);
    const target = followerTargetAt(p) ?? targetAt(scene, session.state, p.x, p.y);
    if (!target) {
      session.path = findPath({ x: session.actor.x, y: session.actor.y }, p, boxes);
      session.pending = null;
      return;
    }
    // Looking at an exit describes it — it must never surprise-travel.
    if (target.kind === 'exit' && armed === 'look') {
      const exit = (scene.exits ?? []).find((e) => e.id === target.id);
      say(exit?.look ?? `That way: ${target.name}.`, actorHead(), P.glow, 'actor');
      disarmVerb(); // this resolved an interaction too — one-shot like the rest
      return;
    }
    const action: PendingAction =
      target.kind === 'exit'
        ? { kind: 'verb', verb: 'interact' }
        : armedItem !== null && armed === 'interact'
          ? { kind: 'apply', itemId: armedItem }
          : { kind: 'verb', verb: resolveClickVerb(target) };
    session.path = findPath({ x: session.actor.x, y: session.actor.y }, target.walkTo, boxes);
    session.pending = { target, action };
  });

  el.canvas.addEventListener('click', () => {
    if (touchInput) {
      hover = undefined;
      lastMouse = null;
      renderSentence();
    }
  });

  el.canvas.addEventListener('dblclick', () => {
    if (!session || session.finished || session.dialogue || session.sequence || fade || session.beat !== null) return;
    const end = session.path?.[session.path.length - 1];
    if (!end) return;
    session.actor.x = end.x;
    session.actor.y = end.y;
    session.path = null;
    session.actor.walking = false;
    session.camera = cameraTargetFor(session); // no slow pan after a snap
    runPending();
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space') {
      spaceHeld = true;
      if (ev.target === document.body) ev.preventDefault();
      return;
    }
    if (!session) return;
    if (ev.key === 'Escape') {
      skipCurrent();
      return;
    }
    if (session.dialogue) return;
    const verb = VERBS.find((v) => verbKey(v) === ev.key.toLowerCase());
    if (verb && !ev.metaKey && !ev.ctrlKey && !ev.altKey) armVerb(verb.id);
  });

  window.addEventListener('keyup', (ev) => {
    if (ev.code === 'Space') spaceHeld = false;
  });

  el.btnSkip.addEventListener('click', skipCurrent);
  el.btnLog.addEventListener('click', () => {
    el.log.hidden = !el.log.hidden;
    el.btnLog.textContent = el.log.hidden ? 'history ▸' : 'history ▾';
    if (!el.log.hidden) el.log.scrollTop = el.log.scrollHeight;
  });

  el.btnEye.addEventListener('click', () => {
    eyeLock = !eyeLock;
    el.btnEye.classList.toggle('armed', eyeLock);
  });

  el.btnMute.addEventListener('click', () => {
    audio.ensureRunning();
    el.btnMute.textContent = audio.toggleMute() ? '♪̸' : '♪';
    el.btnMute.classList.toggle('secondary', audio.isMuted());
  });

  el.btnMenu.addEventListener('click', showMenu);
  el.btnRestart.addEventListener('click', () => {
    if (session) {
      localStorage.removeItem(saveKey(session.id));
      startStory(session.id, null);
    }
  });
}

/**
 * Start Membrillo: hand it the story files your game bundled.
 *
 *   boot({
 *     json:   import.meta.glob('./stories/(star)(star)/(star).json', { eager: true, import: 'default' }),
 *     paints: import.meta.glob('./stories/(star)/paint/index.ts', { eager: true }),
 *   });
 */
export function boot(sources: StorySources): void {
  stories = loadStories(sources);
  initDom();
  wireInput();
  // Re-measure cached text once the pixel font finishes loading (early frames
  // fall back to system monospace with different metrics).
  document.fonts?.ready.then(resetTextCache);

  // Reflect the persisted mute state on the button.
  if (audio.isMuted()) {
    el.btnMute.textContent = '♪̸';
    el.btnMute.classList.add('secondary');
  }

  const bootQuery = new URLSearchParams(location.search);
  const bootStory = bootQuery.get('story');
  if (bootStory && stories.has(bootStory)) {
    const loaded = stories.get(bootStory)!;
    startStory(bootStory, debugState(loaded) ?? loadSave(bootStory));
  } else {
    showMenu();
  }
  requestAnimationFrame(tick);
}
