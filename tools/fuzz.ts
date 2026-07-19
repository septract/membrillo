// Exhaustive story playthrough. Explores every reachable (scene, flags,
// inventory, companions, dialogue-position) state by doing exactly what a
// player can do — via the same engine core the browser runs — and then proves:
//
//   1. an ending is reachable at all, and
//   2. NO reachable state is a dead end (from everywhere, an ending is still
//      reachable) — the LucasArts "no unwinnable states" rule, enforced.
//
// Usage: node tools/fuzz.ts [storyId ...]

import { initialState, stateKey } from '../engine/core/rules.ts';
import type { Scene, State, Story } from '../engine/core/types.ts';
import {
  act,
  applyItem,
  availableVerbs,
  chooseOption,
  combine,
  dialogueNode,
  enterScene,
  isCutscene,
  lookAtItem,
  useExit,
  visibleCharacters,
  visibleExits,
  visibleHotspots,
  visibleOptions,
} from '../engine/core/verbs.ts';
import { loadStoryFiles, storyIdsFromArgv } from './load-story.ts';

const MAX_STATES = 200_000;

interface Node {
  state: State;
  /** Open dialogue position, if any — while open, only options are actions. */
  dlg: { id: string; node: string } | null;
}

interface Edge {
  label: string;
  next: Node;
}

function keyOf(node: Node): string {
  return stateKey(node.state) + '|' + (node.dlg ? `${node.dlg.id}:${node.dlg.node}` : '');
}

function sceneOf(story: Story, state: State): Scene {
  const scene = story.scenes[state.scene];
  if (!scene) throw new Error(`unknown scene "${state.scene}"`);
  return scene;
}

/** Follow non-ending cutscenes to the room (or ending) they lead to. */
function settle(story: Story, state: State, seenScenes: Set<string>): State {
  let s = state;
  for (let hops = 0; ; hops++) {
    if (hops > 100) throw new Error(`cutscene chain loops at "${s.scene}"`);
    seenScenes.add(s.scene);
    const scene = sceneOf(story, s);
    if (scene.ending || !isCutscene(scene)) return s;
    s = enterScene(s, scene.next!);
  }
}

function expand(story: Story, node: Node, seenScenes: Set<string>): Edge[] {
  const edges: Edge[] = [];
  const scene = sceneOf(story, node.state);
  if (scene.ending) return edges; // success terminal

  if (node.dlg) {
    const dlg = story.dialogues[node.dlg.id]!;
    for (const option of visibleOptions(node.state, dialogueNode(dlg, node.dlg.node))) {
      const step = chooseOption(node.state, option);
      edges.push({
        label: `say "${option.text}"`,
        next: {
          state: step.state,
          dlg: step.to === 'end' ? null : { id: node.dlg.id, node: step.to },
        },
      });
    }
    return edges;
  }

  const outcomeNode = (outcome: { state: State; goto?: string; dialogue?: string }): Node => {
    let next: Node = { state: outcome.state, dlg: null };
    if (outcome.dialogue !== undefined) {
      const dlg = story.dialogues[outcome.dialogue];
      if (dlg) next = { ...next, dlg: { id: dlg.id, node: dlg.start } };
    }
    if (outcome.goto !== undefined) {
      next = { ...next, state: settle(story, enterScene(next.state, outcome.goto), seenScenes) };
    }
    return next;
  };

  const targets = [...visibleHotspots(scene, node.state), ...visibleCharacters(scene, node.state)];
  for (const target of targets) {
    for (const verb of availableVerbs(target)) {
      const outcome = act(story, node.state, target.id, verb);
      if (!outcome) continue;
      const next = outcomeNode(outcome);
      if (keyOf(next) !== keyOf(node)) edges.push({ label: `${verb} ${target.id}`, next });
    }
    // SCUMM's "Use X on Y": every held item against every target.
    for (const itemId of node.state.inventory) {
      const outcome = applyItem(story, node.state, target.id, itemId);
      if (!outcome) continue;
      const next = outcomeNode(outcome);
      if (keyOf(next) !== keyOf(node)) {
        edges.push({ label: `use ${itemId} on ${target.id}`, next });
      }
    }
  }
  for (const exit of visibleExits(scene, node.state)) {
    const state = useExit(story, node.state, exit.id);
    if (state) {
      edges.push({ label: `exit ${exit.id}`, next: { state: settle(story, state, seenScenes), dlg: null } });
    }
  }
  const inv = node.state.inventory;
  for (let i = 0; i < inv.length; i++) {
    for (let j = i + 1; j < inv.length; j++) {
      const outcome = combine(story, node.state, inv[i]!, inv[j]!);
      if (stateKey(outcome.state) !== stateKey(node.state)) {
        edges.push({ label: `combine ${inv[i]}+${inv[j]}`, next: { state: outcome.state, dlg: null } });
      }
    }
    const outcome = lookAtItem(story, node.state, inv[i]!);
    if (stateKey(outcome.state) !== stateKey(node.state)) {
      edges.push({ label: `look ${inv[i]}`, next: { state: outcome.state, dlg: null } });
    }
  }
  return edges;
}

