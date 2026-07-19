// Shared kit for the per-story browser drivers: one headless system-Chrome
// session, the world-coordinate helpers, and the error collector. Story
// modules receive this kit and destructure what they need — see
// .claude/skills/browser-verify/SKILL.md for the pattern and its gotchas.
import { mkdirSync } from 'node:fs';

export const BASE = process.env.BASE ?? 'http://localhost:5173';
export const SHOTS = `${process.cwd()}/shots-browser/`; // consumer-cwd relative

export async function createKit() {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('playwright-core not installed. Run: npm i --no-save playwright-core');
    process.exit(1);
  }
  mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 860 } });
  const errors = [];
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

  /** Fresh boot into a story with cleared storage (module independence). */
  async function freshStory(id) {
    await page.goto(`${BASE}/?story=${id}`);
    await page.waitForTimeout(400);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/?story=${id}`);
    await page.waitForTimeout(500);
  }

  return { browser, page, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory };
}
