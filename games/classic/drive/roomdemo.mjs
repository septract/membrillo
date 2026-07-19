// Driver module: roomdemo. Proves the scene-render pipeline end to end — a
// sprite walks a rendered plate on the auto-derived depth/walk band, scaling
// with depth and reaching the exit. Run alone: node drive.mjs roomdemo
export async function run(kit) {
  const { page, hook, worldClick, verb, walkTo, shot, freshStory } = kit;
  await freshStory('roomdemo');
  await shot('70-rendered-room');

  // Walk to the front (near, large) then the back-left (far, small): the actor
  // must reach both — the walkbox came straight out of the render.
  await verb('Look');
  await walkTo(160, 147);
  const front = await hook();
  await shot('71-front');
  await walkTo(40, 112);
  const back = await hook();
  await shot('72-back');
  if (Math.abs(front.actor.x - 160) > 4 || Math.abs(back.actor.x - 40) > 4)
    throw new Error(`actor did not reach the walk targets: front=${front.actor.x} back=${back.actor.x}`);
  // Feet stayed inside the calibrated band at both depths.
  for (const g of [front, back])
    if (g.actor.y < 108 || g.actor.y > 150) throw new Error(`actor left the walk band: y=${g.actor.y}`);
  console.log('  sprite walks the rendered floor, front to back ✓');

  // Out through the rendered door → the ending.
  await verb('Interact');
  await worldClick(268, 52); // door, above the couch hotspot's region
  await page.waitForFunction(() => window.__pcc?.()?.scene === 'done', null, { timeout: 15000 });
  await shot('73-done');
  console.log('  ROOMDEMO: rendered plate is walkable + winnable ✓');
}
