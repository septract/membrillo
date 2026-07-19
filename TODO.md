# Backlog

The working backlog. Keep it honest: when work is deferred in a session or a
design note, it lands here; when it ships, delete it. Dated design notes in
`docs/` hold the *reasoning*; this file only tracks what's open.

## Decisions needed (Mike)

- (none open — Gale Reach shipped as the second mission; next direction TBD
  after playing it.)

## Next (engine)

- Per-story browser tests (Mike, 2026-07-18): tools/browser-drive.mjs is one
  monolith rolled through every story — split into per-story driver modules
  sharing the helper kit, runnable individually (`node tools/drive/<id>.mjs`)
  and all together.

- Multi-frame costumes: richer walk cycles beyond leg-scissor, distinct
  toward/away frames.
- Save slots (single autosave today); save-format versioning before any
  public release.

## Next (content/presentation)

- Pixelization tool: `tools/pixelize.mjs` — box-downscale + palette
  quantization + ordered dither over PNGs (we already have a zero-dep PNG
  encoder; needs the decoder half). Gets full-scale art ~70% of the way to
  pixel art; the rest is hand-cleanup by design.
- Spritesheet talk support: a `talk` row (or a head-overlay layer, SCUMM-
  costume style) in `sheetSprite` — image sprites currently don't mouth-flap.
- Story-supplied player actor sprite (the actor is engine-drawn today; an
  image-based story will want its own hero).

- Hollow + bridge art polish; the placeholder-quality props (skiff reads as
  a table).
- Palette effects: colour cycling (water, the relay coil), day/night tint.
- Second Marigold mission — reuse the ship as the hub (the design note's
  three-act pacing generalizes to episodes with bridge bottlenecks).

## Later

- **Membrillo as a library, not a fork** (Mike, 2026-07-18). Today a game
  author forks the repo and adds a `stories/` directory; the regular shape
  is an npm package plus a consumer template. Sketch:
  - Publish `membrillo` (engine + tools) with the story-loading seam
    inverted: instead of the engine globbing `/stories/*`, the consumer's
    entry calls `boot(stories)` with imported story modules (the glob moves
    into a template one-liner). Vite plugin optional sugar.
  - Ship the validator/fuzzer as a CLI (`npx membrillo check ./stories`) —
    they already read plain directories; the loaders just need a
    configurable root.
  - `npm create membrillo` scaffold: template repo with one example story,
    the deploy workflow, and the browser-verify harness.
  - Prereqs: story-schema versioning (the JSON contract becomes public API),
    save-format versioning, and moving the four in-repo stories to an
    `examples/` consumer to prove the inversion.

- Deploy: GitHub Pages workflow (the kit's recipe; decoupled from any fan
  content — ship Lamplight/Marigold-class original stories only).
- Diegetic hint system — "ask the Marigold's computer" wrapper, escalating
  spoiler-managed hints (research rec #5; ship-scale, not demo-scale).
- Casual/Hard puzzle modes authored up front (research rec #6).
- Typed story DSL (shelved 2026-07-18): `as const satisfies` TS authoring
  with derived id unions, emitted canonical JSON; fuzzer stays the liveness
  checker.
- Bounded counters (`counter:x:0..3`) if a story ever needs them — the only
  approved logic-model extension (see scumm-parity note, Bucket 3).
- Camera: parallax layers.
- Mobile, further: PWA manifest + home-screen icon, rotate-to-landscape
  hint, iOS media-channel audio routing (the kit's recipes).
- Cold playtests with think-aloud protocol before anything ships (research
  rec #9) — this session's playtesting keeps finding what the fuzzer can't.
