// Painters for "Nothing Doing". Draw-only: painters may READ state to vary
// what they draw, never change it. All game logic lives in the scene JSON.
//
// This story exercises the money counter (the wallet chip in the HUD is
// engine-drawn) and a four-hander cast; the art leans small-apartment /
// coffee-shop New York, warm lamps against grey daylight.

import type { State } from 'membrillo/core/types';
import { imageScene, portraitImage, type PortraitFraming } from 'membrillo/art/images';
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
} from 'membrillo/art/sprites';

const H = 180;

// --- Shared palette ---------------------------------------------------------
const BRICK = mix(P.cloth, P.wood, 0.45); // apartment / block brick
const BRICKLIT = mix(BRICK, P.glow, 0.18);
const PLASTER = mix(P.stone, P.horizon, 0.4); // interior walls
const PLASTERLIT = mix(PLASTER, P.white, 0.2);
const CHROME = mix(P.stoneLit, P.white, 0.4); // diner trim, register
const TEAL = mix(P.seaLit, P.grassLit, 0.35); // vinyl booths, neon
const NEON = mix(P.sea, P.white, 0.35);
const GREY_DAY = mix(P.skyMid, P.stone, 0.5); // the flat city sky
const TAN = mix(P.wood, P.glow, 0.35); // Artie's regrettable jacket, floors
const OLIVE = mix(P.grassDark, P.wood, 0.4); // Artie's shirt

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

// ============================================================================
// SCENES
// ============================================================================

// --- Sol's apartment --------------------------------------------------------
function apartmentStatic(ctx: CanvasRenderingContext2D): void {
  // warm plaster wall, wood floor
  rampRect(ctx, 0, 0, 320, 128, [PLASTERLIT, PLASTER, mix(PLASTER, P.black, 0.15)]);
  rampRect(ctx, 0, 128, 320, 52, [mix(TAN, P.black, 0.15), mix(TAN, P.black, 0.3)]);
  for (let x = 0; x < 320; x += 24) px(ctx, x, 128, 1, 52, mix(TAN, P.black, 0.4)); // floorboards
  // coat closet (left)
  blk(ctx, 20, 66, 34, 58, P.woodDark);
  px(ctx, 24, 70, 26, 50, mix(P.wood, P.black, 0.2));
  px(ctx, 44, 92, 3, 8, P.brass); // handle
  // umbrella stand
  blk(ctx, 54, 96, 12, 28, mix(P.stoneDark, P.black, 0.2));
  px(ctx, 58, 78, 2, 22, P.black); // the permanently-open umbrella pole
  ctx.fillStyle = css(P.cloth);
  ctx.beginPath();
  ctx.moveTo(48, 82);
  ctx.lineTo(70, 82);
  ctx.lineTo(59, 74);
  ctx.closePath();
  ctx.fill();
  // TV on a stand
  blk(ctx, 90, 66, 44, 34, P.stoneDark);
  px(ctx, 94, 70, 36, 24, mix(P.night, P.seaDeep, 0.5));
  px(ctx, 108, 100, 8, 8, P.stoneDark); // stand
  // window with grey city
  blk(ctx, 150, 40, 44, 40, P.woodDark);
  px(ctx, 154, 44, 36, 32, GREY_DAY);
  px(ctx, 154, 60, 36, 1, mix(GREY_DAY, P.black, 0.3));
  px(ctx, 171, 44, 2, 32, P.woodDark);
  px(ctx, 158, 64, 8, 12, mix(BRICK, P.black, 0.2)); // building across the way
  px(ctx, 178, 60, 8, 16, mix(BRICK, P.black, 0.3));
  // table with mail
  px(ctx, 116, 118, 40, 4, P.woodDark);
  px(ctx, 120, 108, 30, 10, mix(P.glow, P.white, 0.4)); // mail drift
  px(ctx, 124, 110, 14, 2, P.cloth);
  px(ctx, 130, 114, 16, 2, P.stoneLit);
  // cluttered desk
  blk(ctx, 156, 104, 34, 18, P.wood);
  px(ctx, 160, 100, 26, 4, mix(P.wood, P.black, 0.3));
  px(ctx, 178, 102, 3, 6, P.sea); // the click pen, catching light
  // the couch
  blk(ctx, 208, 116, 66, 28, mix(P.seaDeep, P.grassDark, 0.4));
  px(ctx, 212, 112, 58, 8, mix(P.seaDeep, P.grassDark, 0.5)); // backrest
  px(ctx, 224, 120, 18, 12, mix(P.seaDeep, P.black, 0.2)); // cushion seam
  px(ctx, 244, 120, 18, 12, mix(P.seaDeep, P.black, 0.2));
  // the front door (the exit)
  blk(ctx, 281, 74, 30, 54, P.woodDark);
  px(ctx, 285, 78, 22, 50, mix(P.wood, P.black, 0.15));
  px(ctx, 288, 82, 7, 18, mix(P.wood, P.black, 0.32)); // upper panels
  px(ctx, 298, 82, 7, 18, mix(P.wood, P.black, 0.32));
  px(ctx, 288, 104, 7, 20, mix(P.wood, P.black, 0.32)); // lower panels
  px(ctx, 298, 104, 7, 20, mix(P.wood, P.black, 0.32));
  px(ctx, 290, 100, 3, 4, P.brass); // knob
}

function apartment(ctx: CanvasRenderingContext2D, _state: State, t: number): void {
  ctx.drawImage(cachedBg('apt', 320, apartmentStatic), 0, 0);
  // TV flicker
  if (Math.sin(t * 3.3) > 0.2) px(ctx, 96, 72, 32, 20, mix(P.night, P.seaLit, 0.3));
}

