# The Marigold: Gale Reach — mission 2 design note

*2026-07-18. Second Marigold mission, designed feature-first: each puzzle
beat exists to exercise an engine capability we want (or haven't tested).
Same cast, new planet, one new guest. See `2026-07-18-marigold-demo-design.md`
for the cast and the research applications this note inherits.*

## Premise

The beacon station on **Gale Reach** — automated, unvisited for sixty years —
has started **singing**. Ships are diverting around the noise. Bramble sends
the away team to restore normal service. The truth (gentle, in the house
style): the station's caretaker intelligence, **Mote**, isn't broken. Sixty
years alone under the aurora, it learned the calls of the sky-rays and sings
back. The fix isn't a shutdown — it's company.

New cast: **Mote** (a voice from wall grilles — never embodied) and the
**service drone** (dust-caked, curled on the floor like a cat; wakes to help).
Cog and Solace beam down with you from the start — recruiting was mission 1's
lesson; this mission's briefing sequence hands you the team.

## Feature-first design map

| Mission beat | Engine feature it exercises |
|---|---|
| The woken drone WALKS across the landing bay to the stores cabinet | **Character movement in sequences** (`walkTo` for characters — NEW) |
| The sleeping drone: a plain click should EXAMINE it, not prod it | **Authored `defaultVerb` override** (NEW — kind-default says operate) |
| The beacon shaft: a 320×400 scene climbed by switchback walkboxes | **Vertical camera** (implemented, never exercised) |
| Aurora through the shaft windows; the beacon's pulse when it sings | **Colour cycling** (painter-level; new `cycle` palette helper) |
| Mote speaks from grille hotspots in both rooms | **Talking hotspots** (supported since the speaker rework, unused) |
| Briefing/ending: a full-screen painted card with subtitle beats | **Full-screen image cutscenes** (NEW — cutscene `paint`; the same card shows the beacon dark on arrival, lit at the end via state) |
| Sleeping-drone def swaps to awake-drone def at the walk's endpoint | The **character-swap authoring pattern** (documented in GUIDE) |

## Puzzle dependency chart (backwards from the ending)

```
                 ENDING: sung (cutscene)
                       ▲ beam circle (requires song_settled)
             song_settled ── Mote dialogue: offer the colony comm-link
                       ▲ option requires knows_lonely AND link_ready
     ┌─────────────────┴──────────────────┐
 knows_lonely                        link_ready
   ▲ Solace companion talk             ▲ use coupler WITH beacon socket
     (requires heard_song)               (top of the shaft; Cog splices it,
 heard_song                               requires companion:cog)
   ▲ first Mote conversation         coupler (item)
     (deflects: "routine harmonic      ▲ stores cabinet (requires woke_drone)
     maintenance" — the deflection   woke_drone
     is the clue, Disco-style)         ▲ use power cell WITH drone → the
                                         'wake' sequence: drone stirs, WALKS
                                         to the cabinet, def-swaps awake
                                       ▲ requires knows_dormant
                                     knows_dormant ── sniffer on the drone
                                     cell (item) ── charging rack, landing bay
                                     sniffer ── briefing sequence, as before
```

Parallel branches (lonely vs. link) keep it bushy; problem-before-solution
holds (the drone won't take the cell until diagnosed; Solace can't read Mote
until you've heard it deflect). Climax is again a conversation, not a boss:
you don't fix Mote, you introduce it to the neighbours.

## Scenes

1. `brief2` — cutscene. 2. `landing` — the bay (320×180): beam circle,
   Mote grille, charging rack, stacked-furniture prop (Mote has been
   rearranging; walk-behind), sleeping drone (defaultVerb: look), stores
   cabinet, stairs exit. 3. `shaft` — 320×400 TALL: switchback walkboxes
   climbing four flights, aurora windows (cycling), Mote's core grille,
   the beacon head + empty comm socket at the very top. 4. `sung` — ending.

## Out of scope

Save slots (deferred by Mike), multi-frame costumes (next art pass), a third
scene. Ship it tight; the shaft is the showpiece.
