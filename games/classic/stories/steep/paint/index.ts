// Painters for Operation Steep. Draw-only: painters may READ state to vary
// what they draw, never change it. All game logic lives in the scene JSON.
//
// This story exercises manifest.actor (Earl Grey's tux replaces the engine
// actor) and the shared walkFrame gait — every walking body steps to it.

import type { State } from 'membrillo/core/types';
import { portraitImage } from 'membrillo/art/images';
import { P, css, mix, rgba, type RGB } from 'membrillo/art/palette';
import { rampRect } from 'membrillo/art/dither';
import {
  blk,
  px,
  faceCtx,
  talkMouth,
  blinking,
  walkFrame,
  PORTRAIT,
  type PortraitPainter,
  type SpritePainter,
  type WalkFrame,
} from 'membrillo/art/sprites';

const H = 180;

const bgCache = new Map<string, HTMLCanvasElement>();
function cachedBg(id: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let canvas = bgCache.get(id);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d')!);
    bgCache.set(id, canvas);
  }
  return canvas;
}

function hash(i: number): number {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

// Shared colours
const WINE = mix(P.cloth, P.black, 0.45); // salon walls
const PINK = mix(P.cloth, P.white, 0.45); // lasers, marzipan accents
const CREAM = mix(P.glow, P.white, 0.5); // the Baron's suit

// --- Sprite helpers ---------------------------------------------------------

/** Striding legs for the shared gait; profile gets the x-stride. */
function legs(ctx: CanvasRenderingContext2D, fx: number, y: number, f: WalkFrame, profile: boolean, c: RGB): void {
  const aDx = profile ? f.aDx : 0;
  const bDx = profile ? f.bDx : 0;
  blk(ctx, fx - 5 + aDx, y - 12, 4, 12 - f.aUp, c);
  blk(ctx, fx + 1 + bDx, y - 12, 4, 12 - f.bUp, c);
}

// --- Agent Earl Grey (the player's tux — manifest.actor) --------------------

const earlGrey: SpritePainter = (ctx, fx, fy, pose, t) => {
  const f = walkFrame(pose);
  const bob = pose.walking ? 0 : Math.round(Math.sin(t * 1.8));
  const y = fy + bob - f.rise;
  const profile = pose.facing === 'left' || pose.facing === 'right';
  const sway = profile ? 0 : f.swing === 0 ? 0 : f.swing > 0 ? 1 : -1;

  faceCtx(ctx, fx, pose.facing);
  legs(ctx, fx, y, f, profile, P.black);
  // dinner jacket over a white dress shirt
  blk(ctx, fx - 6 + sway, y - 26, 12, 15, P.black);
  px(ctx, fx - 2 + sway, y - 26, 4, 9, P.white); // shirt front
  px(ctx, fx - 1 + sway, y - 26, 2, 2, P.night); // bow tie
  px(ctx, fx - 6 + sway, y - 26, 12, 1, mix(P.black, P.white, 0.25)); // satin lapel line
  px(ctx, fx + 4 + sway, y - 24, 1, 2, P.white); // pocket square
  // arms
  blk(ctx, fx - 9 + sway, y - 25, 3, 11 - f.swing, P.black);
  blk(ctx, fx + 6 + sway, y - 25, 3, 11 + f.swing, P.black);
  // head: composed, well-barbered
  blk(ctx, fx - 4 + sway, y - 36, 9, 10, P.skin);
  if (pose.facing === 'up') {
    px(ctx, fx - 4 + sway, y - 36, 9, 7, P.night);
  } else if (profile) {
    px(ctx, fx - 4, y - 36, 9, 2, P.night);
    px(ctx, fx - 4, y - 35, 2, 3, P.night); // the sideburn of a serious man
    if (!blinking(t)) px(ctx, fx + 2, y - 32, 1, 2, P.black);
    talkMouth(ctx, fx + 3, y - 29, pose.talking, t);
  } else {
    px(ctx, fx - 4 + sway, y - 36, 9, 2, P.night);
    if (!blinking(t)) {
      px(ctx, fx - 2 + sway, y - 32, 1, 2, P.black);
      px(ctx, fx + 2 + sway, y - 32, 1, 2, P.black);
    }
    talkMouth(ctx, fx - 1 + sway, y - 29, pose.talking, t);
  }
  ctx.restore();
};

// --- Penny Farthing ---------------------------------------------------------

const penny: SpritePainter = (ctx, fx, fy, pose, t) => {
  const f = walkFrame(pose);
  const bob = pose.walking ? 0 : Math.round(Math.sin(t * 2.1));
  const y = fy + bob - f.rise;
  const profile = pose.facing === 'left' || pose.facing === 'right';
  const sway = profile ? 0 : f.swing === 0 ? 0 : f.swing > 0 ? 1 : -1;

  faceCtx(ctx, fx, pose.facing);
  legs(ctx, fx, y, f, profile, P.night);
  // croupier waistcoat over shirtsleeves
  blk(ctx, fx - 6 + sway, y - 26, 12, 15, P.seaDeep);
  px(ctx, fx - 2 + sway, y - 26, 4, 8, P.white);
  px(ctx, fx - 6 + sway, y - 15, 12, 2, P.sea); // watch chain-ish trim
  blk(ctx, fx - 9 + sway, y - 25, 3, 10 - f.swing, P.white);
  blk(ctx, fx + 6 + sway, y - 25, 3, 10 + f.swing, P.white);
  // head, auburn crop, goggles pushed up
  blk(ctx, fx - 4 + sway, y - 36, 9, 10, P.skin);
  if (pose.facing === 'up') {
    px(ctx, fx - 4 + sway, y - 36, 9, 7, P.wood);
    px(ctx, fx - 4 + sway, y - 38, 9, 2, P.brass);
  } else {
    px(ctx, fx - 4 + sway, y - 36, 9, 2, P.wood);
    px(ctx, fx - 4 + sway, y - 38, 9, 2, P.brass); // goggles in her hair
    px(ctx, fx - 2 + sway, y - 38, 2, 2, P.brassLit);
    if (profile) {
      if (!blinking(t)) px(ctx, fx + 2, y - 32, 1, 2, P.black);
      talkMouth(ctx, fx + 3, y - 29, pose.talking, t);
    } else {
      if (!blinking(t)) {
        px(ctx, fx - 2 + sway, y - 32, 1, 2, P.black);
        px(ctx, fx + 2 + sway, y - 32, 1, 2, P.black);
      }
      talkMouth(ctx, fx - 1 + sway, y - 29, pose.talking, t);
    }
  }
  ctx.restore();
};

// --- The supporting cast ----------------------------------------------------

const barman: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const y = fy + Math.round(Math.sin(t * 1.2));
  blk(ctx, fx - 5, y - 10, 4, 10, P.black);
  blk(ctx, fx + 1, y - 10, 4, 10, P.black);
  blk(ctx, fx - 7, y - 27, 14, 18, P.white); // the white jacket
  px(ctx, fx - 1, y - 27, 2, 12, P.stoneLit);
  px(ctx, fx - 1, y - 26, 2, 2, P.black); // black tie
  blk(ctx, fx - 9, y - 24, 3, 9, P.white);
  const polish = pose.talking ? 0 : Math.sin(t * 2.5) > 0.4 ? 1 : 0; // eternally polishing
  blk(ctx, fx + 5, y - 24 - polish, 3, 9, P.white);
  blk(ctx, fx - 4, y - 37, 9, 11, P.skin);
  px(ctx, fx - 4, y - 37, 9, 2, P.stoneLit); // distinguished silver
  if (!blinking(t)) px(ctx, fx + 2, y - 33, 1, 2, P.black);
  talkMouth(ctx, fx + 1, y - 30, pose.talking, t);
  ctx.restore();
};

