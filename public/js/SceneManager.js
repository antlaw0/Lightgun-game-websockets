// js/sceneManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { runCameraRails } from "./cameraRails.js";

export class SceneManager {
    constructor(camera, sceneLoader) {
        this.camera = camera;
        this.sceneLoader = sceneLoader;
        this.currentScene = null;
        this.previousScene = null;
        this._cameraRailsToken = null;

        this.manualDoorAnimations = [];

        this._onKeyDown = (ev) => {
            if (ev.key.toLowerCase() === 'f') {
                const door = this.findNearestDoor(4.5);
                if (door) this.toggleDoor(door);
            }
        };

        this._onSceneComplete = (e) => {
            const scene = e.detail.scene;
            this.onSceneCompleted(scene);
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener("sceneComplete", this._onSceneComplete);
    }

    findNearestDoor(maxDist = 6.0) {
        let best = null;
        let bestDist = Infinity;
        const cameraPos = this.camera.position;

        (this.sceneLoader.props || []).forEach(p => {
            if (!p || !p.mesh) return;
            if (!p.mesh.userData.isDoor) return;

            const doorPos = (typeof p.getDoorCenterPosition === 'function')
                ? p.getDoorCenterPosition()
                : p.mesh.getWorldPosition(new THREE.Vector3());
            const dx = cameraPos.x - doorPos.x;
            const dz = cameraPos.z - doorPos.z;
            const horizontalDistance = Math.hypot(dx, dz);
            const d = doorPos.distanceTo(cameraPos);
            const effectiveDistance = Math.min(d, horizontalDistance);
            if (effectiveDistance < bestDist && (d <= maxDist || horizontalDistance <= 5.5)) {
                bestDist = effectiveDistance;
                best = p;
            }
        });

        return best;
    }

    toggleDoor(doorProp) {
        const hinge = doorProp.mesh;
        if (!hinge) return;

        // Prefer the canonical Door API when available.
        // This keeps behavior consistent with game.js interaction and avoids
        // conflicting concurrent animations on the same hinge.
        if (typeof doorProp.openDoor === 'function' && typeof doorProp.closeDoor === 'function') {
            if (doorProp.isOpen) {
                doorProp.closeDoor();
            } else {
                doorProp.openDoor();
            }
            return;
        }

        const isOpen = hinge.userData.isOpen || false;
        
        const doorWorldPos = new THREE.Vector3();
        hinge.getWorldPosition(doorWorldPos);

        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);

        const doorDirection = new THREE.Vector3(0, 0, 1);
        doorDirection.applyQuaternion(hinge.quaternion);
        
        const dot = cameraDirection.dot(doorDirection);
        
        let targetRotation;
        if (isOpen) {
            targetRotation = hinge.userData.closedRotation || 0;
        } else {
            hinge.userData.closedRotation = hinge.rotation.y;
            targetRotation = hinge.rotation.y + (dot > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
        
        this.startManualDoorAnimation(hinge, targetRotation, 1000);
    }

    startManualDoorAnimation(mesh, targetRotation, duration = 1000) {
        this.manualDoorAnimations = this.manualDoorAnimations.filter(a => a.mesh !== mesh);

        this.manualDoorAnimations.push({
            mesh,
            startRotation: mesh.rotation.y,
            targetRotation,
            progress: 0,
            duration
        });

        try {
            const s = new Audio('assets/sfx/door_open.ogg');
            s.volume = 0.7;
            s.play().catch(()=>{});
        } catch(e){}
    }

    async loadScene(sceneDef) {
        this._cancelActiveCameraRails();
        this.currentScene = sceneDef;

        if (this.sceneLoader.hasPendingScene() &&
            this.sceneLoader.pendingSceneDef === sceneDef) {
            this.sceneLoader.commitPendingScene();
        } else {
            this.sceneLoader.loadScene(sceneDef);
        }

        this._startSceneCameraRails(sceneDef);
    }

    async onSceneCompleted(scene) {
        if (scene !== this.currentScene) return;

        // If this scene uses camera rails, scene progression is expected to be
        // controlled by rails steps (typically a step with triggerNextScene).
        const hasRails = this._getCameraRailsSteps(scene).length > 0;
        if (hasRails) {
            return;
        }

        await this._loadNextScene(scene);
    }

    async _loadNextScene(scene) {

        if (scene.nextScene) {
            this.sceneLoader.preloadScene(scene.nextScene);
            await this.loadScene(scene.nextScene);
        }
    }

    _startSceneCameraRails(sceneDef) {
        const steps = this._getCameraRailsSteps(sceneDef);
        if (!steps.length) return;

        const token = { cancelled: false };
        this._cameraRailsToken = token;

        runCameraRails(this.camera, steps, {
            cancelToken: token,
            sceneLoader: this.sceneLoader,
            defaultContinueCondition: () => this._countAliveEnemies() === 0,
            onTriggerNextScene: async () => {
                if (token.cancelled) return;
                await this._loadNextScene(sceneDef);
            }
        }).catch((err) => {
            if (token.cancelled) return;
            console.warn('[SceneManager] camera rails failed:', err);
        });
    }

    _cancelActiveCameraRails() {
        if (this._cameraRailsToken) {
            this._cameraRailsToken.cancelled = true;
            this._cameraRailsToken = null;
        }
    }

    _countAliveEnemies() {
        const enemies = Array.isArray(this.sceneLoader?.enemies) ? this.sceneLoader.enemies : [];
        let alive = 0;
        for (const enemy of enemies) {
            if (!enemy) continue;
            if (enemy._isDead || enemy._isDying) continue;
            if (enemy._isActive === false) continue;
            alive++;
        }
        return alive;
    }

    _getCameraRailsSteps(sceneDef) {
        if (!sceneDef || !sceneDef.cameraRails) return [];

        const rails = sceneDef.cameraRails;
        if (Array.isArray(rails)) return rails;
        if (Array.isArray(rails.steps)) return rails.steps;

        // Backward compatibility for older schema: { intro: [], exit: [] }
        if (Array.isArray(rails.intro) || Array.isArray(rails.exit)) {
            return [
                ...(Array.isArray(rails.intro) ? rails.intro : []),
                ...(Array.isArray(rails.exit) ? rails.exit : [])
            ];
        }

        return [];
    }

    update(dt) {
        for (let i=this.manualDoorAnimations.length-1; i>=0; i--) {
            const a = this.manualDoorAnimations[i];
            a.progress += dt;
            const alpha = Math.min(1, a.progress / a.duration);
            a.mesh.rotation.y = THREE.MathUtils.lerp(a.startRotation, a.targetRotation, alpha);
            if (alpha >= 1) {
                a.mesh.userData.isOpen = !a.mesh.userData.isOpen;
                this.manualDoorAnimations.splice(i,1);
            } else {
                a.mesh.userData.isOpen = a.mesh.rotation.y !== a.startRotation;
            }
        }
    }

    destroy() {
        this._cancelActiveCameraRails();
        try { window.removeEventListener('keydown', this._onKeyDown); } catch (e) {}
        try { window.removeEventListener('sceneComplete', this._onSceneComplete); } catch (e) {}
        this.manualDoorAnimations = [];
    }
}