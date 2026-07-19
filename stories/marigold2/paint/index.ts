// Painters for Gale Reach. Crew sprites are shared with mission 1 (sibling
// stories may import each other's paint modules — draw-only code). New here:
// a 320x400 TALL scene (the shaft), colour-cycled aurora, and a full-screen
// cutscene card that reads state (beacon dark on arrival, beaming at the end).

import type { State } from '../../../engine/core/types.ts';
import { P, css, cycle, mix, type RGB } from '../../../engine/art/palette.ts';
import { rampRect } from '../../../engine/art/dither.ts';
import { blk, px, faceCtx, type SpritePainter } from '../../../engine/art/sprites.ts';
import { sprites as crew } from '../../marigold/paint/index.ts';

const VIEW_W = 320;
const VIEW_H = 180;
const SHAFT_H = 400;

const hull: RGB = mix(P.night, P.stone, 0.35);
const hullLit: RGB = mix(hull, P.white, 0.18);
const hullDark: RGB = mix(hull, P.black, 0.3);
const chrome: RGB = mix(P.stoneLit, P.white, 0.45);

// The aurora bands — cycled slowly for the classic VGA palette-animation feel.
const AURORA: RGB[] = [
  mix(P.grassLit, P.seaLit, 0.4),
  mix(P.seaLit, P.skyMid, 0.3),
  mix(P.skyMid, P.cloth, 0.25),
  mix(P.grassLit, P.white, 0.3),
];

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

// --- Landing bay ------------------------------------------------------------

function landingStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, VIEW_W, 124, [P.night, hull, hullDark]);
  for (let x = 10; x < VIEW_W; x += 46) px(ctx, x, 0, 3, 34, hullDark); // ribs
  // wall grille
  blk(ctx, 16, 58, 26, 22, hullDark);
  for (let y = 62; y < 78; y += 4) px(ctx, 19, y, 20, 2, mix(hullDark, P.black, 0.4));
  // charging rack
  blk(ctx, 118, 94, 34, 28, hullDark);
  for (let i = 0; i < 3; i++) blk(ctx, 122 + i * 10, 98, 7, 18, mix(hull, P.black, 0.2));
  px(ctx, 124, 100, 3, 3, P.grassLit); // the one live cell light
  // stores cabinet
  blk(ctx, 230, 82, 44, 48, mix(hull, P.wood, 0.2));
  px(ctx, 234, 86, 36, 3, hullLit);
  px(ctx, 248, 104, 8, 6, P.cloth); // lock light
  // deck
  rampRect(ctx, 0, 124, VIEW_W, 56, [mix(hull, P.black, 0.05), hullDark]);
  for (let y = 130; y < VIEW_H; y += 12) px(ctx, 0, y, VIEW_W, 1, mix(hullDark, P.black, 0.3));
  // beam circle
  ctx.strokeStyle = css(P.brass);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(58, 150, 24, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  // shaft door
  blk(ctx, 288, 94, 26, 62, P.woodDark);
  px(ctx, 290, 98, 22, 54, mix(P.woodDark, P.black, 0.45));
}

function landing(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('landing', VIEW_W, VIEW_H, landingStatic), 0, 0);
  // the cell light dies once taken
  if (state.flags.includes('took_cell')) px(ctx, 124, 100, 3, 3, mix(hull, P.black, 0.2));
  // cabinet lock: red until the drone opens it
  px(ctx, 248, 104, 8, 6, state.flags.includes('woke_drone') ? P.grassLit : P.cloth);
  // the song, visualized: the grille pulses gently until settled
  if (!state.flags.includes('song_settled')) {
    const g = 0.4 + Math.sin(t * 2.1) * 0.25;
    px(ctx, 19, 62, 20, 2, mix(hullDark, cycle(AURORA, t, 2), g));
  }
}

// --- The shaft (320x400 — the camera climbs with you) -----------------------

function shaftStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, VIEW_W, SHAFT_H, [P.night, hull, hullDark]);
  // flights: four landings joined by side stairs (match the walkboxes)
  const landings = [392, 312, 232, 152];
  for (const y of landings) {
    px(ctx, 0, y - 2, VIEW_W, 4, hullDark);
    px(ctx, 0, y - 3, VIEW_W, 1, hullLit);
  }
  // stair sides (right, left, right)
  for (const [x, yTop] of [
    [258, 272],
    [8, 192],
    [258, 112],
  ] as const) {
    for (let i = 0; i < 9; i++) px(ctx, x + 4, yTop + 108 - i * 12, 46, 3, mix(hull, P.white, 0.12));
  }
  // window frames (glass painted live)
  blk(ctx, 20, 236, 28, 32, hullDark);
  blk(ctx, 270, 156, 28, 32, hullDark);
  // the door back down to the landing bay (bottom-left landing)
  blk(ctx, 8, 312, 28, 52, P.woodDark);
  px(ctx, 11, 316, 22, 46, mix(P.woodDark, P.black, 0.45));
  px(ctx, 12, 318, 20, 3, P.grassLit); // lit DOWN strip over the lintel
  // Mote's core grille
  blk(ctx, 54, 64, 30, 28, hullDark);
  for (let y = 70; y < 88; y += 4) px(ctx, 58, y, 22, 2, mix(hullDark, P.black, 0.4));
  // beacon head + socket housing at the very top
  blk(ctx, 120, 20, 80, 34, P.stoneDark);
  px(ctx, 126, 26, 68, 22, P.night);
  blk(ctx, 138, 56, 44, 44, mix(hull, P.brass, 0.2));
  px(ctx, 146, 64, 28, 28, P.night); // the empty socket
}

function shaft(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('shaft', VIEW_W, SHAFT_H, shaftStatic), 0, 0);
  const settled = state.flags.includes('song_settled');
  // aurora through the windows — colour-cycled, the sky-rays' weather
  for (const [x, y] of [
    [22, 238],
    [272, 158],
  ] as const) {
    ctx.fillStyle = css(cycle(AURORA, t + x, 3));
    ctx.fillRect(x, y, 24, 28);
    ctx.fillStyle = css(mix(cycle(AURORA, t + x + 1, 3), P.black, 0.3));
    ctx.fillRect(x, y + 10 + Math.floor(Math.sin(t * 1.3) * 4), 24, 4); // drifting band
  }
  // the beacon head: singing = fast cycle; settled = a slow contented pulse
  if (settled) {
    const g = 0.5 + Math.sin(t * 1.1) * 0.2;
    px(ctx, 126, 26, 68, 22, mix(P.night, P.glow, g));
  } else {
    px(ctx, 126, 26, 68, 22, mix(P.night, cycle(AURORA, t, 6), 0.75));
  }
  if (state.flags.includes('link_ready')) px(ctx, 146, 64, 28, 28, mix(P.night, P.grassLit, 0.4));
}

// --- Full-screen cutscene card (used by brief2 AND sung, state-varied) ------

function cardStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, VIEW_W, 120, [P.night, mix(P.night, P.skyTop, 0.5), P.skyTop]);
  // the sea
  rampRect(ctx, 0, 120, VIEW_W, 60, [P.seaDeep, mix(P.seaDeep, P.black, 0.4)]);
  // the crag and the station silhouette
  ctx.fillStyle = css(P.black);
  ctx.beginPath();
  ctx.moveTo(180, 180);
  ctx.lineTo(200, 96);
  ctx.lineTo(226, 88);
  ctx.lineTo(252, 100);
  ctx.lineTo(280, 180);
  ctx.fill();
  px(ctx, 218, 46, 10, 44, P.black); // the beacon tower
  blk(ctx, 214, 34, 18, 14, mix(P.black, P.stone, 0.3)); // the head
}

