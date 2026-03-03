// js/sceneManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { runCameraRails } from "./cameraRails.js";

const DOOR_CAMERA_DISTANCE = 0.1; // distance from door for all transitions
const CAMERA_HEIGHT = 1.7; // vertical height of camera

export class SceneManager {
    constructor(camera, sceneLoader) {
        this.camera = camera;
        this.sceneLoader = sceneLoader;
        this.currentScene = null;
        this.previousScene = null;

        this.transitionState = {
            active: false,
            door: null,
            startRotation: 0,
            targetRotation: 0,
            progress: 0,
            duration: 0,
            onComplete: null,
            cameraStart: null,
            cameraTarget: null,
            cameraControlPoints: null,
            lookTarget: null,
            soundPlayed: false
        };

        this.manualDoorAnimations = [];

        window.addEventListener('keydown', (ev) => {
            if (ev.key.toLowerCase() === 'f') {
                if (this.transitionState.active) return;
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
            if (p.mesh.userData.type !== 'door') return;

            const d = p.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(cameraPos);
            if (d < bestDist && d <= maxDist) {
                bestDist = d;
                best = p;
            }
        });

        return best;
    }

    toggleDoor(doorPropOrMesh) {
        const mesh = doorPropOrMesh.mesh || doorPropOrMesh;
        if (!mesh) return;

        const def = doorPropOrMesh._sceneDef || mesh._sceneDef || {};
        const od = (typeof def.openDirection === 'number') ? def.openDirection : 1;
        const io = (typeof def.openInOut === 'number') ? def.openInOut : 1;
        const isOpen = !!mesh.userData.isOpen;

        const swingSign = -od * io;
        const rotDelta = (isOpen ? -1 : 1) * swingSign * Math.PI / 2;

        const targetRotation = mesh.rotation.y + rotDelta;
        this.startManualDoorAnimation(mesh, targetRotation, this.currentScene?.transitionDuration || 1000);
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

        if (sceneDef.group) sceneDef.group.visible = true;

        const introRails = sceneDef.cameraRails?.intro;
        if (Array.isArray(introRails) && introRails.length > 0) {
            await runCameraRails(this.camera, introRails, null, null);
        }
    }

    async onSceneCompleted(scene) {
        if (scene !== this.currentScene) return;

        if (scene.nextScene) {
            this.sceneLoader.preloadScene(scene.nextScene);
        }

        const exitRails = scene.cameraRails?.exit;
        if (Array.isArray(exitRails) && exitRails.length > 0) {
            // Run exit rails
            await runCameraRails(this.camera, exitRails, null, null);

            // Align camera centered in front of exit door
            if (scene.exitDoorId) {
                const exitDoor = this.sceneLoader.propsById[scene.exitDoorId];
                if (exitDoor?.mesh) {
                    const mesh = exitDoor.mesh;
                    const def = exitDoor._sceneDef || mesh._sceneDef || {};
                    const width = exitDoor.size?.x ?? 1.2;
                    const od = (typeof def.openDirection === 'number') ? def.openDirection : 1;
                    const baseRotation = (def.rotationY !== undefined) ? THREE.MathUtils.degToRad(def.rotationY) : mesh.rotation.y || 0;

                    const right = new THREE.Vector3(1,0,0).applyEuler(new THREE.Euler(0, baseRotation,0));
                    const hingePos = mesh.getWorldPosition(new THREE.Vector3());
                    const centerPos = hingePos.clone().add(right.clone().multiplyScalar(width/2 * od));

                    const doorForward = new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(0, baseRotation,0)).normalize();

                    // Camera positioned centered and DOOR_CAMERA_DISTANCE behind the door
                    const camPos = centerPos.clone().sub(doorForward.clone().multiplyScalar(DOOR_CAMERA_DISTANCE));
                    camPos.y = CAMERA_HEIGHT;
                    this.camera.position.copy(camPos);
                    this.camera.lookAt(centerPos);
                }
            }
        }

        if (scene.nextScene) {
            await this.performDoorCutTransition(scene.nextScene);
        }
    }

