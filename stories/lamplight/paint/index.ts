// Painters for Lamplight. Draw-only code: painters may READ state to vary
// what they draw (a taken prop disappears), never change it. All game logic
// lives in the scene JSON.
//
// The dock is a 480×180 scene viewed through the story's 320×180 window —
// painters just draw their whole scene; the engine's camera does the rest.

import type { State } from '../../../engine/core/types.ts';
import { P, css, mix, type RGB } from '../../../engine/art/palette.ts';
import { rampRect } from '../../../engine/art/dither.ts';
import { blk, px, faceCtx, talkMouth, type SpritePainter } from '../../../engine/art/sprites.ts';

const DOCK_W = 480;
const TOWER_W = 320;
const H = 180;

// Static background layers are painted once into an offscreen canvas and
// blitted every frame; only props and glows are drawn per frame.
const bgCache = new Map<string, HTMLCanvasElement>();

function cachedBg(
  id: string,
  w: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  let canvas = bgCache.get(id);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = H;
    draw(canvas.getContext('2d')!);
    bgCache.set(id, canvas);
  }
  return canvas;
}

function plankBand(
  ctx: CanvasRenderingContext2D,
  w: number,
  y0: number,
  y1: number,
  a: RGB,
  b: RGB,
): void {
  for (let y = y0; y < y1; y += 6) {
    px(ctx, 0, y, w, 6, a);
    px(ctx, 0, y, w, 1, b);
    const shift = ((y / 6) % 2) * 24;
    for (let x = shift; x < w; x += 48) px(ctx, x, y + 1, 1, 5, mix(a, P.black, 0.4));
  }
}

// --- Dock (480 wide — the camera scrolls) -----------------------------------

function dockStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, DOCK_W, 84, [P.skyTop, P.skyMid, P.skyLow, P.horizon]);
  rampRect(ctx, 0, 84, DOCK_W, 42, [P.seaLit, P.sea, P.seaDeep]);
  // far shore
  px(ctx, 0, 80, 110, 4, mix(P.night, P.skyMid, 0.4));
  px(ctx, 14, 76, 30, 4, mix(P.night, P.skyMid, 0.5));
  px(ctx, 330, 78, 60, 3, mix(P.night, P.skyMid, 0.45));
  // pier deck + railing
  plankBand(ctx, DOCK_W, 126, H, P.wood, P.woodLit);
  px(ctx, 0, 124, 424, 2, P.woodDark);
  for (let x = 12; x < 420; x += 42) blk(ctx, x, 106, 3, 18, P.woodDark);
  px(ctx, 10, 112, 408, 2, P.woodLit); // rail top
  // pilings below the pier edge
  for (let x = 30; x < 410; x += 70) blk(ctx, x, 118, 5, 10, P.woodDark);
  // keeper's skiff
  blk(ctx, 210, 106, 48, 10, P.woodDark);
  px(ctx, 214, 108, 40, 4, P.wood);
  px(ctx, 210, 104, 48, 2, P.woodLit);
  blk(ctx, 232, 96, 2, 10, P.woodDark); // stub mast
  // lighthouse at the far end
  blk(ctx, 446, 24, 30, 132, P.stone);
  px(ctx, 448, 24, 6, 130, P.stoneLit);
  px(ctx, 446, 40, 30, 8, P.cloth);
  px(ctx, 446, 76, 30, 8, P.cloth);
  blk(ctx, 444, 12, 34, 14, P.stoneDark); // dark lamp room
  px(ctx, 450, 16, 22, 6, P.night);
  // doorway
  blk(ctx, 452, 100, 20, 56, P.woodDark);
  px(ctx, 454, 104, 16, 50, mix(P.woodDark, P.black, 0.5));
}

