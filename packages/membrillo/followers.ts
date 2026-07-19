// Follower trail: companions walk the actor's own recent path (breadcrumbs),
// which is guaranteed walkable ground — no second pathfinder needed. Pure and
// DOM-free; unit-tested in tools/.

import type { Point } from './core/types.ts';

export interface Trail {
  /** Breadcrumbs, oldest → newest. */
  points: Point[];
}

const MIN_STEP = 3; // px between breadcrumbs
const MAX_POINTS = 240;

/** Gap along the trail between the actor and follower i (0-based). */
export function followGap(index: number): number {
  return 24 * (index + 1);
}

export function resetTrail(trail: Trail, at: Point): void {
  trail.points = [{ ...at }];
}

export function pushTrail(trail: Trail, p: Point): void {
  const last = trail.points[trail.points.length - 1];
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_STEP) {
    trail.points.push({ ...p });
    if (trail.points.length > MAX_POINTS) trail.points.splice(0, trail.points.length - MAX_POINTS);
  }
}

/**
 * The point `distBack` pixels behind the newest breadcrumb, measured along
 * the trail. Clamps to the oldest point on short trails.
 */
export function trailPointAt(trail: Trail, distBack: number): Point {
  const pts = trail.points;
  if (pts.length === 0) return { x: 0, y: 0 };
  let remaining = distBack;
  for (let i = pts.length - 1; i > 0; i--) {
    const a = pts[i]!;
    const b = pts[i - 1]!;
    const seg = Math.hypot(a.x - b.x, a.y - b.y);
    if (seg >= remaining) {
      const t = seg === 0 ? 0 : remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  return { ...pts[0]! };
}
