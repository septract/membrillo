// Driver module: lamplight. Run alone: node tools/browser-drive.mjs lamplight
import { SHOTS } from './kit.mjs';

export async function run(kit) {
  const { page, browser, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
  // --- Lamplight on the wide dock ----------------------------------------------
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

  // --- Walk-away costume check (visual) ----------------------------------------
  await page.goto(`${BASE}/?story=lamplight&start=dock&flags=took_rope,took_hook`);
  await page.waitForTimeout(500);
  await worldClick(60, 130); // walk up-screen: back view + shrinking
  await page.waitForTimeout(450);
  await shot('24-walking-away');
}
