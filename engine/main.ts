// Browser controller: story menu, the four-verb UI, click-to-walk, dialogue
// and cutscene overlays, saves, and the render loop. All game *rules* live in
// core/ — this file only sequences outcomes the core produces.
//
// SCUMM-style presentation: speech floats over the speaker's head (the DOM log
// is a secondary transcript), sprites scale with depth, the actor paths
// through walkboxes and behind props, and room changes fade.

import type { Character, Point, Scene, State } from './core/types.ts';
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
  targetAt,
  VIEW_H,
  VIEW_W,
  type ActorPose,
  type Speech,
  type TargetRef,
} from './render.ts';
import { clampToWalkable, depthScale, findPath, walkBoxes } from './walk.ts';
import { P, type RGB } from './art/palette.ts';
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
  state: State;
  actor: ActorPose;
  /** Remaining walk waypoints. */
  path: Point[] | null;
  pending: Pending | null;
  /** Open dialogue, if any; speaker anchors the floating line. */
  dialogue: { id: string; node: string; anchor: Point; color: RGB } | null;
  /** Cutscene beat index, if the current scene is a cutscene. */
  beat: number | null;
  finished: boolean;
}

const WALK_SPEED = 80; // px/s at scale 1
const SPEECH_MS_MIN = 1600;
const SPEECH_MS_PER_CHAR = 55;
const FADE_MS = 440;
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
      <canvas id="view" width="${VIEW_W}" height="${VIEW_H}"></canvas>
      <div id="hoverlabel" hidden></div>
      <div id="dialogue" hidden></div>
    </div>
    <div class="panel">
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
  verbs: document.getElementById('verbs')!,
  inventory: document.getElementById('inventory')!,
  log: document.getElementById('log')!,
  btnMenu: document.getElementById('btn-menu')!,
  btnRestart: document.getElementById('btn-restart')!,
};
const ctx = el.canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

let session: Session | null = null;
let armed: ArmedVerb = 'look';
let armedItem: string | null = null;
let combineSel: string[] = [];
let hover: TargetRef | undefined;
let highlight = false;
let speech: (Speech & { expires: number | null }) | null = null;
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
  return raw ? (JSON.parse(raw) as State) : null;
}

