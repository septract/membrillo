# Story authoring guide

The complete reference for writing stories. The engine is story-agnostic:
everything your game *is* lives in your story directory as JSON data, plus one
narrow code surface (`paint/index.ts`) for drawing. If a rule here disagrees
with the code, the code wins — then fix this file.

Run after every change, before considering work done. From your own game
(the template, or any standalone consumer) use the CLI:

```
npx membrillo validate <id> --root ./stories   # structure + cross-references
npx membrillo fuzz <id> --root ./stories        # plays every reachable state
npx membrillo check --root ./stories            # both, over every story
```

(Inside this engine repo, the equivalents are `npm run validate -- <id>` and
`npm run fuzz -- <id>`, which point at `games/classic/stories`.)

The fuzzer is an explicit-state checker over your story's flag/item/companion
state space. The space is finite, so the search is exhaustive: a clean run
means there are no reachable dead ends, every scene is reachable, and every
objective can complete — a complete check, not a formal proof. It's the
engine's core guarantee; protect it by keeping logic declarative (no
conditions the fuzzer can't see).

## Directory layout

```
stories/<id>/
  manifest.json      id, title, description, category, start scene,
                     optional view + actor + audio
  items.json         inventory items (array)
  scenes/*.json      one scene per file, filename = scene id
  dialogue/*.json    dialogue trees (optional)
  companions.json    party members (optional)
  objectives.json    goal log (optional)
  paint/index.ts     scene/sprite/prop painters (optional — a story with no
                     painters runs on labelled placeholder boxes)
```

Everything optional is genuinely optional: omitting a file changes nothing
else. `games/classic/stories/meadow/` is the minimal reference (no
painters); `games/classic/stories/lamplight/` is the full-featured one.

The manifest carries the menu presentation too: `description` is a one-line,
**spoiler-free** blurb (tease the tone, never the reveal), and `category`
is `"story"` (default, a real game) or `"demo"` (an engine fixture, shown
under a collapsed section).

`view` sets the render resolution and the default scene size:
`"view": { "w": 320, "h": 180 }` (the engine default if omitted). A scene's
own `size` may exceed the view — larger scenes scroll under a following
camera. `actor` / `actorPortrait` name the player's sprite / dialogue
portrait painters (below); `audio` is the music config (below).

## The player's verbs

Three verbs — **Interact** (default), **Look**, **Talk** — plus item arming:

- A plain click Interacts: doors travel, pickups pick up, machines operate.
- Armed verbs are one-shot: after Look/Talk resolves against a target, the
  mode snaps back to the default (clicks on empty ground walk and keep the
  arm). Don't design puzzles that assume a verb stays armed across clicks.
- With Interact armed, clicking an inventory item arms it ("Use X with …");
  the next click — another item OR a scene target — completes the sentence.
  Combining and applying items are deliberately the same gesture.
- Look describes (and never travels); Talk starts conversation.

