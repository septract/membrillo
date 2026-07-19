// Browser controller: story menu, the four-verb UI, click-to-walk, dialogue
// and cutscene overlays, saves, and the render loop. All game *rules* live in
// core/ — this file only sequences outcomes the core produces.
//
// SCUMM-style presentation: speech floats over the speaker's head (the DOM log
// is a secondary transcript), sprites scale with depth and animate by pose,
// the actor paths through walkboxes and behind props, room changes fade, and
// a following camera lets scenes be larger than the story's view resolution.

import type { Character, Point, Scene, Size, State } from './core/types.ts';
import { initialState } from './core/rules.ts';
import {
  act,
  applyItem,
  chooseOption,
  combine,
  currentScene,
  dialogueNode,
  enterScene,
  isCutscene,
  lookAtItem,
  useExit,
  visibleCharacters,
  visibleOptions,
  type PlayerVerb,
} from './core/verbs.ts';
import { loadStories, type LoadedStory } from './loader.ts';
import {
  renderScene,
  sceneSize,
  storyView,
  targetAt,
  wrapWords,
  type ActorPose,
  type Speech,
  type TargetRef,
} from './render.ts';
import { depthScale, findPath, walkBoxes } from './walk.ts';
import { P, css, rgba, type RGB } from './art/palette.ts';
import {
  ACTOR_SPEECH_OFFSET,
  CHARACTER_SPEECH_OFFSET,
  type Facing,
} from './art/sprites.ts';
import type { Outcome } from './core/rules.ts';

type ArmedVerb = PlayerVerb | 'combine';

type PendingAction = { kind: 'verb'; verb: PlayerVerb } | { kind: 'apply'; itemId: string };

interface Pending {
  target: TargetRef;
  action: PendingAction;
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
  finished: boolean;
}

const WALK_SPEED = 80; // px/s at scale 1
const STEP_PHASE = 0.45; // walk-cycle radians per px covered
const SPEECH_MS_MIN = 1600;
const SPEECH_MS_PER_CHAR = 55;
const FADE_MS = 440;
const CAMERA_LERP = 5; // 1/s
const stories = loadStories();

// --- DOM skeleton -----------------------------------------------------------

const app = document.getElementById('app')!;
app.innerHTML = `
  <header>
    <h1 id="title">Point &amp; Click</h1>
    <nav><button id="btn-menu">Stories</button><button id="btn-restart" hidden>Restart</button></nav>
  </header>
  <div id="menu"></div>
  <div id="game" hidden>
    <div class="stage">
      <canvas id="view"></canvas>
      <div id="hoverlabel" hidden></div>
      <div id="dialogue" hidden></div>
    </div>
    <div class="panel">
      <div id="sentence">&nbsp;</div>
      <div id="verbs"></div>
      <div id="inventory"></div>
      <div id="log"></div>
    </div>
  </div>`;

const el = {
  title: document.getElementById('title')!,
  menu: document.getElementById('menu')!,
  game: document.getElementById('game')!,
  canvas: document.getElementById('view') as HTMLCanvasElement,
  hoverlabel: document.getElementById('hoverlabel')!,
  dialogue: document.getElementById('dialogue')!,
  sentence: document.getElementById('sentence')!,
  verbs: document.getElementById('verbs')!,
  inventory: document.getElementById('inventory')!,
  log: document.getElementById('log')!,
  btnMenu: document.getElementById('btn-menu')!,
  btnRestart: document.getElementById('btn-restart')!,
};
const ctx = el.canvas.getContext('2d')!;

let session: Session | null = null;
let armed: ArmedVerb = 'look';
let armedItem: string | null = null;
let combineSel: string[] = [];
let hover: TargetRef | undefined;
let highlight = false;
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

