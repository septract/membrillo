# Membrillo

A model-checked point-and-click adventure engine for the browser, in the
classic SCUMM spirit. Stories are data; the engine proves them winnable.

*Named for the gentle coroner of Rubacava. Membrillo is also quince paste —
sweet, dense, and best cut into small pieces.*

## What makes it different

- **Every story ships with a proof.** Story logic is declarative (flags,
  items, companions — no scripting), so `npm run fuzz` exhaustively explores
  the full state space and *proves* the LucasArts rules: no dead ends, no
  unwinnable states, every objective completable. A green fuzz isn't a test
  pass; it's a model-checking result.
- **Stories are data, cleanly separated from the engine.** A story is a
  directory of JSON — scenes, rules, items, dialogue, companions, objectives,
  scripted sequences — plus one narrow code surface for drawing (painters:
  code-drawn pixel art, PNG backgrounds, or spritesheets).
- **SCUMM presentation.** Walkboxes with pathfinding, depth-scaled sprites,
  walk-behind occlusion, speech floating over speakers' heads (crisp, on a
  display-resolution text overlay), a scrolling camera, party members who
  trail behind you, scripted in-room sequences, synthesized music from
  themes-as-data. Zero asset files required; images welcome through the same
  seam.
- **Three verbs, one gesture.** Look / Talk / Interact, with "Use X with Y"
  completing on an inventory item or a world target alike. Default clicks
  resolve by kind: people are talked to, things are operated, scenery is
  looked at.

## Quickstart

```
npm install
npm run dev        # play at http://localhost:5173
npm run check      # typecheck + unit tests + validate + fuzz (sub-second)
```

Four stories are included: **Lamplight** (a lighthouse, a sunken lens),
**The Marigold** (a fond fake-TNG away mission), and two engine-honesty
fixtures (`meadow`: no art at all; `postcard`: image assets).

## Writing a story

Read `stories/GUIDE.md` — the full authoring reference — and
`docs/2026-07-18-marigold-demo-design.md` for a worked design (puzzle
dependency chart included). The loop:

```
mkdir stories/mystory && $EDITOR stories/mystory/manifest.json ...
npm run validate -- mystory     # structure + cross-references
npm run fuzz -- mystory         # proves it winnable
```

## Layout

```
engine/core/   pure rules — the ONLY implementation, shared by browser & tools
engine/        canvas/DOM presentation; art library; synth audio
tools/         validator, fuzzer (the model checker), unit tests, browser driver
stories/       story data + per-story painters
docs/          dated design notes (the reasoning lives here)
```

Node ≥ 23 (native TS stripping), TypeScript + Vite, nothing at runtime.

## License

[Apache 2.0](LICENSE). The bundled Pixel Operator font is CC0
(`engine/assets/fonts/LICENSE.txt`).
