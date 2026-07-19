// Pure rules evaluation: conditions, first-match buckets, effect application.
// No DOM, no I/O — this module is imported unchanged by the browser engine and
// by the offline validator/fuzzer, so there is exactly one implementation of
// "what happens when the player does X".

import type { Condition, Rule, State } from './types.ts';

export function initialState(startScene: string): State {
  return { scene: startScene, flags: [], inventory: [], companions: [] };
}

const CONDITION_KINDS = ['flag', 'item', 'companion'] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

export interface ParsedCondition {
  negated: boolean;
  kind: ConditionKind;
  id: string;
}

// Condition strings are immutable authoring data but get checked constantly
// (per-frame visibility filtering, exhaustive fuzz expansion) — parse each
// distinct string once.
const parseCache = new Map<Condition, ParsedCondition>();

/** Throws on malformed conditions — the validator catches these offline. */
export function parseCondition(cond: Condition): ParsedCondition {
  const cached = parseCache.get(cond);
  if (cached) return cached;
  const negated = cond.startsWith('!');
  const body = negated ? cond.slice(1) : cond;
  const sep = body.indexOf(':');
  const kind = body.slice(0, sep) as ConditionKind;
  const id = body.slice(sep + 1);
  if (sep < 1 || id === '' || !CONDITION_KINDS.includes(kind)) {
    throw new Error(`Malformed condition "${cond}" (want [!]flag:x, [!]item:x or [!]companion:x)`);
  }
  const parsed: ParsedCondition = { negated, kind, id };
  parseCache.set(cond, parsed);
  return parsed;
}

export function checkCondition(state: State, cond: Condition): boolean {
  const { negated, kind, id } = parseCondition(cond);
  const pool =
    kind === 'flag' ? state.flags : kind === 'item' ? state.inventory : state.companions;
  const present = pool.includes(id);
  return negated ? !present : present;
}

export function checkAll(state: State, conds: Condition[] | undefined): boolean {
  return (conds ?? []).every((c) => checkCondition(state, c));
}

/** First rule in the bucket whose `requires` all pass, or undefined. */
export function firstMatch(state: State, bucket: Rule[] | undefined): Rule | undefined {
  return (bucket ?? []).find((rule) => checkAll(state, rule.requires));
}

function added(pool: string[], id: string): string[] {
  return pool.includes(id) ? pool : [...pool, id].sort();
}

function removed(pool: string[], id: string): string[] {
  return pool.filter((x) => x !== id);
}

/** What applying a rule produced, beyond the new state. */
export interface Outcome {
  state: State;
  text?: string;
  goto?: string;
  dialogue?: string;
  /** Who says `text` (presentation hint; default: the acting player). */
  speaker?: 'actor' | 'target';
  /** Scene sequence to play (effects → sequence → goto). */
  play?: string;
}

/** Apply a rule's effects immutably. `goto`/`dialogue` are reported, not applied. */
export function applyRule(state: State, rule: Rule): Outcome {
  let { flags, inventory, companions } = state;
  for (const f of rule.setFlags ?? []) flags = added(flags, f);
  for (const f of rule.clearFlags ?? []) flags = removed(flags, f);
  if (rule.giveItem !== undefined) inventory = added(inventory, rule.giveItem);
  if (rule.removeItem !== undefined) inventory = removed(inventory, rule.removeItem);
  if (rule.addCompanion !== undefined) companions = added(companions, rule.addCompanion);
  if (rule.removeCompanion !== undefined) companions = removed(companions, rule.removeCompanion);
  const outcome: Outcome = { state: { ...state, flags, inventory, companions } };
  if (rule.text !== undefined) outcome.text = rule.text;
  if (rule.goto !== undefined) outcome.goto = rule.goto;
  if (rule.dialogue !== undefined) outcome.dialogue = rule.dialogue;
  if (rule.speaker !== undefined) outcome.speaker = rule.speaker;
  if (rule.play !== undefined) outcome.play = rule.play;
  return outcome;
}

/** Canonical key for state-graph exploration (arrays are already sorted). */
export function stateKey(state: State): string {
  return JSON.stringify([state.scene, state.flags, state.inventory, state.companions]);
}
