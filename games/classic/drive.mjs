// Browser regression: plays every story to completion in headless Chrome.
// The orchestrator lives in the engine (membrillo/verify-kit); this file
// only names the modules in drive/. Each new story adds one.
//
//   npm run dev                          # in another shell (or backgrounded)
//   npm i --no-save playwright-core      # once per checkout; uses system Chrome
//   node games/classic/drive.mjs                 # everything (from the repo root)
//   node games/classic/drive.mjs meadow mobile   # any subset
//
// Screenshots land in shots-browser/ (gitignored). Read them — a green log
// with a broken screenshot is a failure. Pattern + gotchas:
// .claude/skills/browser-verify/SKILL.md.

import { runDrive } from 'membrillo/verify-kit';

await runDrive(import.meta.url, [
  'lamplight',
  'meadow',
  'marigold',
  'postcard',
  'marigold2',
  'steep',
  'resilience',
  'mobile',
]);
