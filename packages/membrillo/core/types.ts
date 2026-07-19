// Story data model. Everything here is plain data loaded from a story's JSON
// files — no story ever provides code except scene/sprite painters, which are
// referenced from this data by name only.

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }

/** Engine default render resolution (single source — tools import this too). */
export const DEFAULT_VIEW: Size = { w: 320, h: 180 };

/** 4-way facing (the sprite layer aliases this as its Facing). */
export type Direction = 'left' | 'right' | 'up' | 'down';

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
  /**
   * Who says `text`: the acting player (default) or the target itself —
   * use "target" for in-character NPC replies authored on that character.
   */
  speaker?: 'actor' | 'target';
  /**
   * Scripted sequence (from the current scene's `sequences`) to play after
   * this rule's effects; any `goto` runs after the sequence finishes.
   */
  play?: string;
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
  /**
   * What a plain (Interact-armed) click does, overriding the kind default —
   * e.g. a sleeping creature you'd examine, not prod.
   */
  defaultVerb?: 'look' | 'talk' | 'interact';
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
  /**
   * Portrait painter name (the paint module's `portraits` export): a large
   * 9:16 close-up shown beside the options while this character's dialogue
   * tree is open. Absent: dialogue renders exactly as without portraits.
   */
  portrait?: string;
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
  /** Look-verb description (plain text — looking at an exit never travels). */
  look?: string;
  /**
   * Effects applied on travel (text/flags/items) — `goto`, `dialogue` and
   * `play` are not allowed here (validator enforces); `to` is the destination.
   */
  effects?: Rule;
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
  /** Horizontal anchor, used by the paint-less placeholder; painters position themselves. */
  x?: number;
}

/**
 * One step of an in-room scripted sequence. Presentation directives (say/
 * walkTo/face/wait) play out live; effect fields apply to game state exactly
 * as rule effects do — the fuzzer applies a sequence's effects atomically, so
 * skipping a sequence (Esc) and watching it must end in the same state.
 */
export interface SeqStep {
  /** Speaker/mover: "actor" (default), a scene character id, or a companion id. */
  who?: string;
  say?: string;
  /**
   * Show the speaker's dialogue portrait (if they have one) as a VN-style
   * close-up for this line, dimming the scene — a scripted character beat.
   * Use for wordless moments a floating "..." would hide (a henchman's
   * silence). The line captions under a name tag; a letter-free line
   * (e.g. "...") leaves the mouth closed.
   */
  portrait?: boolean;
  /** Actor only: walk to this point before continuing. */
  walkTo?: Point;
  face?: Direction;
  /** Pause in seconds. */
  wait?: number;
  setFlags?: string[];
  clearFlags?: string[];
  giveItem?: string;
  removeItem?: string;
  addCompanion?: string;
  removeCompanion?: string;
}

/** Entry trigger: first entry whose `requires` pass plays its sequence. */
export interface EnterTrigger {
  requires?: Condition[];
  play: string;
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
  /** World size of this scene; defaults to the story's view. May exceed it. */
  size?: Size;
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
  /** Named in-room scripted sequences, referenced by Rule.play / enter. */
  sequences?: Record<string, SeqStep[]>;
  /** Played on scene entry (first matching trigger). Gate one-time intros on a flag the sequence sets. */
  enter?: EnterTrigger[];
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
  addCompanion?: string;
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

/**
 * A party member: rendered as a follower trailing the actor while in
 * `state.companions`, and targetable with the same verb surface as scene
 * characters (in any scene — companions travel with the player).
 */
export interface Companion extends Target {
  /** Sprite painter name from the story's paint module; box placeholder if absent. */
  paint?: string;
  /** Speech colour, [r,g,b]; default white. */
  color?: [number, number, number];
  /** Portrait painter name for dialogue trees (see Character.portrait). */
  portrait?: string;
}

/**
 * A goal-log entry, derived LIVE from state (never separately stored):
 * visible while `active` passes (default always), ticked once `done` passes.
 */
export interface Objective {
  id: string;
  text: string;
  active?: Condition[];
  done?: Condition[];
}

/** Music theme, as data: the engine's synth interprets it. */
export interface AudioTheme {
  bpm: number;
  /** Chord loop, e.g. ["Am", "F", "C", "G"] ("m" suffix = minor). */
  prog: string[];
  /** MIDI notes melodies pick from. */
  scale: number[];
  /** 'pluck' (melodic) or 'drone' (sustained fifths). */
  style?: 'pluck' | 'drone';
  gain?: number;
}

export interface AudioConfig {
  themes: Record<string, AudioTheme>;
  /** Scene id → theme name; scenes not listed are silent. */
  sceneTheme: Record<string, string>;
}

export interface Manifest {
  id: string;
  title: string;
  /** One-line blurb for the story menu (what the game is, spoiler-free). */
  description?: string;
  /**
   * Menu grouping: 'story' is a real game (default), 'demo' is an
   * engine-honesty fixture shown under a separate, collapsed section.
   */
  category?: 'story' | 'demo';
  /** Scene the story opens on. */
  start: string;
  /**
   * Render resolution — the window the player sees through, and the default
   * scene size. Engine default: 320×180. Scenes larger than the view scroll
   * under a following camera.
   */
  view?: Size;
  /**
   * Sprite painter name for the player actor (the story's paint module must
   * export it under `sprites`). Omitted: the engine's default actor.
   */
  actor?: string;
  /**
   * Portrait painter name for the hero (`portraits` export): under VN
   * dialogue staging the hero stands stage left, listening, whenever the
   * interlocutor has a portrait. Omitted: only the interlocutor appears.
   */
  actorPortrait?: string;
  /** Optional music/SFX config; stories without it are silent. */
  audio?: AudioConfig;
}

export interface Story {
  manifest: Manifest;
  scenes: Record<string, Scene>;
  items: Record<string, Item>;
  dialogues: Record<string, Dialogue>;
  /** Optional party members (companions.json). */
  companions: Record<string, Companion>;
  /** Optional goal log (objectives.json). */
  objectives: Objective[];
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
