// Painters for The Marigold. Draw-only code: painters may READ state to vary
// drawing (the relay lights up, mist rolls once it's fixed), never write it.

import type { State } from 'membrillo/core/types';
import { P, css, mix, type RGB } from 'membrillo/art/palette';
import { rampRect } from 'membrillo/art/dither';
import {
  blk,
  px,
  faceCtx,
  talkMouth,
  blinking,
  walkFrame,
  type Pose,
  type SpritePainter,
  type WalkFrame,
} from 'membrillo/art/sprites';

const H = 180;
const BRIDGE_W = 320;
const HOLLOW_W = 420;

// Ship interior + uniform palette, mixed from engine palette stock.
const hull: RGB = mix(P.night, P.stone, 0.35);
const hullLit: RGB = mix(hull, P.white, 0.18);
const teal: RGB = mix(P.seaLit, P.grassLit, 0.35);
const rust: RGB = mix(P.cloth, P.wood, 0.4);
const cream: RGB = mix(P.white, P.horizon, 0.5);
const chrome: RGB = mix(P.stoneLit, P.white, 0.45);
const lavender: RGB = mix(P.skyMid, P.white, 0.45);
const leafDark: RGB = P.grassDark;
const leaf: RGB = P.grass;
const leafLit: RGB = P.grassLit;

const bgCache = new Map<string, HTMLCanvasElement>();

