// The rendered-plate seam: the scene background is a PNG produced by
// `membrillo scene build roomdemo apt` from floorplans/apt.json. imageScene
// blits it; the matching depth/walk band lives in scenes/apt.json (also emitted
// by the build). No draw code — the floorplan is the source.
import { imageScene } from 'membrillo/art/images';

const aptUrl = new URL('./assets/apt.png', import.meta.url).href;

export const scenes = {
  apt: imageScene(aptUrl),
};
