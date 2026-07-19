# Membrillo as a library — local-first plan

*2026-07-18. Answering Mike's question: what does library-ifying look like,
and is a LOCAL version (no npm publish) easy? Short answer: yes — the
distribution mechanics are trivial; the only real work is one seam inversion.*

## Why it's easy locally

npm has first-class local consumption; no registry involved:

- **Workspaces (recommended)**: make the repo a workspace root —
  `packages/membrillo` (engine + tools + a small CLI) and `games/<name>`
  consumers. `npm install` symlinks the package; games depend on
  `"membrillo": "*"`. Everything stays one repo, one lockfile, one CI.
- **`file:` dependency**: a game in a *separate* repo writes
  `"membrillo": "file:../membrillo"` — npm links it. Good for testing the
  "stranger's repo" experience without publishing.
- Consumed **as TypeScript source** (package `exports` pointing at `.ts`):
  Vite consumers bundle it directly and the node tools run on type-stripping
  — no build step, no dist, no publish artifacts. This works precisely
  because we kept zero runtime dependencies.

## The actual work (one seam + one CLI)

1. **Invert the story-loading seam.** Today `engine/loader.ts` globs
   `/stories/*` itself — that's the fork-shaped coupling. Replace with
   `boot(stories: LoadedStory[])`; the glob becomes a one-liner in the
   consumer's `main.ts` (template-provided). The engine stops knowing where
   stories live.
2. **CLI for the tools.** `membrillo validate|fuzz|drive [--root ./stories]`
   — `tools/load-story.ts` already takes a root parameter; this is mostly a
   `bin` entry and argv plumbing. The per-story driver kit moves into the
   package; game repos write their own driver modules against it.
3. **Move the five stories** into `games/classic` (or one game per package)
   — proving the inversion by consuming it ourselves.
4. **Template**: `games/_template` with one example story, vite config, the
   deploy workflow, and a driver module — cloning it is "npm create
   membrillo" without the registry.

## Deferred until actually publishing

Story-schema + save-format versioning (the JSON contract becomes public API
the moment strangers depend on it), semver discipline, npm provenance. None
of it blocks the local workspace version.

**Estimated effort**: one focused session. The inversion touches
`loader.ts`, `main.ts` boot, and the vite entry; the CLI is small; the moves
are mechanical. Biggest risk is path assumptions in the deploy workflow and
the browser-verify kit — both already parameterize their roots.
