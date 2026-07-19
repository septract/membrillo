// The player-facing verb layer: Look / Talk / Interact / Combine.
// Authors write `look`/`talk`/`use`/`take` buckets; the player only ever sees
// the four verbs, with Interact collapsing to `take` if the target defines it,
// else `use`. The fuzzer imports these same functions, so it exercises exactly
// the actions a player can perform.

import type {
  Character,
  Companion,
  Dialogue,
  DialogueNode,
  DialogueOption,
  Exit,
  Hotspot,
  Rule,
  Scene,
  SeqStep,
  State,
  Story,
  Target,
} from './types.ts';
import { applyRule, checkAll, counterBounds, firstMatch, type CounterBounds, type Outcome } from './rules.ts';

export type PlayerVerb = 'look' | 'talk' | 'interact';

export const DEFAULT_TEXT: Record<PlayerVerb | 'combine' | 'apply', string> = {
  look: 'Nothing unusual about it.',
  talk: 'No reply.',
  interact: "That doesn't seem to do anything.",
  combine: "Those don't go together.",
  apply: "That doesn't work.",
};

export function currentScene(story: Story, state: State): Scene {
  const scene = story.scenes[state.scene];
  if (!scene) throw new Error(`State references unknown scene "${state.scene}"`);
  return scene;
}

export function isCutscene(scene: Scene): boolean {
  return scene.beats !== undefined;
}

export function visibleHotspots(scene: Scene, state: State): Hotspot[] {
  return (scene.hotspots ?? []).filter((h) => checkAll(state, h.requires));
}

export function visibleCharacters(scene: Scene, state: State): Character[] {
  return (scene.characters ?? []).filter((c) => checkAll(state, c.requires));
}

export function visibleExits(scene: Scene, state: State): Exit[] {
  return (scene.exits ?? []).filter((e) => checkAll(state, e.requires));
}

/** Party members currently travelling with the player (scene-independent). */
export function partyCompanions(story: Story, state: State): Companion[] {
  return state.companions
    .map((id) => story.companions[id])
    .filter((c): c is Companion => c !== undefined);
}

function findTarget(story: Story, scene: Scene, state: State, targetId: string): Target | undefined {
  return (
    visibleHotspots(scene, state).find((h) => h.id === targetId) ??
    visibleCharacters(scene, state).find((c) => c.id === targetId) ??
    partyCompanions(story, state).find((c) => c.id === targetId)
  );
}

/** Which authored bucket Interact resolves to. Validator forbids defining both. */
export function interactBucket(target: Target): Rule[] | undefined {
  return target.take ?? target.use;
}

/** Verbs worth offering for a target (Look always is). */
export function availableVerbs(target: Target): PlayerVerb[] {
  const verbs: PlayerVerb[] = ['look'];
  if (target.talk !== undefined) verbs.push('talk');
  if (interactBucket(target) !== undefined) verbs.push('interact');
  return verbs;
}

/**
 * Perform a verb on a visible hotspot or character. Always yields an outcome
 * (default text when no rule matches) so every click gets a response.
 * Returns null only if the target is unknown or not currently visible.
 */
export function act(story: Story, state: State, targetId: string, verb: PlayerVerb): Outcome | null {
  const target = findTarget(story, currentScene(story, state), state, targetId);
  if (!target) return null;
  const bucket = verb === 'interact' ? interactBucket(target) : target[verb];
  const rule = firstMatch(state, bucket);
  if (!rule) return { state, text: DEFAULT_TEXT[verb] };
  return applyRule(state, rule, counterBounds(story.manifest.counters));
}

/**
 * Apply a held inventory item to a visible target — SCUMM's "Use X on Y" /
 * "Give X to Y". First itemUse rule matching the item whose requires pass
 * wins; a default rebuff otherwise, so experimenting always gets a response.
 * Returns null only for an unknown/invisible target.
 */
export function applyItem(
  story: Story,
  state: State,
  targetId: string,
  itemId: string,
): Outcome | null {
  const target = findTarget(story, currentScene(story, state), state, targetId);
  if (!target) return null;
  if (!state.inventory.includes(itemId)) return { state, text: DEFAULT_TEXT.apply };
  const rule = (target.itemUse ?? []).find(
    (r) => r.withItem === itemId && checkAll(state, r.requires),
  );
  if (!rule) return { state, text: DEFAULT_TEXT.apply };
  return applyRule(state, rule, counterBounds(story.manifest.counters));
}

/** Look at an inventory item. */
export function lookAtItem(story: Story, state: State, itemId: string): Outcome {
  const item = story.items[itemId];
  const rule = item ? firstMatch(state, item.look) : undefined;
  if (!rule) return { state, text: DEFAULT_TEXT.look };
  return applyRule(state, rule, counterBounds(story.manifest.counters));
}

