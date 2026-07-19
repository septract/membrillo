// Canvas scene rendering. Works with or without story painters: a story with
// no paint module gets labelled placeholder boxes (the engine-honesty path —
// the meadow fixture must always be playable this way).

import type { Box, Point, Scene, State } from './core/types.ts';
import { visibleCharacters, visibleExits, visibleHotspots } from './core/verbs.ts';
import type { LoadedStory } from './loader.ts';
import { P, css } from './art/palette.ts';
import { drawActor, type Facing } from './art/sprites.ts';

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

function characterBox(pos: Point): Box {
  return { x: pos.x - 9, y: pos.y - 40, w: 18, h: 40 };
}

function centre(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** All clickable targets in the scene, in hit-test priority order. */
export function sceneTargets(scene: Scene, state: State): TargetRef[] {
  const refs: TargetRef[] = [];
  for (const c of visibleCharacters(scene, state)) {
    const region = characterBox(c.pos);
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
  if (scene.walk) {
    ctx.fillStyle = css(P.stoneDark);
    ctx.fillRect(0, scene.walk.y, VIEW_W, VIEW_H - scene.walk.y);
  }
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

export interface RenderOpts {
  t: number;
  actor: ActorPose | null;
  hover?: TargetRef | undefined;
  /** Space held: outline every target (the hotspot-highlight affordance). */
  highlight: boolean;
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

  // Characters and the actor, painter's-algorithm by feet position.
  const bodies: { y: number; draw: () => void }[] = [];
  for (const c of visibleCharacters(scene, state)) {
    const sprite = c.paint !== undefined ? loaded.paint.sprites?.[c.paint] : undefined;
    bodies.push({
      y: c.pos.y,
      draw: () => {
        if (sprite) {
          sprite(ctx, c.pos.x, c.pos.y, c.facing ?? 'left', opts.t);
        } else {
          const b = characterBox(c.pos);
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
    bodies.push({ y: a.y, draw: () => drawActor(ctx, a.x, a.y, a.facing, opts.t, a.walking) });
  }
  bodies.sort((a, b) => a.y - b.y);
  for (const b of bodies) b.draw();

  if (opts.highlight) {
    for (const t of sceneTargets(scene, state)) outlineTarget(ctx, t, false);
  }
  if (opts.hover) outlineTarget(ctx, opts.hover, true);
}