const marzipan: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const y = fy + Math.round(Math.sin(t * 1.1));
  blk(ctx, fx - 5, y - 10, 4, 10, CREAM);
  blk(ctx, fx + 1, y - 10, 4, 10, CREAM);
  blk(ctx, fx - 7, y - 28, 14, 19, CREAM); // cream suit
  px(ctx, fx - 2, y - 28, 4, 10, P.white);
  px(ctx, fx - 1, y - 27, 2, 2, PINK); // pink cravat
  px(ctx, fx - 6, y - 25, 2, 2, PINK); // the marzipan lapel rose
  blk(ctx, fx - 8, y - 24, 3, 10, CREAM);
  const flourish = pose.talking && Math.sin(t * 3.8) > 0 ? 3 : 0;
  blk(ctx, fx + 5, y - 24 - flourish, 3, 10, CREAM);
  blk(ctx, fx - 4, y - 38, 9, 11, P.skin);
  px(ctx, fx - 4, y - 38, 9, 2, P.stoneLit);
  px(ctx, fx - 1, y - 31, 4, 1, P.stoneLit); // a moustache of some ambition
  if (!blinking(t)) px(ctx, fx + 2, y - 34, 1, 2, P.black);
  talkMouth(ctx, fx + 1, y - 29, pose.talking, t);
  ctx.restore();
};

