import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

/**
 * Run camera rails steps.
 * @param {THREE.Camera} camera 
 * @param {Array} steps - Array of step objects
 * @param {Function} onTriggerNextScene - optional callback if a step has triggerNextScene: true
 */
export async function runCameraRails(camera, steps, onTriggerNextScene) {
  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      console.error('Invalid camera step:', step);
      continue;
    }

    switch (step.type) {
      case 'moveTo':
        await moveTo(camera, step.position, step.duration);
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

    // Schedule footstep sounds during movement. No footsteps during turning or pause steps.
    const footstepController = scheduleFootstepsDuringMove(start, end, duration);

    animateLerp(duration, t => {
      camera.position.lerpVectors(start, end, t);
    }, () => {
      // Cancel any remaining scheduled footsteps when move completes
      footstepController.cancel();
      resolve();
    });
  });
}

// ---------------- Footstep scheduling ----------------
// Map move distance & duration to realistic footstep cadence and play random files.
// Files: assets/sfx/pl_crete1.ogg, pl_crete2.ogg, pl_crete3.ogg
function scheduleFootstepsDuringMove(startVec, endVec, durationMs) {
  const dist = startVec.distanceTo(endVec);
  const durationS = Math.max(durationMs / 1000, 0.001);

  // Estimate walking cadence from speed. Use a nominal stride length (meters per step).
  // cadenceHz ~= speed / strideLength. Use strideLength ~0.75m for typical step.
  // Clamp cadence to plausible human range (0.6 Hz slow walk -> ~36 steps/min, up to 3.0 Hz fast).
  const speed = dist / durationS; // units per second (scene units)
  const STRIDE_LENGTH = 0.75; // meters per step (tweak if scene units differ)
  const cadenceHz = THREE.MathUtils.clamp(speed / STRIDE_LENGTH, 0.6, 3.0);

  // Compute number of steps to schedule (at least 0)
  let stepCount = Math.round(cadenceHz * durationS);
  if (stepCount < 1) stepCount = 0;

  const timers = [];

  // If no steps to play, return controller with no-op cancel
  if (stepCount === 0) {
    return { cancel: () => { timers.forEach(t => clearTimeout(t)); } };
  }

  // Schedule steps evenly across duration with small random jitter
  for (let i = 0; i < stepCount; i++) {
    const idealT = (i + 0.5) / stepCount; // center samples inside intervals
    // Add jitter up to +/-10% of interval
    const interval = durationMs / stepCount;
    const jitter = (Math.random() * 0.2 - 0.1) * interval;
    const whenMs = Math.max(0, Math.min(durationMs, idealT * durationMs + jitter));

    const timer = setTimeout(() => {
      // Choose random footstep file
      const idx = 1 + Math.floor(Math.random() * 3);
      const src = `assets/sfx/pl_crete${idx}.ogg`;
      try {
        const a = new Audio(src);
        a.volume = 0.85 - Math.random() * 0.3; // slight volume variation
        a.play().catch(() => {});
      } catch (e) {
        // ignore playback errors
      }
    }, Math.round(whenMs));

    timers.push(timer);
  }

  return {
    cancel: () => { timers.forEach(t => clearTimeout(t)); }
  };
}

function lookAt(camera, target, duration) {
  return new Promise(resolve => {
    const startQuat = camera.quaternion.clone();

    camera.lookAt(target.x, target.y, target.z);
    const endQuat = camera.quaternion.clone();
    camera.quaternion.copy(startQuat);

    animateLerp(duration, t => {
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

    animateLerp(duration, t => {
      camera.quaternion.slerp(endQuat, t);
    }, resolve);
  });
}

function animateLerp(duration, update, done) {
  let startTime = null;

  function frame(time) {
    if (!startTime) startTime = time;
    const t = Math.min((time - startTime) / duration, 1);
    update(t);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      done();
    }
  }

  requestAnimationFrame(frame);
}
