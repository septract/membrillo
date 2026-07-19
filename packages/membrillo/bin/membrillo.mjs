#!/usr/bin/env node
// The membrillo CLI: offline story verification for consumer game projects.
//
//   membrillo validate [ids...] [--root ./stories]
//   membrillo fuzz     [ids...] [--root ./stories]
//   membrillo check    [ids...] [--root ./stories]   # both
//
// Requires Node >= 23 (native TypeScript stripping — the tools import the
// engine's .ts sources directly).

const [, , command, ...rest] = process.argv;

const rootIdx = rest.indexOf('--root');
const root = rootIdx >= 0 ? rest[rootIdx + 1] : './stories';
const ids = rest.filter((a, i) => !a.startsWith('-') && i !== rootIdx + 1);

if (!['validate', 'fuzz', 'check'].includes(command ?? '')) {
  console.error('usage: membrillo <validate|fuzz|check> [ids...] [--root ./stories]');
  process.exit(1);
}
process.env.STORIES_ROOT = root;
process.argv = [process.argv[0], process.argv[1], ...ids];

if (command === 'validate' || command === 'check') await import('../tools/validate.ts');
if (command === 'fuzz' || command === 'check') await import('../tools/fuzz.ts');
