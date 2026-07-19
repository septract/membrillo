# Membrillo game template

A complete, working Membrillo game with one small example story, **The Quince
Tree** (two puzzle links, one ending, fully painted). Copy it, rename it,
replace the story with yours.

## Inside the membrillo repo (the easy path)

```
cp -r games/_template games/mygame
# edit games/mygame/package.json: rename "@membrillo/template" → "@membrillo/mygame"
npm install                       # link the new workspace
npm run dev -w games/mygame       # play at the printed port
npm run check -w games/mygame     # validate + prove winnability
```

## As a standalone repository

Copy this directory anywhere and point the `membrillo` dependency at a
checkout of the engine:

```
"dependencies": { "membrillo": "file:../membrillo/packages/membrillo" }
```

`npm install && npm run dev` — that's the whole setup. For CI (where a
relative `file:` path won't exist), vendor a tarball: run `npm pack` inside
`membrillo/packages/membrillo`, commit the `.tgz`, and depend on
`"membrillo": "file:./membrillo-<version>.tgz"`. Once membrillo is published
to npm this becomes a normal versioned dependency.

`.github/workflows/deploy.yml` deploys to GitHub Pages when this directory is
a repo root (it is inert inside the membrillo repo) — see its header comment.

## Writing your story

The full authoring reference is the engine's `GUIDE.md`
(`packages/membrillo/GUIDE.md`, shipped with the package) — rules, scenes,
dialogue, companions, sequences, painters, audio, and the design rules the
tools enforce. The loop:

```
$EDITOR stories/mystory/manifest.json ...
npm run check       # membrillo check --root ./stories: structure + winnability
```

A passing `check` is a model-checking result: every reachable state was
played, no dead ends exist, every objective can complete. Keep story logic
declarative (flags/items/companions only) and that proof stays exhaustive.

The browser is the other half of verification — `check` proves the rules, not
the feel:

```
npm run dev                        # in one shell
npm i --no-save playwright-core    # once per checkout; drives system Chrome
npm run drive                      # plays every story module in drive/
```

Add a module in `drive/` per story (see `drive/quince.mjs`) and list it in
`drive.mjs`.

## What the example story demonstrates

- **manifest.json** — title, start scene, a synthesized music theme (no
  audio files).
- **scenes/orchard.json** — walkbox, depth scaling, hotspots with ordered
  rule buckets (`look`/`use`/`take`/`itemUse`), a character with dialogue and
  `speaker: "target"` replies, a flag-gated exit paired with a closed-gate
  hotspot on the same region, a one-time entry sequence.
- **scenes/lane.json** — an ending cutscene.
- **dialogue/gardener.json** — a hint tree that sets a `knows_*` flag.
- **objectives.json** — a live goal log derived from state.
- **paint/index.ts** — the one code surface: a cached static background,
  state-varied drawing (fruit, hook, gate), ambient motion, and a sprite.
  Delete it entirely and the story still runs on labelled placeholders.