You author four rule buckets (`look`, `talk`, `use`, `take`) plus `itemUse`.
The engine collapses `take`/`use` behind Interact — define **one or the
other** per target, never both (validator error). A plain click resolves by
kind (people → Talk, operable things → Interact, inert scenery → Look);
override with `defaultVerb` when the kind default is wrong (a sleeping
creature you'd examine, not prod). Dialogue options with `to: "end"` are
marked by the engine (dimmed, trailing ≫) — never hand-write "(leave)".

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

**Conditions** are strings: `flag:x`, `item:x`, `companion:x` (each
`!`-negatable), plus **bounded counters** `counter:name<op>N` (ops `>= <= ==
!= > <`, e.g. `counter:money>=8`). No timers, no randomness in logic — those
stay in painters (presentation only) so the fuzzer's check stays exhaustive.

**Bounded counters** are the one numeric resource (money, a score, a tally).
Declare each in the manifest with a fixed range — the range must stay small,
because it multiplies the fuzz state space:

```jsonc
"counters": { "money": { "min": 0, "max": 9, "start": 3, "label": "Wallet", "unit": "$" } }
```

`label`/`unit` are for the on-screen strip ("Wallet: $3"). Effects
`addCounter` (signed delta) and `setCounter` (absolute) move them, always
clamped to `[min, max]`. Conditions gate on thresholds. Because the range is
bounded, the state space stays finite and winnability stays exhaustively
checked. If you find yourself wanting a big range, collapse it to a few
meaningful thresholds instead.

**Rule effects** (all optional): `text`, `setFlags`, `clearFlags`,
`giveItem`, `removeItem`, `addCompanion`, `removeCompanion`, `addCounter`,
`setCounter`, `goto` (scene), `dialogue` (talk buckets only), `play` (scene
sequence; runs after effects, before any `goto`), `speaker` (`"target"`
floats `text` over the target instead of the player). Dialogue options and
sequence steps carry the same effect fields, counters included.

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

**Cutscenes** are `{ "beats": ["line", ...], "next": "sceneId" }` — caption
cards, click/Esc to advance. Terminal ones use `"ending": true` instead of
`next`. Reaching any `ending` scene wins (the fuzzer's success criterion).
Give a cutscene a `paint` and it becomes a **full-screen card**: the painter
draws at view size (it may read state — the same card can show before/after)
and the beats render as lower-third subtitles. For scripted moments INSIDE a
room, use sequences instead.

## Hotspots, characters, exits

- **Hotspot**: `{ id, name, region {x,y,w,h}, walkTo?, requires?, look/talk/
  use|take/itemUse }`. `requires` gates visibility. `walkTo` defaults to the
  region centre (clamped to walkable) — set it explicitly when the region
  isn't over ground.
- Clicks hit-test characters first, then hotspots, then exits — each in
  declaration order, first match wins. When regions overlap (a branch inside
  the tree's canopy), list the more specific target first: the same
  specific-before-general convention as rule buckets.
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
`say`, `walkTo` (actor: walkbox-pathed; scene characters: straight line —
author-controlled ground; not companions), `face`, `wait`, plus any rule
effect fields. A say step may add `"portrait": true`: if the speaker has a
`portrait`, the scene dims and their close-up stands stage right with the
line captioned under a name tag — a scripted character beat (a wordless
`"..."` reads as deliberate silence, mouth shut, not a dropped line). **The
character-swap pattern**: to move a character
permanently, walk them in a sequence, then `setFlags` a flag that hides
their old definition and reveals a second definition positioned at the walk's
endpoint — the handoff is seamless and survives scene re-entry.
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
export const scenes    = { dock, tower }; // (ctx, state, t) — full scene, WORLD size
export const sprites   = { keeper };      // (ctx, fx, fy, pose, t) — feet-up
export const props     = { crates };      // (ctx, state, t) — drawn at baseline y
export const portraits = { keeperP };     // (ctx, state, t, talking) — 90×160 close-up
```

Use the engine art library (`membrillo/art/*`): every colour from the palette
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
- **Walk cycles**: call `walkFrame(pose)` for the engine's quantized 4-frame
  gait (contact/passing: foot x-offsets `aDx`/`bDx`, leg lifts `aUp`/`bUp`,
  body `rise`, arm `swing`) instead of rolling your own from `phase` — every
  body in the scene then steps to the same beat. Frame-stepped, deliberately
  not smoothed; `index` is there if you'd rather switch whole drawings.
- **The player's costume**: `"actor": "<sprite name>"` in the manifest draws
  the hero with your sprite painter instead of the engine default (validator
  checks the name) — same contract as any character sprite, ~40px tall so
  the speech anchor stays honest.
- Characters ~40px tall keep speech anchors honest; wildly taller/shorter
  sprites will misplace their floating lines.
- **VN dialogue staging** (optional): give a character/companion
  `"portrait": "<name>"` (painter exported under `portraits`, logical 90×160
  — the `PORTRAIT` constant, 9:16). While that speaker's dialogue TREE is
  open, the scene dims and both parties stand floor-to-ceiling over it: the
  hero (`manifest.actorPortrait`) stage left, listening; the interlocutor
  stage right, mirrored so they face each other. The spoken line moves into
  the dialogue box under a coloured name tag. Floating in-room speech (barks,
  sequences) is unaffected — the room stays SCUMM; conversations get the big
  art. The painter gets `(ctx, state, t, talking)`: run the mouth while
  `talking` (timed to line length). Author portraits facing viewer-RIGHT —
  the engine's mirroring makes the pair face each other. No portrait on the
  interlocutor → that dialogue renders classically; portraits are presentation
  only, never logic.
  - **Image portraits**: `portraitImage(url, framing?)` from
    `membrillo/art/images` wraps a PNG/JPG. It cover-fits any resolution into
    the 9:16 frame, and if the image has a flat **chroma-green** background it
    auto-keys it out (generate on green to float the bust over the scene).
    `framing` (`{ zoom, anchorX, anchorY }`) tunes the crop so heads line up
    across a differently-shot cast — see steep's `localPortrait` helper.
  - **Local-art overlay**: a gitignored `paint/assets-local/` beside your
    story lets you drop generated art that replaces the code-drawn painters on
    your machine only, never in the repo — glob it in the paint module and
    fall back to the code-drawn version (steep and quince show the pattern).
    Whether generated art *ships* is your project's call.

**Image assets** work through the same seam — a painter is draw code, and
`membrillo/art/images` wraps PNGs into painters (`games/classic/stories/postcard/` is the
worked fixture):

```ts
import { imageScene, sheetSprite } from 'membrillo/art/images';
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
restyling the cast to match — they clash. To rough out scenes before real art
exists, the engine ships a zero-dependency placeholder generator; from a
consumer game run `node node_modules/membrillo/tools/make-test-art.mjs`
(reads/writes under `STORIES_ROOT`, default `./stories`).

The worked examples named above (`games/classic/stories/lamplight`,
`.../postcard`, and the design-guide note under `docs/research/`) live in the
[Membrillo repo](https://github.com/septract/membrillo), not the npm package —
open them there. The template's `quince` story ships with your starter and
covers most of the same ground.

## Browser verification (the feel, not just the rules)

`validate`/`fuzz` prove the rules; they can't see whether a click lands or
speech floats over the right head. After any presentation or story change,
drive the game in a real browser. The kit is exported as
`membrillo/verify-kit`; a game's `drive.mjs` names its story modules and each
module gets the kit:

```
npm run dev                        # in one shell
npm i --no-save playwright-core    # once per checkout; uses system Chrome
npm run drive                      # plays every module in drive/
```

Kit helpers a driver module receives: `freshStory(id)` (boot with cleared
storage), `worldClick(x,y)` / `walkTo(x,y)` (world coords, camera-aware),
`verb(name)` / `chip(name)` (verb bar / inventory), `waitLog(text)` (assert a
line appeared), `hook()` (`window.__pcc()` — scene/state/actor/camera/view,
read-only), `shot(name)` (screenshot to `shots-browser/` — **read it; a green
log with a broken screenshot is a failure**), and `errors` (console/page
errors fail the run). Off-screen targets can't be clicked; walk in hops. New
stories add a module and list it in `drive.mjs`.

## Design rules (enforced or strongly conventional)

1. **No deaths, no dead ends, no unwinnable states.** The fuzzer checks it;
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