// --- The block --------------------------------------------------------------
function streetStatic(ctx: CanvasRenderingContext2D): void {
  const W = 420;
  rampRect(ctx, 0, 0, W, 92, [GREY_DAY, mix(GREY_DAY, P.white, 0.15)]); // flat sky
  // brick facades
  rampRect(ctx, 0, 40, W, 92, [BRICKLIT, BRICK, mix(BRICK, P.black, 0.2)]);
  for (let y = 46; y < 128; y += 8) px(ctx, 0, y, W, 1, mix(BRICK, P.black, 0.25)); // mortar
  // sidewalk
  rampRect(ctx, 0, 130, W, 50, [mix(P.stone, P.white, 0.1), mix(P.stone, P.black, 0.2)]);
  for (let x = 0; x < W; x += 40) px(ctx, x, 130, 1, 50, mix(P.stone, P.black, 0.35));
  // Sol's building doorway (left)
  blk(ctx, 4, 88, 30, 44, mix(BRICK, P.black, 0.35));
  px(ctx, 8, 92, 22, 40, P.woodDark);
  px(ctx, 6, 82, 26, 6, mix(P.stoneLit, P.white, 0.2)); // lintel
  // vending machine
  blk(ctx, 118, 92, 32, 52, mix(P.sea, P.black, 0.2));
  px(ctx, 122, 96, 24, 30, P.night);
  px(ctx, 124, 100, 8, 8, P.cloth); // soda cans behind glass
  px(ctx, 134, 100, 8, 8, TEAL);
  px(ctx, 124, 110, 8, 8, P.glow);
  px(ctx, 134, 128, 12, 6, P.black); // dispenser slot, forever empty
  // the diner, glowing, in the middle
  blk(ctx, 188, 88, 48, 44, mix(P.woodDark, P.black, 0.1));
  rampRect(ctx, 192, 96, 40, 32, [mix(P.glow, P.white, 0.35), mix(P.glow, P.wood, 0.4)]); // warm window
  px(ctx, 190, 82, 46, 8, mix(P.cloth, P.black, 0.1)); // awning
  // NIB'S neon
  ctx.fillStyle = css(NEON);
  ctx.font = 'bold 9px monospace';
  ctx.fillText("NIB'S", 198, 92);
  // newsstand
  blk(ctx, 250, 100, 46, 40, P.woodDark);
  px(ctx, 252, 104, 42, 4, P.cloth); // striped top
  px(ctx, 254, 112, 12, 16, mix(P.white, P.stone, 0.3)); // stacked papers
  px(ctx, 268, 112, 12, 16, mix(P.white, P.stone, 0.4));
  px(ctx, 282, 112, 10, 16, mix(P.white, P.stone, 0.3));
  // department store (right)
  blk(ctx, 378, 84, 40, 48, mix(P.stoneDark, P.night, 0.4));
  px(ctx, 382, 90, 32, 30, mix(P.seaDeep, P.stone, 0.4)); // big display window
  px(ctx, 396, 94, 6, 20, TAN); // a jacket on a form
  ctx.fillStyle = css(mix(P.glow, P.white, 0.4));
  ctx.font = 'bold 7px monospace';
  ctx.fillText("BRILL'S", 384, 82);
}

function street(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('street', 420, streetStatic), 0, 0);
  // vending machine "smug" light
  px(ctx, 144, 98, 3, 3, state.flags.includes('fed_machine') ? mix(P.cloth, P.glow, 0.5) : mix(TEAL, P.white, 0.4));
  // neon buzz
  if (Math.sin(t * 6.1) > -0.7) {
    ctx.fillStyle = css(mix(NEON, P.white, 0.4));
    ctx.font = 'bold 9px monospace';
    ctx.fillText("NIB'S", 198, 92);
  }
}

// --- Nib's coffee shop ------------------------------------------------------
function dinerStatic(ctx: CanvasRenderingContext2D): void {
  const W = 400;
  rampRect(ctx, 0, 0, W, 130, [mix(PLASTER, P.glow, 0.15), PLASTER, mix(PLASTER, P.black, 0.12)]);
  // checkerboard floor
  for (let x = 0; x < W; x += 20) {
    for (let y = 130; y < H; y += 20) {
      px(ctx, x, y, 20, 20, ((x / 20 + y / 20) & 1) === 0 ? mix(P.white, P.stone, 0.3) : mix(P.stoneDark, P.night, 0.3));
    }
  }
  // long counter with stools
  px(ctx, 80, 118, 220, 6, P.woodDark);
  rampRect(ctx, 80, 122, 220, 10, [mix(P.wood, P.glow, 0.3), P.wood]);
  for (let sx = 96; sx < 300; sx += 40) {
    px(ctx, sx, 132, 8, 4, P.cloth); // stool tops
    px(ctx, sx + 2, 136, 4, 10, P.stoneDark);
  }
  // the marble rye, wax-wrapped, on the counter
  px(ctx, 94, 108, 22, 12, mix(P.wood, P.glow, 0.5));
  px(ctx, 96, 106, 18, 4, mix(P.white, P.glow, 0.4)); // wax paper
  px(ctx, 100, 112, 12, 1, mix(P.woodDark, P.black, 0.2)); // seeded top
  // pie case + coffee machine behind counter
  blk(ctx, 130, 84, 30, 30, CHROME);
  px(ctx, 134, 88, 22, 8, mix(P.cloth, P.glow, 0.4)); // pie
  px(ctx, 134, 100, 22, 8, mix(P.wood, P.glow, 0.3));
  blk(ctx, 170, 82, 24, 32, mix(P.stoneDark, P.black, 0.1)); // coffee urn
  px(ctx, 176, 88, 12, 6, CHROME);
  px(ctx, 180, 104, 4, 6, P.black); // spigot
  // trivia board (right, chalk)
  blk(ctx, 300, 40, 74, 40, mix(P.grassDark, P.black, 0.3));
  px(ctx, 306, 46, 62, 2, mix(P.white, P.grassLit, 0.4));
  px(ctx, 306, 54, 50, 2, mix(P.white, P.grass, 0.4));
  px(ctx, 306, 62, 56, 2, mix(P.white, P.grass, 0.4));
  px(ctx, 306, 70, 34, 2, mix(P.white, P.grassLit, 0.4));
  // Booth 4 (far right)
  blk(ctx, 340, 120, 56, 24, mix(TEAL, P.black, 0.2));
  px(ctx, 344, 112, 48, 10, mix(TEAL, P.black, 0.1)); // seat back
  px(ctx, 366, 124, 8, 8, P.woodDark); // table
  // the glass front door (the exit), grey street beyond
  blk(ctx, 2, 84, 28, 48, mix(P.stoneDark, P.night, 0.3));
  px(ctx, 5, 88, 22, 42, mix(P.wood, P.stone, 0.35)); // door leaf
  px(ctx, 8, 92, 16, 22, mix(GREY_DAY, P.white, 0.15)); // glass, daylight outside
  px(ctx, 8, 92, 16, 1, mix(P.white, GREY_DAY, 0.5)); // reflection
  ctx.fillStyle = css(NEON);
  ctx.font = 'bold 6px monospace';
  ctx.fillText('OPEN', 9, 105); // little hanging sign, read backwards from inside
  px(ctx, 7, 116, 5, 3, P.brass); // push bar
}

