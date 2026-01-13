import * as Pants from './pants.js';
import * as Tshirt from './tshirt.js';

export function equipApparelList(boneMap, sceneGroup, apparelList) {
  // Disabled: skinned apparel produced runtime issues in this environment.
  // Keep apparel modules in the repo for later, but avoid creating SkinnedMesh apparel now.
  try { console.log('[Apparel] equipApparelList called but disabled — skipping apparel creation.'); } catch(_) {}
  return [];
}

export { Pants, Tshirt };
