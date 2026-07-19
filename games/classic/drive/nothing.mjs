// Driver module: nothing ("Nothing Doing"). Run alone: node drive.mjs nothing
// Proves the money COUNTER end to end — the wallet HUD chip, a positive delta
// (the couch, +1), the two required schemes (refund +4, trivia +3), the clamp
// at 9, and the counter-gated payment that ends the game. Also exercises the
// enter sequence (Kessler barges in), companion item-use, a dialogue-option
// addCompanion (Elna), and VN portraits.

export async function run(kit) {
  const { page, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
  await freshStory('nothing');

  const money = async () => (await hook()).state.counters.money;

  // Title card, then Esc into the apartment, where Kessler lets himself in.
  await shot('60-brief-card');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'apartment', null, { timeout: 20000 });
  // Hurry the arrival sequence (three lines); it ends with Kessler recruited.
  for (let i = 0; i < 30; i++) {
    const g = await hook();
    if (g && !g.sequence && g.state.companions.includes('kessler')) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  const gApt = await hook();
  if (!gApt.state.companions.includes('kessler')) throw new Error('Kessler never barged in');
  const wallet = await page.evaluate(() => document.getElementById('counters')?.textContent ?? '');
  if (!wallet.includes('$')) throw new Error(`wallet HUD chip missing: "${wallet}"`);
  if ((await money()) !== 3) throw new Error(`start money not 3: ${await money()}`);
  console.log('  enter sequence + Kessler + wallet HUD ($3) ✓');
  await shot('61-apartment');

  // Pocket the tools of pettiness: jacket, receipt, pen.
  await verb('Interact');
  await worldClick(37, 95); // coat closet
  await waitLog('gauche jacket');
  await worldClick(135, 114); // mail pile
  await waitLog('crumpled receipt');
  await worldClick(173, 112); // cluttered desk
  await waitLog('click pen');
  // The couch: a positive counter delta.
  await worldClick(241, 130);
  await waitLog('loose change');
  if ((await money()) !== 4) throw new Error(`couch did not add a dollar: ${await money()}`);
  console.log('  inventory grabs + couch (+$1 → $4) ✓');

  // Sol, in VN close-up (hero + interlocutor over the dimmed room).
  await verb('Talk');
  await worldClick(290, 145);
  await page.waitForSelector('#dialogue .npc-line', { timeout: 10000 });
  const vn = await hook();
  if (vn.vnPortraits !== 2) throw new Error(`expected 2 VN portraits, got ${vn.vnPortraits}`);
  await shot('62-sol-portrait');
  await page.getByRole('button', { name: 'Where would you even get nine dollars?' }).click();
  await page.getByRole('button', { name: 'jacket and the trivia' }).click();
  await page.waitForTimeout(300);
  console.log('  Sol VN portrait + hint dialogue ✓');

  // Out to the block, then into the diner.
  await verb('Interact');
  await worldClick(295, 100); // front door
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'street', null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await verb('Interact');
  await worldClick(212, 116); // NIB'S
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'diner', null, { timeout: 15000 });
  await page.waitForTimeout(600);
  console.log('  apartment → street → diner ✓');

  // Take the marble rye, feed it to Kessler → he coughs up the trivia answer.
  await verb('Interact');
  await worldClick(105, 111);
  await waitLog('palm the marble rye');
  const gK = await hook();
  const kes = gK.followers.find((f) => f.id === 'kessler') ?? { x: gK.actor.x + 24, y: gK.actor.y };
  await chip('marble rye');
  await worldClick(Math.round(kes.x), Math.round(kes.y) - 15);
  await waitLog('NINETEEN OH FOUR');
  const gAns = await hook();
  if (!gAns.state.flags.includes('knows_answer')) throw new Error('Kessler never answered');
  if (gAns.state.inventory.includes('rye')) throw new Error('rye not consumed');
  console.log('  companion item-use: rye → answer ✓');

  // Walk right to Booth 4; recruit Elna from a dialogue option (addCompanion).
  await verb('Look');
  await walkTo(300, 150);
  await verb('Talk');
  await worldClick(320, 145); // Elna in Booth 4
  await page.waitForSelector('#dialogue .npc-line', { timeout: 10000 });
  await page.getByRole('button', { name: 'I could use a brain' }).click();
  await page.getByRole('button', { name: 'Booth 4 rides again' }).click();
  await page.getByRole('button', { name: 'Rule one accepted' }).click();
  await page.waitForFunction(() => window.__pcc?.()?.state.companions.includes('elna'), null, { timeout: 10000 });
  console.log('  Elna recruited via dialogue option ✓');

  // Win the trivia pot: +$3 (needs the answer AND a brain at the buzzer).
  await verb('Interact');
  await worldClick(337, 60); // trivia board (walks there first, then answers)
  await page.waitForFunction(() => window.__pcc?.()?.state.flags.includes('won_trivia'), null, {
    timeout: 15000,
  });
  if ((await money()) !== 7) throw new Error(`trivia pot not +$3: ${await money()}`);
  console.log('  trivia pot (+$3 → $7) ✓');

  // Back out to the block, all the way right to Brill's for the refund.
  await verb('Look');
  await walkTo(120, 150);
  await verb('Interact');
  await worldClick(16, 116); // diner door
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'street', null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await verb('Look');
  await walkTo(340, 150);
  await verb('Interact');
  await worldClick(396, 113); // BRILL'S
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'store', null, { timeout: 15000 });
  await page.waitForTimeout(600);
  console.log('  street → store ✓');

  // Refund the gauche jacket (receipt required): +$4, clamps 11 → 9.
  await chip('gauche jacket');
  await worldClick(96, 140); // the clerk
  await waitLog('FOUR DOLLARS');
  const gRef = await hook();
  if (!gRef.state.flags.includes('refunded')) throw new Error('refund flag not set');
  if (gRef.state.inventory.includes('jacket')) throw new Error('jacket not returned');
  if ((await money()) !== 9) throw new Error(`refund did not clamp to 9: ${await money()}`);
  console.log('  jacket refund (+$4, clamps → $9) ✓');
  await shot('63-refund');

  // Back to the diner, pay the nine-dollar tab → the anticlimax.
  await verb('Interact');
  await worldClick(16, 116); // store exit
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'street', null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await verb('Look');
  await walkTo(212, 150);
  await verb('Interact');
  await worldClick(212, 116); // NIB'S
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'diner', null, { timeout: 15000 });
  await page.waitForTimeout(600);
  // Park the trailing followers (Kessler + Elna) to the right so they don't
  // occlude Nib at x150, then approach him from the right and pay.
  await verb('Look');
  await walkTo(260, 150);
  await verb('Talk');
  await worldClick(150, 145); // Nib — counter-gated payment (money ≥ 9)
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'victory', null, { timeout: 15000 });
  await shot('64-victory-card');
  await page.keyboard.press('Escape');
  await waitLog('The End');
  console.log('  NOTHING DOING WINNABLE ✓');
}