function diner(ctx: CanvasRenderingContext2D, state: State, t: number): void {
  ctx.drawImage(cachedBg('diner', 400, dinerStatic), 0, 0);
  // coffee urn steam
  const s = Math.sin(t * 2.4) * 2;
  ctx.fillStyle = rgba(P.white, 0.25);
  ctx.fillRect(180 + Math.round(s), 74, 2, 8);
  // WINNERS chalk once the pot is won
  if (state.flags.includes('won_trivia')) {
    ctx.fillStyle = css(mix(P.white, P.glow, 0.4));
    ctx.font = 'bold 7px monospace';
    ctx.fillText('BOOTH 4', 312, 78);
  }
  // the rye is gone once taken
  if (state.flags.includes('took_rye')) px(ctx, 92, 104, 26, 18, mix(P.wood, P.glow, 0.3));
}

// --- Brill's department store -----------------------------------------------
function storeStatic(ctx: CanvasRenderingContext2D): void {
  rampRect(ctx, 0, 0, 320, 130, [PLASTERLIT, mix(PLASTER, P.stone, 0.3), mix(PLASTER, P.black, 0.15)]);
  rampRect(ctx, 0, 130, 320, 50, [mix(P.stone, P.white, 0.15), mix(P.stone, P.black, 0.15)]); // pale tile
  for (let x = 0; x < 320; x += 30) px(ctx, x, 130, 1, 50, mix(P.stone, P.black, 0.25));
  // RETURNS sign
  blk(ctx, 58, 58, 62, 22, mix(P.cloth, P.black, 0.1));
  ctx.fillStyle = css(P.white);
  ctx.font = 'bold 10px monospace';
  ctx.fillText('RETURNS', 64, 74);
  px(ctx, 84, 78, 20, 2, P.sea); // the hand-added "attitude" clause, in pen
  // returns counter + register
  px(ctx, 60, 116, 90, 6, P.woodDark);
  rampRect(ctx, 60, 122, 90, 12, [mix(P.wood, P.stone, 0.3), P.wood]);
  blk(ctx, 96, 100, 24, 18, mix(P.stoneDark, P.stone, 0.3)); // register
  px(ctx, 100, 104, 16, 6, P.night);
  px(ctx, 100, 112, 4, 3, P.cloth);
  px(ctx, 108, 112, 4, 3, P.grass);
  // menswear rack
  px(ctx, 178, 76, 64, 3, P.stoneDark); // rail
  px(ctx, 182, 74, 2, 6, P.stoneDark);
  px(ctx, 238, 74, 2, 6, P.stoneDark);
  for (let i = 0; i < 5; i++) {
    const jx = 184 + i * 12;
    px(ctx, jx, 79, 9, 30, [TAN, TEAL, P.cloth, mix(P.grassDark, P.wood, 0.4), P.stoneDark][i]!);
    px(ctx, jx + 3, 78, 3, 3, P.stoneDark); // hanger hook
  }
  // glass storefront door (the exit), the grey block beyond
  blk(ctx, 2, 84, 28, 48, mix(P.stoneDark, P.stone, 0.3));
  px(ctx, 5, 88, 22, 42, mix(P.stoneLit, P.stone, 0.4)); // aluminium door
  px(ctx, 8, 92, 16, 30, mix(GREY_DAY, P.white, 0.12)); // full-height glass
  px(ctx, 8, 92, 16, 1, mix(P.white, GREY_DAY, 0.5)); // reflection band
  px(ctx, 15, 92, 1, 30, mix(P.stoneLit, P.white, 0.2)); // mullion
  px(ctx, 23, 104, 3, 10, P.stoneDark); // vertical pull handle
}

function store(ctx: CanvasRenderingContext2D, _state: State, _t: number): void {
  ctx.drawImage(cachedBg('store', 320, storeStatic), 0, 0);
}

