# SCUMM parity — where the engine stands and what we adopt

*2026-07-18. Companion to `2026-07-18-architecture.md`. The bar is the
ScummVM-era LucasArts feature set (MI2/DOTT, 1991–93). Direction confirmed by
Mike: the game should feel SCUMM-like — tng-game's visual-novel-style
presentation (text log as primary channel, static scenes) was convenience, not
preference. SCUMM-ness here means presentation and interaction feel; it does
NOT mean adopting SCUMM's scripting model (see "what we refuse").*

## Bucket 1 — presentation gaps: pure engine work, adopt incrementally

| Feature | SCUMM | Us (before) | Plan |
|---|---|---|---|
| Sprite scaling | scale is a property of the ground (per-walkbox / y-gradient); actors shrink walking "away" | fixed-size actors | **adopt now** — per-scene `depth` gradient |
| Walkboxes + pathfinding | connected polygonal boxes, box-route matrix, actors path around obstacles | single axis-aligned rect, straight-line walk | **adopt now** — multiple rects + adjacency + waypoint routing |
| Occlusion (z-planes) | masking planes; actors walk behind scenery | characters painter-sorted, scenery never occludes | **adopt now** — scene `props` with baseline `y`, sorted into the body pass |
| Speech over heads | dialogue floats above the speaker, per-character colour, timed by length | DOM text log + dialogue overlay | **adopt now** — floating text primary, log demoted to transcript |
| Room transitions | dissolves/wipes/fades | hard cut | **adopt now** — fade-out/in |
| Multi-frame costumes | 4-direction walk cycles, talk mouths, idles, scripted actor moves | 2-pose sin bob, left/right only | later — matters once scaling makes toward/away visible |
| Camera scroll | rooms wider than screen, camera follows | single-screen rooms | later — when a story wants a wide room |
| Concurrent room scripts | flames, clocks, wandering NPCs via co-routines | painter `t`-effects only | later, and only as declarative ambient tracks |
| Palette tricks | colour cycling, day/night | none | later, cheap, painter-level |
| Adaptive audio | iMUSE: musical-boundary transitions | none | separate work item (kit's "iMUSE-lite" is the template) |

## Bucket 2 — interaction model: one real gap, adopt now

The four-verb collapse (Look/Talk/Interact/Combine) stays — it's a deliberate
modern lane. But SCUMM's bread and butter is *"Use X on Y"* / *"Give X to Y"*,
and our old encoding (target `use` rules that `requires: item:x`) lets the
engine pick the item, not the player. That kills "wrong item" flavour
responses, player-chosen alternatives, and the experimentation that makes the
genre's friction fun.

**Adopted: `itemUse` buckets.** A target (hotspot or character) may define
`itemUse: [{ withItem, requires?, ...effects }]` — same first-match idiom,
filtered to the item the player is holding against it. UI: with Interact
armed, clicking an inventory chip arms that item; clicking a target applies
it. Unmatched applications get a default rebuff. Give-to-character is the same
mechanism on a character. The fuzzer simply gains item×target edges.

## Bucket 3 — logic model: deliberate distance, we refuse

SCUMM scripts are a full language (counters, timers, randomness, arbitrary
control flow). We stay declarative — boolean flags/items/companions — because
that is exactly what lets `npm run fuzz` exhaustively prove "no unwinnable
states", which SCUMM-era games notoriously could not (hence walkthrough
culture). Guardrails:

- **Refuse**: general scripting, real-time timers, unseeded randomness in
  logic. Timing and randomness may live in painters (presentation) freely.
- **Bounded escape hatch, if a story ever needs it**: small-domain counters
  (e.g. `counter:trust:0..3`) keep the state space finite and fuzzable. Not
  implemented until a story demands one.
- Multiple playable characters (DOTT): deferred; large, and touches
  everything.

## Schema additions (implemented with this note)

```jsonc
// scene
"walk": [ {x,y,w,h}, ... ],          // one or more rects; overlapping/touching
                                      // rects are connected; actor paths through
                                      // shared edges (single object still accepted)
"depth": { "far": { "y": 128, "scale": 0.62 },   // linear scale by feet-y,
           "near": { "y": 172, "scale": 1.0 } }, // clamped outside the range
"props": [ { "id": "crates", "paint": "crates", "y": 152 } ],
// a prop is a painter drawn in the body pass at baseline y — actors with
// feet above (behind) it are occluded, below (in front) draw over it

// hotspot/character (alongside look/talk/use/take)
"itemUse": [ { "withItem": "grapple", "requires": ["flag:knows_crate"],
               "text": "...", "removeItem": "grapple", "giveItem": "lens" } ]

// character
"color": [220, 200, 170]   // speech colour over the head (default white)
```

Painters are unchanged; props reference painter names like scenes/sprites do
(`props` record in the paint module). Walk geometry, depth, and props are
presentation — the fuzzer ignores them; the validator checks their sanity
(boxes connected, start/walkTo/entry inside some box, prop paint refs).

## Priority order (agreed 2026-07-18)

1. `itemUse` — schema-changing, so it lands before the first real story is
   designed.
2. Depth cluster (scaling + walkboxes/pathfinding + props) — perceptually one
   feature: "the room has depth".
3. Speech over heads + fades.
4. Audio (separate); costumes/camera when content wants them.
