// Browser regression orchestrator: runs the per-story driver modules in
// tools/drive/ against a running dev server, sharing one Chrome session.
//
//   npm run dev                          # in another shell (or backgrounded)
//   npm i --no-save playwright-core      # once per checkout; uses system Chrome
//   node tools/browser-drive.mjs                 # everything
//   node tools/browser-drive.mjs marigold2       # just one module
//   node tools/browser-drive.mjs meadow mobile   # any subset
//
// Screenshots land in shots-browser/ (gitignored). Read them — a green log
// with a broken screenshot is a failure. Pattern + gotchas:
// .claude/skills/browser-verify/SKILL.md. New stories add a module here.

import { createKit } from './drive/kit.mjs';

const MODULES = ['lamplight', 'meadow', 'marigold', 'postcard', 'marigold2', 'resilience', 'mobile'];

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
for (const w of wanted) {
  if (!MODULES.includes(w)) {
    console.error(`unknown driver module "${w}" — available: ${MODULES.join(', ')}`);
    process.exit(1);
  }
}
const toRun = wanted.length > 0 ? wanted : MODULES;

const kit = await createKit();
try {
  for (const name of toRun) {
    console.log(`${name}:`);
    const mod = await import(`./drive/${name}.mjs`);
    await mod.run(kit);
  }
} finally {
  await kit.browser.close();
}

if (kit.errors.length) {
  console.error('BROWSER ERRORS:');
  for (const e of kit.errors) console.error('  ' + e);
  process.exit(1);
}
console.log('done, no browser errors');
