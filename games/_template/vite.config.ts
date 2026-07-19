import { gameConfig } from 'membrillo/vite';

// A Membrillo consumer: index.html boots src/main.ts, which hands the engine
// its story globs. Build settings live in the engine's shared config.
export default gameConfig();