function cachedBg(id: string, w: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
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

// --- Bridge -----------------------------------------------------------------

function bridgeStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, BRIDGE_W, 126, [P.night, hull, mix(hull, P.black, 0.2)]);
  // ceiling ribs
  for (let x = 8; x < BRIDGE_W; x += 52) px(ctx, x, 0, 3, 30, mix(hull, P.black, 0.35));
  // viewscreen: Verdant Hollow below
  blk(ctx, 102, 32, 116, 52, P.black);
  rampRect(ctx, 106, 36, 108, 44, [P.night, mix(P.night, P.skyTop, 0.5)]);
  ctx.fillStyle = css(leaf);
  ctx.beginPath();
  ctx.arc(160, 58, 17, 0, Math.PI * 2);
  ctx.fill();
  px(ctx, 148, 52, 10, 3, leafLit);
  px(ctx, 154, 62, 14, 2, leafDark);
  px(ctx, 150, 44, 26, 2, mix(P.white, leaf, 0.5)); // cloud band
  // science console
  blk(ctx, 28, 94, 62, 26, mix(hull, P.black, 0.25));
  px(ctx, 32, 98, 12, 4, teal);
  px(ctx, 48, 98, 8, 4, P.brass);
  px(ctx, 60, 98, 16, 4, teal);
  px(ctx, 32, 106, 44, 2, hullLit);
  // captain's dais
  blk(ctx, 132, 118, 56, 8, mix(hull, P.black, 0.3));
  // beam pad: circle inlay on the floor
  rampRect(ctx, 0, 126, BRIDGE_W, 54, [mix(hull, P.black, 0.1), mix(hull, P.black, 0.35)]);
  for (let y = 130; y < H; y += 10) px(ctx, 0, y, BRIDGE_W, 1, mix(hull, P.black, 0.3));
  ctx.strokeStyle = css(P.brass);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(282, 146, 26, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = css(mix(P.brass, P.black, 0.4));
  ctx.beginPath();
  ctx.ellipse(282, 146, 18, 6, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function bridge(ctx: CanvasRenderingContext2D, _state: State, t: number): void {
  ctx.drawImage(cachedBg('bridge', BRIDGE_W, bridgeStatic), 0, 0);
  // console blinkenlights
  if (Math.sin(t * 2.4) > 0) px(ctx, 48, 98, 8, 4, mix(P.brass, P.glow, 0.6));
  if (Math.sin(t * 1.7 + 2) > 0.3) px(ctx, 32, 98, 12, 4, mix(teal, P.white, 0.4));
  // beam pad idle shimmer
  const g = 0.3 + Math.sin(t * 3.1) * 0.15;
  px(ctx, 280, 143, 4, 2, mix(hull, P.glow, g));
}

// --- Verdant Hollow ---------------------------------------------------------

function hollowStatic(ctx: CanvasRenderingContext2D): void {
  // pale green alien sky
  rampRect(ctx, 0, 0, HOLLOW_W, 96, [
    mix(P.skyMid, leafLit, 0.3),
    mix(P.horizon, leafLit, 0.4),
    mix(cream, leafLit, 0.3),
  ]);
  // far hills
  ctx.fillStyle = css(mix(leaf, P.skyMid, 0.4));
  ctx.beginPath();
  ctx.moveTo(0, 96);
  for (let x = 0; x <= HOLLOW_W; x += 20) {
    ctx.lineTo(x, 88 - Math.sin(x / 47) * 8 - Math.cos(x / 91) * 5);
  }
  ctx.lineTo(HOLLOW_W, 96);
  ctx.fill();
  // meadow ground
  rampRect(ctx, 0, 96, HOLLOW_W, 84, [leafLit, leaf, leafDark]);
  for (let i = 0; i < 90; i++) {
    const gx = (i * 61) % HOLLOW_W;
    const gy = 100 + ((i * 37) % 74);
    px(ctx, gx, gy, 1, 2, i % 3 === 0 ? leafDark : mix(leaf, leafLit, 0.5));
  }
  // beam circle: scorched ring
  ctx.strokeStyle = css(mix(P.woodDark, leafDark, 0.5));
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(60, 151, 26, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  // relay mast
  blk(ctx, 154, 44, 10, 86, P.stone);
  px(ctx, 156, 46, 3, 82, P.stoneLit);
  blk(ctx, 146, 118, 28, 12, mix(P.stone, P.black, 0.3)); // base cabinet
  blk(ctx, 140, 34, 40, 16, P.stoneDark); // coil head
  px(ctx, 144, 38, 32, 8, P.night); // dark lamp... coil window
  blk(ctx, 148, 58, 22, 10, mix(P.stone, P.black, 0.2)); // tuning collar
  px(ctx, 150, 60, 8, 3, P.brass); // collar screw
  // basalt crevice
  ctx.fillStyle = css(mix(P.black, P.stoneDark, 0.4));
  ctx.beginPath();
  ctx.moveTo(248, 136);
  ctx.lineTo(284, 132);
  ctx.lineTo(278, 142);
  ctx.lineTo(254, 144);
  ctx.fill();
  px(ctx, 264, 136, 3, 2, mix(P.seaLit, P.white, 0.4)); // the glitter
  // greenhouse
  blk(ctx, 302, 66, 92, 56, mix(P.seaLit, P.white, 0.25));
  for (let x = 308; x < 390; x += 12) px(ctx, x, 68, 2, 52, mix(P.stone, P.white, 0.2));
  px(ctx, 302, 88, 92, 2, mix(P.stone, P.white, 0.2));
  // vine rows inside (dry)
  for (let x = 310; x < 388; x += 12) px(ctx, x + 4, 96, 4, 24, leafDark);
  // mist-head pipe along the roofline
  px(ctx, 302, 62, 92, 3, P.stone);
}

function hollow(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('hollow', HOLLOW_W, hollowStatic), 0, 0);
  const fixed = state.flags.includes('relay_fixed');
  if (!state.flags.includes('got_crystal')) {
    const wink = Math.sin(t * 2.6) > 0.4;
    if (wink) px(ctx, 264, 136, 3, 2, mix(P.white, P.glow, 0.6));
  } else {
    px(ctx, 264, 136, 3, 2, mix(P.black, P.stoneDark, 0.4)); // glitter gone
  }
  if (fixed) {
    // coil head alight, slow pulse
    const g = 0.6 + Math.sin(t * 2.2) * 0.2;
    px(ctx, 144, 38, 32, 8, mix(P.night, P.glow, g));
    // mist rolling off the greenhouse pipe
    for (let i = 0; i < 8; i++) {
      const mx = 306 + i * 11 + Math.sin(t * 1.3 + i) * 3;
      const my = 60 + ((t * 6 + i * 9) % 30);
      ctx.fillStyle = css(mix(P.white, cream, 0.5));
      ctx.globalAlpha = 0.5 - my / 120;
      ctx.fillRect(mx, 56 + my / 3, 6, 2);
      ctx.globalAlpha = 1;
    }
  } else {
    // the faint, wrong hum: a barely-there flicker in the collar
    if (Math.sin(t * 5.3) > 0.92) px(ctx, 150, 60, 8, 3, mix(P.brass, P.glow, 0.5));
  }
}

// --- Sprites ----------------------------------------------------------------

/** Shared crew body: uniform tunic + slacks, feet-up, ~40px. */
function crewBody(
  ctx: CanvasRenderingContext2D,
  fx: number,
  y: number,
  tunic: RGB,
  slacks: RGB,
  pose: Pose,
): void {
  // The whole crew steps through the engine's shared 4-frame gait.
  const f: WalkFrame = walkFrame(pose);
  const profile = pose.facing === 'left' || pose.facing === 'right';
  blk(ctx, fx - 5 + (profile ? f.aDx : 0), y - 12, 4, 12 - f.aUp, slacks);
  blk(ctx, fx + 1 + (profile ? f.bDx : 0), y - 12, 4, 12 - f.bUp, slacks);
  blk(ctx, fx - 6, y - 26, 12, 15, tunic);
  px(ctx, fx - 6, y - 26, 12, 3, mix(tunic, P.white, 0.25));
  blk(ctx, fx - 9, y - 25, 3, 11 - f.swing, tunic);
  blk(ctx, fx + 6, y - 25, 3, 11 + f.swing, tunic);
}

const bramble: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const y = fy + (pose.walking ? -walkFrame(pose).rise : Math.round(Math.sin(t * 1.2)));
  crewBody(ctx, fx, y, teal, P.night, pose);
  blk(ctx, fx - 4, y - 36, 9, 10, P.skin);
  px(ctx, fx - 4, y - 37, 9, 3, chrome); // silver crop
  if (!blinking(t)) px(ctx, fx + 2, y - 32, 1, 2, P.black);
  talkMouth(ctx, fx + 1, y - 29, pose.talking, t);
  // the tea, held steady, forever
  blk(ctx, fx + 8, y - 18, 4, 4, cream);
  if (Math.sin(t * 2) > 0) px(ctx, fx + 9, y - 20, 1, 2, mix(P.white, cream, 0.5)); // steam
  ctx.restore();
};

const cog: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const y = fy - walkFrame(pose).rise; // androids do not (idle-)bob
  crewBody(ctx, fx, y, rust, P.night, pose);
  blk(ctx, fx - 4, y - 36, 9, 10, chrome); // chrome skin
  px(ctx, fx - 4, y - 36, 9, 2, mix(chrome, P.black, 0.35)); // precise hairline
  if (!blinking(t + 1.7)) px(ctx, fx + 2, y - 32, 1, 2, teal); // teal eye
  talkMouth(ctx, fx + 1, y - 29, pose.talking, t);
  ctx.restore();
};

