// Sprite-drawing helpers and the engine's default player actor.
// Characters are drawn feet-up from a feet-centre anchor, with 1px outlines
// (`blk`) so silhouettes stay readable on any background.
//
// Sprites receive a Pose: 4-way facing, a distance-driven walk phase (so
// steps track ground actually covered, at any walk speed or depth scale),
// and a talking flag that runs the mouth while the sprite's speech floats.

import { P, css, type RGB } from './palette.ts';
import type { Direction, State } from '../core/types.ts';

export type Facing = Direction;

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

// The px()/blk() helpers and the faceCtx mirror are adapted from AngelJaimer's
// pointclick-adventure kit (art/actor.ts), under its "yours to reuse" grant —
// see NOTICE. drawActor, the walk cycle, and everything else here are original.

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

/**
 * Dialogue portraits: a large 9:16 close-up drawn while a character's
 * dialogue tree is open (VN-style; talking art and walking art are separate
 * art modes). Painters draw the FULL logical canvas — the engine scales it
 * into the dialogue overlay with pixelated rendering. `talking` is true
 * while the current line is (nominally) being spoken; run the mouth then.
 */
export const PORTRAIT = { w: 90, h: 160 } as const;

export type PortraitPainter = (
  ctx: CanvasRenderingContext2D,
  state: State,
  t: number,
  talking: boolean,
) => void;

/**
 * One quantized frame of the classic 4-frame walk cycle. Pose.phase advances
 * with ground covered (one step ≈ π), so a full cycle (two steps) is 2π,
 * quantized to: contact (legs apart) → passing (legs together, body high) →
 * contact (other leg leads) → passing. Frame-stepped motion — not smoothed —
 * is what reads as classic sprite animation.
 */
export interface WalkFrame {
  /** 0..3 within the cycle, or -1 when standing (all offsets zero). */
  index: number;
  /** Foot x-offsets in the facing direction: leg A (back-drawn) and leg B. */
  aDx: number;
  bDx: number;
  /** Leg lift in px (the passing leg's foot leaves the ground). */
  aUp: number;
  bUp: number;
  /** Whole-body rise on passing frames — the SCUMM bounce. */
  rise: number;
  /** Arm counter-swing in px; A-side arm leads when positive. */
  swing: number;
}

const STANDING: WalkFrame = { index: -1, aDx: 0, bDx: 0, aUp: 0, bUp: 0, rise: 0, swing: 0 };

const CYCLE: readonly Omit<WalkFrame, 'index'>[] = [
  { aDx: 3, bDx: -3, aUp: 0, bUp: 0, rise: 0, swing: -2 }, // contact, A leads
  { aDx: 0, bDx: 0, aUp: 0, bUp: 2, rise: 1, swing: 0 }, // passing, B lifts
  { aDx: -3, bDx: 3, aUp: 0, bUp: 0, rise: 0, swing: 2 }, // contact, B leads
  { aDx: 0, bDx: 0, aUp: 2, bUp: 0, rise: 1, swing: 0 }, // passing, A lifts
];

/** Quantize a pose into its walk frame. Story sprites share the actor's gait. */
export function walkFrame(pose: Pose): WalkFrame {
  if (!pose.walking) return STANDING;
  const tau = Math.PI * 2;
  const norm = ((pose.phase % tau) + tau) % tau;
  const index = Math.floor(norm / (Math.PI / 2)) % 4;
  return { index, ...CYCLE[index]! };
}

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

/** The default player actor (~40px tall): 4-way facing, 4-frame walk cycle. */
export function drawActor(ctx: CanvasRenderingContext2D, fx: number, fy: number, pose: Pose, t: number): void {
  const f = walkFrame(pose);
  const bob = pose.walking ? 0 : Math.round(Math.sin(t * 1.8));
  const y = fy + bob - f.rise;
  const profile = pose.facing === 'left' || pose.facing === 'right';

  faceCtx(ctx, fx, pose.facing);
  if (profile) {
    // legs stride: feet offset along the facing; the passing leg's foot
    // leaves the ground (shortened from the bottom, hip stays put)
    blk(ctx, fx - 5 + f.aDx, y - 12, 4, 12 - f.aUp, P.night);
    blk(ctx, fx + 1 + f.bDx, y - 12, 4, 12 - f.bUp, P.night);
    // torso + counter-swinging arms
    blk(ctx, fx - 6, y - 26, 12, 15, P.cloth);
    px(ctx, fx - 6, y - 26, 12, 3, P.clothLit);
    blk(ctx, fx - 9, y - 25, 3, 11 - f.swing, P.cloth);
    blk(ctx, fx + 6, y - 25, 3, 11 + f.swing, P.cloth);
    // head in profile
    blk(ctx, fx - 4, y - 36, 9, 10, P.skin);
    px(ctx, fx - 4, y - 36, 9, 2, P.woodDark); // hair
    if (!blinking(t)) px(ctx, fx + 2, y - 32, 1, 2, P.black); // eye
    talkMouth(ctx, fx + 3, y - 29, pose.talking, t);
  } else {
    // toward/away: alternating leg lift with a 1px torso sway — a distinct
    // gait, not the profile stride flattened
    const sway = f.swing === 0 ? 0 : f.swing > 0 ? 1 : -1;
    blk(ctx, fx - 5, y - 12, 4, 12 - f.aUp, P.night);
    blk(ctx, fx + 1, y - 12, 4, 12 - f.bUp, P.night);
    blk(ctx, fx - 6 + sway, y - 26, 12, 15, P.cloth);
    px(ctx, fx - 6 + sway, y - 26, 12, 3, P.clothLit);
    blk(ctx, fx - 9 + sway, y - 25, 3, 10 + f.swing, P.cloth);
    blk(ctx, fx + 6 + sway, y - 25, 3, 10 - f.swing, P.cloth);
    blk(ctx, fx - 4 + sway, y - 36, 9, 10, P.skin);
    if (pose.facing === 'up') {
      // back of the head: all hair, no face
      px(ctx, fx - 4 + sway, y - 36, 9, 7, P.woodDark);
    } else {
      px(ctx, fx - 4 + sway, y - 36, 9, 2, P.woodDark);
      if (!blinking(t)) {
        px(ctx, fx - 2 + sway, y - 32, 1, 2, P.black);
        px(ctx, fx + 2 + sway, y - 32, 1, 2, P.black);
      }
      talkMouth(ctx, fx - 1 + sway, y - 29, pose.talking, t);
    }
  }
  ctx.restore();
}
