# Backlog

The working backlog. Keep it honest: when work is deferred in a session or a
design note, it lands here; when it ships, delete it. Dated design notes in
`docs/` hold the *reasoning*; this file only tracks what's open.

## Decisions needed (Mike)

- (none open — Gale Reach shipped as the second mission; next direction TBD
  after playing it.)

## Next (engine)

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
- Palette effects: day/night tint (colour cycling shipped with Gale Reach).
- Mission 3 (Mike, 2026-07-18): a James Bond-inspired standalone mission with
  a spunky sidekick heroine — everything renamed absurd/funny/charming, never
  copyright-infringing (the Marigold treatment for spy fiction). Gadget items
  are a natural fit for "Use X with Y".

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
