// Assembles Story objects from the JSON (and optional paint modules) under
// stories/. Uses import.meta.glob so dev and build see identical content and
// the story list can never drift from the directory listing.

import type { Dialogue, Item, Manifest, Scene, State, Story } from './core/types.ts';
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
}

export interface LoadedStory {
  story: Story;
  paint: PaintModule;
}

const manifests = import.meta.glob('/stories/*/manifest.json', {
  eager: true,
  import: 'default',
}) as Record<string, Manifest>;
const sceneFiles = import.meta.glob('/stories/*/scenes/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Scene>;
const itemFiles = import.meta.glob('/stories/*/items.json', {
  eager: true,
  import: 'default',
}) as Record<string, Item[]>;
const dialogueFiles = import.meta.glob('/stories/*/dialogue/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Dialogue>;
const paintModules = import.meta.glob('/stories/*/paint/index.ts', {
  eager: true,
}) as Record<string, PaintModule>;

function storyIdOf(path: string): string {
  return path.split('/')[2]!;
}

function collect<T>(files: Record<string, T>, storyId: string): T[] {
  return Object.entries(files)
    .filter(([path]) => storyIdOf(path) === storyId)
    .map(([, data]) => data);
}

export function loadStories(): Map<string, LoadedStory> {
  const out = new Map<string, LoadedStory>();
  for (const [path, manifest] of Object.entries(manifests)) {
    const id = storyIdOf(path);
    const scenes: Record<string, Scene> = {};
    for (const scene of collect(sceneFiles, id)) scenes[scene.id] = scene;
    const items: Record<string, Item> = {};
    for (const item of collect(itemFiles, id).flat()) items[item.id] = item;
    const dialogues: Record<string, Dialogue> = {};
    for (const dlg of collect(dialogueFiles, id)) dialogues[dlg.id] = dlg;
    const paintPath = `/stories/${id}/paint/index.ts`;
    out.set(id, {
      story: { manifest, scenes, items, dialogues },
      paint: paintModules[paintPath] ?? {},
    });
  }
  return out;
}
