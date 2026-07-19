// Sprite-drawing helpers and the engine's default player actor.
// Characters are drawn feet-up from a feet-centre anchor, with 1px outlines
// (`blk`) so silhouettes stay readable on any background.

import { P, css, type RGB } from './palette.ts';

export type Facing = 'left' | 'right';

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
  facing: Facing,
  t: number,
) => void;

/** The default player actor (~40px tall), with walk cycle and idle bob. */
export function drawActor(
  ctx: CanvasRenderingContext2D,
  fx: number,
  fy: number,
  facing: Facing,
  t: number,
  walking: boolean,
): void {
  faceCtx(ctx, fx, facing);
  const swing = walking ? Math.round(Math.sin(t * 11) * 2) : 0;
  const bob = walking ? 0 : Math.round(Math.sin(t * 1.8));
  const y = fy + bob;
  // legs
  blk(ctx, fx - 5, y - 12, 4, 12 + swing, P.night);
  blk(ctx, fx + 1, y - 12, 4, 12 - swing, P.night);
  // torso + arms
  blk(ctx, fx - 6, y - 26, 12, 15, P.cloth);
  px(ctx, fx - 6, y - 26, 12, 3, P.clothLit);
  blk(ctx, fx - 9, y - 25, 3, 11 - swing, P.cloth);
  blk(ctx, fx + 6, y - 25, 3, 11 + swing, P.cloth);
  // head
  blk(ctx, fx - 4, y - 36, 9, 10, P.skin);
  px(ctx, fx - 4, y - 36, 9, 2, P.woodDark); // hair
  px(ctx, fx + 2, y - 32, 1, 2, P.black); // eye
  ctx.restore();
}
