# Architecture — point-and-click adventure engine

*2026-07-18. Founding design note: what we're building, what we learned from
`../tng-game`, what we're borrowing from `deps/pointclick-adventure`, and the
architecture that merges them. Update in place as decisions change; record big
reversals as dated addenda at the bottom.*

## Purpose

Build a **usable point-and-click adventure game** — a real, playable,
shareable game, not another engine experiment. This repo restarts from the
`../tng-game` experiments and integrates their lessons.

## The six design points

1. **Browser-first.** Everything — playing, and as much of the tooling as
   practical — works through the browser. No native editor in the loop.
   (This supersedes the Godot + Popochiu recommendation in
   `research/2026-07-18-scumm-engine-tooling-research.md`, which predates this
   constraint: the Godot *editor* is a native app.)
2. **Clean separation of code and story.** Story content is data the engine
   interprets; the engine knows nothing about any particular story.
3. **Code-first.** Authoring happens in text files an agent can read, write,
   and diff — no GUI editor as the source of truth.
4. **Flex to more complex adventures.** The core model must generalize
   (ordered condition→effect rules, not a fixed puzzle vocabulary).
5. **Use existing tools where we can.** Vendor and borrow; don't rebuild what
   standard tooling provides.
6. **Environment safety.** Nothing security-relevant: no secrets, no
   system modification, no network calls at runtime beyond serving the game;
   persistence is browser `localStorage` only. Third-party code is vendored
   read-only into gitignored `deps/` and read as reference, not executed or
   installed globally.

## Prior art and what we take from each

### `../tng-game` — the architecture (keep)

A zero-build vanilla-JS engine with a proven structure. Its lessons, which we
adopt wholesale:

- **Three-way split.** A pure, DOM-free rules core (`core.js`: condition
  checking, verb resolution, effect application); a DOM/rendering layer that
  imports it; and story content as JSON under `stories/<id>/`.
- **Single implementation of the rules.** Offline tools (`validate`, `fuzz`)
  import the same core the browser runs — a bug cannot exist in one and not
  the other, and the fuzzer tests exactly what a player can click.
- **Engine-honesty fixtures.** Minimal, deliberately off-theme stories exist
  specifically to break if story-specific logic leaks into the engine.
- **General rule model.** Scene entities (hotspots / characters / exits) carry
  ordered rule buckets `{ requires, text, setFlags, giveItem, goto, … }` —
  first rule whose conditions pass wins. Conditions are strings like
  `"flag:x"`, `"item:y"`, `"companion:z"`, `!`-negatable. Progress state is
  `{ flags, inventory, companions }`, and all displayed state (objectives,
  companions) derives live from it — nothing stored separately as "done."
- **Four player verbs.** Look / Talk / Interact / Combine, with authored
  `use`/`take` buckets collapsed behind Interact by the engine (never exposed
  raw; validator errors if a target defines both).
- **Validation culture.** Structural + cross-reference checks on every story
  (asset paths against the filesystem, story index against the directory
  listing); an exhaustive fuzzer that plays every reachable state; unit tests
  on the pure core. All fast enough to run after every change.
- **Debug affordances.** `?story=<id>` selection, `?start=…&flags=…&items=…`
  state-preloading jump links, an in-page debug panel.

### `deps/pointclick-adventure` — the presentation (borrow techniques)

AngelJaimer's Claude skill + TypeScript/Canvas kit (vendored read-only;
deliberately **not** installed as a skill). tng-game never had real SCUMM
*presentation*; the kit shows how to get it with zero asset files:

- **Room scenes**: a 320×200-class pixel canvas, upscaled nearest-neighbour; a
  walking player actor (click-to-walk, feet-anchored sprites, sin-based walk
  cycle), NPCs standing in the room, walkable-area clamping, exits with spawn
  points ("`entry` is where you appear in the *destination*" — their most
  error-prone field; make paired doors agree spatially).
- **Code-drawn art**: a small shared palette module (every colour comes from
  it), ordered Bayer dithering for gradients/glows, chunky 1px-outlined
  sprites drawn feet-up, a hand-built bitmap font (mind the glyph set), cached
  static background + per-frame overlay/dynamic layers. Backgrounds must fill
  the whole canvas or cleared regions show black.