const fondant: SpritePainter = (ctx, fx, fy, pose, t) => {
  const f = walkFrame(pose);
  const y = fy - f.rise;
  const profile = pose.facing === 'left' || pose.facing === 'right';
  faceCtx(ctx, fx, pose.facing);
  // a substantial gentleman: wider, taller, immovable
  blk(ctx, fx - 7 + (profile ? f.aDx : 0), y - 13, 5, 13 - f.aUp, P.black);
  blk(ctx, fx + 2 + (profile ? f.bDx : 0), y - 13, 5, 13 - f.bUp, P.black);
  blk(ctx, fx - 10, y - 32, 20, 20, P.night); // the suit, load-bearing
  px(ctx, fx - 2, y - 32, 4, 8, P.white);
  px(ctx, fx - 1, y - 30, 2, 6, P.wood); // novelty biscuit tie
  px(ctx, fx - 1, y - 28, 2, 1, P.woodLit);
  blk(ctx, fx - 13, y - 29, 3, 13, P.night);
  blk(ctx, fx + 10, y - 29, 3, 13, P.night);
  blk(ctx, fx - 5, y - 42, 11, 11, P.skin);
  if (pose.facing !== 'up') {
    if (!blinking(t + 1.3)) px(ctx, fx + (profile ? 3 : -2), y - 38, 1, 2, P.black);
    if (!profile && !blinking(t + 1.3)) px(ctx, fx + 3, y - 38, 1, 2, P.black);
  }
  // the bowler
  px(ctx, fx - 7, y - 44, 15, 3, P.black);
  px(ctx, fx - 4, y - 47, 9, 4, P.black);
  ctx.restore();
};

// --- The Grand Salon (480×180) ----------------------------------------------

const SALON_W = 480;

function salonStatic(ctx: CanvasRenderingContext2D): void {
  // wine-dark panelled walls, wainscot, parquet
  px(ctx, 0, 0, SALON_W, 126, WINE);
  for (let x = 0; x < SALON_W; x += 60) {
    px(ctx, x + 8, 14, 44, 86, mix(WINE, P.black, 0.25));
    px(ctx, x + 10, 16, 40, 82, mix(WINE, P.cloth, 0.25));
  }
  px(ctx, 0, 100, SALON_W, 4, P.woodDark); // rail
  px(ctx, 0, 104, SALON_W, 22, mix(P.woodDark, P.black, 0.3));
  for (let y = 126; y < H; y += 6) {
    px(ctx, 0, y, SALON_W, 6, y % 12 === 0 ? P.wood : mix(P.wood, P.black, 0.15));
    px(ctx, 0, y, SALON_W, 1, P.woodLit);
  }
  // the bar top, stage left (the counter FRONT is a walk-behind prop, so the
  // barman stands behind it)
  px(ctx, 28, 104, 124, 6, P.woodLit);
  px(ctx, 28, 104, 124, 1, P.woodDark);
  px(ctx, 32, 60, 116, 40, mix(P.black, WINE, 0.5)); // mirrored back bar
  for (let i = 0; i < 9; i++) {
    const bx = 38 + i * 12;
    const colours = [P.sea, P.brass, P.cloth, P.grass] as const;
    px(ctx, bx, 72 + Math.floor(hash(i) * 8), 4, 18, colours[i % 4]!);
    px(ctx, bx + 1, 70 + Math.floor(hash(i) * 8), 2, 3, P.stoneLit);
  }
  // side table for the drinks tray
  blk(ctx, 192, 112, 32, 4, P.woodDark);
  blk(ctx, 204, 116, 6, 12, P.woodDark);
  // card table
  blk(ctx, 298, 108, 68, 18, P.grassDark);
  px(ctx, 302, 110, 60, 12, P.grass);
  px(ctx, 310, 112, 4, 3, P.white); // cards on the felt
  px(ctx, 318, 114, 4, 3, P.white);
  px(ctx, 340, 112, 3, 2, P.cloth); // chips
  px(ctx, 344, 113, 3, 2, P.brass);
  blk(ctx, 306, 126, 5, 10, P.woodDark);
  blk(ctx, 352, 126, 5, 10, P.woodDark);
  // terrace doors, stage right
  blk(ctx, 438, 82, 34, 64, P.woodDark);
  px(ctx, 441, 86, 13, 56, mix(P.night, P.skyTop, 0.5));
  px(ctx, 457, 86, 12, 56, mix(P.night, P.skyTop, 0.5));
  px(ctx, 454, 86, 3, 56, P.woodDark);
  // chandeliers
  for (const cx of [130, 258, 396]) {
    px(ctx, cx + 20, 0, 2, 8, P.brass);
    blk(ctx, cx, 8, 42, 6, P.brass);
    for (let i = 0; i < 6; i++) px(ctx, cx + 3 + i * 7, 14, 2, 4, P.glow);
  }
}

