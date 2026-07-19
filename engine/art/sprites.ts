// Sprite-drawing helpers and the engine's default player actor.
// Characters are drawn feet-up from a feet-centre anchor, with 1px outlines
// (`blk`) so silhouettes stay readable on any background.
//
// Sprites receive a Pose: 4-way facing, a distance-driven walk phase (so
// steps track ground actually covered, at any walk speed or depth scale),
// and a talking flag that runs the mouth while the sprite's speech floats.

import { P, css, type RGB } from './palette.ts';

export type Facing = 'left' | 'right' | 'up' | 'down';

export interface Pose {
  facing: Facing;
  /** Walk cycle position; advances with distance covered. One step ≈ π. */
  phase: number;
  walking: boolean;
  /** True while this sprite's speech is floating overhead. */
  talking: boolean;
}

export const IDLE_POSE: Pose = { facing: 'left', phase: 0, walking: false, talking: false };

/**
 * Speech anchors sit this far above the feet (at scale 1). Derived from the
 * default sprite geometry below: heads top out ~40px up (drawActor: head at
 * y-36 over a 4px hair/cap crown), plus clearance for the text baseline.
 */
export const ACTOR_SPEECH_OFFSET = 44;
export const CHARACTER_SPEECH_OFFSET = 46;

/** Flat rect. */
export function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: RGB,
): void {
  ctx.fillStyle = css(c);
  ctx.fillRect(x, y, w, h);
}

/** Rect with a 1px outline — readable on any background. */
export function blk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: RGB,
  outline: RGB = P.black,
): void {
  ctx.fillStyle = css(outline);
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = css(c);
  ctx.fillRect(x, y, w, h);
}

/** Mirror drawing around centre x=cx when facing left; call restore() after. */
export function faceCtx(ctx: CanvasRenderingContext2D, cx: number, facing: Facing): void {
  ctx.save();
  if (facing === 'left') {
    ctx.translate(cx * 2, 0);
    ctx.scale(-1, 1);
  }
}

export type SpritePainter = (
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  pose: Pose,
  t: number,
) => void;

/** Mouth flap while talking: a dark pixel that opens and closes. */
export function talkMouth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  talking: boolean,
  t: number,
): void {
  if (talking && Math.sin(t * 12) > -0.2) px(ctx, x, y, 2, Math.sin(t * 12) > 0.6 ? 2 : 1, P.black);
}

/** Idle blink: true while the eyes should be shut (brief, every few seconds). */
export function blinking(t: number): boolean {
  return t % 3.7 > 3.55;
}

/** The default player actor (~40px tall): 4-way facing, stepped walk cycle. */
export function drawActor(ctx: CanvasRenderingContext2D, fx: number, fy: number, pose: Pose, t: number): void {
  const step = pose.walking ? Math.round(Math.sin(pose.phase) * 2) : 0;
  const bob = pose.walking ? 0 : Math.round(Math.sin(t * 1.8));
  const y = fy + bob;
  const profile = pose.facing === 'left' || pose.facing === 'right';

  faceCtx(ctx, fx, pose.facing);
  if (profile) {
    // legs scissor front/back
    blk(ctx, fx - 5, y - 12, 4, 12 + step, P.night);
    blk(ctx, fx + 1, y - 12, 4, 12 - step, P.night);
    // torso + counter-swinging arms
    blk(ctx, fx - 6, y - 26, 12, 15, P.cloth);
    px(ctx, fx - 6, y - 26, 12, 3, P.clothLit);
    blk(ctx, fx - 9, y - 25, 3, 11 - step, P.cloth);
    blk(ctx, fx + 6, y - 25, 3, 11 + step, P.cloth);
    // head in profile
    blk(ctx, fx - 4, y - 36, 9, 10, P.skin);
    px(ctx, fx - 4, y - 36, 9, 2, P.woodDark); // hair
    if (!blinking(t)) px(ctx, fx + 2, y - 32, 1, 2, P.black); // eye
    talkMouth(ctx, fx + 3, y - 29, pose.talking, t);
  } else {
    // toward/away: legs stride alternately, arms at the sides
    blk(ctx, fx - 5, y - 12, 4, 12 + step, P.night);
    blk(ctx, fx + 1, y - 12, 4, 12 - step, P.night);
    blk(ctx, fx - 6, y - 26, 12, 15, P.cloth);
    px(ctx, fx - 6, y - 26, 12, 3, P.clothLit);
    blk(ctx, fx - 9, y - 25, 3, 10 + step, P.cloth);
    blk(ctx, fx + 6, y - 25, 3, 10 - step, P.cloth);
    blk(ctx, fx - 4, y - 36, 9, 10, P.skin);
    if (pose.facing === 'up') {
      // back of the head: all hair, no face
      px(ctx, fx - 4, y - 36, 9, 7, P.woodDark);
    } else {
      px(ctx, fx - 4, y - 36, 9, 2, P.woodDark);
      if (!blinking(t)) {
        px(ctx, fx - 2, y - 32, 1, 2, P.black);
        px(ctx, fx + 2, y - 32, 1, 2, P.black);
      }
      talkMouth(ctx, fx - 1, y - 29, pose.talking, t);
    }
  }
  ctx.restore();
}