/** Deterministic pseudo-random for sparkle/gull placement. */
function hash(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function gull(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const flap = Math.sin(t * 9) > 0 ? -1 : 1;
  px(ctx, x - 2, y + flap, 2, 1, P.night);
  px(ctx, x + 1, y + flap, 2, 1, P.night);
  px(ctx, x, y, 1, 1, P.night);
}

function dock(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('dock', DOCK_W, dockStatic), 0, 0);
  // colour-cycled shimmer on the sea
  for (let i = 0; i < 46; i++) {
    const sx = Math.floor(hash(i) * DOCK_W);
    const sy = 86 + Math.floor(hash(i + 100) * 34);
    if (Math.sin(t * 1.8 + i * 1.7) > 0.55) {
      px(ctx, sx, sy, 2, 1, mix(P.seaLit, P.glow, 0.35));
    }
  }
  // gulls working the harbour
  for (let i = 0; i < 3; i++) {
    const gx = ((t * (10 + i * 3) + i * 210) % (DOCK_W + 60)) - 30;
    const gy = 26 + i * 14 + Math.sin(t * 1.1 + i * 2) * 4;
    gull(ctx, gx, gy, t + i);
  }
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
  px(ctx, 448, 96, 3, 4, mix(P.night, P.glow, glow));
}

// --- Tower lamp room --------------------------------------------------------

function towerStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, TOWER_W, 128, [P.stoneDark, P.stone, P.stoneDark]);
  // masonry courses
  for (let y = 8; y < 122; y += 16) {
    px(ctx, 0, y, TOWER_W, 1, mix(P.stoneDark, P.black, 0.4));
    const shift = ((y / 16) % 2) * 20;
    for (let x = shift; x < TOWER_W; x += 40) px(ctx, x, y, 1, 16, mix(P.stoneDark, P.black, 0.3));
  }
  // window on the harbour side
  blk(ctx, 60, 44, 22, 30, P.night);
  px(ctx, 62, 46, 18, 12, P.skyTop);
  px(ctx, 62, 58, 18, 14, P.seaDeep);
  px(ctx, 70, 44, 2, 30, P.stoneDark);
  // floor
  plankBand(ctx, TOWER_W, 128, H, mix(P.stone, P.black, 0.25), P.stoneLit);
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
  ctx.drawImage(cachedBg('tower', TOWER_W, towerStatic), 0, 0);
  // dusk through the window, shifting slowly
  const dim = 0.3 + Math.sin(t * 0.7) * 0.05;
  ctx.fillStyle = css(mix(P.skyLow, P.night, dim));
  ctx.fillRect(62, 46, 18, 12);
}

// --- Props (occluders — drawn in the body pass at their baseline y) ---------

function crates(ctx: CanvasRenderingContext2D, _state: State, _t: number): void {
  // Stacked packing crates mid-dock; the actor paths around and behind them.
  blk(ctx, 144, 130, 24, 24, P.wood);
  px(ctx, 146, 132, 20, 2, P.woodLit);
  px(ctx, 146, 141, 20, 1, P.woodDark);
  blk(ctx, 168, 136, 22, 18, P.wood);
  px(ctx, 170, 138, 18, 2, P.woodLit);
  blk(ctx, 150, 112, 20, 18, P.woodDark);
  px(ctx, 152, 114, 16, 2, P.wood);
  px(ctx, 156, 120, 8, 4, P.stoneDark); // stencilled mark
}

// --- Sprites ----------------------------------------------------------------

const keeper: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const bob = Math.round(Math.sin(t * 1.4));
  const y = fy + bob;
  // boots + oilskin coat
  blk(ctx, fx - 5, y - 10, 4, 10, P.night);
  blk(ctx, fx + 1, y - 10, 4, 10, P.night);
  blk(ctx, fx - 7, y - 28, 14, 19, P.seaDeep);
  px(ctx, fx - 7, y - 28, 14, 3, P.sea);
  px(ctx, fx - 1, y - 25, 1, 14, P.black); // coat seam
  // arms folded; the near arm lifts while he talks
  blk(ctx, fx - 8, y - 24, 3, 10, P.seaDeep);
  const gesture = pose.talking && Math.sin(t * 3.1) > 0 ? 2 : 0;
  blk(ctx, fx + 5, y - 24 - gesture, 3, 10, P.seaDeep);
  // head, beard, cap
  blk(ctx, fx - 4, y - 38, 9, 11, P.skin);
  px(ctx, fx - 4, y - 31, 9, 4, P.white); // beard
  px(ctx, fx - 5, y - 40, 11, 4, P.night); // wool cap
  px(ctx, fx + 2, y - 34, 1, 2, P.black); // eye
  talkMouth(ctx, fx + 1, y - 32, pose.talking, t);
  ctx.restore();
};

export const scenes = { dock, tower };
export const sprites = { keeper };
export const props = { crates };
