// Driver module: postcard. Run alone: node tools/browser-drive.mjs postcard
import { SHOTS } from 'membrillo/verify-kit';

export async function run(kit) {
  const { page, browser, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
  // --- Postcard: the image-asset fixture (PNG background + spritesheet) --------
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
  const buddyPos = pc.followers?.[0] ?? { x: pc.actor.x - 24, y: pc.actor.y };
  await worldClick(Math.round(buddyPos.x), Math.round(buddyPos.y) - 15);
  await waitLog('Still here. Still behind you.');
  const pcAfter = await hook();
  if (Math.abs(pcAfter.actor.x - pc.actor.x) > 1) throw new Error('actor moved to talk to companion');
  console.log('  image sprite companion + in-place talk ✓');
  // VN staging from an IMAGE portrait: the chroma-green test PNG is keyed
  // out automatically, so the bust floats over the dimmed scene.
  await page.waitForSelector('#dialogue .npc-line', { timeout: 10000 });
  const vn = await hook();
  if (vn.vnPortraits !== 1) throw new Error(`expected 1 VN portrait, got ${vn.vnPortraits}`);
  await page.waitForTimeout(400); // let the PNG decode + key
  await shot('62-postcard-portrait');
  console.log('  chroma-keyed image portrait ✓');
  await page.getByRole('button', { name: 'Good talk, Buddy.' }).click();
  await page.waitForTimeout(300);
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
}
