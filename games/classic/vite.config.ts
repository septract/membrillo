import { defineConfig } from 'vite';

// The classic games: a Membrillo consumer. index.html boots src/main.ts,
// which imports the membrillo workspace package (TS source, no build step)
// and hands it the stories/ globs. BASE_PATH supports GitHub Pages subpaths.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { outDir: 'dist', target: 'es2022' },
  server: { open: false },
});
