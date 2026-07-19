// Unit tests for the follower breadcrumb trail (node --test).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { followGap, pushTrail, resetTrail, trailPointAt, type Trail } from '../engine/followers.ts';

function straightTrail(points: [number, number][]): Trail {
  const trail: Trail = { points: [] };
  resetTrail(trail, { x: points[0]![0], y: points[0]![1] });
  for (const [x, y] of points.slice(1)) pushTrail(trail, { x, y });
  return trail;
}

test('pushTrail drops sub-threshold jitter but keeps real movement', () => {
  const trail: Trail = { points: [] };
  resetTrail(trail, { x: 0, y: 0 });
  pushTrail(trail, { x: 1, y: 0 }); // < 3px — ignored
  assert.equal(trail.points.length, 1);
  pushTrail(trail, { x: 4, y: 0 });
  assert.equal(trail.points.length, 2);
});

test('trailPointAt walks back along the trail by distance', () => {
  const trail = straightTrail([[0, 100], [10, 100], [20, 100], [30, 100]]);
  assert.deepEqual(trailPointAt(trail, 0), { x: 30, y: 100 });
  assert.deepEqual(trailPointAt(trail, 5), { x: 25, y: 100 });
  assert.deepEqual(trailPointAt(trail, 15), { x: 15, y: 100 });
  // Beyond the trail: clamps to the oldest breadcrumb.
  assert.deepEqual(trailPointAt(trail, 500), { x: 0, y: 100 });
});

test('trailPointAt spans corners correctly', () => {
  const trail = straightTrail([[0, 0], [10, 0], [10, 10]]);
  assert.deepEqual(trailPointAt(trail, 5), { x: 10, y: 5 });
  assert.deepEqual(trailPointAt(trail, 15), { x: 5, y: 0 });
});

test('followGap spaces followers out in file', () => {
  assert.ok(followGap(0) > 0);
  assert.ok(followGap(1) > followGap(0));
});
