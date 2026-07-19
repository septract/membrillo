// A Membrillo game is this file: import the engine, hand it your stories.
// The globs are the only place the story location is known — the engine
// derives everything else from the files themselves.

import 'membrillo/style.css';
import { boot } from 'membrillo';

boot({
  json: import.meta.glob('../stories/**/*.json', { eager: true, import: 'default' }),
  paints: import.meta.glob('../stories/*/paint/index.ts', { eager: true }),
});
