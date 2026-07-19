# Backlog

The working backlog. Keep it honest: when work is deferred in a session or a
design note, it lands here; when it ships, delete it. Dated design notes in
`docs/` hold the *reasoning*; this file only tracks what's open.

## Decisions needed (Mike)

- (none open.)

## Next (engine)

- Save slots (single autosave today); save-format versioning before any
  public release.

## Next (content/presentation)

- Add a link to the GitHub repo on the running game page (bottom line?) —
  Mike, 2026-07-19.
- Swap the code-drawn test portraits for generated art (Mike has a
  generator; prompts ready in docs/2026-07-19-portrait-prompts.md).
- Portrait extensions if wanted: per-node moods (dialogue schema extension),
  two-frame talking images in `portraitImage`.

- Pixelization tool: `tools/pixelize.mjs` — box-downscale + palette
  quantization + ordered dither over PNGs (we already have a zero-dep PNG
  encoder; needs the decoder half). Gets full-scale art ~70% of the way to
  pixel art; the rest is hand-cleanup by design.
- Spritesheet talk support: a `talk` row (or a head-overlay layer, SCUMM-
  costume style) in `sheetSprite` — image sprites currently don't mouth-flap.

- Hollow + bridge art polish; the placeholder-quality props (skiff reads as
  a table).
- Palette effects: day/night tint (colour cycling shipped with Gale Reach).

## Later

- Library follow-ups: schema/save-format versioning before any npm publish
  (see docs/2026-07-18-library-plan.md); publishing also unblocks standalone
  game repos' CI (today they must vendor an `npm pack` tarball — documented
  in games/_template/README.md).

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