function showMenu(): void {
  session = null;
  speech = null;
  fade = null;
  el.game.hidden = true;
  el.btnRestart.hidden = true;
  el.menu.hidden = false;
  el.title.textContent = 'Point & Click';
  el.menu.innerHTML = '';
  for (const [id, loaded] of stories) {
    const row = document.createElement('div');
    row.className = 'story-row';
    const play = document.createElement('button');
    play.textContent = loaded.story.manifest.title;
    play.addEventListener('click', () => startStory(id, null));
    row.append(play);
    if (loadSave(id)) {
      const cont = document.createElement('button');
      cont.textContent = 'Continue';
      cont.className = 'secondary';
      cont.addEventListener('click', () => startStory(id, loadSave(id)));
      row.append(cont);
    }
    el.menu.append(row);
  }
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
  el.title.textContent = loaded.story.manifest.title;
  el.log.innerHTML = '';
  el.canvas.width = view.w;
  el.canvas.height = view.h;
  el.canvas.style.aspectRatio = `${view.w} / ${view.h}`;
  ctx.imageSmoothingEnabled = false;
  armed = 'look';
  armedItem = null;
  combineSel = [];
  speech = null;
  fade = null;
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

function placeInScene(scene: Scene, entry: Point | null): void {
  if (!session) return;
  session.path = null;
  session.pending = null;
  session.dialogue = null;
  renderDialogue();
  speech = null;
  hover = undefined;
  el.hoverlabel.hidden = true;
  if (isCutscene(scene)) {
    session.beat = 0;
  } else {
    session.beat = null;
    const at = entry ?? scene.start ?? { x: session.view.w / 2, y: session.view.h - 20 };
    session.actor = { ...session.actor, x: at.x, y: at.y, walking: false };
    session.camera = cameraTargetFor(session); // snap, don't pan, on entry
  }
  save();
}

function changeSceneNow(sceneId: string, entry: Point | null): void {
  if (!session) return;
  session.state = enterScene(session.state, sceneId);
  const scene = sceneOf(session);
  if (scene.ending && !isCutscene(scene)) {
    finish();
    return;
  }
  placeInScene(scene, entry);
  renderPanel();
}

/** Room changes go through a fade; the switch happens at full black. */
function changeScene(sceneId: string, entry: Point | null): void {
  fade = {
    t0: performance.now(),
    fired: false,
    apply: () => changeSceneNow(sceneId, entry),
  };
}

function finish(): void {
  if (!session) return;
  session.finished = true;
  localStorage.removeItem(saveKey(session.id));
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
  return { x: c.pos.x, y: c.pos.y - CHARACTER_SPEECH_OFFSET * depthScale(scene, c.pos.y) };
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
    // A talking hotspot (intercom, door grille): float above its region.
    return {
      anchor: { x: target.region.x + target.region.w / 2, y: target.region.y - 6 },
      color: P.white,
      id: target.id,
    };
  }
  return { anchor: actorHead(), color: P.glow, id: 'actor' };
}

