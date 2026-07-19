// Driver module: resilience. Run alone: node tools/browser-drive.mjs resilience
import { SHOTS } from 'membrillo/verify-kit';

export async function run(kit) {
  const { page, browser, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
  // --- Resilience: corrupt save + stale-scene save must not crash --------------
  // Navigate to the app origin first so localStorage is writable (this module
  // must stand alone, not lean on a prior module having loaded the page).
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem('pcc:meadow', '{corrupt json!!');
    localStorage.setItem('pcc:lamplight', JSON.stringify({ scene: 'gone', flags: [], inventory: [], companions: [] }));
    // A version-skewed save missing `companions` must load, not crash Continue.
    localStorage.setItem('pcc:marigold', JSON.stringify({ scene: 'bridge', flags: [], inventory: [] }));
  });
  await page.goto(BASE);
  await page.waitForTimeout(400);
  const menuButtons = await page.getByRole('button').count();
  if (menuButtons < 2) throw new Error('menu did not render with corrupt saves');

  // Continue the stale-scene lamplight save (scope to its card — several cards
  // now have saves, so a bare "Continue" would be ambiguous).
  const continueCard = (title) =>
    page.evaluate((t) => {
      const card = [...document.querySelectorAll('.story-card')].find((c) =>
        c.querySelector('h3')?.textContent?.startsWith(t),
      );
      [...(card?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Continue')?.click();
    }, title);

  await continueCard('Lamplight');
  await page.waitForTimeout(600);
  const boot = await hook();
  if (!boot || boot.scene !== 'intro') throw new Error(`stale-scene save not recovered: ${boot?.scene}`);

  // The version-skewed marigold save (no `companions` field) must load, not
  // crash Continue — the loadSave shape normalization.
  await page.goto(BASE);
  await page.waitForSelector('.story-card', { timeout: 10000 });
  await continueCard('The Marigold');
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'bridge', null, { timeout: 10000 });
  const skew = await hook();
  if (!Array.isArray(skew.state.companions)) throw new Error('normalized save missing companions array');
  console.log('corrupt + stale + version-skewed saves recovered ✓');
}