function salon(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('salon', SALON_W, H, salonStatic), 0, 0);
  // chandelier glimmer
  for (let i = 0; i < 10; i++) {
    if (Math.sin(t * 3 + i * 2.1) > 0.7) {
      const cx = [130, 258, 396][i % 3]!;
      px(ctx, cx + 3 + (i % 6) * 7, 18, 2, 1, P.white);
    }
  }
  if (!state.flags.includes('took_olive')) {
    blk(ctx, 108, 104, 18, 6, P.stoneLit); // the silver bowl
    px(ctx, 111, 103, 3, 2, P.grass); // olives of rank
    px(ctx, 116, 102, 3, 3, P.grassLit);
    px(ctx, 120, 104, 3, 2, P.grass);
  }
  if (!state.flags.includes('took_swizzle')) {
    px(ctx, 196, 108, 24, 3, P.stoneLit); // the tray
    px(ctx, 200, 105, 12, 1, mix(P.white, P.sea, 0.3)); // the swizzle stick
    px(ctx, 214, 104, 3, 4, mix(P.sea, P.white, 0.5)); // an abandoned glass
  }
}

/** The bar counter's front face — a walk-behind prop at baseline 126. */
function barCounter(ctx: CanvasRenderingContext2D, _state: State, _t: number): void {
  blk(ctx, 28, 110, 124, 16, P.woodDark);
  px(ctx, 30, 112, 120, 2, P.brass); // foot rail for the discerning elbow
  for (let x = 36; x < 148; x += 22) px(ctx, x, 116, 14, 8, mix(P.woodDark, P.black, 0.3));
}

// --- The Cliff Terrace (320×240, vertical) ----------------------------------

const TERR_W = 320;
const TERR_H = 240;

function terraceStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, TERR_W, 110, [P.black, P.night, P.skyTop]);
  // sea far below, off the cliff edge
  rampRect(ctx, 0, 110, TERR_W, 14, [P.seaDeep, P.sea]);
  px(ctx, 56, 64, 10, 10, P.glow); // the moon, gibbous and judgemental
  px(ctx, 58, 66, 4, 4, mix(P.glow, P.white, 0.6));
  // upper platform: the funicular station
  px(ctx, 108, 122, 180, 30, P.stone);
  px(ctx, 108, 122, 180, 2, P.stoneLit);
  blk(ctx, 146, 78, 60, 46, P.stoneDark); // station arch
  px(ctx, 152, 84, 48, 40, mix(P.night, P.black, 0.3));
  px(ctx, 158, 88, 14, 30, P.brass); // the carriage, brass and velvet
  px(ctx, 160, 92, 10, 8, mix(P.cloth, P.black, 0.2));
  px(ctx, 170, 20, 2, 60, P.stoneLit); // cables
  px(ctx, 178, 20, 2, 60, P.stoneLit);
  // steps down to the lower terrace
  for (let i = 0; i < 6; i++) {
    px(ctx, 216 + i * 4, 152 + i * 7, 64 - i * 4, 7, mix(P.stone, P.black, 0.1 + i * 0.05));
  }
  // lower terrace
  px(ctx, 0, 186, TERR_W, TERR_H - 186, mix(P.stone, P.black, 0.25));
  for (let y = 192; y < TERR_H; y += 12) px(ctx, 0, y, TERR_W, 1, mix(P.stone, P.black, 0.45));
  // balustrade at the cliff edge
  px(ctx, 64, 168, 140, 3, P.stoneLit);
  for (let x = 68; x < 200; x += 14) blk(ctx, x, 170, 3, 14, P.stone);
  px(ctx, 64, 182, 140, 3, P.stone);
  // salon doors, stage left
  blk(ctx, 2, 174, 24, 54, P.woodDark);
  px(ctx, 5, 178, 8, 46, mix(P.glow, P.woodDark, 0.55));
  px(ctx, 15, 178, 8, 46, mix(P.glow, P.woodDark, 0.6));
  // potted palm
  blk(ctx, 28, 176, 18, 12, P.cloth);
  px(ctx, 34, 150, 4, 28, P.woodDark);
  for (const [lx, ly] of [[22, 148], [30, 140], [42, 142], [48, 150]] as const) {
    px(ctx, lx, ly, 12, 3, P.grassDark);
  }
  // lanterns
  for (const lx of [70, 290]) {
    px(ctx, lx, 150, 2, 36, P.stoneDark);
    blk(ctx, lx - 2, 144, 6, 8, P.brass);
    px(ctx, lx - 1, 146, 4, 4, P.glow);
  }
}

function terrace(ctx: CanvasRenderingContext2D, _state: State, t: number): void {
  ctx.drawImage(cachedBg('terrace', TERR_W, TERR_H, terraceStatic), 0, 0);
  // stars
  for (let i = 0; i < 26; i++) {
    if (Math.sin(t * 1.4 + i * 2.3) > 0.2) {
      px(ctx, Math.floor(hash(i) * TERR_W), Math.floor(hash(i + 50) * 96), 1, 1, mix(P.white, P.skyTop, 0.4));
    }
  }
  // moonlight on the sea, under the moon
  for (let i = 0; i < 12; i++) {
    if (Math.sin(t * 2 + i * 1.7) > 0.5) px(ctx, 26 + Math.floor(hash(i + 90) * 70), 112 + (i % 3) * 4, 3, 1, mix(P.seaLit, P.glow, 0.4));
  }
  // lantern flames breathe
  for (const lx of [70, 290]) {
    const g = 0.5 + Math.sin(t * 3.1 + lx) * 0.2;
    px(ctx, lx - 1, 146, 4, 4, mix(P.brass, P.glow, g));
  }
}

