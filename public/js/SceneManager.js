// js/sceneManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { runCameraRails } from "./cameraRails.js";

export class SceneManager {
    constructor(camera, sceneLoader) {
        this.camera = camera;
        this.sceneLoader = sceneLoader;
        this.currentScene = null;

        // Transition state
        this.transitionState = {
            active: false,
            door: null,
            nextScene: null,
            startRotation: 0,
            targetRotation: 0,
            progress: 0,
            switched: false,
            cameraStartPos: new THREE.Vector3(),
            cameraTargetPos: new THREE.Vector3(),
            doorOpenSound: null
        };

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
        // Check if this scene is already preloaded
        if (this.sceneLoader.hasPendingScene() && this.sceneLoader.pendingSceneDef === sceneDef) {
             this.sceneLoader.commitPendingScene();
        } else {
             this.sceneLoader.loadScene(sceneDef);
        }

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

        // 1. Preload next scene if available
        if (scene.nextScene) {
            this.sceneLoader.preloadScene(scene.nextScene);
        }

        const exitRails = scene.cameraRails?.exit;
        if (Array.isArray(exitRails) && exitRails.length > 0) {
            // Run exit rails
            await runCameraRails(this.camera, exitRails);
        }

        // 2. Perform Door Transition if next scene exists
        if (scene.nextScene) {
            await this.performDoorTransition(scene, scene.nextScene);
        }
    }

    async performDoorTransition(currentSceneDef, nextSceneDef) {
        // Find exit door in current scene
        let exitDoor = null;
        if (currentSceneDef.exitDoorId) {
            exitDoor = this.sceneLoader.propsById[currentSceneDef.exitDoorId];
        } else {
            // Fallback: find nearest door
            let minDist = Infinity;
            this.sceneLoader.props.forEach(p => {
                if (p.mesh && p.mesh.userData.type === 'door') {
                    const d = p.mesh.position.distanceTo(this.camera.position);
                    if (d < minDist) {
                        minDist = d;
                        exitDoor = p;
                    }
                }
            });
        }

        if (!exitDoor) {
            console.warn("No exit door found for transition. Switching immediately.");
            await this.loadScene(nextSceneDef);
            return;
        }

        console.log("Starting door transition...");

        // Setup transition state
        this.transitionState.active = true;
        this.transitionState.door = exitDoor.mesh;
        this.transitionState.nextScene = nextSceneDef;
        this.transitionState.switched = false;
        this.transitionState.progress = 0;
        
        // Door rotation: open 90 degrees (PI/2)
        this.transitionState.startRotation = exitDoor.mesh.rotation.y;
        this.transitionState.targetRotation = this.transitionState.startRotation + Math.PI / 2;

        // Camera push: move forward 1.5 meters
        this.transitionState.cameraStartPos.copy(this.camera.position);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        this.transitionState.cameraTargetPos.copy(this.camera.position).add(forward.multiplyScalar(1.5));

        // Play sound
        try {
            const sound = new Audio("assets/sfx/door_open.ogg"); 
            sound.volume = 0.6;
            sound.play().catch(() => {});
        } catch (e) {}

        // Return a promise that resolves when transition is fully complete
        return new Promise(resolve => {
            this.transitionState.onComplete = resolve;
        });
    }

    update(dt) {
        if (!this.transitionState.active) return;

        const ts = this.transitionState;
        const duration = 2000; // 2 seconds for full open
        
        ts.progress += dt;
        const t = Math.min(1, ts.progress / duration);
        
        // Animate door
        if (ts.door) {
            ts.door.rotation.y = THREE.MathUtils.lerp(ts.startRotation, ts.targetRotation, t);
        }

        // Animate camera push (only for first part, maybe 30% of duration)
        if (t < 0.3) {
            const camT = t / 0.3;
            this.camera.position.lerpVectors(ts.cameraStartPos, ts.cameraTargetPos, camT);
        }

        // Check for switch trigger (10 degrees approx 11% of 90)
        if (t > 0.15 && !ts.switched) {
            console.log("Mid-transition: Switching scenes...");
            ts.switched = true;
            
            // Capture current door rotation to sync
            const currentDoorRot = ts.door.rotation.y;
            
            // Commit new scene
            this.sceneLoader.commitPendingScene();
            this.currentScene = ts.nextScene;
            
            // Find intro door in new scene
            let introDoor = null;
            if (ts.nextScene.introDoorId) {
                introDoor = this.sceneLoader.propsById[ts.nextScene.introDoorId];
            } else {
                 // Fallback: find nearest door
                let minDist = Infinity;
                this.sceneLoader.props.forEach(p => {
                    if (p.mesh && p.mesh.userData.type === 'door') {
                        const d = p.mesh.position.distanceTo(this.camera.position);
                        if (d < minDist) {
                            minDist = d;
                            introDoor = p;
                        }
                    }
                });
            }

            if (introDoor) {
                ts.door = introDoor.mesh;
                // Sync rotation
                ts.door.rotation.y = currentDoorRot;
            } else {
                ts.door = null; // Stop animating door if not found
            }

            // Start intro rails for new scene
            const introRails = ts.nextScene.cameraRails?.intro;
            if (Array.isArray(introRails) && introRails.length > 0) {
                runCameraRails(this.camera, introRails);
            }
        }

        if (t >= 1) {
            ts.active = false;
            if (ts.onComplete) ts.onComplete();
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
        // Play optional sound attached to the transition object at start
        try {
            if (obj.sound) {
                const a = new Audio(obj.sound);
                a.play().catch(() => {});
            }
        } catch (e) { /* ignore audio errors */ }

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