function debugState(loaded: LoadedStory): State | null {
  const q = new URLSearchParams(location.search);
  const start = q.get('start');
  if (!start && !q.get('flags') && !q.get('items')) return null;
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
  el.menu.hidden = true;
  el.game.hidden = false;
  el.btnRestart.hidden = false;
  el.title.textContent = loaded.story.manifest.title;
  el.log.innerHTML = '';
  armed = 'look';
  armedItem = null;
  combineSel = [];
  speech = null;
  fade = null;
  session = {
    id,
    loaded,
    state: state ?? initialState(loaded.story.manifest.start),
    actor: { x: 0, y: 0, facing: 'right', walking: false },
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

function placeInScene(scene: Scene, entry: Point | null): void {
  if (!session) return;
  session.path = null;
  session.pending = null;
  speech = null;
  hover = undefined;
  el.hoverlabel.hidden = true;
  if (isCutscene(scene)) {
    session.beat = 0;
  } else {
    session.beat = null;
    const at = entry ?? scene.start ?? { x: VIEW_W / 2, y: VIEW_H - 20 };
    session.actor = { ...session.actor, x: at.x, y: at.y, walking: false };
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

function say(text: string, anchor: Point, color: RGB, sticky = false): void {
  speech = {
    text,
    color,
    x: anchor.x,
    y: anchor.y,
    expires: sticky ? null : performance.now() + Math.min(SPEECH_MS_MIN + text.length * SPEECH_MS_PER_CHAR, 7000),
  };
  log(text);
}

function actorHead(): Point {
  if (!session) return { x: VIEW_W / 2, y: VIEW_H / 2 };
  const scale = depthScale(sceneOf(session), session.actor.y);
  return { x: session.actor.x, y: session.actor.y - 44 * scale };
}

function characterHead(scene: Scene, c: Character): Point {
  return { x: c.pos.x, y: c.pos.y - 46 * depthScale(scene, c.pos.y) };
}

// --- Outcome handling -------------------------------------------------------

function handleOutcome(outcome: Outcome, speaker: Point): void {
  if (!session) return;
  session.state = outcome.state;
  if (outcome.text !== undefined) say(outcome.text, speaker, P.glow);
  if (outcome.dialogue !== undefined) openDialogue(outcome.dialogue);
  if (outcome.goto !== undefined) changeScene(outcome.goto, null);
  save();
  renderPanel();
}

function runPending(): void {
  if (!session || !session.pending) return;
  const { target, action } = session.pending;
  session.pending = null;
  if (target.kind === 'exit') {
    const scene = sceneOf(session);
    const exit = (scene.exits ?? []).find((e) => e.id === target.id);
    const next = useExit(session.loaded.story, session.state, target.id);
    if (next && exit) {
      session.state = next;
      changeScene(exit.to, exit.entry ?? null);
    }
    return;
  }
  const outcome =
    action.kind === 'apply'
      ? applyItem(session.loaded.story, session.state, target.id, action.itemId)
      : act(session.loaded.story, session.state, target.id, action.verb);
  if (action.kind === 'apply') armedItem = null;
  if (outcome) handleOutcome(outcome, actorHead());
}

// --- Dialogue ---------------------------------------------------------------

function openDialogue(dlgId: string): void {
  if (!session) return;
  const dlg = session.loaded.story.dialogues[dlgId];
  if (!dlg) return;
  const scene = sceneOf(session);
  // Anchor the floating line over whichever visible character talks this tree.
  const speaker = visibleCharacters(scene, session.state).find((c) =>
    (c.talk ?? []).some((r) => r.dialogue === dlgId),
  );
  const anchor = speaker ? characterHead(scene, speaker) : actorHead();
  const color: RGB = speaker?.color ?? P.white;
  session.dialogue = { id: dlgId, node: dlg.start, anchor, color };
  renderDialogue();
}

function renderDialogue(): void {
  if (!session || !session.dialogue) {
    el.dialogue.hidden = true;
    if (speech && speech.expires === null) speech = null;
    return;
  }
  const d = session.dialogue;
  const dlg = session.loaded.story.dialogues[d.id]!;
  const node = dialogueNode(dlg, d.node);
  say(node.line, d.anchor, d.color, true);
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
      }
      save();
      renderDialogue();
      renderPanel();
    });
    el.dialogue.append(btn);
  }
}

// --- Panel (verbs + inventory) ----------------------------------------------

const VERBS: { id: ArmedVerb; label: string }[] = [
  { id: 'look', label: 'Look' },
  { id: 'talk', label: 'Talk' },
  { id: 'interact', label: 'Interact' },
  { id: 'combine', label: 'Combine' },
];

