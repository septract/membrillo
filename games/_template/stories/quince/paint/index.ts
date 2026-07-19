// Painters for The Quince Tree. Draw-only code: painters may READ state to
// vary what they draw (the picked fruit disappears, the gate opens), never
// change it. All game logic lives in the scene JSON.

import type { State } from 'membrillo/core/types';
import { P, mix } from 'membrillo/art/palette';
import { rampRect } from 'membrillo/art/dither';
import { blk, px, faceCtx, talkMouth, type SpritePainter } from 'membrillo/art/sprites';

const W = 320;
const H = 180;
const WALL_TOP = 78;
const WALL_BASE = 122;

// The static background is painted once into an offscreen canvas and blitted
// every frame; only state-gated props and ambience are drawn per frame.
let bg: HTMLCanvasElement | null = null;

function cachedBg(): HTMLCanvasElement {
  if (!bg) {
    bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    orchardStatic(bg.getContext('2d')!);
  }
  return bg;
}

/** Deterministic pseudo-random for tuft/shimmer placement. */
function hash(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

// The canopy is one joined mass: a dark edge pass, then fill, then inner
// volume and lit dapples — outlined rects read as crates, not foliage.
const CANOPY: readonly (readonly [number, number, number, number])[] = [
  [54, 24, 80, 30],
  [64, 12, 56, 20],
  [72, 42, 50, 14],
];

function canopy(ctx: CanvasRenderingContext2D): void {
  const edge = mix(P.grassDark, P.black, 0.45);
  for (const [x, y, w, h] of CANOPY) px(ctx, x - 1, y - 1, w + 2, h + 2, edge);
  for (const [x, y, w, h] of CANOPY) px(ctx, x, y, w, h, P.grassDark);
  for (const [x, y, w, h] of CANOPY) px(ctx, x + 3, y + 2, w - 6, h - 6, P.grass);
  for (let i = 0; i < 26; i++) {
    const dx = 58 + Math.floor(hash(i + 700) * 72);
    const dy = 15 + Math.floor(hash(i + 800) * 38);
    px(ctx, dx, dy, 2, 1, mix(P.grass, P.grassLit, 0.7));
  }
  // underside shadow where the trunk enters
  px(ctx, 76, 52, 40, 4, mix(P.grassDark, P.black, 0.3));
}

function orchardStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, W, WALL_TOP, [P.skyTop, P.skyMid, P.skyLow]);
  // treetops beyond the wall
  px(ctx, 10, WALL_TOP - 6, 54, 6, mix(P.grassDark, P.skyMid, 0.35));
  px(ctx, 210, WALL_TOP - 4, 70, 4, mix(P.grassDark, P.skyMid, 0.4));
  // the wall, coursed
  px(ctx, 0, WALL_TOP, W, WALL_BASE - WALL_TOP, P.stone);
  px(ctx, 0, WALL_TOP, W, 2, P.stoneLit);
  for (let y = WALL_TOP + 8; y < WALL_BASE; y += 12) {
    px(ctx, 0, y, W, 1, mix(P.stone, P.black, 0.35));
    const shift = ((y / 12) % 2) * 16;
    for (let x = shift; x < W; x += 32) px(ctx, x, y - 8, 1, 8, mix(P.stone, P.black, 0.25));
  }
  // the gateway: posts, lintel, and the lane glimpsed through it (the closed
  // leaf is drawn per frame over this until the bolt slides)
  blk(ctx, 286, 86, 28, WALL_BASE - 86, mix(P.woodDark, P.black, 0.4));
  px(ctx, 288, 90, 24, 22, P.skyLow);
  px(ctx, 288, 112, 24, 10, P.grassLit);
  px(ctx, 284, 84, 32, 3, P.woodDark); // lintel
  // lawn
  rampRect(ctx, 0, WALL_BASE, W, H - WALL_BASE, [P.grassLit, P.grass, P.grassDark]);
  for (let i = 0; i < 60; i++) {
    const tx = Math.floor(hash(i) * W);
    const ty = WALL_BASE + 4 + Math.floor(hash(i + 60) * (H - WALL_BASE - 8));
    px(ctx, tx, ty, 1, 2, mix(P.grassDark, P.black, 0.2));
  }
  // box hedge against the wall: edged mass, clipped-flat top, ground shadow
  px(ctx, 127, 99, 66, 24, mix(P.grassDark, P.black, 0.45));
  px(ctx, 128, 100, 64, 22, P.grassDark);
  px(ctx, 130, 101, 60, 3, P.grass);
  for (let i = 0; i < 14; i++) {
    px(ctx, 132 + Math.floor(hash(i + 200) * 56), 105 + Math.floor(hash(i + 300) * 13), 2, 1, mix(P.grassDark, P.grassLit, 0.4));
  }
  px(ctx, 130, WALL_BASE, 62, 2, mix(P.grass, P.black, 0.3));
  // the quince tree: trunk up into the canopy, roots into the lawn
  blk(ctx, 84, 46, 10, WALL_BASE - 46, P.wood);
  px(ctx, 85, 48, 3, WALL_BASE - 50, P.woodLit);
  px(ctx, 78, WALL_BASE - 4, 22, 4, P.wood); // root flare
  canopy(ctx);
  // fruit too tangled to reach (set dressing; the one that matters is dynamic)
  px(ctx, 68, 28, 2, 2, P.brass);
  px(ctx, 88, 18, 2, 2, P.brassLit);
  px(ctx, 100, 48, 2, 2, P.brass);
}

