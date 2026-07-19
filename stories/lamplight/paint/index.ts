// Painters for Lamplight. Draw-only code: painters may READ state to vary
// what they draw (a taken prop disappears), never change it. All game logic
// lives in the scene JSON.

import type { State } from '../../../engine/core/types.ts';
import { P, css, mix, type RGB } from '../../../engine/art/palette.ts';
import { rampRect } from '../../../engine/art/dither.ts';
import { blk, px, faceCtx, type SpritePainter } from '../../../engine/art/sprites.ts';

const W = 320;
const H = 180;

// Static background layers are painted once into an offscreen canvas and
// blitted every frame; only props and glows are drawn per frame.
const bgCache = new Map<string, HTMLCanvasElement>();

function cachedBg(id: string, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let canvas = bgCache.get(id);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    draw(canvas.getContext('2d')!);
    bgCache.set(id, canvas);
  }
  return canvas;
}

function plankBand(ctx: CanvasRenderingContext2D, y0: number, y1: number, a: RGB, b: RGB): void {
  for (let y = y0; y < y1; y += 6) {
    px(ctx, 0, y, W, 6, a);
    px(ctx, 0, y, W, 1, b);
    const shift = ((y / 6) % 2) * 24;
    for (let x = shift; x < W; x += 48) px(ctx, x, y + 1, 1, 5, mix(a, P.black, 0.4));
  }
}

// --- Dock -------------------------------------------------------------------

function dockStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, W, 84, [P.skyTop, P.skyMid, P.skyLow, P.horizon]);
  rampRect(ctx, 0, 84, W, 42, [P.seaLit, P.sea, P.seaDeep]);
  // far shore
  px(ctx, 0, 80, 110, 4, mix(P.night, P.skyMid, 0.4));
  px(ctx, 14, 76, 30, 4, mix(P.night, P.skyMid, 0.5));
  // pier deck + railing
  plankBand(ctx, 126, 180, P.wood, P.woodLit);
  px(ctx, 0, 124, 264, 2, P.woodDark);
  for (let x = 12; x < 264; x += 42) blk(ctx, x, 106, 3, 18, P.woodDark);
  px(ctx, 10, 112, 250, 2, P.woodLit); // rail top
  // pilings below the pier edge
  for (let x = 30; x < 250; x += 70) blk(ctx, x, 118, 5, 10, P.woodDark);
  // keeper's skiff
  blk(ctx, 210, 106, 48, 10, P.woodDark);
  px(ctx, 214, 108, 40, 4, P.wood);
  px(ctx, 210, 104, 48, 2, P.woodLit);
  blk(ctx, 232, 96, 2, 10, P.woodDark); // stub mast
  // lighthouse
  blk(ctx, 286, 24, 30, 132, P.stone);
  px(ctx, 288, 24, 6, 130, P.stoneLit);
  px(ctx, 286, 40, 30, 8, P.cloth);
  px(ctx, 286, 76, 30, 8, P.cloth);
  blk(ctx, 284, 12, 34, 14, P.stoneDark); // dark lamp room
  px(ctx, 290, 16, 22, 6, P.night);
  // doorway
  blk(ctx, 292, 100, 20, 56, P.woodDark);
  px(ctx, 294, 104, 16, 50, mix(P.woodDark, P.black, 0.5));
}

function dock(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('dock', dockStatic), 0, 0);
  if (!state.flags.includes('took_rope')) {
    blk(ctx, 58, 140, 22, 8, P.wood);
    px(ctx, 62, 142, 14, 4, P.woodDark);
    px(ctx, 66, 140, 4, 2, P.woodLit);
  }
  if (!state.flags.includes('took_hook')) {
    px(ctx, 118, 118, 44, 2, P.stoneLit);
    px(ctx, 156, 116, 6, 3, P.brass);
  }
  if (state.flags.includes('knows_crate') && !state.flags.includes('crate_raised')) {
    const wink = Math.sin(t * 2.2) > 0.3;
    if (wink) px(ctx, 236, 112, 3, 2, P.seaLit);
  }
  // lantern by the lighthouse door, breathing
  const glow = 0.55 + Math.sin(t * 2.6) * 0.15;
  px(ctx, 288, 96, 3, 4, mix(P.night, P.glow, glow));
}

