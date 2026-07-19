// Driver module: marigold2. Run alone: node tools/browser-drive.mjs marigold2
import { SHOTS } from 'membrillo/verify-kit';

export async function run(kit) {
  const { page, browser, errors, BASE, hook, worldClick, waitLog, shot, verb, chip, walkTo, freshStory } = kit;
  // --- Gale Reach: mission 2 (character walks, defaultVerb, tall scene, cards) --
  await page.goto(`${BASE}/?story=marigold2`);
  await page.waitForTimeout(400);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/?story=marigold2`);
  await page.waitForTimeout(700);
  await shot('80-card-brief'); // full-screen painted cutscene card
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  await waitLog('rearranged into a spiral');
  await page.keyboard.press('Escape'); // skip the touchdown sequence
  await page.waitForTimeout(300);
  const touchdown = await hook();
  if (touchdown.state.companions.length !== 2) throw new Error('team not aboard');
  if (!touchdown.state.inventory.includes('sniffer')) throw new Error('no sniffer');

  // defaultVerb: a plain Interact click on the SLEEPING drone must LOOK.
  await worldClick(96, 130);
  await waitLog('curled on the deck like a cat');
  console.log('  defaultVerb look on sleeping drone ✓');

  // Stage right so the followers clear the drone's click zone.
  await verb('Look');
  await walkTo(180, 160);
  await verb('Interact');
  await chip('sniffer');
  await worldClick(96, 130); // sniff the drone
  await waitLog("TIDY (RECURRING)");
  await worldClick(134, 105); // take the cell from the rack
  await waitLog('You lift the loose cell');
  await chip('power cell');
  await worldClick(96, 130); // slot it into the drone
  await waitLog('krrr...t?');
  await page.waitForTimeout(900); // the drone is mid-walk to the cabinet
  await shot('81-drone-walking'); // CHARACTER walking in a sequence
  await waitLog('KRRT. KRRT-KRRT.');
  // The trailing setFlags step runs after the line's timer — wait for the
  // sequence itself to end before asserting its effects.
  await page.waitForFunction(
    () => {
      const g = window.__pcc?.();
      return g && !g.sequence && g.state.flags.includes('woke_drone');
    },
    null,
    { timeout: 8000 },
  );
  console.log('  scripted character walk ✓');

  await worldClick(250, 100); // the cabinet — drone opens it
  await waitLog('one mint comm coupler');
  await verb('Talk');
  await worldClick(28, 68); // the wall grille — Mote
  await page.getByRole('button', { name: "You're SINGING, Mote." }).click();
  await page.getByRole('button', { name: '(Let it be, for now.)' }).click();
  const g4 = await hook();
  // Walked LEFT to the grille, so followers trail to the RIGHT: Cog at +24,
  // Solace at +48.
  await worldClick(Math.round(g4.actor.x) + 48, Math.round(g4.actor.y) - 15);
  await waitLog("It's LONELY.");
  console.log('  talking hotspot + Solace read ✓');

  await verb('Interact');
  await worldClick(296, 120); // the shaft door
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'shaft', null, { timeout: 15000 });
  await page.waitForTimeout(700);
  // Climb the switchbacks — the camera follows VERTICALLY.
  await verb('Look');
  await walkTo(285, 290);
  await walkTo(30, 290);
  await walkTo(30, 210);
  await shot('82-shaft-midclimb');
  await walkTo(285, 210);
  await walkTo(285, 130);
  const climbed = await hook();
  if (climbed.camera.y > 60) throw new Error(`camera did not climb: y=${climbed.camera.y}`);
  console.log('  vertical camera ✓');
  await verb('Interact');
  await chip('comm coupler');
  await worldClick(160, 78); // splice it into the socket
  await waitLog('Cog splices the coupler');
  await shot('83-shaft-top');
  await verb('Talk');
  await worldClick(68, 78); // Mote's core
  await page.getByRole('button', { name: "We've patched you into the colony net. Sing to THEM." }).click();
  await page.getByRole('button', { name: 'Carry on, Mote. Sing them something nice.' }).click();
  const settled = await hook();
  if (!settled.state.flags.includes('song_settled')) throw new Error('song not settled');

  // Back down and home.
  await verb('Look');
  await walkTo(285, 210);
  await walkTo(30, 210);
  await walkTo(30, 290);
  await walkTo(285, 290);
  await walkTo(285, 372);
  await verb('Interact');
  await worldClick(20, 338); // the door down
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'landing', null, { timeout: 15000 });
  await page.waitForTimeout(700);
  await worldClick(58, 148); // the beam circle
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'sung', null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await shot('84-card-sung'); // the same card, beacon lit
  await page.keyboard.press('Escape');
  await waitLog('— The End —');
  console.log('  GALE REACH WINNABLE ✓');
}