// --- The Tea Room of Doom (480×180) -----------------------------------------

const LAIR_W = 480;

function lairStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, LAIR_W, 130, [P.black, mix(P.night, P.cloth, 0.15), P.night]);
  // hewn stone piers and hanging banners (pink, naturally)
  for (let x = 60; x < 300; x += 80) {
    px(ctx, x, 10, 12, 120, P.stoneDark);
    px(ctx, x + 2, 10, 3, 120, mix(P.stoneDark, P.stoneLit, 0.4));
    px(ctx, x + 30, 14, 18, 60, mix(PINK, P.black, 0.35));
    px(ctx, x + 33, 18, 12, 8, PINK); // crest: a rampant petit-four
  }
  // floor
  px(ctx, 0, 130, LAIR_W, H - 130, mix(P.stoneDark, P.black, 0.25));
  for (let y = 136; y < H; y += 10) px(ctx, 0, y, LAIR_W, 1, mix(P.stoneDark, P.black, 0.5));
  // funicular alcove, stage left
  blk(ctx, 8, 76, 40, 74, P.stoneDark);
  px(ctx, 12, 82, 32, 64, mix(P.night, P.black, 0.4));
  px(ctx, 18, 88, 14, 30, P.brass);
  // the Baron's tea table
  blk(ctx, 130, 116, 60, 12, P.white);
  px(ctx, 136, 112, 8, 5, CREAM); // cake stand
  px(ctx, 134, 110, 12, 2, P.stoneLit);
  px(ctx, 156, 112, 6, 4, PINK); // petit-fours in formation
  px(ctx, 166, 112, 6, 4, mix(P.grass, P.white, 0.4));
  blk(ctx, 140, 128, 5, 8, P.woodDark);
  blk(ctx, 176, 128, 5, 8, P.woodDark);
  // the doomsday samovar
  blk(ctx, 292, 88, 44, 54, P.brass);
  px(ctx, 296, 92, 12, 46, P.brassLit);
  px(ctx, 308, 84, 12, 6, P.brass); // crown valve
  px(ctx, 312, 78, 4, 8, P.stoneDark); // the spigot of destiny
  // laser emitter pylon
  blk(ctx, 368, 52, 12, 104, P.stoneDark);
  for (let i = 0; i < 5; i++) px(ctx, 370, 58 + i * 20, 8, 4, mix(PINK, P.white, 0.3));
  // THE FOUR O'CLOCK DEVICE: a rose-window clock wired to the samovar
  blk(ctx, 392, 36, 76, 120, P.stoneDark);
  px(ctx, 396, 40, 68, 112, mix(P.stoneDark, P.black, 0.4));
  blk(ctx, 400, 44, 60, 60, mix(P.glow, P.white, 0.3)); // the face
  px(ctx, 404, 48, 52, 52, P.glow);
  // hour markers
  px(ctx, 428, 48, 4, 4, P.black);
  px(ctx, 428, 96, 4, 4, P.black);
  px(ctx, 404, 72, 4, 4, P.black);
  px(ctx, 452, 72, 4, 4, P.black);
  // works below the face
  for (let i = 0; i < 4; i++) px(ctx, 402 + i * 15, 110 + (i % 2) * 10, 10, 6, P.brass);
  px(ctx, 340, 118, 52, 6, P.brassLit); // fat cable to the samovar
}

function lair(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('lair', LAIR_W, H, lairStatic), 0, 0);
  const cx = 430;
  const cy = 74;
  ctx.strokeStyle = css(P.black);
  ctx.lineWidth = 2;
  if (state.flags.includes('device_stopped')) {
    // 3:59 — the most beautiful minute-to in horological history
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 3, cy - 22); // minute hand hard on the 59
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 14, cy - 8); // hour hand shy of four
    ctx.stroke();
  } else {
    // creeping up on four o'clock
    const wob = Math.sin(t * 2) * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + wob, cy - 22);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 15, cy - 6);
    ctx.stroke();
    // the lasers: a fan of rose-pink doom in front of the Device
    for (let i = 0; i < 5; i++) {
      const ly = 60 + i * 20;
      const hum = Math.sin(t * 6 + i) > -0.4;
      if (hum) {
        px(ctx, 380, ly, 88, 1, PINK);
        if (Math.sin(t * 9 + i * 2) > 0.5) px(ctx, 380 + Math.floor(hash(i + 30) * 80), ly, 6, 1, P.white);
      }
    }
  }
  // samovar steam
  for (let i = 0; i < 4; i++) {
    const sy = 70 - ((t * 14 + i * 22) % 44);
    const sx = 312 + Math.sin(t * 1.5 + i) * 4;
    ctx.fillStyle = rgba(P.white, 0.25);
    ctx.fillRect(Math.round(sx), Math.round(sy + 8), 3, 2);
  }
}

