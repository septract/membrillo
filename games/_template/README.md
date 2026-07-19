# Membrillo game template

A complete, working Membrillo game with one small example story, **The Quince
Tree** (two puzzle links, one ending, fully painted). Copy it, rename it,
replace the story with yours.

**Prerequisites:** Node **≥ 23** (the offline tools run story TypeScript with
Node's native type-stripping — on Node 20/22 `npm run dev` works but
`npm run check` dies with `ERR_UNKNOWN_FILE_EXTENSION .ts`), and a system
**Chrome/Chromium** for `npm run drive` (browser verification).

## Inside the membrillo repo (the easy path)

```
cp -r games/_template games/mygame
# edit games/mygame/package.json: rename "@membrillo/template" → "@membrillo/mygame"
npm install                       # link the new workspace
npm run dev -w games/mygame       # play at the printed port
npm run check -w games/mygame     # validate + winnability check
```

## As a standalone repository

The `package.json` here depends on `"membrillo": "*"`, which resolves to the
local package **only inside the membrillo workspace**. Standalone, you must
replace that dependency *before* the first `npm install` — otherwise npm goes
to the registry and installs the wrong thing (or fails). Steps:

1. Clone the engine somewhere: `git clone https://github.com/septract/membrillo`.
2. Copy this directory out to its own folder.
3. Edit its `package.json`: point the dependency at your engine checkout —
   `"dependencies": { "membrillo": "file:../membrillo/packages/membrillo" }`.
4. `npm install && npm run dev` — that's the whole setup.

For CI (where a relative `file:` path won't exist), vendor a tarball: run
`npm pack` inside `membrillo/packages/membrillo`, commit the `.tgz`, and depend
on `"membrillo": "file:./membrillo-<version>.tgz"`. Once membrillo is published
to npm this becomes a normal versioned dependency.

The bundled `.github/workflows/deploy.yml` also needs a committed
`package-lock.json` (it uses `npm ci` with npm caching) — run `npm install`
once and commit the lockfile before pushing.

`.github/workflows/deploy.yml` deploys to GitHub Pages when this directory is
a repo root (it is inert inside the membrillo repo) — see its header comment.

## Writing your story

The full authoring reference is the engine's `GUIDE.md` — it ships with the
package, so standalone it's at `node_modules/membrillo/GUIDE.md` (in this repo,
`packages/membrillo/GUIDE.md`). It covers rules, scenes, dialogue, companions,
sequences, painters, portraits, audio, the design rules the tools enforce, and
browser verification. The loop:

```
$EDITOR stories/mystory/manifest.json ...
npm run check       # membrillo check --root ./stories: structure + winnability
```

A passing `check` means the tools explored every reachable state and found no
dead ends, all scenes reachable, every objective completable. The state space
is finite so the check is exhaustive (a complete check, not a formal proof) —
it stays that way as long as story logic is declarative (flags/items/
companions only).

The browser is the other half of verification — `check` covers the rules, not
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
