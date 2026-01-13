Place animation files (FBX or GLTF) here and name them as referenced by `ENEMY_DEFS` in `public/js/scenes.js`.

Recommended filenames and sources:
- walk.fbx — a looping walk cycle exported from Mixamo or another source.
- shoot_handgun.fbx — a single-shot handgun firing animation (preferably with the arm, spine and head keys).

How to obtain Mixamo animations:
1. Go to https://www.mixamo.com and upload your character or use a generic skeleton.
2. Search for desired animations (e.g., "Walk", "Handgun Idle" or "Pistol Shoot").
3. Click the animation and choose "Download". Export as "FBX for Unity" or "FBX" and include the skin or without skin if you only need the animation.
4. Rename the downloaded files to match the paths in `public/js/scenes.js`, e.g. `walk.fbx` and `shoot_handgun.fbx`, and place them in this folder.

Notes:
- The game will attempt to load clips from `ENEMY_DEFS.Grunt.animationUrls` and attach them to the enemy mixer.
- Clip naming heuristics: clips with names containing "walk" -> walk action, "run" -> run, "idle" -> idle, "shoot" or "fire" -> shoot action.
- If you prefer GLB/GLTF, use `.glb` or `.gltf` and update the filenames accordingly.

If you want, I can download suitable CC0 animations and add them for you — would you like me to try that now? (may require network access and permission)