/** The speech to show this frame: the open dialogue's line, else the transient bark. */
function currentSpeech(): (Speech & { speakerId: string }) | null {
  if (session?.dialogue) {
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

// --- Outcome handling -------------------------------------------------------

function handleOutcome(outcome: Outcome, target?: TargetRef): void {
  if (!session) return;
  session.state = outcome.state;
  if (outcome.text !== undefined) {
    const who = speakerFor(outcome.speaker === 'target' ? target : undefined);
    say(outcome.text, who.anchor, who.color, who.id);
  }
  if (outcome.dialogue !== undefined) openDialogue(outcome.dialogue, target);
  if (outcome.goto !== undefined) changeScene(outcome.goto, null);
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

function runPending(): void {
  if (!session || !session.pending) return;
  const { target, action } = session.pending;
  session.pending = null;
  faceTarget(target);
  if (target.kind === 'exit') {
    const scene = sceneOf(session);
    const exit = (scene.exits ?? []).find((e) => e.id === target.id);
    // useExit validates the gate; the actual switch happens at fade midpoint,
    // so the state (and the render) stay in this scene until then.
    if (exit && useExit(session.loaded.story, session.state, target.id)) {
      changeScene(exit.to, exit.entry ?? null);
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
  renderDialogue();
}

function renderDialogue(): void {
  if (!session || !session.dialogue) {
    el.dialogue.hidden = true;
    return;
  }
  const d = session.dialogue;
  const dlg = session.loaded.story.dialogues[d.id]!;
  const node = dialogueNode(dlg, d.node);
  el.dialogue.hidden = false;
  el.dialogue.innerHTML = '';
  for (const option of visibleOptions(session.state, node)) {
    const btn = document.createElement('button');
    btn.textContent = option.text;
    btn.addEventListener('click', () => {
      if (!session || !session.dialogue) return;
      const step = chooseOption(session.state, option);
      session.state = step.state;
      log(`> ${option.text}`);
      if (step.to === 'end') {
        session.dialogue = null;
      } else {
        session.dialogue.node = step.to;
        log(dialogueNode(dlg, step.to).line);
      }
      save();
      renderDialogue();
      renderPanel();
    });
    el.dialogue.append(btn);
  }
}

// --- Panel (sentence line, verbs, inventory) --------------------------------

// The hotkey and the underlined initial are both the label's first letter.
const VERBS: { id: ArmedVerb; label: string }[] = [
  { id: 'look', label: 'Look' },
  { id: 'talk', label: 'Talk' },
  { id: 'interact', label: 'Interact' },
  { id: 'combine', label: 'Combine' },
];

function verbKey(v: { label: string }): string {
  return v.label[0]!.toLowerCase();
}

function sentenceText(): string {
  if (!session) return ' ';
  const itemName = (id: string | null) =>
    id === null ? null : (session!.loaded.story.items[id]?.name ?? id);
  const targetName = hover?.name;
  if (armed === 'combine') {
    const parts = combineSel.map((i) => itemName(i));
    return `Combine ${parts[0] ?? '…'} with ${parts[1] ?? '…'}`;
  }
  const held = itemName(armedItem);
  if (held !== null) {
    return `Use ${held} on ${targetName ?? '…'}`;
  }
  const verbPhrase =
    armed === 'look' ? 'Look at' : armed === 'talk' ? 'Talk to' : 'Interact with';
  if (targetName) return hover!.kind === 'exit' ? `Go to ${targetName}` : `${verbPhrase} ${targetName}`;
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
      const selected = itemId === armedItem || combineSel.includes(itemId);
      const chip = document.createElement('button');
      chip.className = 'chip' + (selected ? ' armed' : '');
      chip.textContent = item?.name ?? itemId;
      chip.addEventListener('click', () => onItemClick(itemId));
      el.inventory.append(chip);
    }
  }
  renderSentence();
}

function armVerb(id: ArmedVerb): void {
  armed = id;
  armedItem = null;
  combineSel = [];
  renderPanel();
}

function onItemClick(itemId: string): void {
  if (!session) return;
  if (armed === 'combine') {
    combineSel = combineSel.includes(itemId)
      ? combineSel.filter((x) => x !== itemId)
      : [...combineSel, itemId];
    if (combineSel.length === 2) {
      const outcome = combine(session.loaded.story, session.state, combineSel[0]!, combineSel[1]!);
      combineSel = [];
      handleOutcome(outcome);
      return;
    }
  } else if (armed === 'interact') {
    // Arm the item: the next scene click is "use <item> on <target>".
    armedItem = armedItem === itemId ? null : itemId;
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
  if (!session || session.beat !== null || session.dialogue) {
    hover = undefined;
    el.hoverlabel.hidden = true;
    return;
  }
  const rect = el.canvas.getBoundingClientRect();
  const p = worldFromClient(clientX, clientY, rect);
  hover = targetAt(sceneOf(session), session.state, p.x, p.y);
  if (hover) {
    el.hoverlabel.hidden = false;
    el.hoverlabel.textContent = hover.name;
    const stage = el.canvas.parentElement!.getBoundingClientRect();
    el.hoverlabel.style.left = `${clientX - stage.left + 12}px`;
    el.hoverlabel.style.top = `${clientY - rect.top - 8}px`;
  } else {
    el.hoverlabel.hidden = true;
  }
  renderSentence();
}

el.canvas.addEventListener('mousemove', (ev) => {
  lastMouse = { clientX: ev.clientX, clientY: ev.clientY };
  updateHover(ev.clientX, ev.clientY);
});

el.canvas.addEventListener('click', (ev) => {
  if (!session || session.finished || session.dialogue || fade) return;
  if (speech) speech = null; // click skips the line
  const scene = sceneOf(session);
  if (session.beat !== null) {
    advanceBeat(scene);
    return;
  }
  const p = worldPoint(ev);
  const boxes = walkBoxes(scene);
  const target = targetAt(scene, session.state, p.x, p.y);
  if (!target) {
    session.path = findPath({ x: session.actor.x, y: session.actor.y }, p, boxes);
    session.pending = null;
    return;
  }
  if (armed === 'combine') {
    say('Combine works on two inventory items — pick them below.', actorHead(), P.glow, 'actor');
    return;
  }
  const action: PendingAction =
    target.kind === 'exit'
      ? { kind: 'verb', verb: 'interact' }
      : armedItem !== null && armed === 'interact'
        ? { kind: 'apply', itemId: armedItem }
        : { kind: 'verb', verb: armed };
  session.path = findPath({ x: session.actor.x, y: session.actor.y }, target.walkTo, boxes);
  session.pending = { target, action };
});

// Double-click an exit: skip the walk, travel now.
el.canvas.addEventListener('dblclick', () => {
  if (!session || session.finished || session.dialogue || fade || session.beat !== null) return;
  const pending = session.pending;
  if (pending && pending.target.kind === 'exit') {
    session.actor.x = pending.target.walkTo.x;
    session.actor.y = pending.target.walkTo.y;
    session.path = null;
    session.actor.walking = false;
    runPending();
  }
});

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

window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space') {
    highlight = true;
    if (ev.target === document.body) ev.preventDefault();
    return;
  }
  if (!session) return;
  if (ev.key === 'Escape') {
    if (speech) speech = null;
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
    return;
  }
  if (session.dialogue) return;
  const verb = VERBS.find((v) => verbKey(v) === ev.key.toLowerCase());
  if (verb && !ev.metaKey && !ev.ctrlKey && !ev.altKey) armVerb(verb.id);
});
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'Space') highlight = false;
});

