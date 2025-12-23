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
        if (sceneDef.group) {
            sceneDef.group.visible = true;
        }

        // Run intro camera rails if defined
        const introRails = sceneDef.cameraRails?.intro;
        if (Array.isArray(introRails) && introRails.length > 0) {
            // Run camera rails and transition objects in parallel
            await Promise.all([
                runCameraRails(this.camera, introRails),
                this.runTransitionObjects(sceneDef)
            ]);
        }
    }

    // Trigger the next scene mid-rail
    async triggerNextSceneAtStep(nextScene) {
        if (!nextScene.group) return;

        // Make sure the scene group is visible
        nextScene.group.visible = true;

        // Optionally fade in the next scene smoothly
        await this.fadeInScene(nextScene.group, 1); // 1 second fade
    }

    // Fade in a scene's objects
    async fadeInScene(sceneGroup, duration = 1) {
        sceneGroup.traverse(obj => {
            if (obj.material) {
                obj.material.transparent = true;
                obj.material.opacity = 0;
            }
        });

        return new Promise(resolve => {
            let t = 0;
            const clock = new THREE.Clock();

            function step() {
                t += clock.getDelta() / duration;
                sceneGroup.traverse(obj => {
                    if (obj.material && obj.material.transparent) {
                        obj.material.opacity = Math.min(t, 1);
                    }
                });
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            }
            step();
        });
    }

    // Called when SceneLoader dispatches sceneComplete
    async onSceneCompleted(scene) {
        if (scene !== this.currentScene) return;
        console.log(`Scene completed: ${scene.name}`);

        const exitRails = scene.cameraRails?.exit;
        if (Array.isArray(exitRails) && exitRails.length > 0) {
            // Run exit camera rails and optional transition objects
            await Promise.all([
                runCameraRails(this.camera, exitRails),
                this.runTransitionObjects(scene)
            ]);
        }

        // Transition to next scene if defined
        if (scene.nextScene) {
            await this.loadScene(scene.nextScene);
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
        const duration = obj.duration || 1; // seconds
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