interface FuzzResult {
  states: number;
  edges: number;
  endings: number;
  deadEnds: string[];
  unreachedScenes: string[];
}

function fuzzStory(story: Story): FuzzResult {
  const seenScenes = new Set<string>();
  const start: Node = {
    state: settle(story, initialState(story.manifest.start), seenScenes),
    dlg: null,
  };

  const nodes = new Map<string, Node>();
  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  const pred = new Map<string, { from: string; label: string }>();
  const queue: Node[] = [start];
  nodes.set(keyOf(start), start);
  let edgeCount = 0;

  while (queue.length > 0) {
    const node = queue.shift()!;
    const from = keyOf(node);
    const out: string[] = [];
    for (const edge of expand(story, node, seenScenes)) {
      const to = keyOf(edge.next);
      out.push(to);
      edgeCount++;
      (reverse.get(to) ?? reverse.set(to, []).get(to)!).push(from);
      if (!nodes.has(to)) {
        if (nodes.size >= MAX_STATES) throw new Error(`state explosion: > ${MAX_STATES} states`);
        nodes.set(to, edge.next);
        pred.set(to, { from, label: edge.label });
        queue.push(edge.next);
      }
    }
    forward.set(from, out);
  }

  // Success terminals, and reverse-reachability from them.
  const winning = new Set<string>();
  const rq: string[] = [];
  let endings = 0;
  for (const [key, node] of nodes) {
    if (sceneOf(story, node.state).ending) {
      endings++;
      winning.add(key);
      rq.push(key);
    }
  }
  while (rq.length > 0) {
    for (const from of reverse.get(rq.shift()!) ?? []) {
      if (!winning.has(from)) {
        winning.add(from);
        rq.push(from);
      }
    }
  }

  const deadEnds: string[] = [];
  for (const [key, node] of nodes) {
    if (!winning.has(key)) {
      deadEnds.push(describe(node, pathTo(key, pred)));
      if (deadEnds.length >= 3) break;
    }
  }

  const unreachedScenes = Object.keys(story.scenes).filter((s) => !seenScenes.has(s));
  return { states: nodes.size, edges: edgeCount, endings, deadEnds, unreachedScenes };
}

function pathTo(key: string, pred: Map<string, { from: string; label: string }>): string[] {
  const labels: string[] = [];
  for (let k = key; pred.has(k); k = pred.get(k)!.from) labels.unshift(pred.get(k)!.label);
  return labels;
}

function describe(node: Node, path: string[]): string {
  const s = node.state;
  return (
    `scene=${s.scene} flags=[${s.flags}] inv=[${s.inventory}]` +
    (node.dlg ? ` dlg=${node.dlg.id}:${node.dlg.node}` : '') +
    `\n      via: ${path.join(' → ') || '(start)'}`
  );
}

// --- CLI --------------------------------------------------------------------

let failed = false;
for (const id of storyIdsFromArgv(process.argv.slice(2))) {
  try {
    const { story } = loadStoryFiles(id);
    const res = fuzzStory(story);
    const problems: string[] = [];
    if (res.endings === 0) problems.push('no ending is reachable');
    for (const d of res.deadEnds) problems.push(`DEAD END: ${d}`);
    for (const s of res.unreachedScenes) problems.push(`scene "${s}" is unreachable`);
    if (problems.length > 0) {
      failed = true;
      for (const p of problems) console.error(`  ✗ ${id}: ${p}`);
      console.error(`✗ ${id}: ${res.states} states, ${res.edges} edges — FAILED`);
    } else {
      console.log(
        `✓ ${id}: ${res.states} states, ${res.edges} edges, ${res.endings} ending state(s), no dead ends`,
      );
    }
  } catch (err) {
    console.error(`✗ ${id}: ${(err as Error).message}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
