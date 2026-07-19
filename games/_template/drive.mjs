// Browser regression: plays every story to completion in headless Chrome.
// The orchestrator lives in the engine (membrillo/verify-kit); this file
// only names the modules in drive/. Each new story adds one.
//
//   npm run dev                          # in another shell (or backgrounded)
//   npm i --no-save playwright-core      # once per checkout; uses system Chrome
//   node drive.mjs                       # everything
//   node drive.mjs quince                # any subset, by module name
//
// If the dev server isn't on :5173 (e.g. another game grabbed the port),
// point BASE at it: BASE=http://localhost:5174 node drive.mjs
// Screenshots land in shots-browser/ (gitignored). Read them — a green log
// with a broken screenshot is a failure.

import { runDrive } from 'membrillo/verify-kit';

await runDrive(import.meta.url, ['quince']);
