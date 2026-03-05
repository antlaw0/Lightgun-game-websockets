// js/sceneManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { runCameraRails } from "./cameraRails.js";

export class SceneManager {
    constructor(camera, sceneLoader) {
        this.camera = camera;
        this.sceneLoader = sceneLoader;
        this.currentScene = null;
        this.previousScene = null;

        this.manualDoorAnimations = [];

        window.addEventListener('keydown', (ev) => {
            if (ev.key.toLowerCase() === 'f') {
                const door = this.findNearestDoor(3.0);
                if (door) this.toggleDoor(door);
            }
        });

        window.addEventListener("sceneComplete", (e) => {
            const scene = e.detail.scene;
            this.onSceneCompleted(scene);
        });
    }

    findNearestDoor(maxDist = 3.0) {
        let best = null;
        let bestDist = Infinity;
        const cameraPos = this.camera.position;

        (this.sceneLoader.props || []).forEach(p => {
            if (!p || !p.mesh) return;
            if (!p.mesh.userData.isDoor) return;

            const d = p.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(cameraPos);
            if (d < bestDist && d <= maxDist) {
                bestDist = d;
                best = p;
            }
        });

        return best;
    }

    toggleDoor(doorProp) {
        const hinge = doorProp.mesh;
        if (!hinge) return;

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
        this.currentScene = sceneDef;

        if (this.sceneLoader.hasPendingScene() &&
            this.sceneLoader.pendingSceneDef === sceneDef) {
            this.sceneLoader.commitPendingScene();
        } else {
            this.sceneLoader.loadScene(sceneDef);
        }
    }

    async onSceneCompleted(scene) {
        if (scene !== this.currentScene) return;

        if (scene.nextScene) {
            this.sceneLoader.preloadScene(scene.nextScene);
            await this.loadScene(scene.nextScene);
        }
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
            }
        }
    }
}