// Driver module: resilience. Run alone: node tools/browser-drive.mjs resilience
import { SHOTS } from './kit.mjs';

export async function run(kit) {
  const { page, browser, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
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
}
