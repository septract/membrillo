// Walk geometry: multi-box walkable areas, adjacency, and waypoint routing.
// Pure and DOM-free (unit-tested in tools/), but presentation-only — the
// fuzzer never consults geometry, so a broken walkbox can strand the sprite,
// not the story. The validator checks connectivity for exactly that reason.

import type { Box, Point, Scene } from './core/types.ts';

export function walkBoxes(scene: Scene): Box[] {
  if (scene.walk === undefined) return [];
  return Array.isArray(scene.walk) ? scene.walk : [scene.walk];
}

export function inBox(p: Point, b: Box): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

export function boxIndexAt(p: Point, boxes: Box[]): number {
  return boxes.findIndex((b) => inBox(p, b));
}

function clampToBox(p: Point, b: Box): Point {
  return {
    x: Math.min(Math.max(p.x, b.x), b.x + b.w),
    y: Math.min(Math.max(p.y, b.y), b.y + b.h),
  };
}

/** Nearest standable point across all boxes. */
export function clampToWalkable(p: Point, boxes: Box[]): Point {
  let best: Point = p;
  let bestDist = Infinity;
  for (const b of boxes) {
    const c = clampToBox(p, b);
    const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/** The shared region two boxes touch/overlap in (expanded by 1px), or null. */
function portalRect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x - 1);
  const y = Math.max(a.y, b.y - 1);
  const x2 = Math.min(a.x + a.w, b.x + b.w + 1);
  const y2 = Math.min(a.y + a.h, b.y + b.h + 1);
  if (x2 < x || y2 < y) return null;
  return { x, y, w: x2 - x, h: y2 - y };
}

/**
 * Waypoints from `from` to `to` through connected boxes (BFS over adjacency,
 * few boxes per room). Each crossing aims for the point of the shared edge
 * closest to the straight line, so routes hug the direct path. Both endpoints
 * are clamped to walkable ground. Returns at least [target].
 */
export function findPath(from: Point, to: Point, boxes: Box[]): Point[] {
  const target = clampToWalkable(to, boxes);
  if (boxes.length <= 1) return [target];
  const start = boxIndexAt(clampToWalkable(from, boxes), boxes);
  const goal = boxIndexAt(target, boxes);
  if (start === -1 || goal === -1 || start === goal) return [target];

  // BFS box-to-box.
  const prev = new Map<number, number>();
  const queue = [start];
  prev.set(start, -1);
  while (queue.length > 0 && !prev.has(goal)) {
    const i = queue.shift()!;
    boxes.forEach((b, j) => {
      if (!prev.has(j) && portalRect(boxes[i]!, b)) {
        prev.set(j, i);
        queue.push(j);
      }
    });
  }
  if (!prev.has(goal)) return [target]; // disconnected — validator's problem

  const chain: number[] = [];
  for (let i = goal; i !== -1; i = prev.get(i)!) chain.unshift(i);

  const waypoints: Point[] = [];
  let cursor = from;
  for (let k = 0; k + 1 < chain.length; k++) {
    const portal = portalRect(boxes[chain[k]!]!, boxes[chain[k + 1]!]!)!;
    // Aim for the portal point nearest the straight cursor→target line.
    const mid = { x: (cursor.x + target.x) / 2, y: (cursor.y + target.y) / 2 };
    const wp = clampToBox(mid, portal);
    waypoints.push(wp);
    cursor = wp;
  }
  waypoints.push(target);
  return waypoints;
}

/** True if every box can reach every other (the validator's sanity check). */
export function boxesConnected(boxes: Box[]): boolean {
  if (boxes.length <= 1) return true;
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const i = queue.shift()!;
    boxes.forEach((b, j) => {
      if (!seen.has(j) && portalRect(boxes[i]!, b)) {
        seen.add(j);
        queue.push(j);
      }
    });
  }
  return seen.size === boxes.length;
}

/** Sprite scale at feet-y for a scene (1 when no depth is declared). */
export function depthScale(scene: Scene, y: number): number {
  const d = scene.depth;
  if (!d || d.near.y === d.far.y) return 1;
  const t = (y - d.far.y) / (d.near.y - d.far.y);
  const clamped = Math.min(Math.max(t, 0), 1);
  return d.far.scale + (d.near.scale - d.far.scale) * clamped;
}
