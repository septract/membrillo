import { defineConfig } from 'vite';

// Everything is served from the repo root: index.html boots engine/main.ts,
// and stories are pulled in via import.meta.glob (JSON logic + paint modules),
// so dev and build see exactly the same content with no copy step.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { outDir: 'dist', target: 'es2022' },
  server: { open: false },
});
