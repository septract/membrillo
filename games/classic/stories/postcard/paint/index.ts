// The image-asset fixture: background and sprite come from PNG files rather
// than draw code, through the same painter seam. The PNGs are generated
// stand-ins (tools/make-test-art.mjs); art from any pixel editor drops into
// the same files with the same contract.

import { imageScene, sheetSprite } from 'membrillo/art/images';

const bgUrl = new URL('./assets/yard-bg.png', import.meta.url).href;
const sheetUrl = new URL('./assets/buddy-sheet.png', import.meta.url).href;

export const scenes = {
  yard: imageScene(bgUrl),
};

export const sprites = {
  buddy: sheetSprite(sheetUrl, {
    frameW: 20,
    frameH: 40,
    rows: { down: 0, right: 1, up: 2 }, // left mirrors right
    walkFrames: 2,
  }),
};
