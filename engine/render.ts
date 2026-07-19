// Canvas scene rendering. Works with or without story painters: a story with
// no paint module gets labelled placeholder boxes (the engine-honesty path —
// the meadow fixture must always be playable this way).
//
// Coordinates: everything in a scene lives in WORLD space (0..scene size).
// The camera decides which view-sized window of the world is on the canvas;
// this module translates once and draws world-space throughout, then draws
// screen-space overlays (fade) after restoring.

import { DEFAULT_VIEW, type Box, type Point, type Scene, type Size, type State } from './core/types.ts';
import { visibleCharacters, visibleExits, visibleHotspots } from './core/verbs.ts';
import type { LoadedStory } from './loader.ts';
import { P, css, rgba, type RGB } from './art/palette.ts';
import { drawActor, IDLE_POSE, type Facing, type Pose } from './art/sprites.ts';
import { clamp, depthScale, walkBoxes } from './walk.ts';

export { DEFAULT_VIEW };

export function storyView(loaded: LoadedStory): Size {
  return loaded.story.manifest.view ?? DEFAULT_VIEW;
}

export function sceneSize(scene: Scene, view: Size): Size {
  return scene.size ?? view;
}

export interface ActorPose {
  x: number;
  y: number;
  facing: Facing;
  phase: number;
  walking: boolean;
}

export interface TargetRef {
  kind: 'hotspot' | 'character' | 'exit' | 'companion';
  id: string;
  name: string;
  region: Box;
  walkTo: Point;
}

/** Clickable body box for a sprite standing at `pos` (feet anchor). */
export function bodyBox(pos: Point, scale: number): Box {
  return { x: pos.x - 9 * scale, y: pos.y - 40 * scale, w: 18 * scale, h: 40 * scale };
}
const characterBox = bodyBox;

