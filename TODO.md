# Backlog

The working backlog. Keep it honest: when work is deferred in a session or a
design note, it lands here; when it ships, delete it. Dated design notes in
`docs/` hold the *reasoning*; this file only tracks what's open.

## Decisions needed (Mike)

- **Name the framework.** It needs one before any public artifact (deploy,
  README, npm-ability). Candidates to react to, not a shortlist:
  - **Verbena** — verb + flower; sits nicely beside the *Marigold*.
  - **Proscenium** — the frame the scene plays behind.
  - **Tableau** — scenes, staged.
  - **Baize** — the felt the game is played on.
  - **Wick** — small, lightable; pairs with Lamplight.
- **Audio verdict** — the synth themes (ship drone, hollow pluck, dusk/lamp)
  need human ears; tune or rethink `engine/audio` voicing accordingly.
- **Where the demo goes next**: grow the Marigold (second mission), polish
  what exists, or pivot to deploy-and-share.

## Next (engine)

- Sequence `walkTo`/movement for characters and companions (actor-only
  today) — needed for staging richer scripted moments.
- Fuzzer check: every sequence `who` is present (in scene or party) whenever
  the sequence can trigger — currently a silent fall-back-to-actor.
- Authored `defaultVerb` override per target, for when the kind default is
  wrong (a sleeping guard you'd examine, not wake).
- Multi-frame costumes: richer walk cycles beyond leg-scissor, distinct
  toward/away frames.
- Save slots (single autosave today); save-format versioning before any
  public release.

## Next (content/presentation)

- Hollow + bridge art polish; the placeholder-quality props (skiff reads as
  a table).
- Palette effects: colour cycling (water, the relay coil), day/night tint.
- Second Marigold mission — reuse the ship as the hub (the design note's
  three-act pacing generalizes to episodes with bridge bottlenecks).

## Later

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
- Camera: vertical scroll is untested (no tall scene exists); parallax.
- Cold playtests with think-aloud protocol before anything ships (research
  rec #9) — this session's playtesting keeps finding what the fuzzer can't.
