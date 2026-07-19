// Shared Vite config for Membrillo games — the one place the build settings
// live. Games' vite.config.ts is two lines: import gameConfig, export it.
// Dev-time only: vite is the consumer's dependency (they run it), not a
// runtime dependency of the engine.

import type { Plugin, UserConfig } from 'vite';

/**
 * A strict Content-Security-Policy injected into the built index.html (build
 * only — dev uses Vite HMR, which needs inline scripts). Everything a Membrillo
 * game loads is same-origin and bundled: the JS, the CSS, the fonts, the
 * images. `data:` is only for the inline SVG favicon. No external hosts, no
 * inline script, no eval — so even a deployed game that renders a stranger's
 * story JSON can't be turned into a script-injection vector. (Clickjacking
 * protection — frame-ancestors / X-Frame-Options — is omitted because it's
 * ignored in a <meta> tag and needs an HTTP header the static host must set;
 * see SECURITY.md.)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'membrillo-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

/**
 * Pixel-game build defaults plus BASE_PATH subpath support for GitHub Pages
 * (`BASE_PATH=/repo/ npm run build`; dev stays at `/`). Overrides are merged
 * shallowly on top for games that need plugins or extra options; the CSP
 * plugin is prepended to any `plugins` the caller passes.
 */
export function gameConfig(overrides: UserConfig = {}): UserConfig {
  return {
    base: process.env.BASE_PATH ?? '/',
    build: { outDir: 'dist', target: 'es2022' },
    server: { open: false },
    ...overrides,
    plugins: [cspPlugin(), ...(overrides.plugins ?? [])],
  };
}
