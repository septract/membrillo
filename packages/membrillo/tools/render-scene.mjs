// Scene render pipeline (Phase 1): a floorplan → a perspective plate + the
// calibrated depth/walk band, so a schematic 3D room and the physics a sprite
// walks it by are produced together, consistent by construction. In-house
// software renderer — flat-shaded boxes, a per-pixel textured floor, ordered
// dithering, nearest-palette snap — no external tools. See
// docs/2026-07-19-scene-render-pipeline.md.
//
//   membrillo scene build <storyId> <sceneId> [--root ./stories]
//
// Reads   <root>/<story>/floorplans/<scene>.json
// Writes  <root>/<story>/paint/assets/<scene>.png        (the plate — ships)
//         <root>/<story>/floorplans/<scene>.calib.json   ({ size, depth, walk })
//
// Floorplan schema (all world units ≈ feet, +x right, +y up, +z away):
//   view:   { w, h }                          plate size (= scene view/size)
//   camera: { eye:[x,y,z], target:[x,y,z], hfov }   long-ish lens, low pitch
//   floor:  { color:[r,g,b], boardWidth }
//   walls:  [ { box:[x0,x1,y0,y1,z0,z1], color } ]
//   props:  [ { box:[x0,x1,y0,y1,z0,z1], color } ]
//   insets: [ { quad:[[x,y,z]×4], color } ]    flat panels (window, screen…)
//   walkArea: { x0, x1, z0, z1 }               walkable floor rect (drives calib)
//   sprite:   { heightUnits=1.7, nativePx=40 } the actor's real height, in units
//                                              and in its native draw pixels
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { P } from '../art/palette.ts';

// ---- PNG encoder (shared with tools/make-test-art.mjs) ---------------------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const png_chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4, 'ascii'); d.copy(o, 8); o.writeUInt32BE(crc32(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) { raw[y * (1 + w * 4)] = 0; rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), png_chunk('IHDR', ihdr), png_chunk('IDAT', deflateSync(raw, { level: 9 })), png_chunk('IEND', Buffer.alloc(0))]);
}

// ---- vec3 ------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a) => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

// ---- palette snap + ordered dither -----------------------------------------
const PAL = Object.values(P);
function snap(c) { let best = PAL[0], bd = Infinity; for (const p of PAL) { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; best = p; } } return best; }
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const SPREAD = 30;
const snapDither = (x, y, c) => { const b = (BAYER[y & 3][x & 3] / 16 - 0.5) * SPREAD; return snap([c[0] + b, c[1] + b, c[2] + b]); };

// ---- camera + calibration (pure; shared by render and check) ---------------
/** Build the perspective projector for a floorplan's camera. */
function projectorOf(fp) {
  const W = fp.view.w, H = fp.view.h, EYE = fp.camera.eye;
  const FOCAL = (W / 2) / Math.tan((fp.camera.hfov * Math.PI / 180) / 2);
  const F = norm(sub(fp.camera.target, EYE));
  const R = norm(cross([0, 1, 0], F));     // +x → screen right
  const U = norm(cross(F, R));             // +y → screen up
  const project = (p) => { const d = sub(p, EYE); const cz = dot(d, F); return { x: W / 2 + FOCAL * dot(d, R) / cz, y: H / 2 - FOCAL * dot(d, U) / cz, z: cz }; };
  return { W, H, FOCAL, EYE, F, R, U, project };
}