// --- Title / ending cards ---------------------------------------------------
function briefCard(ctx: CanvasRenderingContext2D, _state: State, t: number): void {
  rampRect(ctx, 0, 0, 320, 180, [mix(P.night, P.seaDeep, 0.3), P.night, mix(P.night, P.black, 0.6)]);
  // a lone diner window glowing across a dark street
  blk(ctx, 116, 54, 88, 60, mix(P.woodDark, P.black, 0.2));
  rampRect(ctx, 120, 60, 80, 48, [mix(P.glow, P.white, 0.4), mix(P.glow, P.wood, 0.45)]);
  px(ctx, 158, 60, 2, 48, mix(P.woodDark, P.black, 0.2)); // window mullion
  px(ctx, 120, 84, 80, 1, mix(P.woodDark, P.black, 0.2));
  // NIB'S neon buzzing above
  const on = Math.sin(t * 5.5) > -0.6;
  ctx.fillStyle = css(on ? mix(NEON, P.white, 0.5) : mix(NEON, P.black, 0.3));
  ctx.font = 'bold 12px monospace';
  ctx.fillText("NIB'S", 138, 48);
  // a silhouette in the window: a man, a counter, a reckoning
  px(ctx, 150, 86, 8, 22, P.black); // figure
  px(ctx, 151, 80, 6, 6, P.black); // head
  px(ctx, 128, 100, 64, 4, mix(P.black, P.wood, 0.3)); // counter
  // steam from an unseen coffee
  const s = Math.sin(t * 2) * 2;
  ctx.fillStyle = rgba(P.white, 0.22);
  ctx.fillRect(172 + Math.round(s), 90, 2, 10);
}

function victoryCard(ctx: CanvasRenderingContext2D, _state: State, t: number): void {
  rampRect(ctx, 0, 0, 320, 180, [mix(PLASTER, P.glow, 0.2), PLASTER, mix(PLASTER, P.black, 0.15)]);
  // the counter, the ledger, nine dollars pushed back
  px(ctx, 40, 120, 240, 6, P.woodDark);
  rampRect(ctx, 40, 126, 240, 20, [mix(P.wood, P.glow, 0.3), P.wood]);
  // the ledger, open
  blk(ctx, 120, 96, 80, 26, mix(P.white, P.glow, 0.3));
  px(ctx, 160, 96, 2, 26, mix(P.stone, P.black, 0.2)); // spine
  for (let y = 100; y < 120; y += 4) {
    px(ctx, 124, y, 32, 1, mix(P.stone, P.black, 0.2));
    px(ctx, 166, y, 30, 1, mix(P.stone, P.black, 0.2));
  }
  px(ctx, 168, 104, 24, 2, P.cloth); // your name, in the guilty colour
  // a small stack of pushed-back dollars
  for (let i = 0; i < 4; i++) px(ctx, 214 + i, 112 - i, 22, 3, mix(P.grass, P.white, 0.3));
  // a warm shaft of "nothing resolved" light
  ctx.fillStyle = rgba(P.glow, 0.1 + Math.sin(t * 1.5) * 0.03);
  ctx.beginPath();
  ctx.moveTo(150, 10);
  ctx.lineTo(90, 120);
  ctx.lineTo(230, 120);
  ctx.closePath();
  ctx.fill();
}

// ============================================================================
// SPRITES  (shared gait via walkFrame; profiles get the x-stride)
// ============================================================================

function legs(ctx: CanvasRenderingContext2D, fx: number, y: number, f: ReturnType<typeof walkFrame>, profile: boolean, c: RGB): void {
  const aDx = profile ? f.aDx : 0;
  const bDx = profile ? f.bDx : 0;
  blk(ctx, fx - 5 + aDx, y - 12, 4, 12 - f.aUp, c);
  blk(ctx, fx + 1 + bDx, y - 12, 4, 12 - f.bUp, c);
}

// --- Artie Skint (the player — manifest.actor) ------------------------------
// Short, stocky, balding, glasses; the tan jacket he regrets is stashed, so he
// walks in shirtsleeves and worry.
const artie: SpritePainter = (ctx, fx, fy, pose, t) => {
  const f = walkFrame(pose);
  const bob = pose.walking ? 0 : Math.round(Math.sin(t * 1.8));
  const y = fy + bob - f.rise;
  const profile = pose.facing === 'left' || pose.facing === 'right';
  const sway = profile ? 0 : f.swing === 0 ? 0 : f.swing > 0 ? 1 : -1;

  faceCtx(ctx, fx, pose.facing);
  legs(ctx, fx, y, f, profile, P.stoneDark); // grey slacks
  // olive shirt over a stocky frame
  blk(ctx, fx - 7 + sway, y - 25, 14, 15, OLIVE);
  px(ctx, fx - 1 + sway, y - 25, 2, 10, mix(OLIVE, P.black, 0.3)); // buttons
  blk(ctx, fx - 10 + sway, y - 24, 3, 11 - f.swing, OLIVE);
  blk(ctx, fx + 7 + sway, y - 24, 3, 11 + f.swing, OLIVE);
  // round balding head
  blk(ctx, fx - 4 + sway, y - 35, 9, 10, P.skin);
  px(ctx, fx - 4 + sway, y - 35, 9, 2, mix(P.skin, P.woodDark, 0.4)); // fringe, retreating
  px(ctx, fx - 3 + sway, y - 36, 7, 1, mix(P.skin, P.glow, 0.3)); // bald pate highlight
  if (pose.facing === 'up') {
    px(ctx, fx - 4 + sway, y - 35, 9, 3, mix(P.skin, P.woodDark, 0.4));
  } else if (profile) {
    // glasses (side)
    px(ctx, fx + 1, y - 32, 4, 3, mix(P.stoneLit, P.white, 0.3));
    px(ctx, fx + 5, y - 31, 2, 1, P.stoneDark); // temple arm
    if (!blinking(t)) px(ctx, fx + 2, y - 31, 1, 1, P.black);
    talkMouth(ctx, fx + 3, y - 28, pose.talking, t);
  } else {
    // glasses (front): two lit lenses
    px(ctx, fx - 3 + sway, y - 32, 3, 3, mix(P.stoneLit, P.white, 0.3));
    px(ctx, fx + 1 + sway, y - 32, 3, 3, mix(P.stoneLit, P.white, 0.3));
    px(ctx, fx + sway, y - 31, 1, 1, P.stoneDark); // bridge
    if (!blinking(t)) {
      px(ctx, fx - 2 + sway, y - 31, 1, 1, P.black);
      px(ctx, fx + 2 + sway, y - 31, 1, 1, P.black);
    }
    talkMouth(ctx, fx - 1 + sway, y - 28, pose.talking, t);
  }
  ctx.restore();
};

