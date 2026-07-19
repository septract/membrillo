// Shared Vite config for Membrillo games — the one place the build settings
// live. Games' vite.config.ts is two lines: import gameConfig, export it.
// Dev-time only: vite is the consumer's dependency (they run it), not a
// runtime dependency of the engine.

import type { UserConfig } from 'vite';

/**
 * Pixel-game build defaults plus BASE_PATH subpath support for GitHub Pages
 * (`BASE_PATH=/repo/ npm run build`; dev stays at `/`). Overrides are merged
 * shallowly on top for games that need plugins or extra options.
 */
export function gameConfig(overrides: UserConfig = {}): UserConfig {
  return {
    base: process.env.BASE_PATH ?? '/',
    build: { outDir: 'dist', target: 'es2022' },
    server: { open: false },
    ...overrides,
  };
}