// --- Full-screen cards (320×180, drawn at view size) ------------------------

function briefCard(ctx: CanvasRenderingContext2D, _state: State, t: number): void {
  px(ctx, 0, 0, 320, 180, mix(P.night, P.black, 0.6));
  // the cone of the desk lamp
  ctx.fillStyle = rgba(P.glow, 0.12);
  ctx.beginPath();
  ctx.moveTo(208, 34);
  ctx.lineTo(150, 132);
  ctx.lineTo(272, 132);
  ctx.closePath();
  ctx.fill();
  blk(ctx, 196, 26, 26, 8, P.stoneDark); // lamp shade
  px(ctx, 206, 34, 4, 6, P.glow);
  px(ctx, 218, 20, 3, 8, P.stoneDark); // stalk
  // the desk, the dossier, the tea
  px(ctx, 120, 128, 180, 8, P.woodDark);
  blk(ctx, 168, 112, 44, 16, mix(P.glow, P.wood, 0.5)); // manila dossier
  px(ctx, 172, 116, 30, 2, P.black);
  px(ctx, 172, 121, 22, 2, P.black);
  px(ctx, 186, 108, 8, 4, P.cloth); // TOP SECRET ribbon
  blk(ctx, 240, 116, 12, 10, P.white); // Auntie's cup
  px(ctx, 252, 118, 4, 4, P.white);
  const steam = Math.sin(t * 2.5) * 2;
  ctx.fillStyle = rgba(P.white, 0.3);
  ctx.fillRect(244 + Math.round(steam), 104, 2, 8);
  // the S.C.O.N.E. crest
  blk(ctx, 36, 30, 40, 34, P.stoneDark);
  px(ctx, 44, 38, 24, 16, mix(P.glow, P.wood, 0.6)); // a scone rampant
  px(ctx, 48, 36, 6, 4, mix(P.glow, P.wood, 0.6));
  px(ctx, 50, 44, 4, 3, P.cloth); // jam
  px(ctx, 58, 46, 4, 3, P.white); // cream (in the correct order for nobody)
}

function victoryCard(ctx: CanvasRenderingContext2D, _state: State, t: number): void {
  rampRect(ctx, 0, 0, 320, 180, [P.skyTop, P.skyMid, P.skyLow, P.horizon]);
  // the great clock, stopped in golden light
  blk(ctx, 118, 28, 84, 84, mix(P.glow, P.white, 0.3));
  px(ctx, 124, 34, 72, 72, P.glow);
  px(ctx, 156, 36, 8, 6, P.black);
  px(ctx, 156, 100, 8, 6, P.black);
  px(ctx, 126, 68, 8, 6, P.black);
  px(ctx, 186, 68, 8, 6, P.black);
  ctx.strokeStyle = css(P.black);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(160, 70);
  ctx.lineTo(155, 38); // minute hand: :59, held forever
  ctx.moveTo(160, 70);
  ctx.lineTo(180, 58); // hour hand: almost four
  ctx.stroke();
  // the celebratory cup, foreground
  px(ctx, 60, 140, 200, 40, mix(P.night, P.skyTop, 0.5));
  blk(ctx, 140, 128, 30, 22, P.white);
  px(ctx, 170, 132, 8, 8, P.white);
  px(ctx, 144, 132, 22, 3, mix(P.wood, P.black, 0.3)); // proper strong tea
  for (let i = 0; i < 3; i++) {
    const sy = 118 - ((t * 10 + i * 14) % 30);
    ctx.fillStyle = rgba(P.white, 0.35);
    ctx.fillRect(148 + i * 6 + Math.round(Math.sin(t * 2 + i) * 2), Math.round(sy), 2, 6);
  }
}

// --- Dialogue portraits (90×160 close-ups; code-drawn test art — generated
// art drops in later via membrillo/art/images portraitImage) ----------------

/** Dithered backdrop + frame shared by the cast's portraits. */
function portraitBg(ctx: CanvasRenderingContext2D, a: RGB, b: RGB): void {
  rampRect(ctx, 0, 0, PORTRAIT.w, PORTRAIT.h, [a, b]);
  px(ctx, 0, 0, PORTRAIT.w, 2, mix(a, P.white, 0.15));
}

/** Blink + animated mouth for a portrait head; mx/my centre the mouth. */
function portraitMouth(ctx: CanvasRenderingContext2D, mx: number, my: number, talking: boolean, t: number): void {
  if (talking) {
    const open = Math.sin(t * 11) > 0 ? 5 : 2;
    px(ctx, mx - 4, my, 8, open, mix(P.black, P.cloth, 0.35));
    if (open > 3) px(ctx, mx - 3, my + open - 2, 6, 1, P.skinShade);
  } else {
    px(ctx, mx - 4, my + 1, 8, 2, P.skinShade); // resting line
  }
}