function orchard(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg(), 0, 0);
  // canopy shimmer
  for (let i = 0; i < 10; i++) {
    if (Math.sin(t * 2.1 + i * 1.9) > 0.6) {
      px(ctx, 60 + Math.floor(hash(i + 400) * 62), 20 + Math.floor(hash(i + 500) * 34), 2, 1, P.grassLit);
    }
  }
  // the prize quince on the high branch
  if (!state.flags.includes('picked_quince')) {
    const sway = Math.round(Math.sin(t * 1.6));
    blk(ctx, 106 + sway, 38, 3, 3, P.brassLit);
    px(ctx, 106 + sway, 37, 1, 1, P.grassDark); // stem
  }
  // the lost hook, glinting in the hedge
  if (!state.flags.includes('took_hook')) {
    if (Math.sin(t * 2.4) > 0.2) px(ctx, 172, 110, 4, 2, P.brassLit);
    px(ctx, 176, 108, 2, 2, P.wood);
  }
  // the gate leaf: closed over the opening, or ajar against the post
  if (!state.flags.includes('gate_open')) {
    blk(ctx, 288, 88, 24, WALL_BASE - 88, P.wood);
    for (let x = 293; x < 311; x += 6) px(ctx, x, 90, 1, WALL_BASE - 92, P.woodDark);
    px(ctx, 289, 89, 22, 2, P.woodLit);
    px(ctx, 306, 104, 4, 3, P.brass); // the unsympathetic bolt
  } else {
    blk(ctx, 286, 88, 4, WALL_BASE - 88, P.woodDark); // edge-on, swung inward
  }
  // a bee working the canopy
  const bx = 92 + Math.cos(t * 0.9) * 28;
  const by = 38 + Math.sin(t * 1.7) * 12;
  px(ctx, Math.round(bx), Math.round(by), 1, 1, P.glow);
}

// --- Sprites ----------------------------------------------------------------

const gardener: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const bob = Math.round(Math.sin(t * 1.3));
  const y = fy + bob;
  // boots
  blk(ctx, fx - 5, y - 10, 4, 10, P.night);
  blk(ctx, fx + 1, y - 10, 4, 10, P.night);
  // shirt + green apron
  blk(ctx, fx - 7, y - 28, 14, 19, P.cloth);
  px(ctx, fx - 5, y - 26, 10, 16, P.grass);
  px(ctx, fx - 5, y - 26, 10, 2, P.grassLit);
  // arms; the near one gestures while he talks
  blk(ctx, fx - 8, y - 24, 3, 10, P.cloth);
  const gesture = pose.talking && Math.sin(t * 3.4) > 0 ? 2 : 0;
  blk(ctx, fx + 5, y - 24 - gesture, 3, 10, P.cloth);
  // head under a straw hat
  blk(ctx, fx - 4, y - 37, 9, 10, P.skin);
  px(ctx, fx + 2, y - 33, 1, 2, P.black); // eye
  talkMouth(ctx, fx + 1, y - 30, pose.talking, t);
  px(ctx, fx - 6, y - 39, 13, 3, P.brassLit); // brim
  px(ctx, fx - 3, y - 42, 7, 3, P.brass); // crown
  ctx.restore();
};

export const scenes = { orchard };
export const sprites = { gardener };
