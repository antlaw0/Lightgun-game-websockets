// Auto-generated scene index for debug UI
import * as SceneW1_1 from './scenes/Scene_W1_1.js';
import * as SceneW1_2 from './scenes/Scene_W1_2.js';
import * as SceneTest from './scenes/scene_test.js';
import * as SceneTestCopy from './scenes/scene_test - Copy.js';
import * as generatedScene from './scenes/generatedScene.js';

const ALL_SCENES = [];

function addFromModule(mod) {
  if (!mod) return;
  for (const key of Object.keys(mod)) {
    try {
      const val = mod[key];
      if (val && typeof val === 'object' && typeof val.name === 'string') {
        ALL_SCENES.push({ id: `${key}`, scene: val });
      }
    } catch (e) {}
  }
}

addFromModule(SceneW1_1);
addFromModule(SceneW1_2);
addFromModule(SceneTest);
addFromModule(SceneTestCopy);
addFromModule(generatedScene);


export { ALL_SCENES };
