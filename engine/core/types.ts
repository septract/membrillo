// Story data model. Everything here is plain data loaded from a story's JSON
// files — no story ever provides code except scene/sprite painters, which are
// referenced from this data by name only.

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

/** "flag:torch_lit" | "item:rope" | "companion:ada", optionally "!"-negated. */
export type Condition = string;

/**
 * One entry in a rule bucket. Buckets are ordered: the first rule whose
 * `requires` all pass wins. A rule with no `requires` always matches, so it
 * acts as the bucket's fallback and should come last.
 */
export interface Rule {
  requires?: Condition[];
  text?: string;
  setFlags?: string[];
  clearFlags?: string[];
  giveItem?: string;
  removeItem?: string;
  addCompanion?: string;
  removeCompanion?: string;
  /** Scene to move to after this rule's effects apply. */
  goto?: string;
  /** Dialogue tree to open (meaningful in `talk` buckets only). */
  dialogue?: string;
}

/**
 * "Use/give <item> on/to this target": first rule whose `withItem` matches the
 * item the player applied AND whose `requires` pass wins. This is the player-
 * chosen counterpart to a bare Interact — the SCUMM "Use X on Y".
 */
export interface ItemUseRule extends Rule {
  withItem: string;
}

/** Shared rule surface of hotspots and characters. */
export interface Target {
  id: string;
  name: string;
  /** Visibility gate: target exists only while these pass. */
  requires?: Condition[];
  look?: Rule[];
  talk?: Rule[];
  /** A target may define `use` or `take`, never both (validator enforces). */
  use?: Rule[];
  take?: Rule[];
  itemUse?: ItemUseRule[];
}

export interface Hotspot extends Target {
  region: Box;
  /** Where the actor walks before the action runs; defaults to region centre. */
  walkTo?: Point;
}

export interface Character extends Target {
  /** Feet anchor where the sprite stands. */
  pos: Point;
  walkTo?: Point;
  /** Sprite painter name from the story's paint module; box placeholder if absent. */
  paint?: string;
  facing?: 'left' | 'right';
  /** Speech colour over the head, [r,g,b]; default white. */
  color?: [number, number, number];
}

export interface Exit {
  id: string;
  name: string;
  region: Box;
  walkTo?: Point;
  to: string;
  /** Spawn point in the destination scene; defaults to that scene's `start`. */
  entry?: Point;
  /** Visibility gate. For a locked-door message, pair a gated exit with a hotspot. */
  requires?: Condition[];
}

/**
 * Perspective: sprite scale as a linear function of feet-y, clamped outside
 * the far..near range. SCUMM-style "scale is a property of the ground".
 */
export interface Depth {
  far: { y: number; scale: number };
  near: { y: number; scale: number };
}

/**
 * A foreground/midground occluder: a painter drawn in the body pass at
 * baseline `y`. Actors with feet above it (behind) are drawn under it;
 * actors below it (in front) draw over it.
 */
export interface Prop {
  id: string;
  /** Painter name from the story's paint module's `props` record. */
  paint: string;
  y: number;
}

/**
 * A scene is either a room (walk/start/hotspots/characters/exits) or a
 * cutscene (`beats` + `next`, or `beats` + `ending`). The validator enforces
 * that exactly one shape is used.
 */
export interface Scene {
  id: string;
  name: string;
  /** Scene painter name from the story's paint module; flat placeholder if absent. */
  paint?: string;
  /**
   * Walkable ground: one rect or several. Overlapping/touching rects are
   * connected; the actor paths through their shared edges (engine/walk.ts).
   */
  walk?: Box | Box[];
  start?: Point;
  depth?: Depth;
  props?: Prop[];
  hotspots?: Hotspot[];
  characters?: Character[];
  exits?: Exit[];
  beats?: string[];
  next?: string;
  /** Terminal scene: reaching it ends the story (fuzzer's success criterion). */
  ending?: boolean;
}

export interface CombineRule {
  withItem: string;
  requires?: Condition[];
  text?: string;
  giveItem?: string;
  /** Items consumed; defaults to both components. */
  removeItems?: string[];
  setFlags?: string[];
}

export interface Item {
  id: string;
  name: string;
  look?: Rule[];
  combine?: CombineRule[];
}

export interface DialogueOption {
  text: string;
  /** Next node id, or "end" to close the dialogue. */
  to: string;
  requires?: Condition[];
  setFlags?: string[];
  giveItem?: string;
}

export interface DialogueNode {
  line: string;
  options: DialogueOption[];
}

export interface Dialogue {
  id: string;
  start: string;
  nodes: Record<string, DialogueNode>;
}

export interface Manifest {
  id: string;
  title: string;
  /** Scene the story opens on. */
  start: string;
}

export interface Story {
  manifest: Manifest;
  scenes: Record<string, Scene>;
  items: Record<string, Item>;
  dialogues: Record<string, Dialogue>;
}

/**
 * Complete player progress. Everything the UI shows derives live from this —
 * nothing is ever separately stored as "done". Arrays are kept sorted+unique
 * so states can be compared/hashed structurally.
 */
export interface State {
  scene: string;
  flags: string[];
  inventory: string[];
  companions: string[];
}
