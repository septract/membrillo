// Driver module: marigold. Run alone: node tools/browser-drive.mjs marigold
import { SHOTS } from './kit.mjs';

export async function run(kit) {
  const { page, browser, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
  // --- The Marigold: full demo playthrough (alternate diagnosis path) ----------
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

  // The event log hides by default; the history toggle reveals it.
  const logHidden = await page.evaluate(() => document.getElementById('log')?.hidden);
  if (!logHidden) throw new Error('log should be hidden by default');
  await page.getByRole('button', { name: /history/ }).click();
  const logShown = await page.evaluate(() => !document.getElementById('log')?.hidden);
  if (!logShown) throw new Error('history toggle did not reveal the log');
  console.log('  log hidden by default + toggle ✓');

  await verb('Talk');
  await worldClick(62, 130); // Lt. Cog at his console
  await page.getByRole('button', { name: 'Tell me the joke now.' }).click();
  await page.getByRole('button', { name: 'Join the away team, Lieutenant.' }).click();
  // Recruiting mid-dialogue must NOT spawn the follower until the dialog ends
  // (the lurch felt like a mis-click); the speaker stays pinned on screen.
  const midDialog = await hook();
  if (midDialog.followers.length !== 0) throw new Error('follower spawned mid-dialogue');
  await page.getByRole('button', { name: 'Of course you have.' }).click();
  await page.waitForTimeout(300);
  const closed = await hook();
  if (!closed.followers.includes('cog')) throw new Error('follower missing after dialogue closed');
  console.log('  recruit joins on dialog close, not mid-lurch ✓');
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
}
