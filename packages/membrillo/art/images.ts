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
import { PORTRAIT, type Facing, type Pose, type PortraitPainter, type SpritePainter } from './sprites.ts';

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

/** Chroma-green test: bright green well above the red and blue channels. */
function isChromaGreen(d: Uint8ClampedArray, i: number): boolean {
  const r = d[i]!;
  const g = d[i + 1]!;
  const b = d[i + 2]!;
  return g > 80 && g > r * 1.5 && g > b * 1.5;
}

/**
 * A dialogue portrait from an image: cover-fits the image into the logical
 * 9:16 portrait canvas (any resolution in; the down-scale onto the small
 * canvas plus the overlay's pixelated upscale gives the chunky look for
 * free). Generated or painted art drops straight in.
 *
 * Chroma key, automatically: if at least three corners of the image are
 * flat chroma green, the green is knocked out to transparency (with a
 * despill pass on fringe pixels), so the bust floats over the dimmed scene
 * instead of carrying a rectangle. Generate on a flat green background to
 * opt in; ordinary art is untouched.
 */
export function portraitImage(url: string): PortraitPainter {
  const img = loadImage(url);
  let processed: HTMLCanvasElement | null = null;
  const prepare = (): HTMLCanvasElement => {
    if (processed) return processed;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cx = c.getContext('2d')!;
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    const at = (x: number, y: number): number => (y * c.width + x) * 4;
    const corners = [at(1, 1), at(c.width - 2, 1), at(1, c.height - 2), at(c.width - 2, c.height - 2)];
    if (corners.filter((i) => isChromaGreen(d, i)).length >= 3) {
      for (let i = 0; i < d.length; i += 4) {
        if (isChromaGreen(d, i)) {
          d[i + 3] = 0;
        } else if (d[i + 1]! > Math.max(d[i]!, d[i + 2]!) * 1.2) {
          d[i + 1] = Math.max(d[i]!, d[i + 2]!); // despill the green fringe
        }
      }
      cx.putImageData(data, 0, 0);
    }
    processed = c;
    return c;
  };
  return (ctx) => {
    ctx.clearRect(0, 0, PORTRAIT.w, PORTRAIT.h);
    if (!img.complete || img.naturalWidth === 0) return; // invisible until loaded
    const src = prepare();
    // cover-fit: fill the frame, cropping the longer axis symmetrically
    const scale = Math.max(PORTRAIT.w / src.width, PORTRAIT.h / src.height);
    const sw = PORTRAIT.w / scale;
    const sh = PORTRAIT.h / scale;
    const sx = (src.width - sw) / 2;
    const sy = (src.height - sh) / 2;
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, PORTRAIT.w, PORTRAIT.h);
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
