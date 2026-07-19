// Node-side story loading for the offline tools. Reads the same JSON files the
// browser loader globs, so validate/fuzz see exactly what the game will run.
// Painter modules are NOT executed here — only their source text is read for
// static reference checks (that is what keeps story logic pure data).

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  Companion,
  Dialogue,
  Item,
  Manifest,
  Objective,
  Scene,
  Story,
} from '../core/types.ts';

/** Stories root: $STORIES_ROOT or ./stories, resolved from the CWD — the
 * tools serve consumer game projects, not any fixed repo layout. */
export const STORIES_ROOT = resolve(process.env.STORIES_ROOT ?? './stories');

export interface StoryFiles {
  id: string;
  dir: string;
  story: Story;
  /** paint/index.ts source text, or null if the story ships no painters. */
  paintSource: string | null;
  /** Scene id → source filename, for error messages. */
  sceneFiles: Record<string, string>;
  /**
   * Ids AS AUTHORED, before collapsing into maps — duplicate detection must
   * run on these, because the maps silently overwrite duplicates.
   */
  rawIds: { scenes: string[]; items: string[]; dialogues: string[]; companions: string[]; objectives: string[] };
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (err) {
    throw new Error(`${path}: ${(err as Error).message}`);
  }
}

/** Only directories with a manifest.json — matching what the browser loader globs. */
export function listStoryIds(root: string = STORIES_ROOT): string[] {
  return readdirSync(root)
    .filter(
      (name) =>
        !name.startsWith('.') &&
        statSync(join(root, name)).isDirectory() &&
        existsSync(join(root, name, 'manifest.json')),
    )
    .sort();
}

export function loadStoryFiles(id: string, root: string = STORIES_ROOT): StoryFiles {
  const dir = join(root, id);
  const manifest = readJson<Manifest>(join(dir, 'manifest.json'));

  const rawIds: StoryFiles['rawIds'] = { scenes: [], items: [], dialogues: [], companions: [], objectives: [] };

  const scenes: Record<string, Scene> = {};
  const sceneFiles: Record<string, string> = {};
  const scenesDir = join(dir, 'scenes');
  for (const file of existsSync(scenesDir) ? readdirSync(scenesDir).sort() : []) {
    if (!file.endsWith('.json')) continue;
    const scene = readJson<Scene>(join(scenesDir, file));
    rawIds.scenes.push(scene.id);
    scenes[scene.id] = scene;
    sceneFiles[scene.id] = file;
  }

  const items: Record<string, Item> = {};
  const itemsPath = join(dir, 'items.json');
  if (existsSync(itemsPath)) {
    for (const item of readJson<Item[]>(itemsPath)) {
      rawIds.items.push(item.id);
      items[item.id] = item;
    }
  }

  const dialogues: Record<string, Dialogue> = {};
  const dlgDir = join(dir, 'dialogue');
  for (const file of existsSync(dlgDir) ? readdirSync(dlgDir).sort() : []) {
    if (!file.endsWith('.json')) continue;
    const dlg = readJson<Dialogue>(join(dlgDir, file));
    rawIds.dialogues.push(dlg.id);
    dialogues[dlg.id] = dlg;
  }

  const companions: Record<string, Companion> = {};
  const companionsPath = join(dir, 'companions.json');
  if (existsSync(companionsPath)) {
    for (const c of readJson<Companion[]>(companionsPath)) {
      rawIds.companions.push(c.id);
      companions[c.id] = c;
    }
  }

  let objectives: Objective[] = [];
  const objectivesPath = join(dir, 'objectives.json');
  if (existsSync(objectivesPath)) {
    objectives = readJson<Objective[]>(objectivesPath);
    rawIds.objectives.push(...objectives.map((o) => o.id));
  }

  const paintPath = join(dir, 'paint', 'index.ts');
  const paintSource = existsSync(paintPath) ? readFileSync(paintPath, 'utf8') : null;

  return {
    id,
    dir,
    story: { manifest, scenes, items, dialogues, companions, objectives },
    paintSource,
    sceneFiles,
    rawIds,
  };
}

/** Which story ids to operate on, from argv (all stories when none given). */
export function storyIdsFromArgv(argv: string[]): string[] {
  const wanted = argv.filter((a) => !a.startsWith('-'));
  return wanted.length > 0 ? wanted : listStoryIds();
}