const earlGreyPortrait: PortraitPainter = (ctx, _state, t, talking) => {
  portraitBg(ctx, mix(P.night, P.black, 0.4), P.night);
  const bob = Math.round(Math.sin(t * 1.2));
  const y = 58 + bob;
  // the dinner jacket: black shoulders, white shirt front, bow tie
  blk(ctx, 8, 116 + bob, 74, 44, P.black);
  px(ctx, 32, 116 + bob, 26, 44, P.white);
  px(ctx, 30, 116 + bob, 2, 44, mix(P.black, P.white, 0.3)); // satin lapel
  px(ctx, 58, 116 + bob, 2, 44, mix(P.black, P.white, 0.3));
  px(ctx, 38, 118 + bob, 14, 6, P.night); // the bow tie
  px(ctx, 44, 119 + bob, 2, 4, P.black);
  // neck + a face of professional composure
  blk(ctx, 36, 104 + bob, 18, 16, P.skinShade);
  blk(ctx, 24, y - 2, 42, 52, P.skin);
  px(ctx, 24, y + 32, 42, 16, P.skinShade);
  px(ctx, 20, y - 10, 50, 10, P.night); // impeccable dark hair
  px(ctx, 20, y - 4, 6, 18, P.night); // sideburn of a serious man
  if (!blinking(t + 0.4)) {
    px(ctx, 31, y + 12, 7, 5, P.white);
    px(ctx, 50, y + 12, 7, 5, P.white);
    px(ctx, 34, y + 13, 3, 4, mix(P.seaDeep, P.black, 0.5));
    px(ctx, 53, y + 13, 3, 4, mix(P.seaDeep, P.black, 0.5));
  } else {
    px(ctx, 31, y + 15, 7, 2, P.skinShade);
    px(ctx, 50, y + 15, 7, 2, P.skinShade);
  }
  px(ctx, 30, y + 8, 9, 2, P.night); // one brow fractionally raised
  px(ctx, 49, y + 7, 9, 2, P.night);
  portraitMouth(ctx, 44, y + 35, talking, t);
};

const pennyPortraitDrawn: PortraitPainter = (ctx, _state, t, talking) => {
  portraitBg(ctx, mix(P.seaDeep, P.black, 0.35), P.seaDeep);
  const bob = Math.round(Math.sin(t * 1.4));
  const y = 58 + bob;
  // shoulders: croupier waistcoat over rolled white sleeves
  blk(ctx, 8, 118 + bob, 74, 42, P.seaDeep);
  px(ctx, 30, 118 + bob, 30, 42, P.white);
  px(ctx, 34, 122 + bob, 22, 38, mix(P.seaDeep, P.black, 0.2)); // waistcoat V
  px(ctx, 42, 126 + bob, 6, 30, P.sea); // watch chain
  // neck + head
  blk(ctx, 36, 104 + bob, 18, 16, P.skinShade);
  blk(ctx, 22, y - 4, 46, 54, P.skin);
  px(ctx, 22, y + 34, 46, 16, P.skinShade); // jaw shading
  // auburn crop + goggles pushed up
  px(ctx, 18, y - 12, 54, 16, P.wood);
  px(ctx, 18, y - 2, 8, 28, P.wood);
  px(ctx, 20, y - 16, 50, 8, P.brass); // goggles band
  px(ctx, 28, y - 16, 12, 6, P.brassLit); // lens
  px(ctx, 48, y - 16, 12, 6, P.brassLit);
  // eyes: quick, appraising
  if (!blinking(t + 0.9)) {
    px(ctx, 30, y + 12, 8, 6, P.white);
    px(ctx, 50, y + 12, 8, 6, P.white);
    px(ctx, 33, y + 14, 3, 4, mix(P.seaDeep, P.black, 0.3));
    px(ctx, 53, y + 14, 3, 4, mix(P.seaDeep, P.black, 0.3));
  } else {
    px(ctx, 30, y + 15, 8, 2, P.skinShade);
    px(ctx, 50, y + 15, 8, 2, P.skinShade);
  }
  px(ctx, 29, y + 8, 10, 2, P.wood); // brows, one cocked
  px(ctx, 49, y + 6, 10, 2, P.wood);
  px(ctx, 26, y + 24, 3, 2, P.skinShade); // freckles
  px(ctx, 60, y + 22, 3, 2, P.skinShade);
  portraitMouth(ctx, 45, y + 36, talking, t);
};