/** Derive { size, depth, walk } from the projected floor — the calibration. */
function bandFrom(project, W, H, fp) {
  const wa = fp.walkArea;
  const hUnits = fp.sprite?.heightUnits ?? 1.7, nativePx = fp.sprite?.nativePx ?? 40;
  const zNear = Math.min(wa.z0, wa.z1), zFar = Math.max(wa.z0, wa.z1);
  const xMid = (wa.x0 + wa.x1) / 2;
  const probe = (z) => { const feet = project([xMid, 0, z]), top = project([xMid, hUnits, z]); return { row: feet.y, h: feet.y - top.y }; };
  const nearP = probe(zNear), farP = probe(zFar);
  const depth = {
    far: { y: Math.round(farP.row), scale: +(farP.h / nativePx).toFixed(3) },
    near: { y: Math.round(nearP.row), scale: +(nearP.h / nativePx).toFixed(3) },
  };
  const nl = project([wa.x0, 0, zNear]), nr = project([wa.x1, 0, zNear]);
  const fl = project([wa.x0, 0, zFar]), fr = project([wa.x1, 0, zFar]);
  const left = Math.round(Math.max(fl.x, nl.x)), right = Math.round(Math.min(fr.x, nr.x));
  const yTop = Math.round(Math.min(fl.y, fr.y)), yBot = Math.round(Math.max(nl.y, nr.y));
  return { size: { w: W, h: H }, depth, walk: { x: left, y: yTop, w: right - left, h: yBot - yTop } };
}

/** The calibrated band for a floorplan — no pixels rendered. */
export function calibrate(fp) { const { project, W, H } = projectorOf(fp); return bandFrom(project, W, H, fp); }

/**
 * Render a floorplan. Returns { rgba, width, height, depth, walk } — the plate
 * pixels and the calibrated band ready to drop into a scene JSON.
 */
export function renderScene(fp) {
  const { W, H, FOCAL, EYE, F, R, U, project } = projectorOf(fp);

  const buf = Buffer.alloc(W * H * 4);
  const zbuf = new Float32Array(W * H).fill(Infinity);
  const px = (x, y, c, z) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (z !== undefined && z > zbuf[i]) return; if (z !== undefined) zbuf[i] = z; buf[i * 4] = c[0]; buf[i * 4 + 1] = c[1]; buf[i * 4 + 2] = c[2]; buf[i * 4 + 3] = 255; };

  function fillPoly(pts, color) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    for (let y = Math.max(0, minY | 0); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) { const t = (y - a.y) / (b.y - a.y); xs.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) }); } }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p.x - q.x);
      for (let k = 0; k + 1 < xs.length; k += 2) { const l = xs[k], r = xs[k + 1]; for (let x = Math.max(0, Math.ceil(l.x)); x <= Math.min(W - 1, r.x | 0); x++) { const t = (x - l.x) / (r.x - l.x || 1); px(x, y, snapDither(x, y, color), l.z + t * (r.z - l.z)); } }
    }
  }

  const LIGHT = norm([-0.4, -1, 0.35]);
  const shade = (base, n) => { const k = 0.55 + 0.5 * Math.max(0, dot(n, scale(LIGHT, -1))); return [base[0] * k, base[1] * k, base[2] * k]; };
  function face(corners, base) { const c = scale(corners.reduce(add), 1 / corners.length); const n = norm(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0]))); if (dot(n, sub(EYE, c)) <= 0) return null; return { pts: corners.map(project), color: shade(base, n), depth: dot(sub(c, EYE), F) }; }
  function boxFaces([x0, x1, y0, y1, z0, z1], base) {
    const V = (x, y, z) => [x, y, z];
    return [
      [V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)], [V(x0, y0, z1), V(x1, y0, z1), V(x1, y0, z0), V(x0, y0, z0)],
      [V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0)], [V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z1), V(x1, y1, z1)],
      [V(x0, y0, z1), V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1)], [V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x1, y1, z0)],
    ].map((cn) => face(cn, base)).filter(Boolean);
  }

  // textured floor first (per-pixel unprojection to y=0), then geometry over it
  const wa = fp.walkArea, floorC = fp.floor.color, bwid = fp.floor.boardWidth ?? 0.9;
  const foot = (fp.props ?? []).map((p) => [p.box[0], p.box[1], p.box[4], p.box[5]]);
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const dir = norm(add(add(scale(R, (sx + 0.5 - W / 2) / FOCAL), scale(U, -(sy + 0.5 - H / 2) / FOCAL)), F));
    if (dir[1] >= -1e-4) continue;
    const t = -EYE[1] / dir[1]; if (t <= 0) continue;
    const wx = EYE[0] + dir[0] * t, wz = EYE[2] + dir[2] * t;
    if (wx < wa.x0 - 0.5 || wx > wa.x1 + 0.5 || wz < wa.z0 - 0.5 || wz > wa.z1 + 0.5) continue;
    const bi = Math.floor(wx / bwid), frac = wx / bwid - bi;
    let k = 1 + (bi % 2 ? -0.05 : 0.05);
    if (frac < 0.05 || frac > 0.95) k *= 0.68;
    if (((wz * 1.7 + bi * 3.1) % 4) < 0.14) k *= 0.8;
    let ao = Math.min(1, 0.45 + (wx - wa.x0) / 0.5) * Math.min(1, 0.45 + (wa.x1 - wx) / 0.5) * Math.min(1, 0.5 + (wa.z1 - wz) / 0.7);
    for (const [x0, x1, z0, z1] of foot) if (wx > x0 - 0.4 && wx < x1 + 0.4 && wz > z0 - 0.4 && wz < z1 + 0.4 && !(wx >= x0 && wx <= x1 && wz >= z0 && wz <= z1)) ao *= 0.72;
    px(sx, sy, snapDither(sx, sy, [floorC[0] * k * ao, floorC[1] * k * ao, floorC[2] * k * ao]), t * dot(dir, F));
  }

  const faces = [];
  for (const w of fp.walls ?? []) faces.push(...boxFaces(w.box, w.color));
  for (const p of fp.props ?? []) faces.push(...boxFaces(p.box, p.color));
  for (const ins of fp.insets ?? []) { const f = face(ins.quad, ins.color); if (f) faces.push(f); }
  faces.sort((a, b) => b.depth - a.depth);
  for (const f of faces) fillPoly(f.pts, f.color);

  const { depth, walk } = bandFrom(project, W, H, fp);
  return { rgba: buf, width: W, height: H, depth, walk };
}

