// Generates the postcard fixture's test images — a scene background and a
// character spritesheet — as PNGs, with zero dependencies (hand-rolled PNG
// encoder over node:zlib). These are STAND-INS proving the image-asset seam;
// real art from a pixel editor drops into the same files.
//
//   node tools/make-test-art.mjs
//
// Writes stories/postcard/paint/assets/{yard-bg,buddy-sheet}.png

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

// --- Minimal PNG encoder ----------------------------------------------------

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Tiny raster helpers ----------------------------------------------------

function raster(w, h) {
  const buf = Buffer.alloc(w * h * 4);
  return {
    buf,
    w,
    h,
    set(x, y, [r, g, b, a = 255]) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    },
    fill(x, y, fw, fh, c) {
      for (let yy = y; yy < y + fh; yy++) for (let xx = x; xx < x + fw; xx++) this.set(xx, yy, c);
    },
    /** Rect with a 1px dark outline, like the engine's blk(). */
    blk(x, y, fw, fh, c, o = [16, 14, 20]) {
      this.fill(x - 1, y - 1, fw + 2, fh + 2, o);
      this.fill(x, y, fw, fh, c);
    },
  };
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// --- Background: a rolling yard with a gate (320x180) -----------------------

const BG_W = 320;
const BG_H = 180;
const bg = raster(BG_W, BG_H);

const skyTop = [110, 140, 200];
const skyLow = [230, 200, 160];
const hillFar = [120, 150, 110];
const hillNear = [90, 128, 84];
const grass = [70, 110, 62];
const grassDark = [52, 88, 50];
const wood = [110, 76, 52];
const woodDark = [70, 48, 38];

for (let y = 0; y < 92; y++) {
  const t = y / 92;
  for (let x = 0; x < BG_W; x++) {
    // 2x2 ordered dither between the band colours
    const dt = t + ((x + y) % 2 === 0 ? -0.06 : 0.06);
    bg.set(x, y, mix(skyTop, skyLow, Math.min(1, Math.max(0, dt))));
  }
}
for (let x = 0; x < BG_W; x++) {
  const h1 = 78 + Math.round(Math.sin(x / 38) * 6 + Math.cos(x / 71) * 4);
  const h2 = 96 + Math.round(Math.sin(x / 23 + 2) * 5);
  for (let y = h1; y < BG_H; y++) bg.set(x, y, hillFar);
  for (let y = h2; y < BG_H; y++) bg.set(x, y, hillNear);
}
for (let y = 116; y < BG_H; y++) {
  for (let x = 0; x < BG_W; x++) {
    bg.set(x, y, (x + y * 3) % 7 === 0 ? grassDark : grass);
  }
}
// dirt path to the gate
for (let x = 20; x < 300; x++) {
  const cy = 150 + Math.round(Math.sin(x / 40) * 4);
  for (let y = cy - 3; y < cy + 4; y++) bg.set(x, y, mix(wood, grass, 0.45));
}
// fence + gate on the right
for (let x = 244; x < 316; x += 12) bg.blk(x, 108, 4, 26, wood, woodDark);
bg.fill(244, 112, 72, 3, wood);
bg.fill(244, 124, 72, 3, wood);
bg.blk(282, 104, 26, 32, woodDark);
bg.fill(285, 107, 20, 26, mix(woodDark, [16, 14, 20], 0.4)); // the open gate dark
// signpost at left
bg.blk(60, 112, 4, 26, wood, woodDark);
bg.blk(50, 106, 24, 10, mix(wood, [255, 255, 255], 0.2), woodDark);

writeSprite: {
  mkdirSync(new URL('../stories/postcard/paint/assets/', import.meta.url), { recursive: true });
}
writeFileSync(
  new URL('../stories/postcard/paint/assets/yard-bg.png', import.meta.url),
  encodePng(BG_W, BG_H, bg.buf),
);

// --- Spritesheet: "Buddy" — 3 cols (idle, stepA, stepB) x 3 rows ------------
// Rows: 0 = down, 1 = right, 2 = up. Left is mirrored from right at runtime.

const FW = 20;
const FH = 40;
const sheet = raster(FW * 3, FH * 3);

const tunic = [220, 140, 60];
const tunicLit = [240, 170, 90];
const slacks = [50, 60, 90];
const skin = [214, 168, 130];
const hair = [90, 60, 40];

function drawBuddy(col, row, facing, step) {
  const ox = col * FW + FW / 2; // feet-centre x
  const oy = row * FH + FH; // feet y
  const r = {
    blk: (x, y, w, h, c) => sheet.blk(ox + x, oy + y, w, h, c),
    fill: (x, y, w, h, c) => sheet.fill(ox + x, oy + y, w, h, c),
  };
  // legs (step swings them)
  r.blk(-5, -12, 4, 12 + step, slacks);
  r.blk(1, -12, 4, 12 - step, slacks);
  // tunic + arms
  r.blk(-6, -26, 12, 15, tunic);
  r.fill(-6, -26, 12, 3, tunicLit);
  r.blk(-9, -25, 3, 11 - step, tunic);
  r.blk(6, -25, 3, 11 + step, tunic);
  // head
  r.blk(-4, -36, 9, 10, skin);
  if (facing === 'up') {
    r.fill(-4, -36, 9, 7, hair); // back of the head
  } else {
    r.fill(-4, -36, 9, 3, hair);
    if (facing === 'down') {
      r.fill(-2, -32, 1, 2, [16, 14, 20]);
      r.fill(2, -32, 1, 2, [16, 14, 20]);
    } else {
      r.fill(2, -32, 1, 2, [16, 14, 20]); // profile eye
    }
  }
}

const rows = ['down', 'right', 'up'];
rows.forEach((facing, row) => {
  [0, 2, -2].forEach((step, col) => drawBuddy(col, row, facing, step));
});

writeFileSync(
  new URL('../stories/postcard/paint/assets/buddy-sheet.png', import.meta.url),
  encodePng(FW * 3, FH * 3, sheet.buf),
);

console.log('wrote stories/postcard/paint/assets/{yard-bg,buddy-sheet}.png');
