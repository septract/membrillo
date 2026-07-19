// Canvas scene rendering. Works with or without story painters: a story with
// no paint module gets labelled placeholder boxes (the engine-honesty path —
// the meadow fixture must always be playable this way).
//
// Depth: sprites (actor, characters) scale with their feet-y per the scene's
// `depth` gradient. Props are painters sorted into the same body pass by
// baseline y, which is what lets the actor walk behind scenery.

import type { Box, Point, Scene, State } from './core/types.ts';
import { visibleCharacters, visibleExits, visibleHotspots } from './core/verbs.ts';
import type { LoadedStory } from './loader.ts';
import { P, css, type RGB } from './art/palette.ts';
import { drawActor, type Facing } from './art/sprites.ts';
import { depthScale, walkBoxes } from './walk.ts';

export const VIEW_W = 320;
export const VIEW_H = 180;

export interface ActorPose {
  x: number;
  y: number;
  facing: Facing;
  walking: boolean;
}

export interface TargetRef {
  kind: 'hotspot' | 'character' | 'exit';
  id: string;
  name: string;
  region: Box;
  walkTo: Point;
}

function characterBox(pos: Point, scale: number): Box {
  return { x: pos.x - 9 * scale, y: pos.y - 40 * scale, w: 18 * scale, h: 40 * scale };
}

function centre(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** All clickable targets in the scene, in hit-test priority order. */
export function sceneTargets(scene: Scene, state: State): TargetRef[] {
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
  return refs;
}

export function targetAt(scene: Scene, state: State, x: number, y: number): TargetRef | undefined {
  return sceneTargets(scene, state).find(
    (t) => x >= t.region.x && x < t.region.x + t.region.w && y >= t.region.y && y < t.region.y + t.region.h,
  );
}

function placeholderScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  ctx.fillStyle = css(P.night);
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
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
  /** Anchor: horizontal centre, and the y the text stack sits above. */
  x: number;
  y: number;
}

/** Floating outlined speech text, SCUMM-style. */
export function drawSpeech(ctx: CanvasRenderingContext2D, speech: Speech): void {
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  const words = speech.text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(candidate).width > 180 && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);

  const lineH = 9;
  lines.forEach((text, i) => {
    const w = ctx.measureText(text).width;
    const x = Math.min(Math.max(speech.x - w / 2, 2), VIEW_W - w - 2);
    const y = speech.y - (lines.length - 1 - i) * lineH;
    ctx.fillStyle = css(P.black);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      ctx.fillText(text, x + dx, y + dy);
    }
    ctx.fillStyle = css(speech.color);
    ctx.fillText(text, x, y);
  });
}

export interface RenderOpts {
  t: number;
  actor: ActorPose | null;
  hover?: TargetRef | undefined;
  /** Space held: outline every target (the hotspot-highlight affordance). */
  highlight: boolean;
  speech?: Speech | null;
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

  const painter = scene.paint !== undefined ? loaded.paint.scenes?.[scene.paint] : undefined;
  if (painter) painter(ctx, state, opts.t);
  else placeholderScene(ctx, scene);

  // Characters, props and the actor share one painter's-algorithm pass by
  // feet/baseline y — that ordering IS the walk-behind occlusion.
  const bodies: { y: number; draw: () => void }[] = [];
  for (const c of visibleCharacters(scene, state)) {
    const scale = depthScale(scene, c.pos.y);
    const sprite = c.paint !== undefined ? loaded.paint.sprites?.[c.paint] : undefined;
    bodies.push({
      y: c.pos.y,
      draw: () => {
        if (sprite) {
          scaled(ctx, c.pos.x, c.pos.y, scale, () =>
            sprite(ctx, c.pos.x, c.pos.y, c.facing ?? 'left', opts.t),
          );
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
          ctx.fillStyle = css(P.stone);
          ctx.fillRect(140, prop.y - 24, 40, 24);
          ctx.strokeStyle = css(P.white);
          ctx.strokeRect(140.5, prop.y - 23.5, 39, 23);
        }
      },
    });
  }
  if (opts.actor) {
    const a = opts.actor;
    const scale = depthScale(scene, a.y);
    bodies.push({
      y: a.y,
      draw: () => scaled(ctx, a.x, a.y, scale, () => drawActor(ctx, a.x, a.y, a.facing, opts.t, a.walking)),
    });
  }
  bodies.sort((a, b) => a.y - b.y);
  for (const b of bodies) b.draw();

  if (opts.highlight) {
    for (const t of sceneTargets(scene, state)) outlineTarget(ctx, t, false);
  }
  if (opts.hover) outlineTarget(ctx, opts.hover, true);
  if (opts.speech) drawSpeech(ctx, opts.speech);
  if (opts.fade !== undefined && opts.fade > 0) {
    ctx.fillStyle = `rgba(16,14,20,${Math.min(opts.fade, 1)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