    async performDoorCutTransition(nextSceneDef) {
        this.sceneLoader.commitPendingScene();
        this.previousScene = this.currentScene;
        this.currentScene = nextSceneDef;

        const introDoor = nextSceneDef.introDoorId ? this.sceneLoader.propsById[nextSceneDef.introDoorId] : null;
        if (!introDoor || !introDoor.mesh) {
            console.warn("No intro door found.");
            await this.loadScene(nextSceneDef);
            return;
        }

        const mesh = introDoor.mesh;
        const def = introDoor._sceneDef || mesh._sceneDef || {};
        const baseRotation = (def.rotationY !== undefined) ? THREE.MathUtils.degToRad(def.rotationY) : mesh.rotation.y || 0;
        mesh.rotation.y = baseRotation;
        mesh.userData.isOpen = false;
        mesh.updateMatrixWorld(true);

        const width = introDoor.size?.x ?? 1.2;
        const od = (typeof def.openDirection === 'number') ? def.openDirection : 1;
        const right = new THREE.Vector3(1,0,0).applyEuler(new THREE.Euler(0, baseRotation,0));
        const hingePos = mesh.getWorldPosition(new THREE.Vector3());
        const centerPos = hingePos.clone().add(right.clone().multiplyScalar(width/2 * od));

        const doorForward = new THREE.Vector3(0,0,1).applyEuler(new THREE.Euler(0, baseRotation,0)).normalize();

        // Camera starts at door-centered position and DOOR_CAMERA_DISTANCE
        const camStart = centerPos.clone().sub(doorForward.clone().multiplyScalar(DOOR_CAMERA_DISTANCE));
        camStart.y = CAMERA_HEIGHT;

        const camTarget = centerPos.clone().sub(doorForward.clone().multiplyScalar(DOOR_CAMERA_DISTANCE*2));
        camTarget.y = camStart.y;

        const lookTarget = centerPos.clone().add(doorForward.clone().multiplyScalar(10.0));
        lookTarget.y = camStart.y;

        const camControl = camStart.clone().lerp(camTarget, 0.5);
        camControl.y += 0.1;

        const io = (typeof def.openInOut === 'number') ? def.openInOut : 1;
        const swingSign = -od * io;
        const targetRot = baseRotation + Math.PI/2 * swingSign;

        this.camera.rotation.set(0,0,0);
        this.camera.position.copy(camStart);
        this.camera.lookAt(lookTarget);

        this.transitionState = {
            active: true,
            door: mesh,
            startRotation: baseRotation,
            targetRotation: targetRot,
            progress: 0,
            duration: nextSceneDef.transitionDuration || 1500,
            cameraStart: camStart,
            cameraTarget: camTarget,
            cameraControlPoints: camControl,
            lookTarget: lookTarget,
            onComplete: async () => {
                mesh.userData.isOpen = true;
                const introRails = nextSceneDef.cameraRails?.intro;
                if (Array.isArray(introRails) && introRails.length > 0) {
                    await runCameraRails(this.camera, introRails, null, null);
                }
            },
            soundPlayed: false
        };
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

        if (!this.transitionState.active) return;

        const ts = this.transitionState;
        ts.progress += dt;
        const t = Math.min(1, ts.progress / ts.duration);

        if (!ts.soundPlayed && t >= 0.1) {
            try {
                const s = new Audio('assets/sfx/door_open.ogg');
                s.volume = 0.7;
                s.play().catch(()=>{});
            } catch(e){}
            ts.soundPlayed = true;
        }

        ts.door.rotation.y = THREE.MathUtils.lerp(ts.startRotation, ts.targetRotation, t);

        if (ts.cameraStart && ts.cameraTarget && ts.cameraControlPoints) {
            const p0 = ts.cameraStart, p1 = ts.cameraControlPoints, p2 = ts.cameraTarget;
            const oneMinusT = 1-t;
            const pos = new THREE.Vector3(
                oneMinusT*oneMinusT*p0.x + 2*oneMinusT*t*p1.x + t*t*p2.x,
                oneMinusT*oneMinusT*p0.y + 2*oneMinusT*t*p1.y + t*t*p2.y,
                oneMinusT*oneMinusT*p0.z + 2*oneMinusT*t*p1.z + t*t*p2.z
            );
            this.camera.position.copy(pos);
            this.camera.lookAt(ts.lookTarget || ts.door.getWorldPosition(new THREE.Vector3()));
        }

        if (t>=1) {
            ts.active = false;
            if (ts.onComplete) ts.onComplete();
        }
    }
}