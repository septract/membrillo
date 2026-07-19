# Porting an open-source game to Membrillo — a contingency study

*2026-07-19. Could we port an existing, permissively-licensed adventure game to
Membrillo — for a recognizable demo, and to surface what's missing for a "real"
game? Short answer: no famous graphical adventure is legally portable, but the
public-domain original (Colossal Cave) is — and the exercise's real payoff is
the engine-gap analysis at the end, which stands on its own. This is a
contingency plan, not committed work.*

## The licensing reality: freeware ≠ libre

The famous "free" classics — **Beneath a Steel Sky**, **Flight of the Amazon
Queen**, **Dreamweb**, **Lure of the Temptress** — are *freeware*: free to play
and redistribute *unchanged*, with source given to ScummVM. Freeware is **not**
a licence to make derivative works; the art and script stay under the studios'
copyright. Porting their assets into Membrillo would be infringement. (This is
the same trap as "a GitHub repo with no LICENSE" — absence of terms means all
rights reserved, not free reuse.)

There is also no recognizable *graphical* point-and-click adventure released
with genuinely libre (CC0 / CC-BY / GPL) assets. The CC0 point-and-click games
on itch.io are small unknown jam entries; the well-known "complete libre games"
(Battle for Wesnoth, Ryzoom) aren't the genre.

## Candidates

| Candidate | Asset licence | Portable? | Note |
|---|---|---|---|
| Beneath a Steel Sky, FOTAQ, Dreamweb, Lure | Freeware | **No** | Free to play, not to port. Great to *study* for design. |
| **Colossal Cave Adventure** (Crowther/Woods) | **Public domain** | **Yes** | The 350-point design, map, rooms, and `advent.dat` are PD. Text/parser original — a point-and-click adaptation, not a straight port. Recognizable ("the first adventure game"). |
| Cloak of Darkness (IF benchmark) | Free to reimplement | Yes | The "hello world" of IF; explicitly meant to be reimplemented. Tiny — a nice quick demo, but too small to stress the engine. |
| **Obscure-but-polished CC0 indie** (itch.io) | CC0 (per game page) | **Yes** | The realistic "polished + portable" avenue. All are *short*, but complete and, at their scope, polished — e.g. *Ex Aeternum Redux* (Myst-like), *Clock Aberration* (small horror), *Alyssa's Escape*. Verify the CC0 tag on each game's page before porting; some (Myst-style node navigation) don't map to Membrillo's walkbox/character model. |
| AGS community games | Usually **freeware** | Mostly no | The AGS *engine* is open (Artistic 2.0), but individual games are typically freeware unless an author explicitly CC-licenses the assets. Portable only case-by-case. |
| New game on CC0/CC-BY art packs (itch.io / OpenGameArt) | CC0 / CC-BY | Yes | Not a "port" — an original game with bought-in art. Tests the image-asset pipeline at scale. |

There are two shapes of "good candidate," and they optimize for different goals:

