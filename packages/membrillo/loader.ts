// Assembles Story objects from the files a CONSUMER bundled and handed to
// boot() — the engine never globs a fixed path itself (the library seam; see
// docs/2026-07-18-library-plan.md). Story identity derives from manifest
// locations: every directory containing a manifest.json is a story, and its
// other files are matched by path prefix, so any glob root works.

import type { Companion, Dialogue, Item, Manifest, Objective, Scene, State, Story } from './core/types.ts';
import type { SpritePainter } from './art/sprites.ts';

export type ScenePainter = (ctx: CanvasRenderingContext2D, state: State, t: number) => void;

/**
 * The one narrow code surface a story may provide: named painters. They draw
 * only — they may read state to vary drawing, never change it, and contain no
 * game logic (see docs/2026-07-18-architecture.md).
 */
export interface PaintModule {
  scenes?: Record<string, ScenePainter>;
  sprites?: Record<string, SpritePainter>;
  /** Occluder painters, referenced by scene `props` entries. */
  props?: Record<string, ScenePainter>;
}

/**
 * What a game passes to boot() — two Vite globs over its stories directory:
 *
 *   boot({
 *     json:   import.meta.glob('./stories/(star)(star)/(star).json', { eager: true, import: 'default' }),
 *     paints: import.meta.glob('./stories/(star)/paint/index.ts', { eager: true }),
 *   });
 */
export interface StorySources {
  json: Record<string, unknown>;
  paints?: Record<string, PaintModule>;
}

export interface LoadedStory {
  story: Story;
  paint: PaintModule;
}

export function loadStories(sources: StorySources): Map<string, LoadedStory> {
  const out = new Map<string, LoadedStory>();
  // Every manifest.json defines a story; its directory anchors the rest.
  for (const [path, data] of Object.entries(sources.json)) {
    if (!path.endsWith('/manifest.json')) continue;
    const dir = path.slice(0, -'/manifest.json'.length);
    const id = dir.slice(dir.lastIndexOf('/') + 1);
    const manifest = data as Manifest;

    const scenes: Record<string, Scene> = {};
    const items: Record<string, Item> = {};
    const dialogues: Record<string, Dialogue> = {};
    const companions: Record<string, Companion> = {};
    let objectives: Objective[] = [];

    for (const [p, d] of Object.entries(sources.json)) {
      if (!p.startsWith(`${dir}/`)) continue;
      const rel = p.slice(dir.length + 1);
      if (rel.startsWith('scenes/')) {
        const scene = d as Scene;
        scenes[scene.id] = scene;
      } else if (rel.startsWith('dialogue/')) {
        const dlg = d as Dialogue;
        dialogues[dlg.id] = dlg;
      } else if (rel === 'items.json') {
        for (const item of d as Item[]) items[item.id] = item;
      } else if (rel === 'companions.json') {
        for (const c of d as Companion[]) companions[c.id] = c;
      } else if (rel === 'objectives.json') {
        objectives = d as Objective[];
      }
    }

    out.set(id, {
      story: { manifest, scenes, items, dialogues, companions, objectives },
      paint: sources.paints?.[`${dir}/paint/index.ts`] ?? {},
    });
  }
  return out;
}
