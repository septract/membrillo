// Unit tests for walk geometry (node --test).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  boxesConnected,
  boxIndexAt,
  clampToWalkable,
  depthScale,
  findPath,
  walkBoxes,
} from '../engine/walk.ts';
import type { Box, Scene } from '../engine/core/types.ts';

// The lamplight-dock shape: two upper areas split by an obstacle, joined by a
// strip along the bottom.
const left: Box = { x: 0, y: 100, w: 100, h: 60 };
const right: Box = { x: 200, y: 100, w: 100, h: 60 };
const strip: Box = { x: 0, y: 140, w: 300, h: 20 };
const boxes = [left, right, strip];

test('walkBoxes normalises single box and array forms', () => {
  const room = { id: 'r', name: 'r', walk: left } as Scene;
  assert.deepEqual(walkBoxes(room), [left]);
  const multi = { id: 'r', name: 'r', walk: boxes } as Scene;
  assert.equal(walkBoxes(multi).length, 3);
  assert.deepEqual(walkBoxes({ id: 'c', name: 'c' } as Scene), []);
});

test('clampToWalkable finds the nearest standable point', () => {
  assert.deepEqual(clampToWalkable({ x: 50, y: 120 }, boxes), { x: 50, y: 120 });
  // Above the obstacle gap: the strip directly below (distance 50) beats the
  // corners of left/right (distance √2600).
  assert.deepEqual(clampToWalkable({ x: 150, y: 90 }, boxes), { x: 150, y: 140 });
});

test('connectivity: connected via the strip; disconnected without it', () => {
  assert.equal(boxesConnected(boxes), true);
  assert.equal(boxesConnected([left, right]), false);
  assert.equal(boxesConnected([left]), true);
});

test('adjacency: edge-touching boxes connect, a 1px gap does not', () => {
  const a: Box = { x: 0, y: 0, w: 10, h: 10 };
  const touching: Box = { x: 10, y: 0, w: 10, h: 10 };
  const gapped: Box = { x: 11, y: 0, w: 10, h: 10 };
  assert.equal(boxesConnected([a, touching]), true);
  assert.equal(boxesConnected([a, gapped]), false);
});

test('findPath routes around the gap through the strip', () => {
  const path = findPath({ x: 50, y: 110 }, { x: 250, y: 110 }, boxes);
  assert.deepEqual(path[path.length - 1], { x: 250, y: 110 });
  assert.ok(path.length > 1, 'must route via waypoints, not walk straight');
  // Every waypoint must be standable ground.
  for (const p of path) assert.notEqual(boxIndexAt(p, boxes), -1, JSON.stringify(p));
  // The route must dip into the strip (y >= 140) to get across.
  assert.ok(path.some((p) => p.y >= 140), 'route must pass through the bottom strip');
});

test('findPath within one box goes straight to the (clamped) target', () => {
  assert.deepEqual(findPath({ x: 10, y: 110 }, { x: 90, y: 150 }, [left]), [{ x: 90, y: 150 }]);
  assert.deepEqual(findPath({ x: 10, y: 110 }, { x: 500, y: 110 }, [left]), [{ x: 100, y: 110 }]);
});

test('depthScale interpolates and clamps', () => {
  const scene = {
    id: 'r',
    name: 'r',
    depth: { far: { y: 100, scale: 0.5 }, near: { y: 160, scale: 1.0 } },
  } as Scene;
  assert.equal(depthScale(scene, 100), 0.5);
  assert.equal(depthScale(scene, 160), 1.0);
  assert.equal(depthScale(scene, 130), 0.75);
  assert.equal(depthScale(scene, 60), 0.5); // clamped far
  assert.equal(depthScale(scene, 200), 1.0); // clamped near
  assert.equal(depthScale({ id: 'r', name: 'r' } as Scene, 130), 1);
});