function renderPanel(): void {
  el.verbs.innerHTML = '';
  for (const v of VERBS) {
    const btn = document.createElement('button');
    btn.textContent = v.label;
    btn.className = armed === v.id ? 'armed' : '';
    btn.addEventListener('click', () => {
      armed = v.id;
      armedItem = null;
      combineSel = [];
      renderPanel();
    });
    el.verbs.append(btn);
  }
  el.inventory.innerHTML = '';
  if (!session) return;
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

function onItemClick(itemId: string): void {
  if (!session) return;
  if (armed === 'combine') {
    combineSel = combineSel.includes(itemId)
      ? combineSel.filter((x) => x !== itemId)
      : [...combineSel, itemId];
    if (combineSel.length === 2) {
      const outcome = combine(session.loaded.story, session.state, combineSel[0]!, combineSel[1]!);
      combineSel = [];
      handleOutcome(outcome, actorHead());
      return;
    }
  } else if (armed === 'interact') {
    // Arm the item: the next scene click is "use <item> on <target>".
    armedItem = armedItem === itemId ? null : itemId;
  } else {
    const outcome = lookAtItem(session.loaded.story, session.state, itemId);
    handleOutcome(outcome, actorHead());
    return;
  }
  renderPanel();
}

// --- Canvas input -----------------------------------------------------------

function canvasPoint(ev: MouseEvent): Point {
  const rect = el.canvas.getBoundingClientRect();
  return {
    x: Math.floor(((ev.clientX - rect.left) / rect.width) * VIEW_W),
    y: Math.floor(((ev.clientY - rect.top) / rect.height) * VIEW_H),
  };
}

el.canvas.addEventListener('mousemove', (ev) => {
  if (!session || session.beat !== null || session.dialogue) {
    hover = undefined;
    el.hoverlabel.hidden = true;
    return;
  }
  const p = canvasPoint(ev);
  hover = targetAt(sceneOf(session), session.state, p.x, p.y);
  if (hover) {
    const item = armedItem !== null ? session.loaded.story.items[armedItem] : null;
    el.hoverlabel.hidden = false;
    el.hoverlabel.textContent = item ? `use ${item.name} on ${hover.name}` : hover.name;
    const rect = el.canvas.getBoundingClientRect();
    const stage = el.canvas.parentElement!.getBoundingClientRect();
    el.hoverlabel.style.left = `${ev.clientX - stage.left + 12}px`;
    el.hoverlabel.style.top = `${ev.clientY - rect.top - 8}px`;
  } else {
    el.hoverlabel.hidden = true;
  }
});

el.canvas.addEventListener('click', (ev) => {
  if (!session || session.finished || session.dialogue || fade) return;
  const scene = sceneOf(session);
  if (session.beat !== null) {
    advanceBeat(scene);
    return;
  }
  const p = canvasPoint(ev);
  const boxes = walkBoxes(scene);
  const target = targetAt(scene, session.state, p.x, p.y);
  if (!target) {
    session.path = findPath({ x: session.actor.x, y: session.actor.y }, p, boxes);
    session.pending = null;
    return;
  }
  if (armed === 'combine') {
    say('Combine works on two inventory items — pick them below.', actorHead(), P.glow);
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
  }
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

function wrapLines(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (candidate.length > max && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function drawCutscene(scene: Scene): void {
  if (!session || session.beat === null) return;
  ctx.fillStyle = `rgb(${P.black[0]},${P.black[1]},${P.black[2]})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const beat = (scene.beats ?? [])[session.beat] ?? '';
  ctx.fillStyle = `rgb(${P.white[0]},${P.white[1]},${P.white[2]})`;
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  const lines = wrapLines(beat, 60);
  const y0 = VIEW_H / 2 - (lines.length - 1) * 6;
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y0 + i * 12));
  ctx.fillStyle = `rgb(${P.stoneLit[0]},${P.stoneLit[1]},${P.stoneLit[2]})`;
  ctx.fillText(session.finished ? '' : '· click ·', VIEW_W / 2, VIEW_H - 10);
  ctx.textAlign = 'left';
}

function drawEndCard(): void {
  ctx.fillStyle = `rgb(${P.black[0]},${P.black[1]},${P.black[2]})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = `rgb(${P.glow[0]},${P.glow[1]},${P.glow[2]})`;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('The End', VIEW_W / 2, VIEW_H / 2);
  ctx.fillStyle = `rgb(${P.stoneLit[0]},${P.stoneLit[1]},${P.stoneLit[2]})`;
  ctx.font = '8px monospace';
  ctx.fillText('Restart to play again', VIEW_W / 2, VIEW_H / 2 + 16);
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
  if (speech && speech.expires !== null && now > speech.expires) speech = null;
  const alpha = fadeAlpha(now);
  if (session) {
    const scene = sceneOf(session);
    if (session.finished && !isCutscene(scene)) {
      drawEndCard();
    } else if (session.beat !== null) {
      if (session.finished) drawEndCard();
      else drawCutscene(scene);
      if (alpha > 0) {
        ctx.fillStyle = `rgba(16,14,20,${alpha})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    } else {
      updateWalk(dt);
      renderScene(ctx, session.loaded, session.state, {
        t: now / 1000,
        actor: session.actor,
        hover,
        highlight,
        speech,
        fade: alpha,
      });
      if (session.finished) drawEndCard();
    }
  }
  requestAnimationFrame(tick);
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
  a.walking = true;
  if (Math.abs(dx) > 1) a.facing = dx < 0 ? 'left' : 'right';
}

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
