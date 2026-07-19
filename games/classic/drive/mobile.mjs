// Driver module: mobile. Run alone: node tools/browser-drive.mjs mobile
import { SHOTS } from 'membrillo/verify-kit';

export async function run(kit) {
  const { page, browser, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
  // --- Mobile: touch emulation (iPhone-ish viewport, no keyboard, no hover) ----
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
  await mp.getByRole('button', { name: 'Outline clickable things' }).tap();
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
}