function card(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('card', VIEW_W, VIEW_H, cardStatic), 0, 0);
  // aurora curtains, cycling
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 62 + Math.sin(t * 0.4 + i) * 8;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = css(cycle(AURORA, t + i, 2));
    ctx.fillRect(x, 8, 14, 84 + Math.sin(t * 0.6 + i * 2) * 10);
    ctx.globalAlpha = 1;
  }
  // sky-rays: dark ribbons riding the bands
  for (let i = 0; i < 3; i++) {
    const rx = ((t * (6 + i * 2) + i * 130) % (VIEW_W + 40)) - 20;
    const ry = 30 + i * 18 + Math.sin(t * 1.2 + i * 2) * 6;
    px(ctx, rx, ry, 12, 2, mix(P.night, P.black, 0.5));
    px(ctx, rx + 3, ry - 1, 6, 1, mix(P.night, P.black, 0.5));
  }
  const settled = state.flags.includes('song_settled');
  if (settled) {
    // the beacon beams, and the head glows warm
    const g = 0.6 + Math.sin(t * 1.4) * 0.2;
    px(ctx, 216, 36, 14, 10, mix(P.night, P.glow, g));
    ctx.globalAlpha = 0.25 + Math.sin(t * 1.4) * 0.08;
    ctx.fillStyle = css(P.glow);
    ctx.beginPath();
    ctx.moveTo(223, 40);
    ctx.lineTo(60, 0);
    ctx.lineTo(140, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // dark head; the song shown as cycling ripples from the tower
    const ring = Math.floor((t * 14) % 40);
    ctx.strokeStyle = css(mix(cycle(AURORA, t, 4), P.black, 0.3));
    ctx.globalAlpha = Math.max(0, 0.5 - ring / 80);
    ctx.beginPath();
    ctx.arc(223, 40, 6 + ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// --- Drone sprites ----------------------------------------------------------

const droneSleep: SpritePainter = (ctx, fx, fy, _pose, t) => {
  // a dust-caked dome, curled like a cat; breathes very slowly
  const b = Math.sin(t * 0.8) > 0.9 ? 1 : 0;
  blk(ctx, fx - 8, fy - 10 - b, 16, 10 + b, mix(chrome, P.wood, 0.35));
  px(ctx, fx - 6, fy - 9 - b, 12, 2, mix(chrome, P.wood, 0.15));
  px(ctx, fx + 3, fy - 6, 2, 1, mix(P.cloth, P.black, 0.3)); // dim standby light
};

const drone: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const hop = pose.walking ? Math.abs(Math.round(Math.sin(pose.phase) * 2)) : 0;
  const y = fy - hop;
  // little tracked base + dome, freshly awake and proud of it
  blk(ctx, fx - 7, y - 5, 14, 5, mix(chrome, P.black, 0.35));
  blk(ctx, fx - 6, y - 14, 12, 9, chrome);
  px(ctx, fx - 4, y - 13, 8, 2, mix(chrome, P.white, 0.4));
  px(ctx, fx + 1, y - 11, 2, 2, Math.sin(t * 3) > 0 ? P.grassLit : mix(P.grassLit, P.black, 0.3));
  px(ctx, fx - 3, y - 16, 1, 2, chrome); // antenna
  px(ctx, fx - 3, y - 17, 1, 1, P.cloth);
  ctx.restore();
};

export const scenes = { landing, shaft, card };
export const sprites = { cog: crew.cog, solace: crew.solace, droneSleep, drone };

function clutterProp(ctx: CanvasRenderingContext2D, _state: State, _t: number): void {
  // Mote's spiral of rearranged furniture: stacked chairs and a crate
  blk(ctx, 158, 124, 22, 24, mix(hull, P.wood, 0.3));
  blk(ctx, 164, 108, 18, 16, mix(hull, P.wood, 0.2));
  px(ctx, 166, 110, 14, 2, hullLit);
  blk(ctx, 180, 132, 16, 16, mix(hull, P.wood, 0.35));
  px(ctx, 160, 126, 18, 2, hullLit);
}

export const props = { clutter: clutterProp };
