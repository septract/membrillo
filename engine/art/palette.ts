// Shared palette. Every colour in every painter comes from here (or a story's
// own additions built with the same helpers) — a small harmonious set is what
// keeps code-drawn scenes cohesive.

export type RGB = readonly [number, number, number];

export const P = {
  black: [16, 14, 20] as RGB,
  night: [24, 28, 44] as RGB,
  skyTop: [46, 58, 110] as RGB,
  skyMid: [92, 96, 150] as RGB,
  skyLow: [178, 140, 132] as RGB,
  horizon: [226, 178, 132] as RGB,
  seaDeep: [30, 48, 72] as RGB,
  sea: [44, 74, 98] as RGB,
  seaLit: [94, 130, 142] as RGB,
  stoneDark: [58, 54, 66] as RGB,
  stone: [96, 90, 100] as RGB,
  stoneLit: [140, 132, 138] as RGB,
  woodDark: [70, 48, 38] as RGB,
  wood: [110, 76, 52] as RGB,
  woodLit: [150, 108, 70] as RGB,
  grassDark: [40, 66, 44] as RGB,
  grass: [66, 100, 56] as RGB,
  grassLit: [110, 140, 72] as RGB,
  cloth: [140, 60, 56] as RGB,
  clothLit: [188, 96, 74] as RGB,
  skin: [214, 168, 130] as RGB,
  skinShade: [172, 126, 100] as RGB,
  brass: [196, 156, 72] as RGB,
  brassLit: [236, 204, 120] as RGB,
  glow: [252, 232, 160] as RGB,
  white: [236, 232, 224] as RGB,
} as const;

export function css(c: RGB): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

/** Blend two palette colours; t=0 → a, t=1 → b. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
