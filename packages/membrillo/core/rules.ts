// Pure rules evaluation: conditions, first-match buckets, effect application.
// No DOM, no I/O — this module is imported unchanged by the browser engine and
// by the offline validator/fuzzer, so there is exactly one implementation of
// "what happens when the player does X".

import type { Condition, CounterDecl, Rule, State } from './types.ts';

/** Per-counter [min,max] range, derived from a manifest's counter declarations. */
export type CounterBounds = Record<string, { min: number; max: number }>;

export function counterBounds(decls: Record<string, CounterDecl> | undefined): CounterBounds {
  const out: CounterBounds = {};
  for (const [name, d] of Object.entries(decls ?? {})) out[name] = { min: d.min, max: d.max };
  return out;
}

/** Seed counter values from their declared starts (clamped to range). */
export function initialCounters(decls: Record<string, CounterDecl> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, d] of Object.entries(decls ?? {})) out[name] = clamp(d.start, d.min, d.max);
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function initialState(startScene: string, counters: Record<string, number> = {}): State {
  return { scene: startScene, flags: [], inventory: [], companions: [], counters };
}

const CONDITION_KINDS = ['flag', 'item', 'companion'] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];
export type CounterOp = '>=' | '<=' | '==' | '!=' | '>' | '<';

export type ParsedCondition =
  | { negated: boolean; kind: ConditionKind; id: string }
  | { negated: boolean; kind: 'counter'; id: string; op: CounterOp; value: number };

// Condition strings are immutable authoring data but get checked constantly
// (per-frame visibility filtering, exhaustive fuzz expansion) — parse each
// distinct string once.
const parseCache = new Map<Condition, ParsedCondition>();
const COUNTER_RE = /^counter:([A-Za-z_][A-Za-z0-9_]*)(>=|<=|==|!=|>|<)(-?\d+)$/;

/** Throws on malformed conditions — the validator catches these offline. */
export function parseCondition(cond: Condition): ParsedCondition {
  const cached = parseCache.get(cond);
  if (cached) return cached;
  const negated = cond.startsWith('!');
  const body = negated ? cond.slice(1) : cond;
  let parsed: ParsedCondition;
  if (body.startsWith('counter:')) {
    const m = COUNTER_RE.exec(body);
    if (!m) throw new Error(`Malformed counter condition "${cond}" (want counter:name>=N)`);
    parsed = { negated, kind: 'counter', id: m[1]!, op: m[2] as CounterOp, value: Number(m[3]) };
  } else {
    const sep = body.indexOf(':');
    const kind = body.slice(0, sep) as ConditionKind;
    const id = body.slice(sep + 1);
    if (sep < 1 || id === '' || !CONDITION_KINDS.includes(kind)) {
      throw new Error(
        `Malformed condition "${cond}" (want [!]flag:x, [!]item:x, [!]companion:x or counter:x>=N)`,
      );
    }
    parsed = { negated, kind, id };
  }
  parseCache.set(cond, parsed);
  return parsed;
}

function compareCounter(v: number, op: CounterOp, n: number): boolean {
  switch (op) {
    case '>=': return v >= n;
    case '<=': return v <= n;
    case '==': return v === n;
    case '!=': return v !== n;
    case '>': return v > n;
    case '<': return v < n;
  }
}

export function checkCondition(state: State, cond: Condition): boolean {
  const p = parseCondition(cond);
  if (p.kind === 'counter') {
    const hit = compareCounter(state.counters[p.id] ?? 0, p.op, p.value);
    return p.negated ? !hit : hit;
  }
  const pool =
    p.kind === 'flag' ? state.flags : p.kind === 'item' ? state.inventory : state.companions;
  const present = pool.includes(p.id);
  return p.negated ? !present : present;
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

/**
 * Apply a rule's effects immutably. `goto`/`dialogue` are reported, not
 * applied. Counter effects clamp to `bounds` (the manifest's declared ranges),
 * which keeps the state space finite — pass bounds whenever a story has
 * counters; omit for counter-free stories.
 */
export function applyRule(state: State, rule: Rule, bounds: CounterBounds = {}): Outcome {
  let { flags, inventory, companions } = state;
  for (const f of rule.setFlags ?? []) flags = added(flags, f);
  for (const f of rule.clearFlags ?? []) flags = removed(flags, f);
  if (rule.giveItem !== undefined) inventory = added(inventory, rule.giveItem);
  if (rule.removeItem !== undefined) inventory = removed(inventory, rule.removeItem);
  if (rule.addCompanion !== undefined) companions = added(companions, rule.addCompanion);
  if (rule.removeCompanion !== undefined) companions = removed(companions, rule.removeCompanion);
  let counters = state.counters;
  const setCounter = (name: string, v: number): void => {
    const b = bounds[name];
    counters = { ...counters, [name]: b ? clamp(v, b.min, b.max) : v };
  };
  for (const [name, delta] of Object.entries(rule.addCounter ?? {})) {
    setCounter(name, (counters[name] ?? 0) + delta);
  }
  for (const [name, value] of Object.entries(rule.setCounter ?? {})) setCounter(name, value);
  const outcome: Outcome = { state: { ...state, flags, inventory, companions, counters } };
  if (rule.text !== undefined) outcome.text = rule.text;
  if (rule.goto !== undefined) outcome.goto = rule.goto;
  if (rule.dialogue !== undefined) outcome.dialogue = rule.dialogue;
  if (rule.speaker !== undefined) outcome.speaker = rule.speaker;
  if (rule.play !== undefined) outcome.play = rule.play;
  return outcome;
}

/** Canonical key for state-graph exploration (arrays are already sorted). */
export function stateKey(state: State): string {
  // Counters are keyed sorted so equal maps hash identically.
  const counters = Object.entries(state.counters).sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify([state.scene, state.flags, state.inventory, state.companions, counters]);
}
