// js/sceneManager.js
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

    // Load a scene: build world and run intro rails only
    async loadScene(sceneDef) {
        if (!sceneDef || typeof sceneDef !== "object") {
            console.error("SceneManager.loadScene: invalid scene", sceneDef);
            return;
        }

        this.currentScene = sceneDef;

        console.log(`SceneManager loading scene: ${sceneDef.name}`);

        // Build the world (props, enemies, room, lights)
        this.sceneLoader.loadScene(sceneDef);

        // Run intro camera rails if defined
        const introRails = sceneDef.cameraRails?.intro;
        if (Array.isArray(introRails) && introRails.length > 0) {
            await runCameraRails(this.camera, introRails);
        }

        // Gameplay begins after this point
        // SceneLoader will emit "sceneComplete" when enemies are cleared
    }

    // Called when SceneLoader dispatches sceneComplete
    async onSceneCompleted(scene) {
        // Ignore stale events
        if (scene !== this.currentScene) return;

        console.log(`Scene completed: ${scene.name}`);

        // Run exit camera rails if defined
        const exitRails = scene.cameraRails?.exit;
        if (Array.isArray(exitRails) && exitRails.length > 0) {
            await runCameraRails(this.camera, exitRails);
        }

        // Transition to next scene if defined
        if (scene.nextScene) {
            await this.loadScene(scene.nextScene);
        }
    }
}
