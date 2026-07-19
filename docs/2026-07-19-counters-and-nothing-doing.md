# Bounded counters + "Nothing Doing" (the Seinfeld game)

*2026-07-19. A purpose-built story that demands the features we flagged as
missing — resource counters and a larger inventory — plus the engine work to
support them. Theme: a Seinfeld-style "game about nothing" (original parody
characters, absurd/charming not infringing, per the Marigold/Steep house
style).*

## Part 1 — bounded counters (engine)

The one sanctioned extension to the logic model (see the scumm-parity note). It
must **preserve the exhaustive-winnability guarantee**: the fuzzer can only
prove no-dead-ends if the state space stays finite. Counters stay finite by
being **bounded** — declared with a min/max, and every effect clamps into range.

**Declaration** (manifest): every counter has a range and a start.

```jsonc
"counters": { "money": { "min": 0, "max": 9, "start": 3 } }
```

State gains `counters: Record<string, number>`, seeded from the declarations.

**Conditions** — `counter:<name><op><n>`, op ∈ `>= <= == != > <`:

```jsonc
"requires": ["counter:money>=8"]
"requires": ["counter:money==0", "flag:knows_scheme"]
```

**Effects** (rule fields, alongside setFlags/giveItem/…):

```jsonc
"addCounter": { "money": 2 }     // delta, clamped to [min,max]
"setCounter": { "money": 0 }     // absolute, clamped
```

**Fuzzer**: the state key includes each counter's value; effects apply and
clamp. Bounded range → finite state space → the exhaustive check still holds.
(A story with a `money` in 0..9 multiplies the state count by ≤10 — fine.)

**Validator**: counter conditions/effects must name a declared counter;
`min ≤ start ≤ max`. The fuzzer then proves winnability across counter values.

**UI**: a small counters strip in the panel — `Wallet: $3` — so the player can
see the resource. Purely derived from state, like objectives.

Why bounded (not free) counters: an unbounded counter (or a timer) would make
the state space infinite and break the fuzzer's completeness. Bounded is the
line that keeps "every story ships winnable-checked" true. If a story needs a
big range, that's a design smell — collapse it to a few meaningful thresholds.

## Part 2 — "Nothing Doing"

A petty little adventure. You are **Artie Skint** — short-fused, broke,
perpetually aggrieved, a scheme for every occasion. Your friends are
insufferable **trivia** obsessives. Everything spirals from nothing.

### Cast (all original)

- **Artie Skint** (player) — the George-archetype: anxious, cheap, indignant,
  always one technicality from triumph or disaster.
- **Elna** (companion) — sardonic, fiercely competitive, a walking almanac.
- **Kessler** (companion) — the eccentric across the hall; bursts in, spouts
  obscure facts, means well, ruins everything helpfully.
- **Nib** — owns the diner; keeps Artie's tab and Artie's number.

### The mechanic marriage

- **Money counter** (`money`, 0..9, start 3): Artie owes Nib **$8** for a tab
  he swears he settled. The whole game is scraping together enough to clear it
  — petty income (return a jacket, find change, win the pot) against petty
  costs. Reach the target ⇒ the ending.
- **Trivia companions**: the diner runs **Trivia Night** with a cash pot. Artie
  can't answer anything, but Elna/Kessler each know one impossible fact — feed
  the right companion the question (a `companion:` + counter beat) to win the
  pot. This ties the counter, the companions, and the theme together.
- **Inventory at scale** (~10 items): the jacket, the receipt, a marble rye
  nod, a "faulty" umbrella, a subway token, a TV listings mag, a pen (a
  "these pretzels" bit), etc. — enough to make the chip row work for its living
  and to fuel wrong-item comedy.

### Scenes

1. `apartment` — Artie's place. Kessler bursts in. The jacket, the mail (the
   dreaded tab notice), the couch (change in the cushions).
2. `diner` — Nib's. The tab, Trivia Night, Elna in the booth, the register.
3. `street` / `store` — return the jacket for the refund; a vending machine
   that eats tokens; the petty economy.

### Puzzle chart (backwards from the ending)

```
clear the tab (needs counter:money>=8 at Nib)
 ├── refund the jacket at the store (+$4)   ← needs the receipt
 │     └── receipt (found in the jacket pocket / the mail pile)
 ├── win Trivia Night pot (+$3)             ← needs a companion + the question
 │     ├── the question (overheard / on the board at the diner)
 │     └── companion:elna OR companion:kessler (recruited by knowing their
 │           obsession — hand them the right trivia bait item)
 └── couch change (+$1) and other petty gains, minus petty costs
```

No deaths, no dead ends (the fuzzer proves it across money values). The comedy
is in the rebuffs and the pettiness; the counter makes "not enough money yet"
a real, visible obstacle instead of a boolean.

## Verification

`npm run validate/fuzz` after each story change (the fuzzer now walks counter
values too), plus a browser driver module asserting the wallet ticks and the
tab clears. Engine changes get the unit tests + a counter fixture.