// --- Tower lamp room --------------------------------------------------------

function towerStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, W, 128, [P.stoneDark, P.stone, P.stoneDark]);
  // masonry courses
  for (let y = 8; y < 122; y += 16) {
    px(ctx, 0, y, W, 1, mix(P.stoneDark, P.black, 0.4));
    const shift = ((y / 16) % 2) * 20;
    for (let x = shift; x < W; x += 40) px(ctx, x, y, 1, 16, mix(P.stoneDark, P.black, 0.3));
  }
  // window on the harbour side
  blk(ctx, 60, 44, 22, 30, P.night);
  px(ctx, 62, 46, 18, 12, P.skyTop);
  px(ctx, 62, 58, 18, 14, P.seaDeep);
  px(ctx, 70, 44, 2, 30, P.stoneDark);
  // floor
  plankBand(ctx, 128, 180, mix(P.stone, P.black, 0.25), P.stoneLit);
  // lamp pedestal and open housing
  blk(ctx, 146, 100, 28, 22, P.stone);
  px(ctx, 148, 100, 24, 3, P.stoneLit);
  blk(ctx, 140, 60, 40, 40, P.brass);
  px(ctx, 144, 64, 32, 32, P.night); // the empty socket
  px(ctx, 140, 60, 40, 3, P.brassLit);
  // spiral stairs down
  blk(ctx, 234, 90, 38, 48, mix(P.stoneDark, P.black, 0.3));
  for (let i = 0; i < 5; i++) px(ctx, 238 + i * 6, 96 + i * 8, 24 - i * 4, 3, P.stone);
  // doorway to the gallery
  blk(ctx, 2, 98, 22, 60, P.woodDark);
  px(ctx, 4, 102, 18, 54, mix(P.woodDark, P.black, 0.5));
}

function tower(ctx: CanvasRenderingContext2D, _state: State, t: number): void {
  ctx.drawImage(cachedBg('tower', towerStatic), 0, 0);
  // dusk through the window, shifting slowly
  const dim = 0.3 + Math.sin(t * 0.7) * 0.05;
  ctx.fillStyle = css(mix(P.skyLow, P.night, dim));
  ctx.fillRect(62, 46, 18, 12);
}

// --- Sprites ----------------------------------------------------------------

const keeper: SpritePainter = (ctx, fx, fy, facing, t) => {
  faceCtx(ctx, fx, facing);
  const bob = Math.round(Math.sin(t * 1.4));
  const y = fy + bob;
  // boots + oilskin coat
  blk(ctx, fx - 5, y - 10, 4, 10, P.night);
  blk(ctx, fx + 1, y - 10, 4, 10, P.night);
  blk(ctx, fx - 7, y - 28, 14, 19, P.seaDeep);
  px(ctx, fx - 7, y - 28, 14, 3, P.sea);
  px(ctx, fx - 1, y - 25, 1, 14, P.black); // coat seam
  // arms folded
  blk(ctx, fx - 8, y - 24, 3, 10, P.seaDeep);
  blk(ctx, fx + 5, y - 24, 3, 10, P.seaDeep);
  // head, beard, cap
  blk(ctx, fx - 4, y - 38, 9, 11, P.skin);
  px(ctx, fx - 4, y - 31, 9, 4, P.white); // beard
  px(ctx, fx - 5, y - 40, 11, 4, P.night); // wool cap
  px(ctx, fx + 2, y - 34, 1, 2, P.black); // eye
  ctx.restore();
};

export const scenes = { dock, tower };
export const sprites = { keeper };
