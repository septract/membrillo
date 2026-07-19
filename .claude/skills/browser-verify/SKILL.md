---
name: browser-verify
description: >-
  Launch and drive this game in headless Chrome to verify engine or story
  changes end-to-end. Use whenever a change touches the DOM/canvas layer,
  presentation, or story content and offline validate/fuzz aren't enough —
  the fuzzer proves logic; only driving the browser proves the feel.
---

# Browser verification (headless Chrome)

The offline tools (`npm run check`) prove the *rules*: winnability, no dead
ends, schema sanity. They cannot see the DOM/canvas layer — speech anchoring,
camera scroll, follower motion, input gating, fades. For that, drive the real
game in headless Chrome. This pattern has caught real bugs the fuzzer proved
correct (wrong-speaker speech, followers stacking on the beam pad, CSS hiding
failures, mid-fade races).

## Setup (once per checkout)

```bash
npm i --no-save playwright-core   # deliberately NOT in package.json — dev-only,
                                  # uses the system Chrome, no browser download
```

Requires Google Chrome installed (`channel: 'chrome'`).

## Run

```bash
npm run dev > /dev/null 2>&1 &                    # then poll, don't sleep:
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
node tools/browser-drive.mjs                      # full regression, all stories
pkill -f vite
```

`tools/browser-drive.mjs` plays every story to completion and asserts along
the way; screenshots land in `shots-browser/` (gitignored). **Read the
screenshots** — a green log with a broken frame is still a failure. It exits
non-zero on any assertion or any browser console error/pageerror.

When adding a story or feature, extend the driver with a section that plays
it; when a story's coordinates change, the driver's clicks must follow.

## The driving pattern

Everything goes through `window.__pcc()` — the engine's read-only debug hook
(scene, state, actor, camera, view, beat, dialogue) — plus these helpers in
the driver:

- **`worldClick(x, y)`** — clicks a WORLD coordinate: reads the camera from
  the hook, subtracts it (the engine rounds the camera; so does worldClick),
  scales by view, clicks the canvas. Never hand-compute screen positions.
- **`walkTo(x, y)`** — clicks ground and waits until the hook reports the
  actor within 3px. Needed before interacting with anything currently
  off-screen: **off-screen targets are unclickable by design** — stage the
  actor toward them first, let the camera follow.
- **`waitLog(text)`** — waits for the DOM transcript to contain a line. The
  log records everything (speech, dialogue, choices), so it's the universal
  "did the thing happen" assertion.
- **DOM UI via roles**: verbs/chips/dialogue options are real buttons —
  `page.getByRole('button', { name: '...' })`.
- **State assertions** via the hook: flags, inventory, companions, scene.

## Gotchas (each one cost a debugging round — keep them)

- **Walks take real time.** A click during the actor's walk cancels the
  pending action. Wait for arrival (hook position), never `sleep(guess)` —
  and remember walk speed scales with depth.
- **Fades**: scene changes switch state at the fade MIDPOINT (~220ms in).
  After triggering travel, `waitForFunction(scene === target)` then pause
  ~500ms before clicking.
- **Sequences block input**; a click hurries the current line, Esc skips the
  rest. To prove a click *hurried* a line, assert with a timeout shorter
  than the line's natural timer (~1.6s + 55ms/char).
- **Followers sit ON the trail behind the actor** — clicking near the actor
  can hit a companion instead of scenery underneath. They trail opposite the
  walk direction (walked right → they're at lower x, ~24px per rank).
- **Overlapping hotspots** resolve in array order (characters, then
  hotspots, then exits) — click a spot only one target owns (the skiff sits
  on the water; aim at open water).
- **Speech floats over the scene** and can cover targets in screenshots;
  timed lines expire, dialogue lines persist until an option is chosen.
- **Audio is unverifiable headlessly.** Assert no console errors, then say
  so honestly — a human must listen.
- **Reset between runs**: `page.evaluate(() => localStorage.clear())` then
  re-navigate, or saves leak between sections. Debug URLs
  (`?story=x&start=scene&flags=a,b&items=i&companions=c`) jump straight to a
  state and bypass saves — ideal for isolating one interaction.