// --- Kessler (the Kramer) — tall, wild hair, loud bowling shirt -------------
const kessler: SpritePainter = (ctx, fx, fy, pose, t) => {
  const f = walkFrame(pose);
  const y = fy - f.rise; // tall, doesn't idle-bob much
  const profile = pose.facing === 'left' || pose.facing === 'right';
  const sway = profile ? 0 : f.swing === 0 ? 0 : f.swing > 0 ? 1 : -1;

  faceCtx(ctx, fx, pose.facing);
  // longer legs
  blk(ctx, fx - 5 + (profile ? f.aDx : 0), y - 15, 4, 15 - f.aUp, mix(P.wood, P.stone, 0.4));
  blk(ctx, fx + 1 + (profile ? f.bDx : 0), y - 15, 4, 15 - f.bUp, mix(P.wood, P.stone, 0.4));
  // loud shirt, tall torso
  blk(ctx, fx - 7 + sway, y - 31, 14, 18, mix(P.cloth, P.glow, 0.3));
  px(ctx, fx - 5 + sway, y - 29, 3, 12, TEAL); // garish pattern
  px(ctx, fx + 2 + sway, y - 27, 3, 10, mix(P.grass, P.white, 0.2));
  const flail = pose.talking && Math.sin(t * 5) > 0 ? 4 : 0;
  blk(ctx, fx - 10 + sway, y - 30 - flail, 3, 13 - f.swing, mix(P.cloth, P.glow, 0.3));
  blk(ctx, fx + 7 + sway, y - 30, 3, 13 + f.swing, mix(P.cloth, P.glow, 0.3));
  // narrow head, explosion of hair
  blk(ctx, fx - 4 + sway, y - 42, 9, 11, P.skin);
  px(ctx, fx - 6 + sway, y - 45, 13, 4, P.woodDark); // hair mass
  px(ctx, fx - 5 + sway, y - 47, 4, 3, P.woodDark);
  px(ctx, fx + 3 + sway, y - 47, 4, 3, P.woodDark);
  px(ctx, fx - 4 + sway, y - 42, 9, 1, P.woodDark);
  if (pose.facing !== 'up') {
    if (profile) {
      if (!blinking(t + 0.5)) px(ctx, fx + 2, y - 38, 1, 2, P.black);
      talkMouth(ctx, fx + 3, y - 34, pose.talking, t);
    } else {
      if (!blinking(t + 0.5)) {
        px(ctx, fx - 2 + sway, y - 38, 1, 2, P.black);
        px(ctx, fx + 2 + sway, y - 38, 1, 2, P.black);
      }
      talkMouth(ctx, fx - 1 + sway, y - 34, pose.talking, t);
    }
  }
  ctx.restore();
};

// --- Elna (the Elaine) — sharp, magenta, decisive --------------------------
const elna: SpritePainter = (ctx, fx, fy, pose, t) => {
  const f = walkFrame(pose);
  const bob = pose.walking ? 0 : Math.round(Math.sin(t * 2));
  const y = fy + bob - f.rise;
  const profile = pose.facing === 'left' || pose.facing === 'right';
  const sway = profile ? 0 : f.swing === 0 ? 0 : f.swing > 0 ? 1 : -1;
  const MAG = mix(P.cloth, P.white, 0.25);

  faceCtx(ctx, fx, pose.facing);
  legs(ctx, fx, y, f, profile, mix(P.night, P.stone, 0.3));
  // blazer, shoulders with attitude
  blk(ctx, fx - 7 + sway, y - 26, 14, 16, MAG);
  px(ctx, fx - 7 + sway, y - 26, 14, 2, mix(MAG, P.white, 0.3)); // shoulder line
  px(ctx, fx - 1 + sway, y - 24, 2, 8, P.white); // blouse
  blk(ctx, fx - 10 + sway, y - 25, 3, 11 - f.swing, MAG);
  blk(ctx, fx + 7 + sway, y - 25, 3, 11 + f.swing, MAG);
  // big confident hair
  blk(ctx, fx - 4 + sway, y - 36, 9, 10, P.skin);
  px(ctx, fx - 6 + sway, y - 39, 13, 5, P.woodDark);
  px(ctx, fx - 6 + sway, y - 36, 3, 6, P.woodDark); // curls at the jaw
  px(ctx, fx + 4 + sway, y - 36, 3, 6, P.woodDark);
  if (pose.facing !== 'up') {
    if (profile) {
      if (!blinking(t + 1.1)) px(ctx, fx + 2, y - 32, 1, 2, P.black);
      talkMouth(ctx, fx + 3, y - 29, pose.talking, t);
    } else {
      if (!blinking(t + 1.1)) {
        px(ctx, fx - 2 + sway, y - 32, 1, 2, P.black);
        px(ctx, fx + 2 + sway, y - 32, 1, 2, P.black);
      }
      px(ctx, fx - 1 + sway, y - 30, 3, 1, P.cloth); // a decisive line of lipstick
      talkMouth(ctx, fx - 1 + sway, y - 28, pose.talking, t);
    }
  }
  ctx.restore();
};

