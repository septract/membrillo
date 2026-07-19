// Full browser regression: plays every story to completion in headless system
// Chrome, exercising sequences, companions, camera scroll, objectives, saves.
// This is the check the offline fuzzer cannot do — it verifies the DOM/canvas
// layer and the FEEL, clicking exactly where a player would.
//
//   npm run dev                          # in another shell (or backgrounded)
//   npm i --no-save playwright-core      # once per checkout; uses system Chrome
//   node tools/browser-drive.mjs
//
// Screenshots land in shots-browser/ (gitignored). Read them — a green log
// with a broken screenshot is a failure. Patterns and gotchas are documented
// in .claude/skills/browser-verify/SKILL.md.
import { mkdirSync } from 'node:fs';

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('playwright-core not installed. Run: npm i --no-save playwright-core');
  process.exit(1);
}

const BASE = process.env.BASE ?? 'http://localhost:5173';
const SHOTS = new URL('../shots-browser/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const errors = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 860 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const hook = () => page.evaluate(() => window.__pcc?.() ?? null);

// Click a WORLD coordinate: subtract the camera, scale by the view.
async function worldClick(wx, wy) {
  const g = await hook();
  const box = await page.locator('#view').boundingBox();
  const sx = (wx - g.camera.x + 0.5) / g.view.w;
  const sy = (wy - g.camera.y + 0.5) / g.view.h;
  await page.mouse.click(box.x + sx * box.width, box.y + sy * box.height);
}

async function waitLog(text) {
  await page.waitForFunction(
    (t) => document.getElementById('log')?.textContent?.includes(t),
    text,
    { timeout: 12000 },
  );
  console.log(`  log ✓ "${text}"`);
}

async function waitIdle() {
  // Wait until the walk finished and no fade is running.
  await page.waitForFunction(() => {
    const g = window.__pcc?.();
    return g !== null;
  });
  await page.waitForTimeout(150);
}

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}${name}.png` });
  console.log(`  shot ${name}`);
}

const verb = (name) => page.getByRole('button', { name, exact: true }).click();
const chip = (name) => page.getByRole('button', { name }).click();

// Walk to a world point (must be currently on-screen) and wait for arrival.
async function walkTo(wx, wy) {
  await worldClick(wx, wy);
  await page.waitForFunction(
    ([x, y]) => {
      const g = window.__pcc?.();
      return g && Math.abs(g.actor.x - x) < 3 && Math.abs(g.actor.y - y) < 3;
    },
    [wx, wy],
    { timeout: 15000 },
  );
  await page.waitForTimeout(250); // let the camera settle
}

// --- Lamplight on the wide dock ----------------------------------------------
console.log('lamplight:');
await page.goto(BASE);
await page.getByRole('button', { name: 'Lamplight' }).click();
await page.waitForTimeout(300);
await page.keyboard.press('Escape'); // Esc skips the intro cutscene
await page.waitForTimeout(900);
const atDock = await hook();
if (atDock.scene !== 'dock') throw new Error(`Esc skip failed, at ${atDock.scene}`);
console.log('  esc-skip cutscene ✓');

// The arrival sequence auto-plays on entry; let the first line land, then a
// CLICK must hurry the line to the next step, and Esc skips the remainder —
// skipping must still apply all remaining effects.
await waitLog("Off the ferry");
await shot('40-arrival-sequence');
await worldClick(160, 90); // click-to-hurry the keeper's line
// 2.5s window proves the click advanced it — the natural timer is ~5s.
await page.waitForFunction(
  () => document.getElementById('log')?.textContent?.includes('That lamp of yours is dead'),
  null,
  { timeout: 2500 },
);
console.log('  click hurries sequence dialog ✓');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const skipped = await hook();
if (!skipped.state.flags.includes('arrived')) throw new Error('sequence skip lost its effects');
console.log('  in-room sequence + esc-skip ✓');
await shot('20-dock-left');

await page.keyboard.press('i'); // NEW: verb hotkey
await worldClick(70, 144); // coil of line
await waitLog('You shoulder the coil of line.');
await worldClick(140, 120); // boathook
await waitLog('You lift the boathook off the rail.');

// The keeper is mid-dock, off-screen from the left end: walk right like a
// player would and let the camera follow before clicking him.
await verb('Look');
await walkTo(300, 160);
await verb('Talk');
await worldClick(330, 140); // the keeper — now on screen
await waitLog("Lamp's dead, and my lens with it");
await page.getByRole('button', { name: 'Your lens is in the harbour?' }).click();
await page.getByRole('button', { name: "Can't you fish it out yourself?" }).click();
await page.getByRole('button', { name: 'A grapple. Right.' }).click();
const midCam = await hook();
console.log(`  camera followed to x=${Math.round(midCam.camera.x)} (expect > 60)`);
if (midCam.camera.x < 60) throw new Error('camera did not follow');
await shot('21-dock-scrolled');

// Unified use-with: under Interact, arm one item then click the other.
await verb('Interact');
await chip('coil of line');
await chip('boathook');
await waitLog('A serviceable grapple.');
const sentence = await page.evaluate(() => document.getElementById('sentence')?.textContent);
console.log(`  sentence line: "${sentence}"`);

// Speaker attribution: the keeper's in-character line must float over HIM.
await chip('makeshift grapple');
await worldClick(330, 140); // use grapple on the keeper
await waitLog('A fine rig.');
await shot('30-keeper-speaks');

await chip('makeshift grapple'); // re-arm (applying cleared it)
await worldClick(160, 95); // use grapple on open harbour water (not the skiff)
await waitLog('up comes the crate');

await verb('Look');
await walkTo(378, 160); // stage right until the far end scrolls into view
// Look on an exit must describe, never travel.
await worldClick(460, 120);
await waitLog('iron-banded door');
const stillDock = await hook();
if (stillDock.scene !== 'dock') throw new Error('Look on exit travelled!');
console.log('  look-on-exit describes, does not travel ✓');
await verb('Interact');
await worldClick(460, 120); // lighthouse door
await page.waitForFunction(() => window.__pcc?.()?.scene === 'tower', null, { timeout: 15000 });
await page.waitForTimeout(700);
console.log('  reached tower ✓');
await shot('22-tower');

// The gallery door is authored flavour now, not a silent default.
await worldClick(10, 120);
await waitLog('rusted fast');
// Exit effects: the spiral stairs ARE the way down; the flavour line plays,
// and the arrival sequence must NOT replay (flag-gated).
await worldClick(250, 110); // spiral stairs
await waitLog('Down the hundred and nine steps');
await page.waitForFunction(() => window.__pcc?.()?.scene === 'dock', null, { timeout: 15000 });
await page.waitForTimeout(700);
const back = await hook();
if (back.scene !== 'dock') throw new Error('did not return to dock');
console.log('  exit effects + no arrival replay ✓');
await verb('Interact');
await worldClick(460, 120); // and up again
await page.waitForFunction(() => window.__pcc?.()?.scene === 'tower', null, { timeout: 15000 });
await page.waitForTimeout(700);
await verb('Interact');
await chip('lamp lens');
await worldClick(160, 85); // use lens on housing
await waitLog('You heave the lens up into the housing.');
await page.waitForTimeout(800);
await page.keyboard.press('Escape'); // skip the ending cutscene
await waitLog('— The End —');
console.log('  WINNABLE IN BROWSER ✓');

// --- Meadow at 256x144 --------------------------------------------------------
console.log('meadow (256x144 view):');
await page.goto(`${BASE}/?story=meadow`);
await page.waitForTimeout(400);
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/?story=meadow`);
await page.waitForTimeout(400);
const m = await hook();
if (m.view.w !== 256 || m.view.h !== 144) throw new Error(`view is ${m.view.w}x${m.view.h}`);
console.log('  view 256x144 ✓');
await page.keyboard.down(' ');
await page.waitForTimeout(200);
await shot('23-meadow-256');
await page.keyboard.up(' ');
// Objectives panel derives live from state.
const objText = await page.evaluate(() => document.getElementById('objectives')?.textContent);
if (!objText?.includes('Cross the stream')) throw new Error(`objectives missing: ${objText}`);
console.log('  objectives panel ✓');

