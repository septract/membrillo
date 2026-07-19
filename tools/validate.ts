// Structural + cross-reference validation for every story (or the ids passed
// as arguments). Anything that would make the game misbehave is an error;
// style-level suspicions are warnings. Exit code 1 on any error.
//
// Imports the engine core's own condition parser, so "valid" here means valid
// to the exact code that will run in the browser.

import { parseCondition } from '../engine/core/rules.ts';
import { isCutscene } from '../engine/core/verbs.ts';
import { DEFAULT_VIEW, type Box, type Point, type Rule, type Scene, type Target } from '../engine/core/types.ts';
import { boxesConnected, boxIndexAt, inBox, walkBoxes } from '../engine/walk.ts';
import { loadStoryFiles, storyIdsFromArgv, type StoryFiles } from './load-story.ts';

class Report {
  errors: string[] = [];
  warnings: string[] = [];

  error(msg: string): void {
    this.errors.push(msg);
  }

  warn(msg: string): void {
    this.warnings.push(msg);
  }
}

function isRoom(scene: Scene): boolean {
  return !isCutscene(scene);
}

interface ItemUsage {
  sources: Set<string>;
  sinks: Set<string>;
}

function validateStory(files: StoryFiles): Report {
  const r = new Report();
  const { story, id } = files;
  const { manifest, scenes, items, dialogues } = story;

  if (manifest.id !== id) r.error(`manifest.json: id "${manifest.id}" != directory "${id}"`);
  if (!manifest.title) r.error('manifest.json: missing title');
  if (!scenes[manifest.start]) r.error(`manifest.json: start scene "${manifest.start}" not found`);
  const view = manifest.view ?? DEFAULT_VIEW;
  if (view.w <= 0 || view.h <= 0) r.error('manifest.json: view dimensions must be positive');

  const usage: ItemUsage = { sources: new Set(), sinks: new Set() };

  const checkConds = (where: string, conds: string[] | undefined): void => {
    for (const cond of conds ?? []) {
      try {
        const parsed = parseCondition(cond);
        if (parsed.kind === 'item') {
          usage.sinks.add(parsed.id);
          if (!items[parsed.id]) r.error(`${where}: condition "${cond}" names unknown item`);
        }
      } catch (err) {
        r.error(`${where}: ${(err as Error).message}`);
      }
    }
  };

  const checkRule = (where: string, rule: Rule, opts: { talk: boolean; effectsOnly?: boolean }): void => {
    checkConds(where, rule.requires);
    if (rule.giveItem !== undefined) {
      usage.sources.add(rule.giveItem);
      if (!items[rule.giveItem]) r.error(`${where}: giveItem "${rule.giveItem}" unknown`);
    }
    if (rule.removeItem !== undefined) {
      usage.sinks.add(rule.removeItem);
      if (!items[rule.removeItem]) r.error(`${where}: removeItem "${rule.removeItem}" unknown`);
    }
    if (rule.goto !== undefined) {
      if (!scenes[rule.goto]) r.error(`${where}: goto "${rule.goto}" names unknown scene`);
      if (opts.effectsOnly) r.error(`${where}: goto is not allowed here`);
    }
    if (rule.dialogue !== undefined) {
      if (!opts.talk) r.error(`${where}: dialogue "${rule.dialogue}" outside a talk bucket`);
      else if (!dialogues[rule.dialogue]) r.error(`${where}: unknown dialogue "${rule.dialogue}"`);
    }
  };

  const checkTarget = (where: string, target: Target): void => {
    checkConds(where, target.requires);
    if (target.use !== undefined && target.take !== undefined) {
      r.error(`${where}: defines both "use" and "take" — Interact must resolve to exactly one`);
    }
    for (const [bucket, rules] of Object.entries({
      look: target.look,
      talk: target.talk,
      use: target.use,
      take: target.take,
    })) {
      (rules ?? []).forEach((rule, i) =>
        checkRule(`${where}.${bucket}[${i}]`, rule, { talk: bucket === 'talk' }),
      );
    }
    (target.itemUse ?? []).forEach((rule, i) => {
      const w = `${where}.itemUse[${i}]`;
      if (!items[rule.withItem]) r.error(`${w}: withItem "${rule.withItem}" unknown`);
      usage.sinks.add(rule.withItem);
      checkRule(w, rule, { talk: false });
    });
  };

  const dupCheck = (where: string, ids: string[]): void => {
    const seen = new Set<string>();
    for (const x of ids) {
      if (seen.has(x)) r.error(`${where}: duplicate id "${x}" — later definitions silently overwrite earlier ones`);
      seen.add(x);
    }
  };

  // Duplicates must be checked against ids AS AUTHORED: the loader collapses
  // into id-keyed maps, where a duplicate silently replaces its predecessor.
  dupCheck('scenes/', files.rawIds.scenes);
  dupCheck('items.json', files.rawIds.items);
  dupCheck('dialogue/', files.rawIds.dialogues);

  // --- Scenes ---------------------------------------------------------------
  let endings = 0;
  for (const [sceneId, scene] of Object.entries(scenes)) {
    const file = files.sceneFiles[sceneId] ?? '?';
    const where = `scenes/${file}`;
    if (file !== `${sceneId}.json`) r.warn(`${where}: scene id "${sceneId}" != filename`);
    if (scene.ending) endings++;

    if (!isRoom(scene)) {
      if ((scene.beats ?? []).length === 0) r.error(`${where}: cutscene with empty beats`);
      if (scene.next !== undefined && scene.ending) r.error(`${where}: has both next and ending`);
      if (scene.next === undefined && !scene.ending) r.error(`${where}: cutscene needs next or ending`);
      if (scene.next !== undefined && !scenes[scene.next]) r.error(`${where}: next "${scene.next}" unknown`);
      if (scene.hotspots || scene.characters || scene.exits || scene.walk) {
        r.error(`${where}: cutscene may not also have room fields`);
      }
      continue;
    }

    const size = scene.size ?? view;
    if (scene.size && (scene.size.w < view.w || scene.size.h < view.h)) {
      r.error(`${where}: scene size ${scene.size.w}x${scene.size.h} smaller than the ${view.w}x${view.h} view`);
    }
    const boxes = walkBoxes(scene);
    if (boxes.length === 0 || !scene.start) {
      r.error(`${where}: room scene needs walk and start`);
      continue;
    }
    if (boxIndexAt(scene.start, boxes) === -1) r.error(`${where}: start is outside every walk box`);
    for (const b of boxes) {
      if (b.x < 0 || b.y < 0 || b.x + b.w > size.w || b.y + b.h > size.h) {
        r.error(`${where}: a walk box leaves the ${size.w}x${size.h} scene`);
      }
    }
    if (!boxesConnected(boxes)) {
      r.error(`${where}: walk boxes are not all connected — the actor can be stranded`);
    }
    const depth = scene.depth;
    if (depth) {
      if (depth.far.scale <= 0 || depth.near.scale <= 0) r.error(`${where}: depth scales must be > 0`);
      if (depth.far.y === depth.near.y) r.error(`${where}: depth far.y and near.y must differ`);
    }
    for (const prop of scene.props ?? []) {
      if (prop.y < 0 || prop.y > size.h) r.error(`${where}#${prop.id}: prop y outside the scene`);
      if (prop.x !== undefined && (prop.x < 0 || prop.x > size.w)) {
        r.error(`${where}#${prop.id}: prop x outside the scene`);
      }
      checkPaintRef(r, files, `${where}#${prop.id}`, prop.paint);
    }

    dupCheck(where, [
      ...(scene.hotspots ?? []).map((h) => h.id),
      ...(scene.characters ?? []).map((c) => c.id),
      ...(scene.exits ?? []).map((e) => e.id),
    ]);

    const checkRegion = (w: string, b: Box): void => {
      if (b.x < 0 || b.y < 0 || b.x + b.w > size.w || b.y + b.h > size.h) {
        r.error(`${w}: region leaves the ${size.w}x${size.h} scene`);
      }
    };
    const checkWalkTo = (w: string, p: Point | undefined): void => {
      if (p && boxIndexAt(p, boxes) === -1) r.error(`${w}: walkTo is outside every walk box`);
    };

    for (const h of scene.hotspots ?? []) {
      const w = `${where}#${h.id}`;
      checkTarget(w, h);
      checkRegion(w, h.region);
      checkWalkTo(w, h.walkTo);
    }
    for (const c of scene.characters ?? []) {
      const w = `${where}#${c.id}`;
      checkTarget(w, c);
      checkWalkTo(w, c.walkTo);
      if (!inBox(c.pos, { x: 0, y: 0, w: size.w, h: size.h })) r.error(`${w}: pos outside the scene`);
      if (c.paint !== undefined) checkPaintRef(r, files, w, c.paint);
    }
    for (const e of scene.exits ?? []) {
      const w = `${where}#${e.id}`;
      checkConds(w, e.requires);
      checkRegion(w, e.region);
      checkWalkTo(w, e.walkTo);
      const dest = scenes[e.to];
      if (!dest) {
        r.error(`${w}: exit to unknown scene "${e.to}"`);
      } else if (isRoom(dest)) {
        // The kit's hardest-won lesson: the spawn point must be sane ground
        // in the DESTINATION, or the player teleports oddly.
        const destBoxes = walkBoxes(dest);
        const entry = e.entry ?? dest.start;
        if (entry && destBoxes.length > 0 && boxIndexAt(entry, destBoxes) === -1) {
          r.error(`${w}: entry (${entry.x},${entry.y}) outside every walk box of "${e.to}"`);
        }
      }
    }
    if (scene.paint !== undefined) checkPaintRef(r, files, where, scene.paint);
  }
  if (endings === 0) r.error('story has no ending scene');

  // --- Items ----------------------------------------------------------------
  for (const item of Object.values(items)) {
    const where = `items.json#${item.id}`;
    (item.look ?? []).forEach((rule, i) =>
      checkRule(`${where}.look[${i}]`, rule, { talk: false, effectsOnly: true }),
    );
    for (const c of item.combine ?? []) {
      usage.sinks.add(item.id);
      usage.sinks.add(c.withItem);
      if (!items[c.withItem]) r.error(`${where}: combine withItem "${c.withItem}" unknown`);
      checkConds(`${where}.combine`, c.requires);
      if (c.giveItem !== undefined) {
        usage.sources.add(c.giveItem);
        if (!items[c.giveItem]) r.error(`${where}: combine giveItem "${c.giveItem}" unknown`);
      }
      for (const gone of c.removeItems ?? []) {
        if (!items[gone]) r.error(`${where}: combine removeItems "${gone}" unknown`);
      }
    }
  }

  // --- Dialogues ------------------------------------------------------------
  for (const dlg of Object.values(dialogues)) {
    const where = `dialogue/${dlg.id}.json`;
    if (!dlg.nodes[dlg.start]) r.error(`${where}: start node "${dlg.start}" missing`);
    for (const [nodeId, node] of Object.entries(dlg.nodes)) {
      if (node.options.length === 0) r.error(`${where}#${nodeId}: node has no options`);
      if (!node.options.some((o) => o.requires === undefined || o.requires.length === 0)) {
        r.warn(`${where}#${nodeId}: every option is conditional — player could be stuck`);
      }
      for (const o of node.options) {
        checkConds(`${where}#${nodeId}`, o.requires);
        if (o.to !== 'end' && !dlg.nodes[o.to]) {
          r.error(`${where}#${nodeId}: option goes to unknown node "${o.to}"`);
        }
        if (o.giveItem !== undefined) {
          usage.sources.add(o.giveItem);
          if (!items[o.giveItem]) r.error(`${where}#${nodeId}: giveItem "${o.giveItem}" unknown`);
        }
      }
    }
  }

  // --- Every item has a source and a sink -----------------------------------
  for (const itemId of Object.keys(items)) {
    if (!usage.sources.has(itemId)) r.error(`item "${itemId}" has no source — the player can never obtain it`);
    if (!usage.sinks.has(itemId)) r.error(`item "${itemId}" has no sink — it is never used for anything`);
  }

  return r;
}

/** Static check: the painter name must appear in the story's paint module source. */
function checkPaintRef(r: Report, files: StoryFiles, where: string, name: string): void {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (files.paintSource === null) {
    r.error(`${where}: references painter "${name}" but story has no paint/index.ts`);
  } else if (!new RegExp(`\\b${escaped}\\b`).test(files.paintSource)) {
    r.error(`${where}: painter "${name}" not found in paint/index.ts`);
  }
}

// --- CLI --------------------------------------------------------------------

let failed = false;
for (const id of storyIdsFromArgv(process.argv.slice(2))) {
  let report: Report;
  try {
    report = validateStory(loadStoryFiles(id));
  } catch (err) {
    console.error(`✗ ${id}: ${(err as Error).message}`);
    failed = true;
    continue;
  }
  for (const w of report.warnings) console.warn(`  ⚠ ${id}: ${w}`);
  if (report.errors.length > 0) {
    failed = true;
    for (const e of report.errors) console.error(`  ✗ ${id}: ${e}`);
    console.error(`✗ ${id}: ${report.errors.length} error(s)`);
  } else {
    console.log(`✓ ${id} valid (${report.warnings.length} warning(s))`);
  }
}
process.exit(failed ? 1 : 0);