// --- Sol (the Jerry) — neat, blue shirt, unbothered ------------------------
const sol: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const y = fy + Math.round(Math.sin(t * 1.5));
  blk(ctx, fx - 5, y - 10, 4, 10, mix(P.night, P.stone, 0.35)); // clean jeans
  blk(ctx, fx + 1, y - 10, 4, 10, mix(P.night, P.stone, 0.35));
  blk(ctx, fx - 7, y - 27, 14, 18, mix(P.sea, P.white, 0.25)); // crisp blue shirt
  px(ctx, fx - 1, y - 27, 2, 12, mix(P.sea, P.white, 0.4));
  blk(ctx, fx - 9, y - 24, 3, 9, mix(P.sea, P.white, 0.25));
  blk(ctx, fx + 5, y - 24, 3, 9, mix(P.sea, P.white, 0.25));
  blk(ctx, fx - 4, y - 37, 9, 11, P.skin);
  px(ctx, fx - 4, y - 37, 9, 3, P.woodDark); // tidy dark hair
  px(ctx, fx - 5, y - 35, 1, 3, P.woodDark);
  if (!blinking(t)) {
    px(ctx, fx - 2, y - 33, 1, 2, P.black);
    px(ctx, fx + 2, y - 33, 1, 2, P.black);
  }
  talkMouth(ctx, fx, y - 30, pose.talking, t);
  ctx.restore();
};

// --- Nib (the diner owner) — apron, spatula, ledger-keeper ------------------
const nib: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const y = fy + Math.round(Math.sin(t * 1.3));
  blk(ctx, fx - 5, y - 10, 4, 10, P.stoneDark);
  blk(ctx, fx + 1, y - 10, 4, 10, P.stoneDark);
  blk(ctx, fx - 7, y - 28, 14, 19, mix(P.white, P.stone, 0.15)); // white shirt
  px(ctx, fx - 6, y - 22, 12, 13, mix(P.cloth, P.wood, 0.35)); // grease-marked apron
  px(ctx, fx - 6, y - 22, 12, 1, mix(P.cloth, P.black, 0.2)); // apron tie
  blk(ctx, fx - 9, y - 25, 3, 10, mix(P.white, P.stone, 0.15));
  const wave = pose.talking && Math.sin(t * 4) > 0 ? 3 : 0;
  blk(ctx, fx + 6, y - 25 - wave, 3, 10, mix(P.white, P.stone, 0.15));
  px(ctx, fx + 8, y - 27 - wave, 6, 2, CHROME); // the spatula, brandished
  blk(ctx, fx - 4, y - 38, 9, 11, P.skin);
  px(ctx, fx - 4, y - 38, 9, 2, P.stoneLit); // grey, thinning
  px(ctx, fx - 5, y - 30, 10, 2, mix(P.stoneLit, P.white, 0.2)); // moustache
  if (!blinking(t + 2)) {
    px(ctx, fx - 2, y - 34, 1, 2, P.black);
    px(ctx, fx + 2, y - 34, 1, 2, P.black);
  }
  talkMouth(ctx, fx, y - 29, pose.talking, t);
  ctx.restore();
};

// --- The clerk — cardigan, name tag, weaponized policy ---------------------
const clerk: SpritePainter = (ctx, fx, fy, pose, t) => {
  faceCtx(ctx, fx, pose.facing);
  const y = fy + Math.round(Math.sin(t * 1.4));
  blk(ctx, fx - 5, y - 10, 4, 10, mix(P.stone, P.night, 0.4));
  blk(ctx, fx + 1, y - 10, 4, 10, mix(P.stone, P.night, 0.4));
  blk(ctx, fx - 7, y - 27, 14, 18, mix(P.grassDark, P.stone, 0.4)); // dun cardigan
  px(ctx, fx - 1, y - 27, 2, 12, mix(P.grassDark, P.black, 0.2));
  px(ctx, fx + 3, y - 25, 3, 3, mix(P.white, P.stone, 0.2)); // name tag
  blk(ctx, fx - 9, y - 24, 3, 9, mix(P.grassDark, P.stone, 0.4));
  blk(ctx, fx + 5, y - 24, 3, 9, mix(P.grassDark, P.stone, 0.4));
  blk(ctx, fx - 4, y - 37, 9, 11, P.skin);
  px(ctx, fx - 4, y - 37, 9, 3, mix(P.wood, P.stoneLit, 0.4)); // hair, pinned back
  if (!blinking(t + 1.5)) {
    px(ctx, fx - 2, y - 33, 1, 2, P.black);
    px(ctx, fx + 2, y - 33, 1, 2, P.black);
  }
  px(ctx, fx - 1, y - 29, 3, 1, P.stoneDark); // a mouth set to "no"
  talkMouth(ctx, fx, y - 29, pose.talking, t);
  ctx.restore();
};

// ============================================================================
// DIALOGUE PORTRAITS  (90×160 close-ups)
// ============================================================================

function portraitBg(ctx: CanvasRenderingContext2D, a: RGB, b: RGB): void {
  rampRect(ctx, 0, 0, PORTRAIT.w, PORTRAIT.h, [a, b]);
  px(ctx, 0, 0, PORTRAIT.w, 2, mix(a, P.white, 0.15));
}

