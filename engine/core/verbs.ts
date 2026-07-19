// The player-facing verb layer: Look / Talk / Interact / Combine.
// Authors write `look`/`talk`/`use`/`take` buckets; the player only ever sees
// the four verbs, with Interact collapsing to `take` if the target defines it,
// else `use`. The fuzzer imports these same functions, so it exercises exactly
// the actions a player can perform.

import type {
  Character,
  Dialogue,
  DialogueNode,
  DialogueOption,
  Exit,
  Hotspot,
  Rule,
  Scene,
  State,
  Story,
  Target,
} from './types.ts';
import { applyRule, checkAll, firstMatch, type Outcome } from './rules.ts';

export type PlayerVerb = 'look' | 'talk' | 'interact';

export const DEFAULT_TEXT: Record<PlayerVerb | 'combine', string> = {
  look: 'Nothing unusual about it.',
  talk: 'No reply.',
  interact: "That doesn't seem to do anything.",
  combine: "Those don't go together.",
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

function findTarget(scene: Scene, state: State, targetId: string): Target | undefined {
  return (
    visibleHotspots(scene, state).find((h) => h.id === targetId) ??
    visibleCharacters(scene, state).find((c) => c.id === targetId)
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
  const target = findTarget(currentScene(story, state), state, targetId);
  if (!target) return null;
  const bucket = verb === 'interact' ? interactBucket(target) : target[verb];
  const rule = firstMatch(state, bucket);
  if (!rule) return { state, text: DEFAULT_TEXT[verb] };
  return applyRule(state, rule);
}

/** Look at an inventory item. */
export function lookAtItem(story: Story, state: State, itemId: string): Outcome {
  const item = story.items[itemId];
  const rule = item ? firstMatch(state, item.look) : undefined;
  if (!rule) return { state, text: DEFAULT_TEXT.look };
  return applyRule(state, rule);
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

/** Travel through a visible exit. Returns the new state, or null if not usable. */
export function useExit(story: Story, state: State, exitId: string): State | null {
  const exit = visibleExits(currentScene(story, state), state).find((e) => e.id === exitId);
  if (!exit) return null;
  return { ...state, scene: exit.to };
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

export function chooseOption(state: State, option: DialogueOption): DialogueStep {
  const rule: Rule = {};
  if (option.setFlags !== undefined) rule.setFlags = option.setFlags;
  if (option.giveItem !== undefined) rule.giveItem = option.giveItem;
  return { state: applyRule(state, rule).state, to: option.to };
}
