// js/sceneManager.js
import { runCameraSteps } from "./cameraRails.js";

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

    // Load a scene: build world and run intro rails only
    async loadScene(sceneDef) {
        if (!sceneDef || typeof sceneDef !== "object") {
            console.error("SceneManager.loadScene: invalid scene", sceneDef);
            return;
        }

        this.currentScene = sceneDef;

        console.log(`SceneManager loading scene: ${sceneDef.name}`);

        // Build the world (SceneLoader handles props, enemies, room, lights)
        this.sceneLoader.loadScene(sceneDef);

        // Run intro camera steps if defined
        if (sceneDef.introSteps?.length) {
            await runCameraSteps(this.camera, sceneDef.introSteps);
        }

        // Combat happens here; SceneLoader emits "sceneComplete" when done
    }

    // Called by SceneLoader when scene completes
    async onSceneCompleted(scene) {
        console.log(`Scene completed: ${scene.name}`);

        // Run exit camera steps
        if (scene.exitSteps?.length) {
            await runCameraSteps(this.camera, scene.exitSteps);
        }

        // Load the next scene if defined
        if (scene.nextScene) {
            this.loadScene(scene.nextScene);
        }
    }
}