function portraitMouth(ctx: CanvasRenderingContext2D, mx: number, my: number, talking: boolean, t: number): void {
  if (talking) {
    const open = Math.sin(t * 11) > 0 ? 5 : 2;
    px(ctx, mx - 4, my, 8, open, mix(P.black, P.cloth, 0.35));
    if (open > 3) px(ctx, mx - 3, my + open - 2, 6, 1, P.skinShade);
  } else {
    px(ctx, mx - 4, my + 1, 8, 2, P.skinShade);
  }
}

const artiePortrait: PortraitPainter = (ctx, _state, t, talking) => {
  portraitBg(ctx, mix(OLIVE, P.black, 0.4), mix(OLIVE, P.black, 0.15));
  const bob = Math.round(Math.sin(t * 1.6));
  const y = 58 + bob;
  blk(ctx, 6, 118 + bob, 78, 42, OLIVE); // shirt shoulders
  px(ctx, 40, 118 + bob, 10, 42, mix(OLIVE, P.black, 0.3));
  blk(ctx, 22, y, 46, 54, P.skin); // broad worried face
  px(ctx, 22, y + 36, 46, 18, P.skinShade);
  px(ctx, 20, y - 6, 50, 8, mix(P.skin, P.woodDark, 0.4)); // retreating fringe
  px(ctx, 24, y - 4, 42, 3, mix(P.skin, P.glow, 0.3)); // pate shine
  // big glasses
  px(ctx, 28, y + 12, 14, 10, mix(P.stoneLit, P.white, 0.25));
  px(ctx, 48, y + 12, 14, 10, mix(P.stoneLit, P.white, 0.25));
  px(ctx, 42, y + 15, 6, 2, P.stoneDark); // bridge
  if (!blinking(t)) {
    px(ctx, 33, y + 15, 4, 4, P.black);
    px(ctx, 53, y + 15, 4, 4, P.black);
  } else {
    px(ctx, 32, y + 17, 6, 2, P.skinShade);
    px(ctx, 52, y + 17, 6, 2, P.skinShade);
  }
  px(ctx, 30, y + 8, 12, 2, mix(P.skinShade, P.black, 0.3)); // anxious brows
  px(ctx, 48, y + 8, 12, 2, mix(P.skinShade, P.black, 0.3));
  portraitMouth(ctx, 45, y + 38, talking, t);
};

const solPortrait: PortraitPainter = (ctx, _state, t, talking) => {
  portraitBg(ctx, mix(P.sea, P.black, 0.45), mix(P.sea, P.black, 0.2));
  const bob = Math.round(Math.sin(t * 1.3));
  const y = 58 + bob;
  blk(ctx, 8, 116 + bob, 74, 44, mix(P.sea, P.white, 0.25)); // crisp blue shirt
  px(ctx, 38, 116 + bob, 16, 44, mix(P.sea, P.white, 0.4));
  blk(ctx, 24, y, 42, 52, P.skin);
  px(ctx, 24, y + 34, 42, 16, P.skinShade);
  px(ctx, 20, y - 8, 50, 12, P.woodDark); // tidy dark hair
  px(ctx, 20, y - 8, 6, 20, P.woodDark);
  px(ctx, 64, y - 8, 6, 20, P.woodDark);
  if (!blinking(t)) {
    px(ctx, 31, y + 14, 6, 4, P.white);
    px(ctx, 51, y + 14, 6, 4, P.white);
    px(ctx, 33, y + 15, 3, 3, P.black);
    px(ctx, 53, y + 15, 3, 3, P.black);
  } else {
    px(ctx, 31, y + 16, 6, 2, P.skinShade);
    px(ctx, 51, y + 16, 6, 2, P.skinShade);
  }
  px(ctx, 30, y + 9, 9, 2, P.woodDark); // level, amused brows
  px(ctx, 50, y + 9, 9, 2, P.woodDark);
  portraitMouth(ctx, 44, y + 35, talking, t);
};

const nibPortrait: PortraitPainter = (ctx, _state, t, talking) => {
  portraitBg(ctx, mix(P.wood, P.black, 0.5), mix(P.wood, P.black, 0.25));
  const bob = Math.round(Math.sin(t * 1.1));
  const y = 58 + bob;
  blk(ctx, 6, 116 + bob, 78, 44, mix(P.white, P.stone, 0.15)); // white shirt
  px(ctx, 6, 128 + bob, 78, 32, mix(P.cloth, P.wood, 0.35)); // apron
  px(ctx, 6, 128 + bob, 78, 2, mix(P.cloth, P.black, 0.2));
  blk(ctx, 22, y, 46, 54, P.skin);
  px(ctx, 22, y + 36, 46, 18, P.skinShade); // heavy jaw
  px(ctx, 18, y - 6, 54, 8, P.stoneLit); // grey, thinning
  if (!blinking(t + 2)) {
    px(ctx, 31, y + 14, 6, 5, P.white);
    px(ctx, 53, y + 14, 6, 5, P.white);
    px(ctx, 33, y + 15, 3, 4, mix(P.wood, P.black, 0.3));
    px(ctx, 55, y + 15, 3, 4, mix(P.wood, P.black, 0.3));
  } else {
    px(ctx, 31, y + 17, 6, 2, P.skinShade);
    px(ctx, 53, y + 17, 6, 2, P.skinShade);
  }
  px(ctx, 29, y + 9, 10, 2, mix(P.stoneLit, P.black, 0.2)); // grizzled brows, suspicious
  px(ctx, 51, y + 9, 10, 2, mix(P.stoneLit, P.black, 0.2));
  px(ctx, 30, y + 30, 30, 3, P.stoneLit); // the moustache
  portraitMouth(ctx, 45, y + 38, talking, t);
};

