// Membrillo's public surface. A game is a Vite project that imports boot()
// and hands it the story files it bundled — the engine never assumes where
// stories live (see docs/2026-07-18-library-plan.md for the seam design).

export { boot } from './main.ts';
export type { StorySources, LoadedStory } from './loader.ts';
export type {
  AudioConfig,
  AudioTheme,
  Companion,
  Character,
  Dialogue,
  Exit,
  Hotspot,
  Item,
  Manifest,
  Objective,
  Rule,
  Scene,
  SeqStep,
  State,
  Story,
} from './core/types.ts';
export type { PaintModule, ScenePainter } from './loader.ts';
export type { SpritePainter, PortraitPainter, Pose, Facing } from './art/sprites.ts';
export { PORTRAIT } from './art/sprites.ts';
