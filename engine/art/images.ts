// Image-asset support for painters. The painter seam is draw-only code, so
// images need no engine machinery — these helpers just make the pattern a
// convention: bundle a PNG with the story (Vite turns `new URL('./x.png',
// import.meta.url)` into an asset), then wrap it as a scene painter or a
// spritesheet-backed sprite painter.
//
// Pixel art: assets draw at WORLD scale onto the pixel buffer, so 1 image
// pixel = 1 world pixel; author art at scene/sprite size, never pre-scaled.

import type { State } from '../core/types.ts';
import { P, css } from './palette.ts';
import type { Facing, Pose, SpritePainter } from './sprites.ts';

const cache = new Map<string, HTMLImageElement>();

/** Cached image element; starts loading on first call. */
export function loadImage(url: string): HTMLImageElement {
  let img = cache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    cache.set(url, img);
  }
  return img;
}

/** A scene painter that draws one full-scene image (dark fill until loaded). */
export function imageScene(url: string): (ctx: CanvasRenderingContext2D, state: State, t: number) => void {
  const img = loadImage(url);
  return (ctx) => {
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0);
    } else {
      ctx.fillStyle = css(P.night);
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  };
}

/**
 * Spritesheet contract for image-based characters/companions:
 *
 * - Fixed-size frames in a grid; each ROW is a facing, each COLUMN a frame.
 * - Row order: `rows` maps facings to row indices. A missing 'left' row is
 *   mirrored from 'right' automatically (the usual pixel-art convention).
 * - Column 0 is idle; columns 1..walkFrames cycle while walking.
 * - Frames are drawn feet-up: the bottom-centre of a frame is the anchor.
 */
export interface SheetSpec {
  frameW: number;
  frameH: number;
  rows: Partial<Record<Facing, number>>;
  /** Number of walking frames after the idle column (default 2). */
  walkFrames?: number;
}

export function sheetSprite(url: string, spec: SheetSpec): SpritePainter {
  const img = loadImage(url);
  const walkFrames = spec.walkFrames ?? 2;
  return (ctx, fx, fy, pose: Pose, _t) => {
    if (!img.complete || img.naturalWidth === 0) {
      // Loading placeholder: a body-sized box, same as paint-less characters.
      ctx.fillStyle = css(P.stone);
      ctx.fillRect(fx - spec.frameW / 2, fy - spec.frameH, spec.frameW, spec.frameH);
      return;
    }
    let facing = pose.facing;
    let mirror = false;
    if (spec.rows[facing] === undefined && facing === 'left' && spec.rows.right !== undefined) {
      facing = 'right';
      mirror = true;
    }
    const row = spec.rows[facing] ?? 0;
    const col = pose.walking ? 1 + (Math.floor(pose.phase / Math.PI) % walkFrames) : 0;
    ctx.save();
    if (mirror) {
      ctx.translate(fx * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(
      img,
      col * spec.frameW,
      row * spec.frameH,
      spec.frameW,
      spec.frameH,
      Math.round(fx - spec.frameW / 2),
      Math.round(fy - spec.frameH),
      spec.frameW,
      spec.frameH,
    );
    ctx.restore();
  };
}