const elnaPortrait: PortraitPainter = (ctx, _state, t, talking) => {
  const MAG = mix(P.cloth, P.white, 0.25);
  portraitBg(ctx, mix(MAG, P.black, 0.5), mix(MAG, P.black, 0.2));
  const bob = Math.round(Math.sin(t * 1.5));
  const y = 60 + bob;
  blk(ctx, 6, 118 + bob, 78, 42, MAG); // blazer
  px(ctx, 34, 118 + bob, 22, 42, P.white); // blouse
  px(ctx, 6, 118 + bob, 78, 2, mix(MAG, P.white, 0.3));
  blk(ctx, 24, y, 42, 50, P.skin);
  px(ctx, 24, y + 32, 42, 18, P.skinShade);
  // big hair framing the face
  px(ctx, 16, y - 10, 58, 14, P.woodDark);
  px(ctx, 14, y - 6, 12, 40, P.woodDark);
  px(ctx, 64, y - 6, 12, 40, P.woodDark);
  if (!blinking(t + 1.1)) {
    px(ctx, 31, y + 12, 6, 4, P.white);
    px(ctx, 51, y + 12, 6, 4, P.white);
    px(ctx, 33, y + 13, 3, 3, P.black);
    px(ctx, 53, y + 13, 3, 3, P.black);
  } else {
    px(ctx, 31, y + 15, 6, 2, P.skinShade);
    px(ctx, 51, y + 15, 6, 2, P.skinShade);
  }
  px(ctx, 31, y + 7, 8, 2, P.woodDark); // arched, unimpressed brows
  px(ctx, 51, y + 7, 8, 2, P.woodDark);
  if (!talking) px(ctx, 40, y + 34, 12, 2, P.cloth); // a line of lipstick, resting
  portraitMouth(ctx, 45, y + 34, talking, t);
};

const clerkPortrait: PortraitPainter = (ctx, _state, t, talking) => {
  const CARD = mix(P.grassDark, P.stone, 0.4);
  portraitBg(ctx, mix(CARD, P.black, 0.4), mix(CARD, P.black, 0.15));
  const bob = Math.round(Math.sin(t * 1.2));
  const y = 60 + bob;
  blk(ctx, 8, 118 + bob, 74, 42, CARD); // cardigan
  px(ctx, 38, 118 + bob, 14, 42, mix(CARD, P.black, 0.25));
  px(ctx, 54, 124 + bob, 8, 6, mix(P.white, P.stone, 0.2)); // name tag
  blk(ctx, 24, y, 42, 50, P.skin);
  px(ctx, 24, y + 32, 42, 18, P.skinShade);
  px(ctx, 20, y - 6, 50, 10, mix(P.wood, P.stoneLit, 0.4)); // hair pinned back
  px(ctx, 20, y - 2, 4, 14, mix(P.wood, P.stoneLit, 0.4));
  px(ctx, 66, y - 2, 4, 14, mix(P.wood, P.stoneLit, 0.4));
  if (!blinking(t + 1.5)) {
    px(ctx, 31, y + 13, 6, 4, P.white);
    px(ctx, 51, y + 13, 6, 4, P.white);
    px(ctx, 33, y + 14, 3, 3, P.black);
    px(ctx, 53, y + 14, 3, 3, P.black);
  } else {
    px(ctx, 31, y + 16, 6, 2, P.skinShade);
    px(ctx, 51, y + 16, 6, 2, P.skinShade);
  }
  px(ctx, 31, y + 8, 8, 2, mix(P.wood, P.black, 0.3)); // flat, patient brows
  px(ctx, 51, y + 8, 8, 2, mix(P.wood, P.black, 0.3));
  if (!talking) px(ctx, 40, y + 35, 12, 2, P.stoneDark); // a mouth set to "policy"
  portraitMouth(ctx, 45, y + 35, talking, t);
};

// ============================================================================
// EXPORTS
// ============================================================================
// A/B comparison: the same apartment rebuilt through the scene-render pipeline
// (floorplans/apartment_render.json → `membrillo scene build`). Hidden — reach
// it with ?story=nothing&start=apartment_render; its door walks into the
// hand-drawn version so you can step from one straight into the other.
const apartmentRenderUrl = new URL('./assets/apartment_render.png', import.meta.url).href;
export const scenes = {
  apartment, street, diner, store, briefCard, victoryCard,
  apartment_render: imageScene(apartmentRenderUrl),
};
export const sprites = { artie, kessler, elna, sol, nib, clerk };
export const props = {};

// Local-art overlay: paint/assets-local/ is GITIGNORED — drop generated
// portraits there and they replace the code-drawn ones on this machine only.
// Nothing generated ships in the repo.
const localArt = import.meta.glob('./assets-local/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const localPortrait = (file: string, fallback: PortraitPainter, framing?: PortraitFraming): PortraitPainter => {
  const url = localArt[`./assets-local/${file}`];
  return url !== undefined ? portraitImage(url, framing) : fallback;
};

export const portraits = {
  artiePortrait: localPortrait('artie.jpg', artiePortrait, { zoom: 1.0, anchorY: 0.3 }),
  solPortrait: localPortrait('sol.jpg', solPortrait, { zoom: 1.1, anchorY: 0.3 }),
  nibPortrait: localPortrait('nib.jpg', nibPortrait, { zoom: 1.0, anchorY: 0.32 }),
  elnaPortrait: localPortrait('elna.jpg', elnaPortrait, { zoom: 1.15, anchorY: 0.3 }),
  clerkPortrait: localPortrait('clerk.jpg', clerkPortrait, { zoom: 1.1, anchorY: 0.3 }),
};