- **Synth audio**: a small Web Audio "iMUSE-lite" — scheduler + synth voices
  over per-theme chord progressions, per-room theme map, SFX. No audio files.
  (You can't hear it headlessly — never claim it sounds good; let Mike judge.)
- **Winnability verification**: drive the whole puzzle chain headlessly via a
  `window.__game`-style debug hook and assert flags/inventory/ending at each
  step. Their hard-won gotcha: module-level room state mutates across a
  playthrough, so verification needs a fresh page and one self-contained run
  that guards its starting state. (Our answer is better: keep rooms immutable
  in the core and let the fuzzer do this exhaustively — but keep their debug
  hook for in-browser spot checks.)
- Also worth lifting when needed: mobile/PWA handling (pointer events,
  landscape prompt, iOS media-channel audio routing, manifest + icon),
  localStorage save slots, and the GitHub Pages deploy workflow.

Their design docs also independently converge on tng-game's conclusions:
every item has a source and a sink, no dead ends, 2–4 rooms for episode 1,
verify winnability yourself rather than asking the user to check, and "a
tight, winnable 2–3 room game beats a sprawling broken one."

What we **reject** from the kit: story-as-TypeScript. Its rooms, dialogue, and
puzzle logic are code modules — that fails design point 2 and makes offline
validation/fuzzing near-impossible. Its puzzle vocabulary
(`needs`/`pickup`/`accepts`) is also a fixed shallow set, failing point 4.

## The merged architecture

```
engine/          # runtime, story-agnostic
  core.*         #   pure rules: conditions, verb resolution, effects (no DOM)
  ...            #   DOM/canvas layer: scene rendering, walk, input, UI
  art/           #   shared drawing library: palette, dither, bitmap font, sprite helpers
  audio/         #   Web Audio synth engine (themes are data)
tools/           # node-side: validate, fuzz, core unit tests — all import engine core
stories/<id>/    # story DATA: manifest, scenes, items, dialogue (JSON)
  scenes/*.json  #   logic: hotspots/characters/exits with rule buckets
  paint/*        #   the story's declared code surface: named scene painters
docs/            # design notes (date-first) + research/
deps/            # gitignored vendored reference repos
```

### The one hard design decision: art vs. data purity

Code-drawn art is inherently *code* (a background is a painter function),
which collides with "story is data." Resolution:

> **Story logic is pure JSON; each story may carry a narrow, declared code
> surface for its painters.** Scene JSON references a painter by name
> (`"paint": "bridge"`); the painters live in the story's `paint/` directory,
> use only the engine's art library, and contain **no game logic** — they may
> read `{ flags, inventory, companions }` to vary drawing, never write it.
> The validator checks every painter reference resolves and can load story
> logic without executing any painter, so validate/fuzz stay pure-data.

A story may instead reference image assets (tng-game style) — the presentation
seam supports both, but per the kit's experience, painted backdrops clash with
code-drawn sprites; don't mix styles within a story without restyling the cast.

### Player interface

Keep tng-game's collapsed four-verb model (Look / Talk / Interact / Combine)
rather than the kit's 9-verb panel. The design-guide research
(`research/2026-07-18-tng-adventure-game-design-guide.md`) treats
verb-count as a genuine open debate but recommends the streamlined
context-sensitive lane; tng-game already proved it out, and the fuzzer tests
exactly those four verbs. Adopt the guide's structural rules as hard
constraints: no deaths, no dead ends, no unwinnable states (the fuzzer's job
is to prove this), design puzzle chains backwards as a dependency graph,
every item has a source and a sink, hotspot-highlight affordance, hints over
obscurity.

### Language and build

TypeScript via Vite (as the kit does) rather than tng-game's zero-build
vanilla JS. Rationale: types on the rule/scene schema are the cheapest
validator we can have, point 5 says use standard tooling, and Vite's dev
server satisfies browser-first. The core stays DOM-free and importable by
node tools regardless. This is the one place we trade tng-game's
"zero dependencies" purity for tooling leverage; keep the dependency count
near zero anyway (Vite + TypeScript, nothing at runtime).

## Deliberately deferred

- Which story ships first (the tng pilot's structure is reusable; its
  franchise content raises the IP questions the design guide discusses —
  keep the engine agnostic either way).
- Companion/party mechanics beyond tng-game's flag-derived model.
- Hint system mechanics (design guide surveys the options; decide when a
  story is big enough to need one).
- Deploy target (the kit's GitHub Pages workflow is ready when wanted;
  pushing anything is always user-initiated).