function centre(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

// Targets only change when the (immutable) state or scene changes; this is
// called per mousemove and per highlight frame, so cache the last result.
let targetsCache: { scene: Scene; state: State; refs: TargetRef[] } | null = null;

/** All clickable targets in the scene, in hit-test priority order. */
export function sceneTargets(scene: Scene, state: State): TargetRef[] {
  if (targetsCache && targetsCache.scene === scene && targetsCache.state === state) {
    return targetsCache.refs;
  }
  const refs: TargetRef[] = [];
  for (const c of visibleCharacters(scene, state)) {
    const region = characterBox(c.pos, depthScale(scene, c.pos.y));
    refs.push({ kind: 'character', id: c.id, name: c.name, region, walkTo: c.walkTo ?? { x: c.pos.x - 16, y: c.pos.y } });
  }
  for (const h of visibleHotspots(scene, state)) {
    refs.push({ kind: 'hotspot', id: h.id, name: h.name, region: h.region, walkTo: h.walkTo ?? centre(h.region) });
  }
  for (const e of visibleExits(scene, state)) {
    refs.push({ kind: 'exit', id: e.id, name: e.name, region: e.region, walkTo: e.walkTo ?? centre(e.region) });
  }
  targetsCache = { scene, state, refs };
  return refs;
}

/**
 * Hit-test in WORLD coordinates. Deliberately half-open ([x, x+w)) — pixel
 * hit-testing convention; walk.ts's inBox is inclusive because walk points ON
 * a box edge are standable ground.
 */
export function targetAt(scene: Scene, state: State, x: number, y: number): TargetRef | undefined {
  return sceneTargets(scene, state).find(
    (t) => x >= t.region.x && x < t.region.x + t.region.w && y >= t.region.y && y < t.region.y + t.region.h,
  );
}

function placeholderScene(ctx: CanvasRenderingContext2D, scene: Scene, size: Size): void {
  ctx.fillStyle = css(P.night);
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.fillStyle = css(P.stoneDark);
  for (const b of walkBoxes(scene)) ctx.fillRect(b.x, b.y, b.w, b.h);
}

function outlineTarget(ctx: CanvasRenderingContext2D, t: TargetRef, strong: boolean): void {
  ctx.strokeStyle = css(strong ? P.glow : P.stoneLit);
  ctx.lineWidth = 1;
  ctx.strokeRect(t.region.x + 0.5, t.region.y + 0.5, t.region.w - 1, t.region.h - 1);
  if (t.kind === 'exit') {
    ctx.fillStyle = css(strong ? P.glow : P.stoneLit);
    ctx.fillRect(t.region.x + t.region.w / 2 - 1, t.region.y - 4, 3, 3);
  }
}

/** Draw with the sprite scaled around its feet anchor. */
function scaled(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  scale: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(scale, scale);
  ctx.translate(-fx, -fy);
  draw();
  ctx.restore();
}

export interface Speech {
  text: string;
  color: RGB;
  /** WORLD-space anchor: horizontal centre, and the y the text sits above. */
  x: number;
  y: number;
}

/** Greedy word wrap shared by speech bubbles and cutscene cards. */
export function wrapWords(text: string, fits: (candidate: string) => boolean): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (!fits(candidate) && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

// A speech line is constant while displayed — wrap and measure it once, not
// per frame (sticky dialogue lines can be on screen indefinitely).
let speechCache: { text: string; maxW: number; lines: { text: string; w: number }[] } | null = null;

/** Floating outlined speech text, SCUMM-style, kept inside the camera window. */
export function drawSpeech(
  ctx: CanvasRenderingContext2D,
  speech: Speech,
  camera: Point,
  view: Size,
): void {
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  const maxW = Math.min(180, view.w - 8);
  if (!speechCache || speechCache.text !== speech.text || speechCache.maxW !== maxW) {
    const lines = wrapWords(speech.text, (s) => ctx.measureText(s).width <= maxW);
    speechCache = {
      text: speech.text,
      maxW,
      lines: lines.map((text) => ({ text, w: ctx.measureText(text).width })),
    };
  }
  const lines = speechCache.lines;

  const lineH = 9;
  const yBase = Math.max(speech.y, camera.y + lines.length * lineH + 2);
  lines.forEach(({ text, w }, i) => {
    const x = clamp(speech.x - w / 2, camera.x + 2, Math.max(camera.x + 2, camera.x + view.w - w - 2));
    const y = yBase - (lines.length - 1 - i) * lineH;
    ctx.fillStyle = css(P.black);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      ctx.fillText(text, x + dx, y + dy);
    }
    ctx.fillStyle = css(speech.color);
    ctx.fillText(text, x, y);
  });
}

/** A companion follower's presentation state, owned by the controller. */
export interface FollowerView {
  id: string;
  pose: ActorPose;
  paint?: string | undefined;
}

export interface RenderOpts {
  t: number;
  actor: ActorPose | null;
  camera: Point;
  view: Size;
  hover?: TargetRef | undefined;
  /** Space held: outline every target (the hotspot-highlight affordance). */
  highlight: boolean;
  speech?: Speech | null;
  /** Body the current speech belongs to: 'actor', a character id, or a companion id. */
  speakingId?: string | null;
  followers?: FollowerView[];
  /** Scripted-sequence facing overrides for scene characters. */
  facingOverrides?: Record<string, Facing>;
  /** 0..1 black overlay for room-change fades. */
  fade?: number;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  loaded: LoadedStory,
  state: State,
  opts: RenderOpts,
): void {
  const scene = loaded.story.scenes[state.scene];
  if (!scene) return;
  const size = sceneSize(scene, opts.view);

  // Ground fill so a painter that under-covers its scene (or a scene smaller
  // than the view) never smears stale pixels from the previous frame.
  ctx.fillStyle = css(P.black);
  ctx.fillRect(0, 0, opts.view.w, opts.view.h);

  ctx.save();
  ctx.translate(-Math.round(opts.camera.x), -Math.round(opts.camera.y));

  const painter = scene.paint !== undefined ? loaded.paint.scenes?.[scene.paint] : undefined;
  if (painter) painter(ctx, state, opts.t);
  else placeholderScene(ctx, scene, size);

  // Characters, props and the actor share one painter's-algorithm pass by
  // feet/baseline y — that ordering IS the walk-behind occlusion.
  const bodies: { y: number; draw: () => void }[] = [];
  for (const c of visibleCharacters(scene, state)) {
    const scale = depthScale(scene, c.pos.y);
    const sprite = c.paint !== undefined ? loaded.paint.sprites?.[c.paint] : undefined;
    const pose: Pose = {
      ...IDLE_POSE,
      facing: opts.facingOverrides?.[c.id] ?? c.facing ?? 'left',
      talking: opts.speakingId === c.id && !!opts.speech,
    };
    bodies.push({
      y: c.pos.y,
      draw: () => {
        if (sprite) {
          scaled(ctx, c.pos.x, c.pos.y, scale, () => sprite(ctx, c.pos.x, c.pos.y, pose, opts.t));
        } else {
          const b = characterBox(c.pos, scale);
          ctx.fillStyle = css(P.stone);
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = css(P.white);
          ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        }
      },
    });
  }
  for (const prop of scene.props ?? []) {
    const propPainter = loaded.paint.props?.[prop.paint];
    bodies.push({
      y: prop.y,
      draw: () => {
        if (propPainter) {
          propPainter(ctx, state, opts.t);
        } else {
          const px = (prop.x ?? size.w / 2) - 20;
          ctx.fillStyle = css(P.stone);
          ctx.fillRect(px, prop.y - 24, 40, 24);
          ctx.strokeStyle = css(P.white);
          ctx.strokeRect(px + 0.5, prop.y - 23.5, 39, 23);
        }
      },
    });
  }
  for (const f of opts.followers ?? []) {
    const scale = depthScale(scene, f.pose.y);
    const sprite = f.paint !== undefined ? loaded.paint.sprites?.[f.paint] : undefined;
    const pose: Pose = {
      facing: f.pose.facing,
      phase: f.pose.phase,
      walking: f.pose.walking,
      talking: opts.speakingId === f.id && !!opts.speech,
    };
    const { x, y } = f.pose;
    bodies.push({
      y,
      draw: () => {
        if (sprite) {
          scaled(ctx, x, y, scale, () => sprite(ctx, x, y, pose, opts.t));
        } else {
          const b = bodyBox({ x, y }, scale);
          ctx.fillStyle = css(P.stone);
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = css(P.white);
          ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        }
      },
    });
  }
  if (opts.actor) {
    const a = opts.actor;
    const scale = depthScale(scene, a.y);
    const pose: Pose = {
      facing: a.facing,
      phase: a.phase,
      walking: a.walking,
      talking: opts.speakingId === 'actor' && !!opts.speech,
    };
    bodies.push({
      y: a.y,
      draw: () => scaled(ctx, a.x, a.y, scale, () => drawActor(ctx, a.x, a.y, pose, opts.t)),
    });
  }
  bodies.sort((a, b) => a.y - b.y);
  for (const b of bodies) b.draw();

  if (opts.highlight) {
    for (const t of sceneTargets(scene, state)) outlineTarget(ctx, t, false);
  }
  if (opts.hover) outlineTarget(ctx, opts.hover, true);
  if (opts.speech) drawSpeech(ctx, opts.speech, opts.camera, opts.view);

  ctx.restore();

  if (opts.fade !== undefined && opts.fade > 0) {
    ctx.fillStyle = rgba(P.black, Math.min(opts.fade, 1));
    ctx.fillRect(0, 0, opts.view.w, opts.view.h);
  }
}