// Recruit the sparrow companion via dialogue, then talk to the follower.
await verb('Talk');
await worldClick(200, 110); // the hermit
await page.getByRole('button', { name: 'Anyone else out here?' }).click();
await page.getByRole('button', { name: 'Come on then, bird.' }).click();
await page.waitForTimeout(400);
const party = await hook();
if (!party.state.companions.includes('sparrow')) throw new Error('companion not recruited');
await verb('Look');
await walkTo(60, 120); // walk away so the follower trails us
await shot('41-follower');
// The follower stands ~24px behind the actor along the trail — talk to it.
await verb('Talk');
const g2 = await hook();
await worldClick(Math.round(g2.actor.x) + 24, Math.round(g2.actor.y) - 15);
await waitLog('Peep.');
console.log('  companion follower + talk ✓');

await page.keyboard.press('i');
await worldClick(40, 108); // crank
await waitLog('You pull a rusty crank handle out of the grass.');
await chip('rusty crank');
await worldClick(125, 90); // use crank on sluice
await waitLog('The crank bites.');
const ticked = await page.evaluate(() => document.querySelector('#objectives .objective.done')?.textContent);
if (!ticked?.includes('Cross the stream')) throw new Error('objective did not tick');
console.log('  objective ticks live ✓');
await worldClick(240, 106); // old bridge
await page.waitForFunction(() => window.__pcc?.()?.scene === 'glade', null, { timeout: 15000 });
await page.keyboard.press('Escape');
await waitLog('— The End —');
console.log('  FIXTURE WINNABLE ✓');

