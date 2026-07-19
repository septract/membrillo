// The calibration is pure math the whole pipeline trusts (a plate and the band
// a sprite walks it by must agree). Lock it: the roomdemo fixture's floorplan
// must keep deriving its committed band, and checkScene must agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibrate, checkScene } from './render-scene.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../games/classic/stories');
const floorplan = (story, scene) =>
  JSON.parse(readFileSync(resolve(ROOT, story, 'floorplans', `${scene}.json`), 'utf8'));

test('calibrate derives the committed band for roomdemo/apt', () => {
  const calib = JSON.parse(readFileSync(resolve(ROOT, 'roomdemo/floorplans/apt.calib.json'), 'utf8'));
  assert.deepEqual(calibrate(floorplan('roomdemo', 'apt')), calib);
});

test('checkScene passes when a scene matches its floorplan', () => {
  assert.deepEqual(checkScene(ROOT, 'roomdemo', 'apt'), { ok: true, diffs: [] });
});

test('calibration is deterministic, with far smaller and higher than near', () => {
  const fp = floorplan('roomdemo', 'apt');
  const a = calibrate(fp);
  assert.deepEqual(a, calibrate(fp));
  assert.ok(a.depth.far.scale < a.depth.near.scale, 'far sprite scales smaller');
  assert.ok(a.depth.far.y < a.depth.near.y, 'far anchor sits higher on screen');
});
