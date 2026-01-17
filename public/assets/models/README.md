Place custom FBX models here.

Required for the melee enemy in `scene_test`:
- `brute.fbx` — model file (already present in this folder)

Required animation (in `public/assets/animations`):
- `brute_walk.fbx` — walk animation used by the melee enemy

Notes:
- The scene `public/js/scenes/scene_test.js` references these paths:
  - `assets/models/brute.fbx`
  - `assets/animations/brute_walk.fbx`
- Only the model and walk animation for the melee enemy were changed; all other behaviour and assets remain unchanged.