# Backlog

The working backlog. Keep it honest: when work is deferred in a session or a
design note, it lands here; when it ships, delete it. Dated design notes in
`docs/` hold the *reasoning*; this file only tracks what's open.

## Decisions needed (Mike)

- (none open.)

## Toward first release (Mike, 2026-07-19)

- **QoL audit for "first release" quality** — DONE (2026-07-19): 4-agent
  audit (engine correctness, click-coverage, docs/onboarding, UX/mobile),
  clear wins all fixed + committed; judgment calls resolved with Mike.
- **Security-practice audit** (Mike, 2026-07-19) — if we're encouraging
  others to use this, make it as safe as possible. The core is a
  **bidirectional trust model** (Mike's framing): loading a game runs the
  author's painter JS in your browser (you trust the author, = any website,
  bounded by the same-origin sandbox); and serving someone else's story under
  YOUR origin runs THEIR painter JS as you (arbitrary code under your origin).
  My earlier "painters are trusted author code" only holds for the
  single-author-deploys-own-game case; the story/code split invites the
  multi-party case (community stories, a load-any-URL viewer, merged story
  PRs) where it breaks. Goal: minimize *required* trust — make story DATA
  safe to treat as hostile, make painter CODE an explicit sandboxable
  boundary. Mitigation ladder:
    1. Harden the data path (do first): audit that ALL story text reaches the
       DOM via textContent only (never innerHTML — check log/dialogue/
       sentence/menu/objectives), no eval, strict CSP on the deployed site.
       Then a stranger's JSON is safe; only the painter is code.
    2. Sandbox untrusted painters in an iframe on a SEPARATE origin (cheaper
       and better-fit than WASM for "load untrusted stories").
    3. Only if user-generated content becomes a goal: a declarative-only
       render mode (painters as data/DSL, or WASM with no host access) so a
       story can be pure data, loadable with zero code trust — where the WASM
       idea earns its keep.
  Also: localStorage key namespacing/collisions across games on one origin;
  the offline tools run type-stripped story files under Node (a story's
  paint/*.ts and drive/*.mjs execute during check/drive — a supply-chain
  boundary for anyone running someone else's story through the tools);
  dependency posture (zero runtime deps — keep it). Deliverable: SECURITY.md
  stating the trust boundary loudly, plus the step-1 hardening.
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

- **Durable story abstractions** (Mike, 2026-07-19) — THE core need for big
  stories: JSON gives us data, not *abstraction*. A big SWE project is workable
  because it's composed of durable, independently-editable units with
  interfaces (functions, modules, types); a big story is currently one flat
  pile of JSON where everything references everything by stringly-typed global
  ids. What we want is first-class, composable units you can build bit by bit:
  a **puzzle/thread** as a unit that declares what it *consumes* and *produces*
  (its flag/item/counter interface) and can be authored + tested in isolation;
  a **character** as a reusable module (its dialogue + reactions travel with
  it); **scene templates / parameterized sub-stories**; encapsulation so a
  thread's internal flags don't leak into one global namespace. Then a big game
  = composition of durable abstractions, and the fuzzer checks the seams. The
  tooling below serves this; the abstraction model is the real design work
  (relates to the shelved typed-DSL — types are one way to make the interfaces
  durable).
- **Structured story-programming tools** (Mike, 2026-07-19) — building a big
  story should feel like a big SWE project, not hand-linking JSON. Felt
  acutely while authoring "Nothing Doing". Candidate tooling: (1) a story
  "language server" — go-to-definition / find-references across flags, items,
  counters, scenes (which rule SETS flag X, which READS it); rename-refactor a
  flag/item id across all files. (2) Auto-derive the puzzle dependency GRAPH
  from the data (the flag/item/counter DAG — "what unlocks what") and render
  it, like a build graph; the fuzzer already walks the state space, so the
  data is there. (3) Per-thread test assertions (the fuzzer proves global
  winnability; add "from state S, action A reaches flag F" unit checks). (4)
  Story modules / composable threads so a big game is assembled from units.
  (5) Author from a higher-level spec — the shelved typed-DSL (`as const
  satisfies`) that compiles to canonical JSON with derived id unions. Start
  with the language-server-style cross-reference checks + the dependency-graph
  view; both are pure reads over existing data.

- Ask AngelJaimer for a formal licence on the pointclick-adventure kit
  (Mike, 2026-07-19, low priority). The kit README grants reuse ("the engine
  itself is yours to reuse") and we attribute in NOTICE + docs/2026-07-19-kit-
  reuse-audit.md — sufficient for a fun OSS project. A one-line issue asking
  them to drop in MIT/CC0/Apache would remove the informal-grant ambiguity for
  anyone reusing OUR repo downstream, but it's polish, not a blocker.

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
