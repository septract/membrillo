// Driver module: meadow. Run alone: node tools/browser-drive.mjs meadow
import { SHOTS } from 'membrillo/verify-kit';

export async function run(kit) {
  const { page, browser, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
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
}
