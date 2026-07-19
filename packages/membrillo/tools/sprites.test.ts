// Unit tests for the walk-cycle quantization (node --test). walkFrame is the
// shared gait: the default actor and story sprites all step through it, so
// its frame boundaries and invariants are engine contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { walkFrame, type Pose } from '../art/sprites.ts';

const pose = (phase: number, walking = true): Pose => ({
  facing: 'right',
  phase,
  walking,
  talking: false,
});

test('standing pose is the zero frame', () => {
  const f = walkFrame(pose(1.7, false));
  assert.equal(f.index, -1);
  assert.deepEqual([f.aDx, f.bDx, f.aUp, f.bUp, f.rise, f.swing], [0, 0, 0, 0, 0, 0]);
});

test('a full cycle is four frames, one per quarter turn', () => {
  const q = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    assert.equal(walkFrame(pose(i * q + 0.01)).index, i);
    assert.equal(walkFrame(pose(i * q + q - 0.01)).index, i);
  }
  // and it wraps
  assert.equal(walkFrame(pose(4 * q + 0.01)).index, 0);
});

test('negative phase wraps into the cycle', () => {
  assert.equal(walkFrame(pose(-0.01)).index, 3);
  assert.equal(walkFrame(pose(-Math.PI * 2 + 0.01)).index, 0);
});

test('contact frames: both feet grounded, legs apart, no rise', () => {
  for (const i of [0, 2]) {
    const f = walkFrame(pose(i * (Math.PI / 2) + 0.1));
    assert.equal(f.aUp, 0);
    assert.equal(f.bUp, 0);
    assert.equal(f.rise, 0);
    assert.ok(f.aDx !== 0 && f.aDx === -f.bDx, 'legs stride symmetrically');
  }
  // opposite legs lead on the two contact frames
  assert.equal(walkFrame(pose(0.1)).aDx, -walkFrame(pose(Math.PI + 0.1)).aDx);
});

test('passing frames: alternating leg lifted, body risen', () => {
  const p1 = walkFrame(pose(Math.PI / 2 + 0.1));
  const p3 = walkFrame(pose((3 * Math.PI) / 2 + 0.1));
  assert.equal(p1.rise, 1);
  assert.equal(p3.rise, 1);
  assert.ok(p1.bUp > 0 && p1.aUp === 0, 'first passing lifts leg B');
  assert.ok(p3.aUp > 0 && p3.bUp === 0, 'second passing lifts leg A');
});

test('one step (phase π) spans exactly two frames', () => {
  assert.equal(walkFrame(pose(0.1)).index, 0);
  assert.equal(walkFrame(pose(0.1 + Math.PI / 2)).index, 1);
  assert.equal(walkFrame(pose(0.1 + Math.PI)).index, 2);
});