const solace: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const f = walkFrame(pose);
  const profile = pose.facing === 'left' || pose.facing === 'right';
  const y = fy + (pose.walking ? -f.rise : Math.round(Math.sin(t * 1.6)));
  blk(ctx, fx - 5 + (profile ? f.aDx : 0), y - 12, 4, 12 - f.aUp, mix(lavender, P.black, 0.4));
  blk(ctx, fx + 1 + (profile ? f.bDx : 0), y - 12, 4, 12 - f.bUp, mix(lavender, P.black, 0.4));
  // wrap: a longer, softer tunic
  blk(ctx, fx - 7, y - 26, 14, 17, lavender);
  px(ctx, fx - 7, y - 26, 14, 3, mix(lavender, P.white, 0.35));
  px(ctx, fx - 1, y - 23, 1, 12, mix(lavender, P.black, 0.25));
  blk(ctx, fx - 9, y - 24, 3, 10 - f.swing, lavender);
  blk(ctx, fx + 6, y - 24, 3, 10 + f.swing, lavender);
  blk(ctx, fx - 4, y - 36, 9, 10, P.skin);
  px(ctx, fx - 5, y - 37, 11, 4, P.woodDark); // dark waves
  px(ctx, fx - 5, y - 33, 2, 5, P.woodDark);
  if (!blinking(t + 0.9)) px(ctx, fx + 2, y - 32, 1, 2, P.black);
  talkMouth(ctx, fx + 1, y - 29, pose.talking, t);
  ctx.restore();
};

const wren: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const y = fy + (pose.walking ? -walkFrame(pose).rise : Math.round(Math.sin(t * 2.1))); // fidgety
  crewBody(ctx, fx, y, cream, P.wood, pose);
  px(ctx, fx - 4, y - 20, 8, 8, leaf); // gardening apron
  px(ctx, fx - 3, y - 14, 2, 2, P.woodDark); // soil smudge
  blk(ctx, fx - 4, y - 36, 9, 10, P.skin);
  px(ctx, fx - 4, y - 37, 9, 4, P.wood); // sandy mop
  if (!blinking(t + 2.3)) px(ctx, fx + 2, y - 32, 1, 2, P.black);
  talkMouth(ctx, fx + 1, y - 29, pose.talking, t);
  ctx.restore();
};

export const scenes = { bridge, hollow };
export const sprites = { bramble, cog, solace, wren };