// Compact-but-spaced inline JSON, matching the scenes' hand-authored one-liners.
const inline = (v) => typeof v !== 'object' || v === null ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(inline).join(', ')}]`
    : `{ ${Object.entries(v).map(([k, x]) => `"${k}": ${inline(x)}`).join(', ')} }`;

/**
 * Surgically replace the single-line size/depth/walk values in a scene file,
 * preserving all hand-authored content and each line's trailing comma. Keys
 * that aren't present (as a one-line value) are reported, not invented.
 */
function patchSceneBand(root, storyId, sceneId, band) {
  const scenePath = resolve(root, storyId, 'scenes', `${sceneId}.json`);
  if (!existsSync(scenePath)) return { patched: [], missing: ['size', 'depth', 'walk'], noScene: true };
  let text = readFileSync(scenePath, 'utf8');
  const patched = [], missing = [];
  for (const key of ['size', 'depth', 'walk']) {
    const re = new RegExp(`^(\\s*)"${key}":[^\\n]*?(,?)\\s*$`, 'm');
    if (re.test(text)) { text = text.replace(re, (_m, indent, comma) => `${indent}"${key}": ${inline(band[key])}${comma}`); patched.push(key); }
    else missing.push(key);
  }
  if (patched.length) writeFileSync(scenePath, text);
  return { patched, missing };
}

/** IO wrapper for the CLI: read floorplan, write plate + calib sidecar, patch the scene. */
export function buildScene(root, storyId, sceneId) {
  const fpPath = resolve(root, storyId, 'floorplans', `${sceneId}.json`);
  const fp = JSON.parse(readFileSync(fpPath, 'utf8'));
  const { rgba, width, height, depth, walk } = renderScene(fp);
  const pngPath = resolve(root, storyId, 'paint', 'assets', `${sceneId}.png`);
  mkdirSync(dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, encodePng(width, height, rgba));
  const calib = { size: { w: width, h: height }, depth, walk };
  writeFileSync(resolve(root, storyId, 'floorplans', `${sceneId}.calib.json`), JSON.stringify(calib, null, 2) + '\n');
  console.log(`  ✓ ${storyId}/${sceneId}: wrote paint/assets/${sceneId}.png (${width}×${height})`);
  const { patched, missing, noScene } = patchSceneBand(root, storyId, sceneId, calib);
  if (patched.length) console.log(`    patched scenes/${sceneId}.json: ${patched.join(', ')}`);
  if (noScene) console.log(`    (no scenes/${sceneId}.json yet — add size/depth/walk: ${inline(calib)})`);
  else if (missing.length) console.log(`    add these to scenes/${sceneId}.json: ${missing.map((k) => `"${k}": ${inline(calib[k])}`).join(', ')}`);
  return calib;
}

// deep, key-order-insensitive canonical form — so reordered JSON keys don't
// read as drift, only real value changes do.
const sortKeys = (o) => Array.isArray(o) ? o.map(sortKeys) : (o && typeof o === 'object') ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])) : o;
const canon = (o) => JSON.stringify(sortKeys(o ?? null));

/**
 * Verify a scene JSON's size/depth/walk still match what its floorplan derives
 * — the model-checked consistency guarantee (a hand-edited walkbox that drifts
 * from the plate is caught, like validate/fuzz catch story drift).
 */
export function checkScene(root, storyId, sceneId) {
  const fp = JSON.parse(readFileSync(resolve(root, storyId, 'floorplans', `${sceneId}.json`), 'utf8'));
  const want = calibrate(fp);
  const scenePath = resolve(root, storyId, 'scenes', `${sceneId}.json`);
  if (!existsSync(scenePath)) return { ok: false, diffs: [`scenes/${sceneId}.json is missing`] };
  const scene = JSON.parse(readFileSync(scenePath, 'utf8'));
  const diffs = [];
  for (const key of ['size', 'depth', 'walk'])
    if (canon(scene[key]) !== canon(want[key])) diffs.push(`${key}: scene ${JSON.stringify(scene[key])} ≠ floorplan ${JSON.stringify(want[key])}`);
  return { ok: diffs.length === 0, diffs };
}

/** Check every floorplan under root (optionally restricted to storyIds). Returns the failure count. */
export function checkAll(root, ids = []) {
  const targets = ids.length ? ids : readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  let failed = 0, checked = 0;
  for (const story of targets) {
    const fpDir = resolve(root, story, 'floorplans');
    if (!existsSync(fpDir)) continue;
    for (const f of readdirSync(fpDir)) {
      if (!f.endsWith('.json') || f.endsWith('.calib.json')) continue;
      const scene = f.replace(/\.json$/, '');
      const { ok, diffs } = checkScene(root, story, scene);
      checked++;
      if (ok) console.log(`  ✓ ${story}/${scene}: scene matches floorplan`);
      else { failed++; console.error(`  ✗ ${story}/${scene}:`); for (const d of diffs) console.error(`      ${d}`); }
    }
  }
  if (!checked) console.log('  (no floorplans found)');
  return failed;
}

// ---- CLI (also invoked via `membrillo scene …`) ----------------------------
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const rest = process.argv.slice(2);
  const ri = rest.indexOf('--root'); const root = ri >= 0 ? rest[ri + 1] : process.env.STORIES_ROOT ?? './stories';
  const [sub, ...args] = rest.filter((a, i) => !a.startsWith('-') && !(ri >= 0 && i === ri + 1));
  if (sub === 'build') { if (!args[0] || !args[1]) { console.error('usage: render-scene build <storyId> <sceneId> [--root]'); process.exit(1); } buildScene(root, args[0], args[1]); }
  else if (sub === 'check') { process.exit(checkAll(root, args) ? 1 : 0); }
  else { console.error('usage: render-scene <build <story> <scene> | check [ids…]> [--root ./stories]'); process.exit(1); }
}
