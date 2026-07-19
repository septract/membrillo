# Story authoring guide

The complete reference for writing stories. The engine is story-agnostic:
everything your game *is* lives in your story directory as JSON data, plus one
narrow code surface (`paint/index.ts`) for drawing. If a rule here disagrees
with the code, the code wins — then fix this file.

Run after every change, before considering work done:

```
npm run validate -- <id>    # structure + cross-references
npm run fuzz -- <id>        # plays every reachable state; proves winnability
```

The fuzzer is an explicit-state model checker over your story's flag/item/
companion state space. A passing run **proves** there are no unwinnable
states, every scene is reachable, and every objective can complete. This is
the engine's core guarantee — protect it by keeping logic declarative (no
conditions the fuzzer can't see).

## Directory layout

```
stories/<id>/
  manifest.json      id, title, start scene, optional view + audio
  items.json         inventory items (array)
  scenes/*.json      one scene per file, filename = scene id
  dialogue/*.json    dialogue trees (optional)
  companions.json    party members (optional)
  objectives.json    goal log (optional)
  paint/index.ts     scene/sprite/prop painters (optional — a story with no
                     painters runs on labelled placeholder boxes)
```

Everything optional is genuinely optional: omitting a file changes nothing
else. `stories/meadow/` is the minimal reference (no painters);
`stories/lamplight/` is the full-featured one.

## The player's verbs

Three verbs — **Interact** (default), **Look**, **Talk** — plus item arming:

- A plain click Interacts: doors travel, pickups pick up, machines operate.
- With Interact armed, clicking an inventory item arms it ("Use X with …");
  the next click — another item OR a scene target — completes the sentence.
  Combining and applying items are deliberately the same gesture.
- Look describes (and never travels); Talk starts conversation.

You author four rule buckets (`look`, `talk`, `use`, `take`) plus `itemUse`.
The engine collapses `take`/`use` behind Interact — define **one or the
other** per target, never both (validator error).

## Rules — the entire logic model

Every behaviour is an ordered **rule bucket**: the first rule whose
`requires` all pass wins, so put specific rules first and an unconditional
fallback last.

```jsonc
"use": [
  { "requires": ["item:key", "!flag:door_open"],
    "text": "The key turns.", "setFlags": ["door_open"], "removeItem": "key" },
  { "requires": ["flag:door_open"], "text": "It's already open." },
  { "text": "Locked tight." }                    // fallback — always last
]
```

