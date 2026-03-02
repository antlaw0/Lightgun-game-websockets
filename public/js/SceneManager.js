// js/sceneManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { runCameraRails } from "./cameraRails.js";

export class SceneManager {
    constructor(camera, sceneLoader) {
        this.camera = camera;
        this.sceneLoader = sceneLoader;
        this.currentScene = null;

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
    const od = (typeof def.openDirection === 'number') ? def.openDirection : 1; // pivot side
    const io = (typeof def.openInOut === 'number') ? def.openInOut : 1;        // 1 outward, -1 inward
    const isOpen = !!mesh.userData.isOpen;

    // Correct swing: center-pivot adjustment
    // od: -1 left, 1 right
    // io: 1 outward, -1 inward
    const swingSign = -od * io;  // center-pivot: multiply directly
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
            await runCameraRails(this.camera, exitRails, null, null);
        }

        if (scene.nextScene) {
            await this.performDoorCutTransition(scene.nextScene);
        }
    }

async performDoorCutTransition(nextSceneDef) {
    this.sceneLoader.commitPendingScene();
    this.currentScene = nextSceneDef;

    const introDoor = nextSceneDef.introDoorId ? this.sceneLoader.propsById[nextSceneDef.introDoorId] : null;
    if (!introDoor || !introDoor.mesh) {
        console.warn("No intro door found.");
        await this.loadScene(nextSceneDef);
        return;
    }

    const mesh = introDoor.mesh;
    const def = introDoor._sceneDef || mesh._sceneDef || {};

    // Set initial rotation from rotationY if defined
    const baseRotation = (def.rotationY !== undefined) ? THREE.MathUtils.degToRad(def.rotationY) : mesh.rotation.y || 0;
    mesh.rotation.y = baseRotation;
    mesh.userData.isOpen = false;
    mesh.updateMatrixWorld(true);
    
    // Calculate Center position from Hinge (mesh) position
    // Hinge is at mesh.position. Center is Hinge - (Width/2 * od * Right)
    const width = introDoor.size?.x ?? 1.2;
    const od = (typeof def.openDirection === 'number') ? def.openDirection : 1;
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, baseRotation, 0));
    const hingePos = mesh.getWorldPosition(new THREE.Vector3());
    const centerPos = hingePos.clone().add(right.clone().multiplyScalar( - (width / 2) * od ));

    // Door forward vector (local +Z rotated)
const doorForward = new THREE.Vector3(0, 0, 1)
    .applyEuler(new THREE.Euler(0, baseRotation, 0))
    .normalize();

// Determine which side of the door we are currently on
const currentCamPos = this.camera.position.clone();
const toCamera = currentCamPos.clone().sub(centerPos).normalize();

// Dot product tells us if we are in front or behind
const dot = doorForward.dot(toCamera);

// If dot > 0, camera is in front of doorForward
// If dot < 0, camera is behind doorForward
// We want camStart to be on the SAME side we came from

//const outsideSign = (dot > 0) ? 1 : -1;

// Camera starts outside
//const camStart = centerPos.clone()
    //.add(doorForward.clone().multiplyScalar(outsideSign * 2.5));

//camStart.y = 1.7;
  // Camera starts outside the door
const outsideSign = 1; // 1 = outside, -1 = inside
const camStart = centerPos.clone()
    .add(doorForward.clone().multiplyScalar(outsideSign * 2.5));
camStart.y = 1.7;  
	// Camera target: move through the door into the room
    const camTarget = centerPos.clone()
    .add(doorForward.clone().multiplyScalar(-outsideSign * 2.0));

camTarget.y = camStart.y;
    
	// Look target: straight down the hallway
    const lookTarget = centerPos.clone()
        .add(doorForward.clone().multiplyScalar(10.0));
    lookTarget.y = camStart.y;

    // Control point for arc (keep low to avoid clipping door header)
    const camControl = camStart.clone().lerp(camTarget, 0.5);
    camControl.y += 0.1;

    // Correct door rotation based on pivot + in/out
    const io = (typeof def.openInOut === 'number') ? def.openInOut : 1;
    const swingSign = -od * io;
    const targetRot = baseRotation + Math.PI / 2 * swingSign;

    // Initialize camera cleanly
this.camera.rotation.x = 0; // reset vertical tilt
this.camera.rotation.y = 0; // reset yaw
this.camera.rotation.z = 0; // reset roll

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
        // Manual door animations
        for (let i = this.manualDoorAnimations.length - 1; i >= 0; i--) {
            const a = this.manualDoorAnimations[i];
            a.progress += dt;
            const alpha = Math.min(1, a.progress / a.duration);
            a.mesh.rotation.y = THREE.MathUtils.lerp(a.startRotation, a.targetRotation, alpha);
            if (alpha >= 1) {
                a.mesh.userData.isOpen = !a.mesh.userData.isOpen;
                this.manualDoorAnimations.splice(i, 1);
            }
        }

        // Transition door + camera
        if (!this.transitionState.active) return;

        const ts = this.transitionState;
        ts.progress += dt;
        const t = Math.min(1, ts.progress / ts.duration);

        // Play door sound
        if (!ts.soundPlayed && t >= 0.1) {
            try {
                const s = new Audio('assets/sfx/door_open.ogg');
                s.volume = 0.7;
                s.play().catch(()=>{});
            } catch(e){}
            ts.soundPlayed = true;
        }

        // Door rotation
        ts.door.rotation.y = THREE.MathUtils.lerp(ts.startRotation, ts.targetRotation, t);

        // Camera quadratic Bézier arc
        if (ts.cameraStart && ts.cameraTarget && ts.cameraControlPoints) {
            const p0 = ts.cameraStart, p1 = ts.cameraControlPoints, p2 = ts.cameraTarget;
            const oneMinusT = 1 - t;
            const pos = new THREE.Vector3(
                oneMinusT*oneMinusT*p0.x + 2*oneMinusT*t*p1.x + t*t*p2.x,
                oneMinusT*oneMinusT*p0.y + 2*oneMinusT*t*p1.y + t*t*p2.y,
                oneMinusT*oneMinusT*p0.z + 2*oneMinusT*t*p1.z + t*t*p2.z
            );
            this.camera.position.copy(pos);
            if (ts.lookTarget) {
                this.camera.lookAt(ts.lookTarget);
            } else {
                this.camera.lookAt(ts.door.getWorldPosition(new THREE.Vector3()));
            }
        }

        if (t >= 1) {
            ts.active = false;
            if (ts.onComplete) ts.onComplete();
        }
    }
}