- **A polished obscure CC0 indie** (Mike's suggestion) — best for a *demo*:
  real, complete production values, legally clean, no name-recognition needed.
  The catch is scope (these are short) and fit (pick a *character-walking*
  SCUMM-style one, not a Myst-style node game). Modest stress-test.
- **A Colossal Cave slice** — best for the *stress-test*: it leans on exactly
  the features Membrillo lacks (below). Recognizable, PD-clean, but it's a
  text→point-and-click *adaptation* and needs original art.

**Recommendation if we build one:** a **Colossal Cave "first act"** — the
surface, the well house, and the first stretch of cave (grate, keys, lamp, bird,
snake, the first few treasures) — as a cozy point-and-click reimagining. Legally
clean, recognizable, and it happens to lean on exactly the features Membrillo
deliberately lacks, which makes it the best possible probe. A full 140-room port
is out of scope; a slice is a real demo.

## The engine-gap analysis (the actual payoff)

Membrillo is *opinionated*: its state is booleans only (flags / items /
companions), which keeps the state space finite so the fuzzer can
**exhaustively** prove winnability — no deaths, no dead ends, every objective
completable. Porting a real classic reveals that most "missing" features aren't
oversights; they're the **price of that guarantee**. Grouped by whether they
*preserve* the finite-state check or *trade against* it:

### Cheap extensions that keep the guarantee

- **Bounded counters** (`counter:x:0..N`) — resources like the lamp's battery,
  money, a score. Already the one sanctioned logic extension (see the backlog /
  scumm-parity note). A *small* bound stays finite, so the fuzzer still checks
  exhaustively. **The single most-needed feature for a real game.** Medium
  effort: extend the condition language + the fuzzer's state tuple.
- **Save slots** — single autosave today; named/multiple slots. Low effort,
  already backlogged.
- **Inventory at scale** — the chip row doesn't handle 20+ items; needs
  paging/scroll/grid. Low effort (UI).
- **Bigger maps / travel** — the engine already scrolls and handles many rooms;
  what a large game wants is authoring help and maybe an in-game map / fast
  travel. Low–medium (mostly tooling).
- **More verb nuance** — 3 verbs vs the classic 9. Modern remasters collapse to
  ~3, and "give" is already item-on-character, so most puzzles map cleanly;
  the rare open/close/push/pull distinction would need thought. Low.
- **Recorded audio / voice** — synth-only today. Images already ship through
  the paint seam, so audio files are a consistent next step. Medium; an
  aesthetic decision as much as a feature.
- **i18n / string tables** — inline English now; translated games need
  externalized strings. Medium; not needed for a demo.

### Features that trade *against* the guarantee (design decisions)

- **Deaths / fail states.** Membrillo's rules *forbid* them (a death is a dead
  end). A faithful classic port has them. Either adapt them away (the cozy
  reimagining — the lamp *warns* instead of killing) or add soft-death /
  checkpoint semantics and accept that the fuzzer must model them specially.
- **Randomness in logic** (random encounters, dice). Banned — the fuzzer needs
  determinism. Keep it presentation-only, or add "bounded nondeterminism" the
  fuzzer explores as branching (state blow-up risk).
- **Living-world simulation** — NPCs on timed schedules, off-screen state
  (Maniac Mansion, DOTT). Our characters are static or sequence-scripted. A
  simulated world is a huge (often unbounded) state space — fundamentally at
  odds with exhaustive checking.
- **Multiple playable characters / character switching** (DOTT). We have one
  actor + companions; switching who you control is a real feature some classics
  need. Medium; mostly a control-layer change.

## Verdict

The most valuable output isn't a port — it's the list above. Membrillo already
covers a *specific, coherent* target well: the modern, cozy, no-death,
provably-winnable LucasArts-lineage adventure (Thimbleweed Park / the MI
remasters, not the deathful classics). To support a broader "real" game, the
first and highest-leverage step is **bounded counters** — it unlocks resource
puzzles while preserving the model-checking guarantee. Everything past that
(deaths, randomness, simulation) is a deliberate trade of completeness for
scope, to be made per-game, not globally.

A Colossal Cave first-act demo would be a fun, legally-clean way to *drive*
those decisions with a concrete game — but it's optional; this note is the
contingency, and the gap list is the takeaway.

## Sources

- ScummVM freeware games — <https://www.scummvm.org/games/>
- Colossal Cave Adventure is public domain (Crowther/Woods FORTRAN + advent.dat)
  — <https://github.com/troglobit/adventure>, <https://rickadams.org/adventure/e_downloads.html>
- Libre vs freeware licensing — <https://en.wikipedia.org/wiki/List_of_open-source_video_games>
- CC0 / CC-BY reusable assets — <https://opengameart.org/content/cc0-resources>, <https://itch.io/game-assets/assets-cc0/genre-adventure>
