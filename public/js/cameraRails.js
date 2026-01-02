import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { HUD } from './hud.js'; // if not already imported


/**
 * Run camera rails steps.
 * @param {THREE.Camera} camera 
 * @param {Array} steps - Array of step objects
 * @param {Function} onTriggerNextScene - optional callback if a step has triggerNextScene: true
 */
// Footstep sounds for concrete surface
const footstepSoundsConcrete = [
    new Audio("assets/sfx/pl_crete1.ogg"),
    new Audio("assets/sfx/pl_crete2.ogg"),
    new Audio("assets/sfx/pl_crete3.ogg"),
];

// Optional: set volume
footstepSoundsConcrete.forEach(s => s.volume = 0.5);

// Footstep timing tracker
let lastFootstepTime = 0;
const footstepInterval = 300; // ms between steps, adjust as needed


function tryPlayFootstep() {
    const nowMs = performance.now();
    if (nowMs - lastFootstepTime >= footstepInterval) {
        const sound = footstepSoundsConcrete[Math.floor(Math.random() * footstepSoundsConcrete.length)];
        sound.currentTime = 0;
        sound.play();
        lastFootstepTime = nowMs;
		
		        // Trigger head bob for this step
        HUD.triggerHeadBob();
    }
}

export async function runCameraRails(camera, steps, onTriggerNextScene) {
  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      console.error('Invalid camera step:', step);
      continue;
    }

    switch (step.type) {
      case 'moveTo':
            HUD.setHeadBob(true, 0.3, 0.2); // enable head bob for this move
		await moveTo(camera, step.position, step.duration);
        HUD.setHeadBob(false); // disable head bob after this move
		break;

      case 'lookAt':
        await lookAt(camera, step.target, step.duration);
        break;

      case 'rotate':
        await rotate(camera, step.rotation, step.duration);
        break;

      case 'pause':
        await pause(step.duration);
        break;

      default:
        console.warn("Unknown camera rail step:", step);
    }

    // Trigger optional step callback
    if (typeof step.onReach === 'function') {
      await step.onReach();
    }

    // Trigger scene transition if flag is set
    if (step.triggerNextScene && typeof onTriggerNextScene === 'function') {
      await onTriggerNextScene();
    }
  }
}

// --- helpers ---

function pause(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

function moveTo(camera, position, duration) {
  return new Promise(resolve => {
    const start = camera.position.clone();
    const end = new THREE.Vector3(position.x, position.y, position.z);

    animateLerp(camera, duration, t => {
      camera.position.lerpVectors(start, end, t);
    }, resolve);
  });
}

function lookAt(camera, target, duration) {
  return new Promise(resolve => {
    const startQuat = camera.quaternion.clone();

    camera.lookAt(target.x, target.y, target.z);
    const endQuat = camera.quaternion.clone();
    camera.quaternion.copy(startQuat);

    animateLerp(camera, duration, t => {
      camera.quaternion.slerp(endQuat, t);
    }, resolve);
  });
}

function rotate(camera, rotation, duration) {
  return new Promise(resolve => {
    const startQuat = camera.quaternion.clone();
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rotation.x || 0),
      THREE.MathUtils.degToRad(rotation.y || 0),
      THREE.MathUtils.degToRad(rotation.z || 0),
      'YXZ'
    );
    const endQuat = new THREE.Quaternion().setFromEuler(euler).multiply(startQuat);

    animateLerp(camera, duration, t => {
      camera.quaternion.slerp(endQuat, t);
    }, resolve);
  });
}

function animateLerp(camera, duration, update, done) {
    let startTime = null;

    function frame(time) {
        if (!startTime) startTime = time;
        const t = Math.min((time - startTime) / duration, 1);

        // Compute base rail position for this frame
        const basePos = camera.position.clone();
        update(t); // move along rail

        // Compute HUD offsets (head bob + shake)
        const offset = HUD._getCameraOffset();
        camera.position.copy(camera.position.clone().add(offset));

        tryPlayFootstep();

        if (t < 1) requestAnimationFrame(frame);
        else done();
    }

    requestAnimationFrame(frame);
}
