// Ordered (Bayer) dithering — flat fills look cheap; dithered gradients are
// what sells the VGA feel in skies, seas and glows.

import type { RGB } from './palette.ts';

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** Threshold in [0,1) for pixel (x,y). */
function threshold(x: number, y: number): number {
  return (BAYER4[y & 3]![x & 3]! + 0.5) / 16;
}

/** Dither between two colours by t∈[0,1] at pixel (x,y). */
export function ditherPick(a: RGB, b: RGB, t: number, x: number, y: number): RGB {
  return t > threshold(x, y) ? b : a;
}

/** Dither along a multi-stop ramp by t∈[0,1] at pixel (x,y). */
export function rampPick(ramp: readonly RGB[], t: number, x: number, y: number): RGB {
  const last = ramp.length - 1;
  const pos = Math.min(Math.max(t, 0), 0.9999) * last;
  const i = Math.floor(pos);
  return ditherPick(ramp[i]!, ramp[i + 1]!, pos - i, x, y);
}

/** Fast per-pixel writes into an ImageData you putImageData once. */
export class Pixels {
  readonly w: number;
  readonly h: number;
  private img: ImageData;

  constructor(img: ImageData, w: number, h: number) {
    this.img = img;
    this.w = w;
    this.h = h;
  }

  set(x: number, y: number, c: RGB): void {
    const i = (y * this.w + x) * 4;
    const d = this.img.data;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
}

/** Fill a rect with a vertical dithered ramp (the sky-band recipe). */
export function rampRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: readonly RGB[],
): void {
  const img = ctx.createImageData(w, h);
  const px = new Pixels(img, w, h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      px.set(xx, yy, rampPick(ramp, yy / h, x + xx, y + yy));
    }
  }
  ctx.putImageData(img, x, y);
}
