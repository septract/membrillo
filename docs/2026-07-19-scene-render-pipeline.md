# Scene render pipeline (floorplan → perspective plate)

Status: **greenlit sprint** (Mike, 2026-07-19). Exploration to give scenes a real
sense of 3D space instead of flat head-on elevations. This note scopes it.

## Prototype outcome (2026-07-19): go, no Blender

A ~230-line throwaway Node renderer (painter's-algorithm flat-shaded boxes +
z-buffer, a perspective floor grid, nearest-palette snap, output straight to
320×180) produced a convincing SCUMM room of the apartment on the first pass. The
verdict on the two open risks:

- **"Do cheap flat-shaded boxes read as a room?"** — Yes. The receding floor grid
  is the dominant depth cue; boxes + palette snap look like a hand-built room, not
  a render. **We do not need Blender.**
- **"Can the depth band be auto-derived?"** — Yes. Two reference figures placed at
  the floor polygon's back/front edges rendered at 50.5 px and 76.2 px, base rows
  102 and 148 → `far {y:102, scale:0.66}`, `near {y:148, scale:1.0}` read straight
  off the render, no image analysis. The floorplan produces the picture *and* the
  physics, consistent by construction.

Camera that works: eye pulled back and up (~2× room depth back, ~3 units up),
low target, ~44° HFOV to frame a 10-unit room; right-handed basis
`R = cross(up, F)`, `U = cross(F, R)` for the authored left/right layout.

Deferred polish for the real tool: baseboards + wall dithering, furniture
proportions, a stray grid-line-over-door artifact, per-wall light variation.

## The problem, precisely

The scenes read flat, but the engine is **not** the limit — the actor system is
already perspective-aware and the *backgrounds don't agree with it*.

Every scene declares a depth band:

```json
"depth": { "far": { "y": 128, "scale": 0.9 }, "near": { "y": 168, "scale": 1.05 } }
```

A sprite whose feet sit at screen row `sy` is scaled linearly between the two
anchors:

```
scale(sy) = far.scale + (near.scale - far.scale) · (sy - far.y) / (near.y - far.y)
```

That *is* a floor plane receding under a slightly-elevated camera — the SCUMM
setup. But the current painters draw flat elevations (a wall rectangle, a floor
strip with **vertical** floorboards). So the character shrinks into depth
correctly while standing on a floor painted like a blueprint. That contradiction
is most of what reads as "not a 3D space." The fix is backgrounds whose
perspective matches the depth band — independent of how the art is produced.

## The crux: calibrate the camera to the depth band

The engine scales sprites **linearly in screen-y** (SCUMM's scale-band trick, not
true pinhole projection — under a real pinhole, apparent size vs screen-y is a
rational function, not linear). So a rendered plate will only sit correctly under
composited sprites if the render camera is chosen so that, over the visible floor
band, its perspective is ~linear and matches `far`/`near`.

Two ways:

1. **Constrain the render** to a long-focal-length, low-pitch camera so
   perspective is near-linear across the floor band, and anchor it to the depth
   decl. *Recommended for prototyping — leaves the engine untouched.*
2. **Extend the engine** to a true-perspective (nonlinear) depth curve derived
   from the camera. More faithful, more work. Deferred.

Under (1) the calibration is mechanical, and it means **the pipeline emits the
`depth` + `walk` block as an output, not just the PNG**:

- Put a reference figure of the sprite's real height (~40 px at scale 1) at the
  **back** edge of the walkable floor and at the **front** edge; render.
- Measure each one's pixel height and base row.
- Emit `far = { y: backRow,  scale: backHeight / refHeight }`,
  `near = { y: frontRow, scale: frontHeight / refHeight }`, and set the walkbox
  y-range to `[backRow, frontRow]`.

Now composited sprites match the plate exactly at the two anchors and stay close
between. A room's floorplan produces both its picture and its physics, in
agreement by construction — that is the whole point of doing this.

## Recommended shape: in-house software renderer (not Blender)

The rooms are boxy — extruded walls and block furniture. That does not need
Blender, and Blender would be a heavy external tool invoked outside the project.
A small self-contained rasterizer fits far better:

- **Zero-dep, in-project** — consistent with the engine's ethos and safety point
  6. We already have a zero-dep PNG *encoder*.
- **Exact camera control** — required for the calibration above; a GUI tool
  fights us here.
- **Renders straight to target** — because we own it, it outputs 320×180 in the
  shared palette directly. This sidesteps the one gap in the planned
  `tools/pixelize.mjs` (the PNG *decoder* half): nothing external comes in, so we
  never decode. Pixelize stays useful only for hand-fed full-res art.
- **"Quick and dirty" as intended** — flat-shaded boxes, one directional light +
  ambient, downscaled to our palette read as a SCUMM room, not a render. Photoreal
  is not the goal; correct perspective + occlusion cheaply is.

Rough scope: a few hundred lines (`tools/render-scene.mjs`): triangle raster with
a z-buffer, flat shading, painter draws boxes from the floorplan.

## Floorplan format (sketch)

A small declarative file per room — the durable, hand-editable source (fits the
"durable story abstractions" thread: the floorplan is the interface, the plate is
a derived artifact):