const marzipanPortrait: PortraitPainter = (ctx, _state, t, talking) => {
  portraitBg(ctx, mix(PINK, P.black, 0.55), mix(PINK, P.black, 0.2));
  const bob = Math.round(Math.sin(t * 1.1));
  const y = 56 + bob;
  // cream suit shoulders, pink cravat, the marzipan rose
  blk(ctx, 6, 116 + bob, 78, 44, CREAM);
  px(ctx, 34, 116 + bob, 22, 44, P.white);
  px(ctx, 38, 120 + bob, 14, 12, PINK); // cravat
  px(ctx, 12, 124 + bob, 8, 8, PINK); // the rose
  px(ctx, 14, 126 + bob, 4, 4, mix(PINK, P.white, 0.5));
  // head: broad, glazed, calm
  blk(ctx, 34, 102 + bob, 22, 18, P.skinShade);
  blk(ctx, 20, y - 2, 50, 56, P.skin);
  px(ctx, 20, y + 36, 50, 18, P.skinShade);
  px(ctx, 16, y - 10, 58, 12, P.stoneLit); // silver sweep
  px(ctx, 16, y - 2, 6, 20, P.stoneLit);
  if (!blinking(t + 2.2)) {
    px(ctx, 30, y + 14, 8, 5, P.white);
    px(ctx, 52, y + 14, 8, 5, P.white);
    px(ctx, 33, y + 15, 3, 4, mix(P.wood, P.black, 0.4));
    px(ctx, 55, y + 15, 3, 4, mix(P.wood, P.black, 0.4));
  } else {
    px(ctx, 30, y + 17, 8, 2, P.skinShade);
    px(ctx, 52, y + 17, 8, 2, P.skinShade);
  }
  px(ctx, 29, y + 10, 10, 2, P.stoneLit);
  px(ctx, 51, y + 10, 10, 2, P.stoneLit);
  px(ctx, 34, y + 30, 22, 3, P.stoneLit); // the ambitious moustache
  const flourish = talking && Math.sin(t * 3.8) > 0.4;
  if (flourish) px(ctx, 74, 128 + bob, 10, 20, CREAM); // a hand, mid-gesture
  portraitMouth(ctx, 45, y + 38, talking, t);
};

const barmanPortrait: PortraitPainter = (ctx, _state, t, talking) => {
  portraitBg(ctx, mix(WINE, P.black, 0.4), WINE);
  const bob = Math.round(Math.sin(t * 1.2));
  const y = 58 + bob;
  // white jacket, black tie, perfect posture
  blk(ctx, 10, 116 + bob, 70, 44, P.white);
  px(ctx, 36, 116 + bob, 18, 44, P.stoneLit);
  px(ctx, 41, 118 + bob, 8, 22, P.black); // the tie
  blk(ctx, 36, 102 + bob, 18, 16, P.skinShade);
  blk(ctx, 24, y - 2, 42, 52, P.skin);
  px(ctx, 24, y + 32, 42, 16, P.skinShade);
  px(ctx, 20, y - 10, 50, 10, P.stoneLit); // distinguished silver, parted
  px(ctx, 44, y - 10, 2, 10, mix(P.stoneLit, P.black, 0.3));
  if (!blinking(t + 3.4)) {
    px(ctx, 31, y + 12, 7, 5, P.white);
    px(ctx, 50, y + 12, 7, 5, P.white);
    px(ctx, 34, y + 13, 3, 4, mix(P.night, P.black, 0.2));
    px(ctx, 53, y + 13, 3, 4, mix(P.night, P.black, 0.2));
  } else {
    px(ctx, 31, y + 15, 7, 2, P.skinShade);
    px(ctx, 50, y + 15, 7, 2, P.skinShade);
  }
  px(ctx, 30, y + 8, 9, 2, P.stoneLit);
  px(ctx, 49, y + 8, 9, 2, P.stoneLit);
  portraitMouth(ctx, 44, y + 34, talking, t);
};

export const scenes = { salon, terrace, lair, briefCard, victoryCard };
export const sprites = { earlGrey, penny, barman, marzipan, fondant };
export const props = { barCounter };
// Local-art overlay: paint/assets-local/ is GITIGNORED — drop generated
// portraits there (penny.jpg, marzipan.jpg, ...) and they replace the
// code-drawn ones on this machine only. Nothing generated ships in the repo
// unless it's deliberately moved into assets/ (a decision, not an accident).
const localArt = import.meta.glob('./assets-local/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const localPortrait = (file: string, fallback: PortraitPainter): PortraitPainter => {
  const url = localArt[`./assets-local/${file}`];
  return url !== undefined ? portraitImage(url) : fallback;
};

export const portraits = {
  earlGreyPortrait: localPortrait('earlgrey.jpg', earlGreyPortrait),
  pennyPortrait: localPortrait('penny.jpg', pennyPortraitDrawn),
  marzipanPortrait: localPortrait('marzipan.jpg', marzipanPortrait),
  barmanPortrait: localPortrait('barman.jpg', barmanPortrait),
};