**Conditions** are strings: `flag:x`, `item:x`, `companion:x`, each
`!`-negatable. That's the whole language — no counters, no timers, no
randomness in logic (this is what keeps the fuzzer's proof exhaustive).
Randomness and timing belong in painters (presentation only).

**Rule effects** (all optional): `text`, `setFlags`, `clearFlags`,
`giveItem`, `removeItem`, `addCompanion`, `removeCompanion`, `goto` (scene),
`dialogue` (talk buckets only), `play` (scene sequence; runs after effects,
before any `goto`), `speaker` (`"target"` floats `text` over the target
instead of the player — use for in-character NPC replies).

## Scenes

A scene is a **room** or a **cutscene** — never both.

```jsonc
{
  "id": "dock",                       // must match the filename
  "name": "Graywater Stair",
  "paint": "dock",                    // painter name; omit for placeholder
  "size": { "w": 480, "h": 180 },     // world size; omit = the story's view
  "walk": [ {"x":8,"y":128,"w":130,"h":44}, ... ],   // one rect or several
  "depth": { "far": {"y":128,"scale":0.68}, "near": {"y":172,"scale":1.05} },
  "props": [ {"id":"crates","paint":"crates","y":154} ],
  "start": { "x": 30, "y": 158 },
  "hotspots": [...], "characters": [...], "exits": [...],
  "sequences": { ... }, "enter": [ ... ]
}
```

- **walk**: overlapping/touching rects connect; the actor paths through
  shared edges. A 1px gap does NOT connect (validator checks connectivity).
  Every `walkTo`, `start`, and incoming `entry` must sit inside some box.
- **depth**: sprite scale by feet-y — SCUMM perspective. Walk speed scales too.
- **props** are occluders: drawn in the body pass at baseline `y`, so actors
  with feet above (behind) them are hidden. Give walkboxes a lane behind a
  prop or nobody ever walks behind it.
- **size > view** scrolls under a following camera. Remember off-screen
  targets can't be clicked — players walk toward things, which is correct.

**Cutscenes** are `{ "beats": ["line", ...], "next": "sceneId" }` — full-black
caption cards, click/Esc to advance. Terminal ones use `"ending": true`
instead of `next`. Reaching any `ending` scene wins (the fuzzer's success
criterion). For scripted moments INSIDE a room, use sequences instead.

## Hotspots, characters, exits

- **Hotspot**: `{ id, name, region {x,y,w,h}, walkTo?, requires?, look/talk/
  use|take/itemUse }`. `requires` gates visibility. `walkTo` defaults to the
  region centre (clamped to walkable) — set it explicitly when the region
  isn't over ground.
- **Character**: as hotspot but `pos` (feet anchor) instead of region,
  plus `paint` (sprite), `color` ([r,g,b] speech colour), `facing`.
- **Exit**: `{ id, name, region, walkTo?, to, entry, requires?, look?,
  effects? }`. `entry` is where the player SPAWNS in the destination — put it
  just inside that scene's matching doorway, inside its walkboxes (validator
  checks; this is the genre's most classic authoring bug). `look` is plain
  text (Look never travels). `effects` is a rule applied on travel (text/
  flags/items only — no goto/dialogue/play).
- Anything that LOOKS traversable (stairs, gates, roads) should BE an exit or
  have authored `use` flavour. A player interacting with scenery and getting
  the generic default is a design bug, not a feature.

## Items

```jsonc
{ "id": "rope", "name": "coil of line",
  "look": [{ "text": "Twenty feet of tarred line." }],
  "combine": [{ "withItem": "hook", "giveItem": "grapple",
                "text": "You lash the hook to the line." }] }
```

- `combine` fires from either item of the pair; both components are consumed
  unless `removeItems` says otherwise.
- **Item-on-world** lives on the TARGET as `itemUse` buckets keyed by
  `withItem` — write flavour rebuffs for plausible wrong items; the
  experimentation is the fun. Unmatched applications get the generic rebuff.
- **Source and sink rule** (validator-enforced): every item must be
  obtainable somewhere and used/consumed/referenced somewhere.

## Dialogue

```jsonc
{ "id": "keeper", "start": "start",
  "nodes": {
    "start": { "line": "Lamp's dead, and my lens with it.",
      "options": [
        { "text": "Your lens is in the harbour?", "to": "crate",
          "setFlags": ["knows_crate"] },
        { "text": "I'll see what I can do. (leave)", "to": "end" } ] } } }
```

Opened from a talk rule: `"talk": [{ "dialogue": "keeper" }]`. Options carry
`requires`, `setFlags`, `giveItem`, `addCompanion`; `to` names a node or
`"end"`. The floating line anchors over whoever was talked to (characters,
companions, even hotspots — an intercom works). Give every node an
unconditional way out; the engine injects an emergency "(leave)" if you
don't, but relying on it is a design smell (the validator warns).

Use dialogue to hint the next puzzle link and set `goal_*`/`knows_*` flags —
the player should learn the problem before finding the solution.

## Companions (party members)

`companions.json`: array of `{ id, name, paint?, color?, look/talk/use|take/
itemUse }` — the same rule surface as characters. While in
`state.companions` they walk behind the actor (breadcrumb trail) and are
clickable **in every scene**: gate puzzle beats on `companion:x` conditions,
or put ability rules on the companion ("ask Cog to lift it"). Recruit via any
rule/option `addCompanion`. No `play` rules on companions (they're
scene-independent; sequences aren't).

## Objectives (goal log)

`objectives.json`: `{ id, text, active?, done? }` — pure derivations from
state, shown while `active` passes, ticked once `done` passes. The fuzzer
errors on objectives that never show or can never complete. Keep the first
objective visible from the start: the player should always know what they're
trying to do.

## Sequences (in-room scripted moments)

```jsonc
"sequences": {
  "arrival": [
    { "setFlags": ["arrived"] },
    { "walkTo": { "x": 70, "y": 158 } },
    { "who": "keeper", "say": "You there! Off the ferry!" },
    { "say": "That lamp of yours is dead, isn't it." },
    { "wait": 0.4 } ] },
"enter": [{ "requires": ["!flag:arrived"], "play": "arrival" }]
```

Steps: `who` (`"actor"` default, a scene character id, or a companion id),
`say`, `walkTo` (actor only), `face`, `wait`, plus any rule effect fields.
Trigger from `enter` (first matching trigger, every entry — gate one-time
intros on a flag the sequence itself sets) or a rule's `play` (`play`+`goto`
= sequence, then travel: a beam-out). Clicking hurries the current line; Esc
skips the rest **and still applies every remaining effect** — a skipped
sequence provably ends in the same state as a watched one, so never put
load-bearing state changes anywhere but step effects.

## Audio

In the manifest; themes are data, the engine synthesises (no files):

```jsonc
"audio": {
  "themes": { "dusk": { "bpm": 76, "prog": ["Am","F","C","G"],
              "scale": [57,60,62,64,67,69,72], "style": "pluck", "gain": 0.7 } },
  "sceneTheme": { "dock": "dusk" } }
```

`style`: `pluck` (bass + sparse melody from `scale`) or `drone` (sustained
fifths). Unlisted scenes are silent; themes crossfade on scene change.
Nobody can verify audio headlessly — a human must listen.

## Painters (`paint/index.ts`)

The story's one code surface. Draw-only: painters may READ state to vary
drawing (hide a taken prop), never write it, and hold no game logic.

```ts
export const scenes  = { dock, tower };   // (ctx, state, t) — full scene, WORLD size
export const sprites = { keeper };        // (ctx, fx, fy, pose, t) — feet-up
export const props   = { crates };        // (ctx, state, t) — drawn at baseline y
```

Use the engine art library (`engine/art/`): every colour from the palette
(`P`, `mix`), `rampRect` for dithered sky/sea bands, `blk`/`px` for outlined
pixel shapes, `talkMouth`/`blinking` for faces. Recipes:

- **Scene**: cache the static background once (offscreen canvas, see
  lamplight's `cachedBg`) and FILL THE WHOLE scene size — uncovered pixels
  smear. Blit per frame, then dynamic props (state-gated) and `t`-driven
  ambience (glows, shimmer, gulls).
- **Sprite**: ~40px tall from the feet up, 1px outlines, `faceCtx` to mirror.
  Respect `pose`: `walking`+`phase` swing limbs, `talking` runs the mouth,
  4-way `facing` (draw the back of the head for `up`). The engine scales
  sprites by depth — draw at scale 1.
- Characters ~40px tall keep speech anchors honest; wildly taller/shorter
  sprites will misplace their floating lines.

**Image assets** work through the same seam — a painter is draw code, and
`engine/art/images.ts` wraps PNGs into painters (`stories/postcard/` is the
worked fixture):

```ts
import { imageScene, sheetSprite } from '../../../engine/art/images.ts';
const bg = new URL('./assets/yard-bg.png', import.meta.url).href; // Vite bundles it
export const scenes = { yard: imageScene(bg) };
export const sprites = {
  buddy: sheetSprite(sheetUrl, {
    frameW: 20, frameH: 40,
    rows: { down: 0, right: 1, up: 2 },  // 'left' mirrors 'right'
    walkFrames: 2,                        // col 0 idle, cols 1..N walk cycle
  }),
};
```

Author art at world scale (1 image pixel = 1 scene pixel; backgrounds at the
scene's `size`, sprite frames feet-anchored at bottom-centre). Don't mix
image-painted backdrops with code-drawn sprites in one scene without
restyling the cast to match — they clash. `tools/make-test-art.mjs` generates
placeholder PNGs to rough out scenes before real art exists.

## Design rules (enforced or strongly conventional)

1. **No deaths, no dead ends, no unwinnable states.** The fuzzer proves it;
   your job is to make the proof mean something by keeping logic declarative.
2. **Problem before solution.** Let the player find the locked thing before
   the key (gate the key's use, or its visibility, on knowing the problem).
3. **Every item: source and sink** (enforced). No red herrings in v1.
4. **Every click deserves a response** — authored, not generic. Write `look`
   text for everything (validator warns), wrong-item flavour for plausible
   items, and `use` responses for scenery that looks usable.
5. **Flags**: `snake_case`; `knows_*` for information the player learned,
   `took_*` for one-time pickups (hide the hotspot with `!flag:took_x`),
   past-tense verbs for events (`gate_open`, `lamp_lit`).
6. **Hint through characters** — dialogue points at the next link without
   handing over the answer.
7. Keep episode one small: 2–4 rooms, one chain, a satisfying ending scene.
   Draw the puzzle dependency chart BEFORE writing JSON (design backwards
   from the ending; see docs/2026-07-18-tng-adventure-game-design-guide.md).

## Debugging

- `?story=<id>` boots straight in; `&start=<scene>&flags=a,b&items=x,y
  &companions=c` jumps to a state (bypasses saves).
- Space outlines all clickable targets; L/T/I arm verbs; Esc skips
  cutscenes/sequences; double-click exits to travel instantly.
- `window.__pcc()` in the console: scene, state, actor, camera, view.
