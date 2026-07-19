# Kit reuse audit — what Membrillo took from AngelJaimer's pointclick-adventure

*2026-07-19. A precise, file-by-file comparison of Membrillo's engine against
the vendored reference kit (`deps/pointclick-adventure/kit/src/`), so the reused
portions can be isolated, replaced, or clean-roomed if ever needed.*

## Licence context

The kit ships no `LICENSE` file, but its `kit/README.md` ("Credits & licence")
states: **"The engine itself is yours to reuse."** That is an explicit (if
informal) reuse grant — so the adaptations below are permitted. (Note: absent
that sentence, "no licence" would mean *all rights reserved*, not free reuse.)
We attribute in `NOTICE` as good practice; a formal licence request to the
author is backlogged as low-priority polish.

## The reuse map

Compared every overlapping module by API, algorithm structure, and magic
numbers. Four presentation modules borrow; everything else is independent.

| Our file | Kit source | Verdict | What is actually shared |
|---|---|---|---|
| `art/dither.ts` | `art/dither.ts` | **Derived** | `ditherPick` / `rampPick` / `Pixels` API + the `(BAYER4[y][x]+0.5)/16` threshold. Re-commented, strict-typed; `rampRect` is ours. |
| `art/sprites.ts` | `art/actor.ts` | **Partial** | Only `px()` (fillRect wrapper), `blk()` (1px-outlined rect), and the `faceCtx` left/right mirror. `drawActor`, `walkFrame`, `Pose`, `talkMouth`, `blinking`, portraits — ours. |
| `audio/engine.ts` | `audio/engine.ts` + `audio/instruments.ts` | **Partial** | The themes-as-data shape (`{bpm, prog, scale, style, gain}`) and the Web-Audio lookahead-scheduler + fail-silent architecture. Voices/synthesis reimplemented and simpler (152 vs 232+ lines). |
| `art/palette.ts` | `art/palette.ts` | **Idiom only** | The `P = { name: [r,g,b] as RGB }` pattern + `RGB` tuple type + "every colour from one small set" philosophy. All colour values and names are ours. |

### Confirmed independent (no kit lineage)

- **Rules model** — `core/types.ts`, `core/rules.ts`, `core/verbs.ts`,
  `core/objectives.ts`. The kit uses a fixed nine-verb Spanish MI2 vocabulary
  (`Abrir/Coger/Usar/Empujar/…`) over a bespoke TS `Hotspot`/`NPC` schema
  (`pickupIf`, `needs`, `needsBlocked`, `card`, `goto`). Membrillo uses a
  general JSON rule-bucket model (condition strings, ordered first-match) with
  three collapsed verbs — carried over from the earlier `../tng-game`, not the
  kit. Deliberately divergent (design points 2/3: stories are JSON data).
- **Navigation & presentation** — `walk.ts` (multi-rect walkboxes + BFS portal
  pathfinding), `followers.ts`, `render.ts` (scrolling camera, depth scaling,
  walk-behind), `loader.ts` (the `boot()` seam). The kit has **no** walkbox,
  pathfinding, or camera code at all.
- **Text** — Membrillo uses the vendored Pixel Operator webfont (CC0). The kit
  uses a hand-built 5×7 **code bitmap font** (`art/font.ts`); we took none of it.
- **Tooling** — the validator, the winnability fuzzer, the browser verify-kit,
  and the `membrillo` CLI have no kit equivalent.
- **All story content**, painters, and the audio synthesis voices.

Nothing from the kit ships at runtime as a dependency; the reuse is
source-level adaptation of the four modules above.

## Clean-room reimplementation — rough effort

Method (Mike's definition): one agent writes a **functional spec** of each
module from the behaviour (not the code); a **fresh agent that has never seen
the kit or our derived files** implements from that spec plus public algorithm
references; we swap the results in and re-run the full suite (`check` + browser
regression + CSP smoke) to confirm identical behaviour.

If we ever wanted to remove the kit's provenance entirely (relicense with zero
third-party lineage, or if the informal grant were ever in doubt), the cost is
**low — roughly half a day end-to-end**: ~1 hr to write the four specs, ~1–2 hrs
of fresh-agent implementation, ~1 hr integration + verification. It's cheap and
low-risk because every borrowed piece is small, functional, and converges on
public/textbook prior art *other* than the kit:

- **`dither.ts` — ~30–60 min.** Ordered Bayer dithering is a textbook
  algorithm; the 4×4 matrix is a published mathematical constant (not
  copyrightable). Reimplement `ditherPick`/`rampPick` from the definition and
  rename the API. The only real "expression" overlap is the function/class
  names, which are trivial to restructure.
- **`sprites.ts` px/blk/faceCtx — ~15–30 min.** These are 3–5 line canvas
  utilities (`fillRect`; outline-then-fill; `translate + scale(-1,1)` mirror)
  with essentially one natural implementation. Barely copyrightable; the
  similarity is functional, not creative.
- **`audio/engine.ts` — ~1–2 hrs.** Rewrite the scheduler loop from the
  well-known public "lookahead scheduler" pattern (Chris Wilson, *A Tale of Two
  Clocks* / MDN Web Audio), which is the true origin. The themes-as-data shape
  (bpm/chord-progression/scale) is a generic music representation, not novel
  expression, and our voices are already independent.
- **`palette.ts` — ~0.** A named-colour data object isn't copyrightable
  expression, and the values are already ours. Rename `P` if maximally cautious.

Caveat: I'm not a lawyer, and a *strict* clean-room means a fresh implementer
who has never seen the kit works from a functional spec. Practically, this
material is generic enough that independent reimplementation converges on nearly
the same code regardless — which is also why the reuse risk is low. Given the
explicit grant + attribution, clean-rooming is optional insurance, not a need.