// --- Walk-away costume check (visual) ----------------------------------------
await page.goto(`${BASE}/?story=lamplight&start=dock&flags=took_rope,took_hook`);
await page.waitForTimeout(500);
await worldClick(60, 130); // walk up-screen: back view + shrinking
await page.waitForTimeout(450);
await shot('24-walking-away');

// --- The Marigold: full demo playthrough (alternate diagnosis path) ----------
console.log('marigold:');
await page.goto(`${BASE}/?story=marigold`);
await page.waitForTimeout(400);
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/?story=marigold`);
await page.waitForTimeout(400);
await page.keyboard.press('Escape'); // skip the briefing cutscene
await page.waitForTimeout(900);
await waitLog("Verdant Hollow's weather relay is dark");
// Click through every briefing line; the click on the CAPTAIN'S LAST LINE
// must dismiss it immediately (Mike's second click-eater report).
await worldClick(160, 90);
await waitLog('un-melted');
await worldClick(160, 90);
await waitLog('See it done.');
await worldClick(160, 90);
await page.waitForTimeout(150);
const briefed = await hook();
if (briefed.sequence) throw new Error('briefing sequence still running');
if (briefed.speech !== null) throw new Error(`final line lingered: "${briefed.speech}"`);
if (!briefed.state.inventory.includes('sniffer')) throw new Error('no sniffer after briefing');
console.log('  final line dismissed by its click ✓');
await shot('50-bridge');

await verb('Talk');
await worldClick(62, 130); // Lt. Cog at his console
await page.getByRole('button', { name: 'Tell me the joke now.' }).click();
await page.getByRole('button', { name: 'Join the away team, Lieutenant.' }).click();
await page.getByRole('button', { name: 'Of course you have.' }).click();
await worldClick(242, 135); // Counselor Solace
await page.getByRole('button', { name: 'Join the away team, Counselor.' }).click();
await page.getByRole('button', { name: "Then let's bring both." }).click();
const crewed = await hook();
if (crewed.state.companions.length !== 2) throw new Error('away team not assembled');
console.log('  away team assembled ✓');

await verb('Interact');
await worldClick(280, 140); // beam pad
await page.waitForFunction(() => window.__pcc?.()?.scene === 'hollow', null, { timeout: 15000 });
await waitLog('Atmosphere: damp.');
await shot('51-hollow-arrival');
// Click-through must cost exactly one click per line — the trailing pacing
// wait and the fade-in must never eat a click (Mike's playtest nit).
await worldClick(160, 90); // dismiss Cog's line (during fade-in is fine)
await waitLog('very worried');
await worldClick(160, 90); // dismiss Solace's line — also ends the wait step
await page.waitForTimeout(150);
await worldClick(60, 150); // IMMEDIATELY act: the very next click must land
await waitLog('Finish the job first, Ensign.');
console.log('  no lost clicks on arrival ✓');

// The A-Final-Unity alternate path: Cog diagnoses instead of the sniffer.
await verb('Look');
await walkTo(120, 160);
await verb('Talk');
const onHollow = await hook();
// Walked left-to-right, so Cog trails at lower x.
await worldClick(Math.round(onHollow.actor.x) - 24, Math.round(onHollow.actor.y) - 15);
await waitLog('singing a whole tone flat');
console.log('  companion diagnosis (alternate path) ✓');

await verb('Interact');
await worldClick(264, 138); // the crevice — Cog fetches
await waitLog('like a teacup');
await chip('focusing crystal');
await worldClick(160, 80); // install in the relay
await waitLog('click like a struck glass');

await verb('Look');
await walkTo(300, 160); // stage right to reach Wren
await verb('Talk');
await worldClick(320, 135); // Wren
await page.getByRole('button', { name: 'It was detuned. By hand. A whole tone flat, exactly.' }).click();
await page.getByRole('button', { name: /Let Solace speak/ }).click();
await page.getByRole('button', { name: 'The tuning fork, please. We\'ll put it right together.' }).click();
await page.getByRole('button', { name: "We'll have it humming by supper." }).click();
const confessed = await hook();
if (!confessed.state.inventory.includes('tuner')) throw new Error('no tuning fork after confession');
console.log('  Solace-gated confession ✓');

await verb('Interact');
await chip('tuning fork');
await worldClick(160, 80); // use tuning fork with the relay (visible from here)
await waitLog('mist-heads hiss awake');
await shot('52-relay-fixed');
console.log('  relay fixed ✓');

await walkTo(120, 160); // stage toward the beam circle
await worldClick(60, 150); // beam home
await page.waitForFunction(() => window.__pcc?.()?.scene === 'home', null, { timeout: 15000 });
await page.keyboard.press('Escape');
await waitLog('— The End —');
console.log('  MARIGOLD WINNABLE ✓');

// --- Postcard: the image-asset fixture (PNG background + spritesheet) --------
console.log('postcard:');
await page.goto(`${BASE}/?story=postcard`);
await page.waitForTimeout(400);
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE}/?story=postcard`);
await waitLog('Right behind you.');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await shot('60-postcard');
await worldClick(230, 150); // walk right: sheet walk frames + facing rows
await page.waitForTimeout(500);
await shot('61-postcard-walking');
await page.waitForFunction(
  () => {
    const g = window.__pcc?.();
    return g && Math.abs(g.actor.x - 230) < 3;
  },
  null,
  { timeout: 15000 },
);
await verb('Talk');
const pc = await hook();
await worldClick(Math.round(pc.actor.x) - 24, Math.round(pc.actor.y) - 15); // Buddy trails left
await waitLog('Still here. Still behind you.');
const pcAfter = await hook();
if (Math.abs(pcAfter.actor.x - pc.actor.x) > 1) throw new Error('actor moved to talk to companion');
console.log('  image sprite companion + in-place talk ✓');
await verb('Interact');
await worldClick(292, 115); // the gate
await page.waitForFunction(() => window.__pcc?.()?.scene === 'sent', null, { timeout: 15000 });
await page.keyboard.press('Escape');
await waitLog('— The End —');
console.log('  IMAGE FIXTURE WINNABLE ✓');
// Every click responds: clicking the end card returns to the story menu.
await page.waitForTimeout(300);
await worldClick(160, 90);
await page.waitForFunction(() => !document.getElementById('menu')?.hidden, null, { timeout: 5000 });
console.log('  end-card click → menu ✓');

