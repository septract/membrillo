// Browser controller: story menu, the four-verb UI, click-to-walk, dialogue
// and cutscene overlays, saves, and the render loop. All game *rules* live in
// core/ — this file only sequences outcomes the core produces.

import type { Point, Scene, State } from './core/types.ts';
import { initialState } from './core/rules.ts';
import {
  act,
  chooseOption,
  combine,
  currentScene,
  dialogueNode,
  enterScene,
  isCutscene,
  lookAtItem,
  useExit,
  visibleOptions,
  type PlayerVerb,
} from './core/verbs.ts';
import { loadStories, type LoadedStory } from './loader.ts';
import { renderScene, targetAt, VIEW_H, VIEW_W, type ActorPose, type TargetRef } from './render.ts';
import { P, css } from './art/palette.ts';

type ArmedVerb = PlayerVerb | 'combine';

interface Pending {
  target: TargetRef;
  verb: PlayerVerb;
}

interface Session {
  id: string;
  loaded: LoadedStory;
  state: State;
  actor: ActorPose;
  walkTarget: Point | null;
  pending: Pending | null;
  /** Open dialogue, if any. */
  dialogue: { id: string; node: string } | null;
  /** Cutscene beat index, if the current scene is a cutscene. */
  beat: number | null;
  finished: boolean;
}

const WALK_SPEED = 80; // px/s
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
let combineSel: string[] = [];
let hover: TargetRef | undefined;
let highlight = false;

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
  combineSel = [];
  session = {
    id,
    loaded,
    state: state ?? initialState(loaded.story.manifest.start),
    actor: { x: 0, y: 0, facing: 'right', walking: false },
    walkTarget: null,
    pending: null,
    dialogue: null,
    beat: null,
    finished: false,
  };
  placeInScene(sceneOf(session), null);
  renderPanel();
}

// --- Scene flow -------------------------------------------------------------

function sceneOf(s: Session): Scene {
  return currentScene(s.loaded.story, s.state);
}

