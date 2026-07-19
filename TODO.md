# Backlog

The working backlog. Keep it honest: when work is deferred in a session or a
design note, it lands here; when it ships, delete it. Dated design notes in
`docs/` hold the *reasoning*; this file only tracks what's open.

## Decisions needed (Mike)

- (none open.)

## Toward first release (Mike, 2026-07-19)

- **QoL audit for "first release" quality** — IN PROGRESS: multi-agent audit
  (engine correctness, click-coverage, docs/onboarding, UX/mobile) then fix
  the findings. Do this BEFORE the independent AI test below.
- **Security-practice audit** (Mike, 2026-07-19) — if we're encouraging
  others to use this, make it as safe as possible. Scope: XSS surface (story
  text must reach the DOM only via textContent, never innerHTML — audit
  log/dialogue/sentence/menu); the trust boundary of `paint/index.ts` and
  driver modules (they run arbitrary JS — fine for a game author's own
  stories, a hazard if a game ever accepts USER-submitted stories; document
  it loudly); localStorage key namespacing/collisions; CSP-friendliness of
  the built site; the offline tools running type-stripped story files under
  Node; dependency/supply-chain posture (currently zero runtime deps — keep
  it). Deliverable: a SECURITY.md + any hardening the audit surfaces.
- **Independent AI build test** — have a different AI, in a SEPARATE
  directory (not this repo), build a new game from `games/_template` with no
  hand-holding, to test whether the template + GUIDE are self-sufficient.
  Present it as an independent test, not "built here". Needs a written
  standalone-setup handout for Mike to give the other AI (draft:
  docs/2026-07-19-independent-build-test.md once the audit lands).

## Next (engine)

- Sequence speaker presence, safe by construction (Mike, 2026-07-19). The
  reported repro turned out to be a red herring: the "gap" in the terrace
  loom is Mr. Fondant's intentional "..." (verified — all three lines play),
  not a dropped Penny line. BUT the latent risk is real: the lair capture
  sequence names `who: "penny"`, safe only because the puzzle chain happens
  to guarantee she's recruited (shortbread gate). Make it enforced: extend
  the fuzzer/validator to check that every state able to trigger a sequence
  has each companion the sequence names, with a regression test. Consider
  whether a near-silent "..." line should read more clearly as deliberate
  (it currently looks like a dropped line to a first-time player).

- Save slots (single autosave today); save-format versioning before any
  public release.

## Next (content/presentation)

- Add a link to the GitHub repo on the running IN-GAME page (bottom line?) —
  Mike, 2026-07-19. (The stories MENU now has a "source on GitHub" footer;
  this is about the in-story screen.)
- Investigate the LucasArts-like fonts at https://scummbar.com/fonts/
  (Mike, 2026-07-19) — seem free; check licences before vendoring. Could
  replace/augment Pixel Operator for stronger SCUMM flavour.
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
