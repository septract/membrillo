// Driver module: quince. Run alone: node drive.mjs quince
// Plays the example story start to finish — the winnability proof is the
// fuzzer's job; this proves the FEEL: clicks land, speech floats, the gate
// actually opens on screen.

export async function run(kit) {
  const { page, hook, worldClick, waitLog, shot, verb, chip, freshStory } = kit;
  await freshStory('quince');

  // The entry sequence greets us; wait for it to fully end (the flag lands
  // before the last line clears, so wait for both).
  await page.waitForFunction(() => {
    const g = window.__pcc?.();
    return g && !g.sequence && g.state.flags.includes('greeted');
  }, null, { timeout: 15000 });
  console.log('  entry sequence played ✓');
  await shot('01-orchard');

  // Look responds with authored text.
  await verb('Look');
  await worldClick(90, 70); // the tree
  await waitLog('all knuckles and blossom-scars');

  // Dialogue: learn the toll, get the hint, leave. VN staging: the
  // gardener's portrait stands over the dimmed scene (no actorPortrait in
  // this story, so the hero's side stays empty) and the line moves into
  // the box.
  await verb('Talk');
  await worldClick(232, 138); // the gardener
  await page.waitForSelector('#dialogue .npc-line', { timeout: 10000 });
  const vn = await hook();
  if (vn.vnPortraits !== 1) throw new Error(`expected 1 VN portrait, got ${vn.vnPortraits}`);
  console.log('  VN dialogue staging ✓');
  await page.getByRole('button', { name: 'Where do I find a quince?' }).click();
  await page.getByRole('button', { name: "I'll have a look." }).click();
  await page.waitForTimeout(300);
  const hinted = await hook();
  if (!hinted.state.flags.includes('knows_quince')) throw new Error('hint flag not set');
  console.log('  dialogue + hint flag ✓');

  // Take the hook, hook the branch, pay the gardener.
  await page.keyboard.press('i');
  await worldClick(176, 112); // the glint in the hedge
  await waitLog('You drag a pruning hook out of the hedge');
  await chip('pruning hook');
  await worldClick(106, 39); // the high branch
  await waitLog('The quince drops into your hand.');
  const ticked = await page.evaluate(
    () => document.querySelector('#objectives .objective.done')?.textContent,
  );
  if (!ticked?.includes('Pick a quince')) throw new Error(`objective did not tick: ${ticked}`);
  console.log('  hook → quince, objective ticks ✓');
  await chip('ripe quince');
  await worldClick(232, 138); // give it to the gardener
  await waitLog("Fair's fair.");

  // Through the gate to the ending card.
  await worldClick(296, 105);
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'lane', null, { timeout: 15000 });
  await page.keyboard.press('Escape');
  await waitLog('— The End —');
  await shot('02-end');
  console.log('  STORY WINNABLE IN BROWSER ✓');
}
