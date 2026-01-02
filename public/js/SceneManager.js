// js/sceneManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { runCameraRails } from "./cameraRails.js";
import { ENEMY_INSTANCES } from "./enemy.js";

export class SceneManager {
    constructor(camera, sceneLoader) {
        this.camera = camera;
        this.sceneLoader = sceneLoader;
        this.currentScene = null;

        // Listen for scene completion from SceneLoader
        window.addEventListener("sceneComplete", (e) => {
            const scene = e.detail.scene;
            this.onSceneCompleted(scene);
        });
    }

    // Load a scene: build world and run intro rails
    async loadScene(sceneDef) {
        if (!sceneDef || typeof sceneDef !== "object") {
            console.error("SceneManager.loadScene: invalid scene", sceneDef);
            return;
        }

        this.currentScene = sceneDef;
        console.log(`SceneManager loading scene: ${sceneDef.name}`);

// ===== HARD RESET ENEMIES BEFORE NEW SCENE =====
ENEMY_INSTANCES.forEach(enemy => {
  if (enemy.mesh && enemy.mesh.parent) {
    enemy.mesh.parent.remove(enemy.mesh);
  }
});
ENEMY_INSTANCES.length = 0;

// ===== RESET SCENE GROUP TRANSFORM =====
if (sceneDef.group) {
  sceneDef.group.position.set(0, 0, 0);
  sceneDef.group.rotation.set(0, 0, 0);
  sceneDef.group.scale.set(1, 1, 1);
}

// Build the world (props, enemies, room, lights)
this.sceneLoader.loadScene(sceneDef);


        // Optionally hide scene objects until ready (can fade in later)
        if (sceneDef.group) sceneDef.group.visible = true;

        // Run intro camera rails if defined
        const introRails = sceneDef.cameraRails?.intro;
        if (Array.isArray(introRails) && introRails.length > 0) {
            await Promise.all([
                runCameraRails(this.camera, introRails),
                this.runTransitionObjects(sceneDef)
            ]);
        }
    }

    // Called when SceneLoader dispatches sceneComplete
    async onSceneCompleted(scene) {
        if (scene !== this.currentScene) return;
        console.log(`Scene completed: ${scene.name}`);
console.log("Clearing enemies and loading next scene:", scene.nextScene?.name);

        const exitRails = scene.cameraRails?.exit;
        if (Array.isArray(exitRails) && exitRails.length > 0) {
            // Run exit rails, passing a callback to load the next scene
            await runCameraRails(this.camera, exitRails, async () => {
                // After the last step with triggerNextScene
                if (scene.nextScene) {
                    await this.loadScene(scene.nextScene);
                }
            });

            // Animate transition objects in parallel
            await this.runTransitionObjects(scene);
        } else {
            // If no exit rails, immediately load next scene
            if (scene.nextScene) {
                await this.loadScene(scene.nextScene);
            }
        }
    }

    // Animate optional transition objects like doors or props
    async runTransitionObjects(sceneDef) {
        if (!sceneDef.transitionObjects || !Array.isArray(sceneDef.transitionObjects)) return;
        const promises = sceneDef.transitionObjects.map(obj => this.animateObject(obj));
        await Promise.all(promises);
    }

    // Animate a single object (example: door rotation)
    async animateObject(obj) {
        if (!obj || !obj.object3D) return;
        const targetRotation = obj.targetRotation || null;
        const duration = obj.duration || 1;
        if (!targetRotation) return;

        return new Promise(resolve => {
            const startRot = obj.object3D.rotation.clone();
            let t = 0;
            const clock = new THREE.Clock();

            function step() {
                t += clock.getDelta() / duration;
                obj.object3D.rotation.x = THREE.MathUtils.lerp(startRot.x, targetRotation.x, Math.min(t, 1));
                obj.object3D.rotation.y = THREE.MathUtils.lerp(startRot.y, targetRotation.y, Math.min(t, 1));
                obj.object3D.rotation.z = THREE.MathUtils.lerp(startRot.z, targetRotation.z, Math.min(t, 1));
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            }
            step();
        });
    }
}

/**
 * Dev helper: instant scene loader by filename.
 * Usage from console:
 *    window.sceneManager.loadSceneByName("scene_w1_2");
 * Assumes scene files live in /js/scenes/ and export a single scene object.
 */
SceneManager.prototype.loadSceneByName = async function(sceneName) {
    if (!sceneName || typeof sceneName !== "string") {
        console.error("loadSceneByName: invalid scene name", sceneName);
        return;
    }

    try {
        // Optional: cleanup current scene
        if (this.currentScene && typeof this.currentScene.cleanup === "function") {
            this.currentScene.cleanup();
        }

        // Dynamic import from your new scenes folder
        const sceneModule = await import(`/js/scenes/${sceneName}.js`);

        // Grab the first exported object as the scene
        const sceneDef = sceneModule[Object.keys(sceneModule)[0]];

        if (!sceneDef) {
            console.error("Scene not found in module:", sceneName);
            return;
        }

        // Load it through the normal SceneManager pipeline
        await this.loadScene(sceneDef);

        console.log(`Dev helper: loaded scene "${sceneName}"`);
    } catch (err) {
        console.error(`Failed to load scene "${sceneName}":`, err);
    }
};