el.btnMenu.addEventListener('click', showMenu);
el.btnRestart.addEventListener('click', () => {
  if (session) {
    localStorage.removeItem(saveKey(session.id));
    startStory(session.id, null);
  }
});

// --- Render loop ------------------------------------------------------------

function drawCutscene(scene: Scene): void {
  if (!session || session.beat === null) return;
  const { w, h } = session.view;
  ctx.fillStyle = css(P.black);
  ctx.fillRect(0, 0, w, h);
  const beat = (scene.beats ?? [])[session.beat] ?? '';
  ctx.fillStyle = css(P.white);
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  const max = Math.floor(w / 5.5);
  const lines = wrapWords(beat, (s) => s.length <= max);
  const y0 = h / 2 - (lines.length - 1) * 6;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, y0 + i * 12));
  ctx.fillStyle = css(P.stoneLit);
  ctx.fillText(session.finished ? '' : '· click ·', w / 2, h - 10);
  ctx.textAlign = 'left';
}

function drawEndCard(): void {
  if (!session) return;
  const { w, h } = session.view;
  ctx.fillStyle = css(P.black);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css(P.glow);
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('The End', w / 2, h / 2);
  ctx.fillStyle = css(P.stoneLit);
  ctx.font = '8px monospace';
  ctx.fillText('Restart to play again', w / 2, h / 2 + 16);
  ctx.textAlign = 'left';
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
    const scene = sceneOf(session);
    if (session.finished && !isCutscene(scene)) {
      drawEndCard();
    } else if (session.beat !== null) {
      if (session.finished) drawEndCard();
      else drawCutscene(scene);
      if (alpha > 0) {
        ctx.fillStyle = rgba(P.black, alpha);
        ctx.fillRect(0, 0, session.view.w, session.view.h);
      }
    } else {
      updateWalk(dt);
      updateCamera(dt);
      const sp = currentSpeech();
      renderScene(ctx, session.loaded, session.state, {
        t: now / 1000,
        actor: session.actor,
        camera: session.camera,
        view: session.view,
        hover,
        highlight,
        speech: sp,
        speakingId: sp?.speakerId ?? null,
        fade: alpha,
      });
      if (session.finished) drawEndCard();
    }
  }
  requestAnimationFrame(tick);
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
        finished: session.finished,
      }
    : null;

// --- Boot -------------------------------------------------------------------

const bootQuery = new URLSearchParams(location.search);
const bootStory = bootQuery.get('story');
if (bootStory && stories.has(bootStory)) {
  const loaded = stories.get(bootStory)!;
  startStory(bootStory, debugState(loaded) ?? loadSave(bootStory));
} else {
  showMenu();
}
requestAnimationFrame(tick);
