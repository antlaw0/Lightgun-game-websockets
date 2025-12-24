// js/sceneManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { runCameraRails } from "./cameraRails.js";

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