```ts
{
  size: { w: 320, h: 180 },          // target plate (or larger for scroll)
  camera: { height, pitch, focal },   // long lens, low pitch (see crux)
  floor: [[x,z], ...],                // walkable polygon, world coords
  walls: [{ from:[x,z], to:[x,z], height }],
  props: [{ box:[x,z,w,d,h], material }],   // extruded boxes: counter, couch, TV
  palette: "shared",
}
```

Output: `<room>.png` (committed, served directly) **and** the calibrated
`{ depth, walk }` block, written into the scene JSON automatically (see below) —
not pasted by hand.

## Automation / helper framework (Mike, 2026-07-19: "as much as we can")

The point is not to *generate* plates but to get them *right* automatically — the
calibration is the error-prone part, so it should be computed and **checked**, not
eyeballed. The framework, roughly a `membrillo scene` CLI verb:

- **One command builds a room.** `membrillo scene build <room>`: render the plate,
  auto-place the two reference figures at the floor polygon's back/front edges,
  measure, compute `depth`/`walk`, and write both the PNG and the JSON block in
  place. Floorplan in → correct, wired scene out.
- **Auto-calibration, no manual measuring.** The renderer knows where it put the
  reference figures (it drew them), so it reads their pixel extents directly — no
  image analysis, no guessing.
- **A correctness check** (fits the model-checked ethos). `membrillo scene check`:
  re-derive `depth`/`walk` from the floorplan+camera and assert the scene JSON
  still matches — so a hand-edited walkbox that drifts from the plate is caught,
  the way `validate`/`fuzz` catch story drift. The floor is drawn correct *and
  proven* consistent with the physics.
- **Live preview** (design point 1 — through the browser). A dev route that
  renders the floorplan and overlays the walkbox + a draggable test figure, so you
  tune camera/floor and watch the figure stay planted. Tightens the loop from
  edit→build→look to edit→look.
- **Occlusion hints.** From the prop boxes and camera, flag which props the walk
  path passes behind and suggest the walk-behind declarations (see open question).

## Ship policy — resolved: renders ship (Mike, 2026-07-19)

A render of a hand-built floorplan is **not** AI art (the 2026-07-19 rule is
specifically generative), and Mike is fine shipping renders. So rendered plates
are a **committed, shipping art class**: they live in the repo (`paint/assets/`
or alongside the story), not gitignored `assets-local/`. Consequences:

- The floorplan `.ts` is the committed **source**; the plate PNG is a committed
  **build artifact** derived from it (checked in for zero-build serving, but
  regenerable). Treat the floorplan as truth, the PNG as output — like the
  emitted `depth`/`walk` block.
- The "fully playable with hand-written art alone" principle still holds via the
  meadow fixture (placeholder path) and the code painters, which remain the
  fallback when no plate is present. Renders augment; they aren't required.
- `assets-local/` stays reserved for *generative* art overlays (portraits) — a
  different rule, unchanged.

## Phased plan

1. **Renderer + auto-calibration on one room. — DONE (2026-07-19).**
   `packages/membrillo/tools/render-scene.mjs` (renderer + `renderScene`/
   `buildScene`), the floorplan JSON schema, and `membrillo scene build <story>
   <scene>` all landed. It reads `floorplans/<scene>.json`, writes a committed
   plate `paint/assets/<scene>.png` plus a `<scene>.calib.json` sidecar carrying
   `{ size, depth, walk }`. The `roomdemo` fixture (hidden `demo` category) wires
   the plate via `imageScene` and the emitted band; its driver
   (`games/classic/drive/roomdemo.mjs`) browser-proves a sprite walks the rendered
   floor front→back, scaling with the depth band, and reaches the exit. Blender
   verdict confirmed: not needed. Dither/textured-floor pass makes the plate
   legible (see prototype outcome). Calibration is analytic (project a reference
   figure at the walk area's near/far edges — no image analysis).
2. **`scene check` + auto-patch — DONE (2026-07-19); live preview remains.**
   `membrillo scene check [ids…]` re-derives the band from the floorplan and
   asserts the scene JSON still matches (canonical, key-order-insensitive
   compare), wired into `npm run check` via `scene:check` and locked by
   `render-scene.test.mjs` (calibration is pinned; drift fails the suite).
   `scene build` now **auto-patches** the scene's size/depth/walk in place
   (surgical single-line replace, trailing comma + hand-authored content
   preserved) — no manual paste. Still to do: a browser live-preview route that
   renders the floorplan and overlays the walkbox + a draggable test figure, to
   tune camera/floor with edit→look instead of edit→build→look.
3. **Second and third rooms** — Monk's, a street — to test the format across a
   scrolling world and an exterior; port "Nothing Doing" onto rendered plates as
   the first real customer.
4. **Occlusion automation** and floorplan authoring ergonomics.

## Open questions

- Cheaper alternative to the whole pipeline: teach the painters oblique
  perspective by hand (angled floor, raking walls) — closes maybe 60–70% of the
  gap in code, ships in-repo, no pipeline. Worth a quick spike before Phase 1 as a
  baseline to beat.
- Walk-behind depth sorting must agree with rendered occlusion (a prop the actor
  passes behind in the render must be a walk-behind in the scene).
