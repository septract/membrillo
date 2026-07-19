#!/usr/bin/env node
// The membrillo CLI: offline story verification for consumer game projects.
//
//   membrillo validate [ids...] [--root ./stories]
//   membrillo fuzz     [ids...] [--root ./stories]
//   membrillo check    [ids...] [--root ./stories]   # both
//   membrillo scene build <storyId> <sceneId> [--root ./stories]  # render plate
//
// Requires Node >= 23 (native TypeScript stripping — the tools import the
// engine's .ts sources directly).

const [, , command, ...rest] = process.argv;

const rootIdx = rest.indexOf('--root');
const root = rootIdx >= 0 ? rest[rootIdx + 1] : './stories';
// Story ids are the positionals — every flag, plus the value after --root.
// (Guard rootIdx >= 0: with no --root, rootIdx is -1 and rootIdx+1 is 0,
// which must NOT exclude the first id — the bug that returned a false green
// for `membrillo check <misspelled-id>`.)
const ids = rest.filter((a, i) => !a.startsWith('-') && !(rootIdx >= 0 && i === rootIdx + 1));

// `scene` renders a floorplan to a plate + calibrated depth/walk — its own path.
if (command === 'scene') {
  const [sub, storyId, sceneId] = ids;
  if (sub !== 'build' || !storyId || !sceneId) {
    console.error('usage: membrillo scene build <storyId> <sceneId> [--root ./stories]');
    process.exit(1);
  }
  const { buildScene } = await import('../tools/render-scene.mjs');
  buildScene(root, storyId, sceneId);
  process.exit(0);
}

if (!['validate', 'fuzz', 'check'].includes(command ?? '')) {
  console.error('usage: membrillo <validate|fuzz|check|scene> [ids...] [--root ./stories]');
  process.exit(1);
}
process.env.STORIES_ROOT = root;
process.argv = [process.argv[0], process.argv[1], ...ids];

if (command === 'validate' || command === 'check') await import('../tools/validate.ts');
if (command === 'fuzz' || command === 'check') await import('../tools/fuzz.ts');