// --- Resilience: corrupt save + stale-scene save must not crash --------------
await page.evaluate(() => {
  localStorage.setItem('pcc:meadow', '{corrupt json!!');
  localStorage.setItem('pcc:lamplight', JSON.stringify({ scene: 'gone', flags: [], inventory: [], companions: [] }));
});
await page.goto(BASE);
await page.waitForTimeout(400);
const menuButtons = await page.getByRole('button').count();
if (menuButtons < 2) throw new Error('menu did not render with corrupt saves');
await page.getByRole('button', { name: 'Continue' }).click(); // resumes the stale-scene save
await page.waitForTimeout(600);
const boot = await hook();
if (!boot || boot.scene !== 'intro') throw new Error(`stale-scene save not recovered: ${boot?.scene}`);
console.log('corrupt + stale saves recovered ✓');

// --- Mobile: touch emulation (iPhone-ish viewport, no keyboard, no hover) ----
console.log('mobile:');
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const mp = await mctx.newPage();
mp.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
mp.on('console', (m) => {
  if (m.type() === 'error') errors.push(`mobile console: ${m.text()}`);
});
await mp.goto(`${BASE}/?story=lamplight`);
await mp.waitForTimeout(500);
await mp.evaluate(() => localStorage.clear());
await mp.goto(`${BASE}/?story=lamplight`);
await mp.waitForTimeout(800);
// Tap through the intro cutscene (no Esc key on a phone).
const mbox = await mp.locator('#view').boundingBox();
for (let i = 0; i < 3; i++) {
  await mp.touchscreen.tap(mbox.x + mbox.width / 2, mbox.y + mbox.height / 2);
  await mp.waitForTimeout(200);
}
await mp.waitForFunction(
  () => document.getElementById('log')?.textContent?.includes('Off the ferry'),
  null,
  { timeout: 15000 },
);
// The on-canvas skip button is touch's Esc: skip the arrival sequence.
await mp.getByRole('button', { name: 'skip ≫' }).tap();
await mp.waitForTimeout(300);
const mg = await mp.evaluate(() => window.__pcc?.());
if (!mg.state.flags.includes('arrived')) throw new Error('mobile skip lost effects');
console.log('  tap-through cutscene + skip button ✓');
// The eye toggle latches hotspot highlighting (no Space key on a phone).
await mp.getByRole('button', { name: '👁' }).tap();
await mp.waitForTimeout(200);
await mp.screenshot({ path: `${SHOTS}70-mobile-highlight.png` });
console.log('  shot 70-mobile-highlight');
// Tap the rope: default Interact picks it up.
const g3 = await mp.evaluate(() => window.__pcc?.());
await mp.touchscreen.tap(
  mbox.x + ((70 - g3.camera.x + 0.5) / g3.view.w) * mbox.width,
  mbox.y + ((144 - g3.camera.y + 0.5) / g3.view.h) * mbox.height,
);
await mp.waitForFunction(
  () => document.getElementById('log')?.textContent?.includes('You shoulder the coil of line.'),
  null,
  { timeout: 15000 },
);
console.log('  touch pickup ✓');
await mctx.close();

await browser.close();
if (errors.length) {
  console.error('BROWSER ERRORS:');
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log('done, no browser errors');
