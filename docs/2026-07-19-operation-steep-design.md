# Operation Steep — mission design note

*2026-07-19. A James Bond-inspired mission per Mike's direction: a spunky
sidekick heroine, everything renamed absurd/funny/charming rather than
copyright-infringing (the Marigold treatment applied to spy fiction). Also
the showcase for two new engine features: `manifest.actor` (the hero wears a
tux) and the 4-frame `walkFrame` gait.*

## The world (all names original)

- **S.C.O.N.E.** — the Secret Commission for Overseas Nuisance Elimination.
  Her Majesty's least deniable service. Briefings come from **Auntie**, who
  is nobody's aunt.
- **Agent Earl Grey** (the player) — impeccable dinner jacket, unflappable,
  charmingly useless without support staff. "Grey. *Earl* Grey." The tux is
  the point: he is drawn by a story-supplied actor sprite.
- **Penny Farthing** — S.C.O.N.E.'s gadget prodigy, undercover as a
  croupier, field-promoted to sidekick. Spunky, technical, thoroughly
  unimpressed by Grey's suavity; does the actual cleverness. Recruited as a
  **companion**, so her gadget skills travel with the party.
- **Baron Marzipan** — confectionery magnate. His petit-fours were snubbed
  at the Royal Garden Party in '61 and he has been planning his revenge on
  civilisation ever since.
- **Mr. Fondant** — the Baron's enormous, silent henchman. Bowler hat.
  One known weakness: he is moved to tears by *proper* shortbread.
- **The Four O'Clock Device** — the Baron's doomsday machine: it will freeze
  the entire world at 4:01pm. One minute past teatime. Forever.

## Scenes

1. `brief` — full-screen card: Auntie's office, the mission. → salon
2. `salon` — the Grand Salon of the Hôtel Bombe (480×180, scrolling).
   Barman, snack bowl, drinks tray, Penny at the card table. Doors → terrace.
3. `terrace` — the cliff terrace and funicular station (320×240, vertical
   camera). Mr. Fondant blocks the funicular. → lair (gated).
4. `lair` — the Tea Room of Doom (480×180). Laser grid, the Device, the
   Baron. Entering plays the capture-and-monologue sequence (villains
   explain; it's in the rules).
5. `victory` — full-screen ending card: the clock stopped at 3:59.

## Puzzle dependency chart (designed backwards from the ending)

```
stop the Device (olive → Device; needs grid_off + knows_plan)
 ├── grid_off      (swizzle stick → laser grid; needs companion:penny)
 │    └── swizzle stick        (drinks tray, salon)
 ├── knows_plan    (capture sequence on entering the lair — the monologue
 │                  reveals the Device's weakness: "a sub-atomic jiffy of
 │                  brine"; hints the olive)
 ├── cocktail olive             (snack bowl, salon)
 └── reach the lair: fondant_moved
      └── shortbread → Mr. Fondant  (he steps aside, weeping — character-
           │                         swap walk sequence)
      └── shortbread ← Penny   (needs companion:penny + knows_fondant)
           ├── companion:penny (dialogue at the card table; she was
           │                    expecting a *competent* agent, but fine)
           └── knows_fondant   (barman dialogue: Fondant's weakness)
```

Items: olive (bowl → Device), swizzle stick (tray → grid), shortbread
(Penny → Fondant). Every item one source, one sink. Problem-before-solution:
the barman names Fondant's weakness before Penny will hand over the
shortbread; the monologue names brine before the olive can jam anything.

## Objectives

- "Get into Baron Marzipan's lair" (done: fondant_moved)
- "Find a way past Mr. Fondant" (active: met_fondant, done: fondant_moved)
- "Stop the Four O'Clock Device" (active: knows_plan, done: device_stopped)

## Feature exercise (why this mission, engineering-wise)

- `manifest.actor` — Earl Grey's tux sprite replaces the engine actor
  (first story to use it).
- `walkFrame` — every sprite in the cast steps through the shared 4-frame
  gait; the tux mid-stride is the feature demo.
- Companion ability rules (Penny), scripted character walk (Fondant stepping
  aside), full-screen cards (briefing, victory), vertical camera (terrace),
  themes-as-data audio (lounge pluck / cliff wind / lair menace).

## Tone rules

No deaths (capture, yes; the fuzzer still proves no dead ends — being
captured is the *plan*). Every look/use click gets an authored line; martini
jokes are permitted but rationed. The Baron is a gracious host. Penny gets
the last word.
