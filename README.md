# Membrillo

A browser point-and-click adventure engine in the classic SCUMM spirit.
Stories are data, kept separate from the engine, and a checker plays through
every reachable state to catch dead ends before players hit them.

*Named for the gentle coroner of Rubacava. Membrillo is also quince paste —
sweet, dense, and best cut into small pieces.*

## Features

- **Winnability checking.** Story logic is declarative — flags, items,
  companions, no scripting — so the state space is finite and `npm run fuzz`
  can explore all of it. It reports dead ends, unreachable scenes, and
  objectives that can't complete. Because the search is exhaustive, a clean
  run means no reachable dead end exists (not a formal proof, but a complete
  check of the finite space).
- **Stories are data, separate from the engine.** A story is a directory of
  JSON — scenes, rules, items, dialogue, companions, objectives, scripted
  sequences — plus one small code file for drawing (painters: code-drawn
  pixel art, PNG backgrounds, or spritesheets).
- **SCUMM presentation.** Walkboxes with pathfinding, depth-scaled sprites,
  walk-behind occlusion, speech floating over speakers' heads (crisp, on a
  display-resolution text overlay), a scrolling camera, party members who
  trail behind you, scripted in-room sequences, and synthesized music from
  data (no audio files). Optional VN-style dialogue portraits. No asset files
  required; images work through the same seam.
- **Three verbs, one gesture.** Look / Talk / Interact, with "Use X with Y"
  completing on an inventory item or a world target alike. A plain click
  picks the sensible verb by kind: people are talked to, things are operated,
  scenery is looked at.

## Quickstart

```
npm install
npm run dev        # play at http://localhost:5173
npm run check      # typecheck + unit tests + validate + fuzz (sub-second)
```

Six stories are included: **Lamplight** (a lighthouse, a sunken lens),
**The Marigold** and **Gale Reach** (fond fake-TNG away missions),
**Operation Steep** (a tuxedoed spy, a gadgeteer sidekick, a doomsday
teatime), plus two fixtures that keep the engine honest (`meadow` ships no
art; `postcard` uses image assets).

## Writing a story

Read `packages/membrillo/GUIDE.md` — the full authoring reference — and
`docs/2026-07-18-marigold-demo-design.md` for a worked example (with a puzzle
dependency chart). The loop:

```
mkdir games/classic/stories/mystory && $EDITOR .../manifest.json ...
npm run validate -- mystory     # structure + cross-references
npm run fuzz -- mystory         # checks every reachable state is winnable
```

## Layout (npm workspaces)

```
packages/membrillo/   the engine: core rules, presentation, art, audio,
                      tools (validator, fuzzer, verify kit), CLI, and
                      GUIDE.md (the authoring reference)
games/classic/        a game built on it: stories + a ~10-line entry that
                      calls boot() with its story globs
games/_template/      a starter game — copy it to begin your own
                      (its README is the how-to)
docs/                 dated design notes
```

A new game is a copy of `games/_template` — in-workspace, or standalone with
a `file:` link to `packages/membrillo` (no registry needed). Games hold only
declarations: story globs, a title, a driver-module list. Build config,
tsconfig, and the browser-drive orchestrator are imported from the engine.
`npx membrillo check --root ./stories` runs the validator and winnability
check against any story directory.

Node ≥ 23 (native TS stripping), TypeScript + Vite, nothing at runtime.

## License

[Apache 2.0](LICENSE). The bundled Pixel Operator font is CC0
(`packages/membrillo/assets/fonts/LICENSE.txt`).
