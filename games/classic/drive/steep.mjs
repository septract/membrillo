// Driver module: steep (Operation Steep). Run alone: node drive.mjs steep
// Critical path plus one Marzipan gloat; also proves manifest.actor (the tux
// sprite boots without errors) and the terrace's vertical camera.

export async function run(kit) {
  const { page, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
  await freshStory('steep');

  // Briefing card (painted full-screen): shoot it, then Esc to the salon,
  // where the arrival sequence plays.
  await shot('89-brief-card');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const g = window.__pcc?.();
    return g && g.scene === 'salon' && !g.sequence && g.state.flags.includes('arrived');
  }, null, { timeout: 20000 });
  console.log('  briefing card + arrival sequence ✓');
  await shot('90-salon');

  // Barman: learn Fondant's weakness (problem before solution).
  await verb('Talk');
  await worldClick(84, 105);
  await page.getByRole('button', { name: "Tell me about the Baron's funicular." }).click();
  await page.getByRole('button', { name: 'And what does Mr. Fondant care about?' }).click();
  await page.getByRole('button', { name: 'Shortbread. Of course. Thank you.' }).click();
  await page.waitForTimeout(300);
  const g1 = await hook();
  if (!g1.state.flags.includes('knows_fondant')) throw new Error('knows_fondant not set');
  // Verbs are one-shot: the Talk arm must have reset to Interact after use.
  const afterTalk = await page.evaluate(
    () => document.querySelector('#verbs button.armed')?.textContent,
  );
  if (afterTalk !== 'Interact') throw new Error(`verb did not reset after talk: ${afterTalk}`);
  console.log('  barman hint + one-shot verb reset ✓');

  // Confiscate snacks.
  await page.keyboard.press('i');
  await worldClick(116, 107);
  await waitLog('the ranking olive');
  await worldClick(207, 109);
  await waitLog('liberate the swizzle stick');

  // Recruit Penny at the card table.
  await verb('Talk');
  await worldClick(344, 118);
  await page.getByRole('button', { name: 'Grey. EARL Grey.' }).click();
  await page.getByRole('button', { name: "Then we'd better team up." }).click();
  await page.getByRole('button', { name: 'After you, Miss Farthing.' }).click();
  await page.waitForFunction(() => window.__pcc?.()?.state.companions.includes('penny'), null, {
    timeout: 10000,
  });
  console.log('  Penny recruited ✓');

  // Walk clear, then ask the trailing Penny for the shortbread.
  await verb('Look');
  await walkTo(260, 150);
  await verb('Talk');
  const g2 = await hook();
  const pennyPos = g2.followers?.[0] ?? { x: g2.actor.x + 24, y: g2.actor.y };
  await worldClick(Math.round(pennyPos.x), Math.round(pennyPos.y) - 15);
  await waitLog('patented pocket shortbread');
  console.log('  companion gadget handoff ✓');

  // Out to the terrace; the loom sequence introduces Mr. Fondant.
  // (Walk right first — the doors are off-camera from the card table.)
  await verb('Look');
  await walkTo(420, 150);
  // Ground clicks are walks, not interactions: the Look arm must survive.
  const afterWalk = await page.evaluate(
    () => document.querySelector('#verbs button.armed')?.textContent,
  );
  if (afterWalk !== 'Look') throw new Error(`ground click disarmed the verb: ${afterWalk}`);
  console.log('  ground click keeps the arm ✓');
  await verb('Interact');
  await worldClick(452, 110);
  await page.waitForFunction(() => {
    const g = window.__pcc?.();
    return g && g.scene === 'terrace' && !g.sequence && g.state.flags.includes('met_fondant');
  }, null, { timeout: 20000 });
  const g3 = await hook();
  if (!(g3.camera.y > 20)) throw new Error(`terrace camera not vertical: ${g3.camera.y}`);
  console.log('  terrace + vertical camera ✓');
  await shot('91-terrace');

  // Shortbread diplomacy: Fondant steps aside (scripted character walk).
  await chip('proper shortbread');
  await worldClick(176, 112);
  await page.waitForFunction(() => {
    const g = window.__pcc?.();
    return g && !g.sequence && g.state.flags.includes('fondant_moved');
  }, null, { timeout: 20000 });
  const ticked = await page.evaluate(
    () => document.querySelector('#objectives .objective.done')?.textContent,
  );
  if (!ticked?.includes('lair')) throw new Error(`lair objective did not tick: ${ticked}`);
  console.log('  Fondant moved, objective ticks ✓');
  await shot('92-fondant-aside');

  // Up the funicular; capture + monologue on arrival. The Baron does go on —
  // hurry his lines with clicks, the way any player would.
  await worldClick(170, 100);
  let arrived = false;
  for (let i = 0; i < 80 && !arrived; i++) {
    const g = await hook();
    arrived = !!g && g.scene === 'lair' && !g.sequence && g.state.flags.includes('knows_plan');
    if (!arrived) {
      if (g?.scene === 'lair' && g.sequence) await worldClick(240, 165);
      await page.waitForTimeout(500);
    }
  }
  if (!arrived) {
    const g = await hook();
    throw new Error(`never captured: scene=${g?.scene} seq=${g?.sequence} flags=${g?.state.flags}`);
  }
  console.log('  captured; monologue delivered (hurried) ✓');
  await shot('93-lair');

  // One gloat for the road (exercises the dialogue tree).
  await verb('Talk');
  await worldClick(180, 118);
  await page.getByRole('button', { name: 'Your device has a flaw. They always do.' }).click();
  await page.getByRole('button', { name: 'Brine. How reassuring for you.' }).click();
  await page.waitForTimeout(300);

  // Penny crosses the lasers, then the olive stops history at 3:59.
  // (Walk to the Device end of the room first — it's off-camera from the
  // Baron's tea table.)
  await verb('Look');
  await walkTo(300, 150); // two hops: even the walk target must be on-screen
  await walkTo(340, 150);
  await verb('Interact');
  await chip('swizzle stick');
  await worldClick(374, 100);
  await page.waitForFunction(() => {
    const g = window.__pcc?.();
    return g && !g.sequence && g.state.flags.includes('grid_off');
  }, null, { timeout: 30000 });
  console.log('  laser grid down ✓');
  await chip('cocktail olive');
  await worldClick(430, 80);
  for (let i = 0; i < 80; i++) {
    const g = await hook();
    if (g?.scene === 'victory') break;
    if (g?.sequence) await worldClick(240, 165); // hurry the finale
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'victory', null, { timeout: 5000 });
  await shot('94-359-card'); // the painted victory card, before skipping it
  await page.keyboard.press('Escape');
  await waitLog('— The End —');
  console.log('  OPERATION STEEP WINNABLE ✓');
}
