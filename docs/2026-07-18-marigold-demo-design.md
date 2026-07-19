# The Marigold — demo design note

*2026-07-18. A short, charming, fake-TNG mini adventure: an affectionate
parody with original characters, built to exercise companions, the away-
mission round trip, sequences, objectives, and audio — with real (if small)
game design. See `stories/GUIDE.md` for schema; this note is the design.*

## Premise

You are **Ensign Pip**, junior-most officer of the survey ship **Marigold** —
a slightly shabby, deeply earnest exploration vessel. The agricultural colony
on **Verdant Hollow** reports its weather relay dark: the greenhouse mists
have stopped and the season's crop will fail. Captain Bramble sends you on
your first away mission. Assemble the team, beam down, fix the relay, come
home.

## Cast (parody-safe analogs)

| Character | Analog of | Traits (original expression) |
|---|---|---|
| **Captain Bramble** (she) | the captain | silver-cropped, serene, scalding nettle tea, "See it done." |
| **Lt. Cog** | the android | chrome-skinned science officer, studies humour with zero success, effortlessly strong, painfully literal |
| **Counselor Solace** | the empath | lavender wrap, feels what people won't say, gentle to a fault |
| **Wren** | colonist-of-the-week | the Hollow's botanist; flustered, hiding something embarrassing |

IP safety: original names, ship, planet, phrases, and uniform colours (teal/
rust/cream — not the trademark scheme). The *structure* (captain, android,
empath, away mission) is genre furniture; no protected names, catchphrases
("energize", "make it so"), designs, or plots are used. Terms: "beam pad",
"sniffer" (scanner), "the survey service".

## Puzzle dependency chart (designed backwards from the ending)

```
                      ENDING: home (cutscene)
                            ▲ beam up (pad exit; requires relay_fixed)
                    relay_fixed
                            ▲ use tuning fork WITH relay (requires crystal_installed)
        tuning fork (item, from Wren)
                            ▲ dialogue: Wren confesses (requires solace_truth)
        solace_truth ── dialogue option gated on companion:solace + knows_misaligned
                            │
        crystal_installed ── use crystal WITH relay
        crystal (item) ── ask Cog at the crevice (requires companion:cog + knows_burnout)
                            │
        knows_burnout + knows_misaligned ── EITHER:
          · use sniffer WITH relay (the player's own tool), OR
          · talk to Cog on the surface — perfect pitch + burnt-quartz nose
            ("The relay is singing a whole tone flat.")
        sniffer (item) ── given in Bramble's briefing (bridge enter sequence)
                            │
        beam down (pad exit; requires companion:cog AND companion:solace)
        companions ── recruited by talking to Cog and Solace on the bridge
```

Two parallel mid-chain branches (crystal via Cog, truth via Solace) so a
stuck player always has the other thread — the "bushy" rule. Problem before
solution throughout: the crevice refuses until you know the crystal burnt
out; Wren's confession is unreachable until you've measured the detuning.
The charm beat: the relay isn't broken, Wren *improved* it — off by exactly
a whole tone — and is mortified. No villain, gentle stakes, one good laugh
per character.

## Scenes

1. `briefing` — intro cutscene (3 beats).
2. `bridge` (320×180): Bramble (briefing sequence on first entry: mission +
   sniffer), Cog and Solace stand here **until recruited** (`requires
   !companion:x` — recruiting visibly moves them from the room into your
   party), beam pad exit gated on the full team, viewscreen/console flavour.
3. `hollow` (420×180, camera scrolls): the relay tower, the crevice, the
   greenhouse (flavour), Wren, the beam circle — gated on `relay_fixed`,
   with an authored "not yet, ensign" hotspot response for early-return
   attempts (never a silent default). Arrival sequence on first entry.
4. `home` — ending cutscene.

## Applying the design research

Direct applications of
`research/2026-07-18-tng-adventure-game-design-guide.md`:

- **The A Final Unity pattern** (its best-regarded mechanic): the central
  diagnosis has TWO character-specific solutions — the player's sniffer or
  Cog's perfect pitch — mirroring the Geordi-OR-Troi singularity puzzle. Its
  worst mechanic (mandatory real-time combat) has no analog here, on purpose.
- **Disco failure philosophy** (Recommendation 7): pressing Wren without
  Solace doesn't block — her too-quick deflection ("Storms! Probably storms.")
  is itself a readable clue, a branch rather than a wall.
- **Three-act pacing** (Gilbert bottlenecks): Act 1 = fast onboarding on the
  bridge; Act 2 = the meat on the Hollow; Act 3 = fast wrap-up. The beam-down
  is the act bottleneck.
- **Technobabble as flavour over clear logic** (Recommendation 10): strip the
  jargon and the puzzle still reads — a part burnt out, the tuning is off,
  replace and retune. "Whole tone flat" is the joke, not the mechanism.
- **Judgment Rites' ending lesson**: the climax is a conversation
  (Wren's confession), not a boss.
- Deferred but planned per the research: a diegetic hint system ("ask the
  Marigold's computer") and casual/hard modes — ship-scale features, noted in
  the parity backlog, not demo scope.

## What each beat exercises

- **Companions**: recruit two, watch them trail you, gate two different
  puzzle mechanisms on them (a companion-gated *scene rule* for Cog, a
  companion-gated *dialogue option* for Solace), talk to them anywhere.
- **Away-mission loop**: ship → planet → ship, both directions through
  gated exits with effects, themes crossfading (bridge drone ↔ hollow pluck).
- **Sequences**: briefing (say/give/flags), beam-down arrival (multi-speaker).
- **Objectives**: four-stage mission log that ticks live.
- **Design rules**: diagnosis-before-solution gating, bushy parallel
  branches, wrong-item flavour (sniffer on people reads their mood — Solace
  finds it rude), authored responses on every plausible click.

## Out of scope (deliberately)

Multiple away missions, combat/stakes, hint systems, more than four scenes.
Ship it charming and tiny; grow it only if it earns it.