/**
 * Combine two inventory items. Checks both items' combine lists, either
 * direction; consumes both components unless the rule says otherwise.
 */
export function combine(story: Story, state: State, itemA: string, itemB: string): Outcome {
  if (itemA === itemB || !state.inventory.includes(itemA) || !state.inventory.includes(itemB)) {
    return { state, text: DEFAULT_TEXT.combine };
  }
  for (const [self, other] of [
    [itemA, itemB],
    [itemB, itemA],
  ] as const) {
    for (const rule of story.items[self]?.combine ?? []) {
      if (rule.withItem !== other || !checkAll(state, rule.requires)) continue;
      let inventory = state.inventory;
      for (const gone of rule.removeItems ?? [self, other]) {
        inventory = inventory.filter((x) => x !== gone);
      }
      if (rule.giveItem !== undefined && !inventory.includes(rule.giveItem)) {
        inventory = [...inventory, rule.giveItem].sort();
      }
      let flags = state.flags;
      for (const f of rule.setFlags ?? []) {
        if (!flags.includes(f)) flags = [...flags, f].sort();
      }
      const outcome: Outcome = { state: { ...state, flags, inventory } };
      if (rule.text !== undefined) outcome.text = rule.text;
      return outcome;
    }
  }
  return { state, text: DEFAULT_TEXT.combine };
}

/**
 * Travel through a visible exit: applies the exit's `effects` (if any), then
 * moves to its destination. Returns null if the exit isn't usable.
 */
export function useExit(story: Story, state: State, exitId: string): Outcome | null {
  const exit = visibleExits(currentScene(story, state), state).find((e) => e.id === exitId);
  if (!exit) return null;
  const out = exit.effects
    ? applyRule(state, exit.effects, counterBounds(story.manifest.counters))
    : { state };
  return { ...out, state: { ...out.state, scene: exit.to } };
}

/** Move to a scene via a rule's `goto` (or a cutscene's `next`). */
export function enterScene(state: State, sceneId: string): State {
  return { ...state, scene: sceneId };
}

// --- Dialogue ---------------------------------------------------------------

export function dialogueNode(dialogue: Dialogue, nodeId: string): DialogueNode {
  const node = dialogue.nodes[nodeId];
  if (!node) throw new Error(`Dialogue "${dialogue.id}" has no node "${nodeId}"`);
  return node;
}

export function visibleOptions(state: State, node: DialogueNode): DialogueOption[] {
  return node.options.filter((o) => checkAll(state, o.requires));
}

export interface DialogueStep {
  state: State;
  /** Next node id, or "end" when the dialogue closes. */
  to: string;
}

export function chooseOption(state: State, option: DialogueOption, bounds: CounterBounds = {}): DialogueStep {
  const rule: Rule = {};
  if (option.setFlags !== undefined) rule.setFlags = option.setFlags;
  if (option.giveItem !== undefined) rule.giveItem = option.giveItem;
  if (option.addCompanion !== undefined) rule.addCompanion = option.addCompanion;
  if (option.addCounter !== undefined) rule.addCounter = option.addCounter;
  if (option.setCounter !== undefined) rule.setCounter = option.setCounter;
  return { state: applyRule(state, rule, bounds).state, to: option.to };
}

// --- Scripted sequences -----------------------------------------------------

/** The rule-shaped effect subset of one sequence step. */
export function stepRule(step: SeqStep): Rule {
  const rule: Rule = {};
  if (step.setFlags !== undefined) rule.setFlags = step.setFlags;
  if (step.clearFlags !== undefined) rule.clearFlags = step.clearFlags;
  if (step.giveItem !== undefined) rule.giveItem = step.giveItem;
  if (step.removeItem !== undefined) rule.removeItem = step.removeItem;
  if (step.addCompanion !== undefined) rule.addCompanion = step.addCompanion;
  if (step.removeCompanion !== undefined) rule.removeCompanion = step.removeCompanion;
  if (step.addCounter !== undefined) rule.addCounter = step.addCounter;
  if (step.setCounter !== undefined) rule.setCounter = step.setCounter;
  return rule;
}

/**
 * Apply the state effects of steps[from..] atomically. The fuzzer uses this
 * for whole sequences; the engine uses it when Esc-skipping a running one —
 * so a skipped sequence provably ends in the same state as a watched one.
 */
export function applySequenceEffects(state: State, steps: SeqStep[], from = 0, bounds: CounterBounds = {}): State {
  let s = state;
  for (const step of steps.slice(from)) s = applyRule(s, stepRule(step), bounds).state;
  return s;
}

/** The sequence a scene wants to play on entry (first matching trigger). */
export function enterSequenceId(scene: Scene, state: State): string | null {
  const trigger = (scene.enter ?? []).find((t) => checkAll(state, t.requires));
  return trigger?.play ?? null;
}