function placeInScene(scene: Scene, entry: Point | null): void {
  if (!session) return;
  session.walkTarget = null;
  session.pending = null;
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

function changeScene(sceneId: string, entry: Point | null): void {
  if (!session) return;
  session.state = enterScene(session.state, sceneId);
  const scene = sceneOf(session);
  if (scene.ending && !isCutscene(scene)) {
    finish();
    return;
  }
  placeInScene(scene, entry);
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

// --- Outcome handling -------------------------------------------------------

function runPending(): void {
  if (!session || !session.pending) return;
  const { target, verb } = session.pending;
  session.pending = null;
  if (target.kind === 'exit') {
    const scene = sceneOf(session);
    const exit = (scene.exits ?? []).find((e) => e.id === target.id);
    const next = useExit(session.loaded.story, session.state, target.id);
    if (next && exit) {
      session.state = next;
      changeScene(exit.to, exit.entry ?? null);
      renderPanel();
    }
    return;
  }
  const outcome = act(session.loaded.story, session.state, target.id, verb);
  if (!outcome) return;
  session.state = outcome.state;
  if (outcome.text !== undefined) log(outcome.text);
  if (outcome.dialogue !== undefined) openDialogue(outcome.dialogue);
  if (outcome.goto !== undefined) changeScene(outcome.goto, null);
  save();
  renderPanel();
}

// --- Dialogue ---------------------------------------------------------------

function openDialogue(dlgId: string): void {
  if (!session) return;
  const dlg = session.loaded.story.dialogues[dlgId];
  if (!dlg) return;
  session.dialogue = { id: dlgId, node: dlg.start };
  renderDialogue();
}

function renderDialogue(): void {
  if (!session || !session.dialogue) {
    el.dialogue.hidden = true;
    return;
  }
  const dlg = session.loaded.story.dialogues[session.dialogue.id]!;
  const node = dialogueNode(dlg, session.dialogue.node);
  el.dialogue.hidden = false;
  el.dialogue.innerHTML = '';
  const line = document.createElement('p');
  line.className = 'npc-line';
  line.textContent = node.line;
  el.dialogue.append(line);
  for (const option of visibleOptions(session.state, node)) {
    const btn = document.createElement('button');
    btn.textContent = option.text;
    btn.addEventListener('click', () => {
      if (!session || !session.dialogue) return;
      const step = chooseOption(session.state, option);
      session.state = step.state;
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
      combineSel = [];
      renderPanel();
    });
    el.verbs.append(btn);
  }
  el.inventory.innerHTML = '';
  if (!session) return;
  for (const itemId of session.state.inventory) {
    const item = session.loaded.story.items[itemId];
    const chip = document.createElement('button');
    chip.className = 'chip' + (combineSel.includes(itemId) ? ' armed' : '');
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
      session.state = outcome.state;
      if (outcome.text !== undefined) log(outcome.text);
      combineSel = [];
      save();
    }
  } else {
    const outcome = lookAtItem(session.loaded.story, session.state, itemId);
    session.state = outcome.state;
    if (outcome.text !== undefined) log(outcome.text);
    save();
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

function clampToWalk(scene: Scene, p: Point): Point {
  const w = scene.walk;
  if (!w) return p;
  return {
    x: Math.min(Math.max(p.x, w.x), w.x + w.w),
    y: Math.min(Math.max(p.y, w.y), w.y + w.h),
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
    el.hoverlabel.hidden = false;
    el.hoverlabel.textContent = hover.name;
    const rect = el.canvas.getBoundingClientRect();
    const stage = el.canvas.parentElement!.getBoundingClientRect();
    el.hoverlabel.style.left = `${ev.clientX - stage.left + 12}px`;
    el.hoverlabel.style.top = `${ev.clientY - rect.top - 8}px`;
  } else {
    el.hoverlabel.hidden = true;
  }
});

el.canvas.addEventListener('click', (ev) => {
  if (!session || session.finished || session.dialogue) return;
  const scene = sceneOf(session);
  if (session.beat !== null) {
    advanceBeat(scene);
    return;
  }
  const p = canvasPoint(ev);
  const target = targetAt(scene, session.state, p.x, p.y);
  if (!target) {
    session.walkTarget = clampToWalk(scene, p);
    session.pending = null;
    return;
  }
  if (armed === 'combine') {
    log('Combine works on two inventory items — pick them below.');
    return;
  }
  const verb: PlayerVerb = target.kind === 'exit' ? 'interact' : armed;
  session.walkTarget = clampToWalk(scene, target.walkTo);
  session.pending = { target, verb };
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
    renderPanel();
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
  ctx.fillStyle = css(P.black);
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const beat = (scene.beats ?? [])[session.beat] ?? '';
  ctx.fillStyle = css(P.white);
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  const lines = wrapLines(beat, 60);
  const y0 = VIEW_H / 2 - (lines.length - 1) * 6;
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y0 + i * 12));
  ctx.fillStyle = css(P.stoneLit);
  ctx.fillText(session.finished ? '' : '· click ·', VIEW_W / 2, VIEW_H - 10);
  ctx.textAlign = 'left';
}

function drawEndCard(): void {
  ctx.fillStyle = css(P.black);
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = css(P.glow);
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('The End', VIEW_W / 2, VIEW_H / 2);
  ctx.fillStyle = css(P.stoneLit);
  ctx.font = '8px monospace';
  ctx.fillText('Restart to play again', VIEW_W / 2, VIEW_H / 2 + 16);
  ctx.textAlign = 'left';
}

let lastTime = performance.now();

function tick(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (session) {
    const scene = sceneOf(session);
    if (session.finished && !isCutscene(scene)) {
      drawEndCard();
    } else if (session.beat !== null) {
      if (session.finished) drawEndCard();
      else drawCutscene(scene);
    } else {
      updateWalk(dt);
      renderScene(ctx, session.loaded, session.state, {
        t: now / 1000,
        actor: session.actor,
        hover,
        highlight,
      });
      if (session.finished) drawEndCard();
    }
  }
  requestAnimationFrame(tick);
}

function updateWalk(dt: number): void {
  if (!session || !session.walkTarget) {
    if (session) session.actor.walking = false;
    return;
  }
  const a = session.actor;
  const t = session.walkTarget;
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const dist = Math.hypot(dx, dy);
  const step = WALK_SPEED * dt;
  if (dist <= step) {
    a.x = t.x;
    a.y = t.y;
    a.walking = false;
    session.walkTarget = null;
    runPending();
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
