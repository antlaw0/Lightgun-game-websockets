import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

/**
 * Run camera rails steps.
 * @param {THREE.Camera} camera 
 * @param {Array} steps - Array of step objects
 * @param {Function|Object} onTriggerNextSceneOrOptions - legacy callback or options object
 * @param {Object} cancelTokenArg - legacy cancellation token (used when arg3 is callback)
 */
export async function runCameraRails(camera, steps, onTriggerNextSceneOrOptions, cancelTokenArg) {
  const options = normalizeOptions(onTriggerNextSceneOrOptions, cancelTokenArg);
  const onTriggerNextScene = options.onTriggerNextScene;
  const cancelToken = options.cancelToken;
  const defaultContinueCondition = options.defaultContinueCondition;
  const pollIntervalMs = Math.max(16, options.pollIntervalMs || 100);

  for (const step of steps || []) {
    if (isCancelled(cancelToken)) {
      // caller requested cancellation; stop processing further steps
      break;
    }

    if (!step || typeof step !== 'object') {
      console.error('Invalid camera step:', step);
      continue;
    }

    switch (step.type) {
      case 'moveTo':
        await moveTo(camera, step.position, step.duration, cancelToken);
        break;

      case 'lookAt':
        await lookAt(camera, step.target || step.position, step.duration, cancelToken);
        break;

      case 'rotate':
        await rotate(camera, step.rotation, step.duration, cancelToken);
        break;

      case 'pause':
        await pause(step.duration, cancelToken);
        break;

      case 'prefab':
        // Compatibility: some authored rails used type "prefab" as a timed
        // transition marker. If a position exists, treat it as a move.
        if (step.position) {
          await moveTo(camera, step.position, step.duration, cancelToken);
        } else {
          await pause(step.duration, cancelToken);
        }
        break;

      case 'stop':
        // Stop markers are where gameplay happens. We invoke onReach first so
        // steps can spawn enemies/sequences, then we wait until continue condition passes.
        if (typeof step.onReach === 'function') {
          await step.onReach();
        }
        await waitOnStop(step, {
          camera,
          sceneLoader: options.sceneLoader,
          cancelToken,
          defaultContinueCondition,
          pollIntervalMs
        });
        break;

      case 'openDoor':
        await openDoorStep(step, options.sceneLoader, cancelToken);
        break;

      default:
        console.warn("Unknown camera rail step:", step);
    }

    // Trigger optional step callback
    if (step.type !== 'stop' && typeof step.onReach === 'function') {
      await step.onReach();
    }

    // Trigger scene transition if flag is set
    if (!isCancelled(cancelToken) && step.triggerNextScene && typeof onTriggerNextScene === 'function') {
      await onTriggerNextScene();
      // if the callback started a transition it may want to stop the rest of
      // the rails; callback can set cancelToken.cancelled on the object it was
      // given by the caller.
    }
  }
}

// --- helpers ---

function normalizeOptions(onTriggerNextSceneOrOptions, cancelTokenArg) {
  if (typeof onTriggerNextSceneOrOptions === 'function') {
    return {
      onTriggerNextScene: onTriggerNextSceneOrOptions,
      cancelToken: cancelTokenArg || null,
      defaultContinueCondition: null,
      pollIntervalMs: 100
    };
  }

  const opts = onTriggerNextSceneOrOptions && typeof onTriggerNextSceneOrOptions === 'object'
    ? onTriggerNextSceneOrOptions
    : {};

  return {
    onTriggerNextScene: opts.onTriggerNextScene,
    cancelToken: opts.cancelToken || null,
    sceneLoader: opts.sceneLoader || null,
    defaultContinueCondition: opts.defaultContinueCondition || null,
    pollIntervalMs: opts.pollIntervalMs || 100
  };
}

function isCancelled(cancelToken) {
  return !!(cancelToken && cancelToken.cancelled);
}

function pause(duration, cancelToken) {
  const ms = Math.max(0, Number(duration) || 0);
  if (ms <= 0 || isCancelled(cancelToken)) return Promise.resolve();

  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    const checker = setInterval(() => {
      if (!isCancelled(cancelToken)) return;
      clearTimeout(timer);
      clearInterval(checker);
      resolve();
    }, 30);

    setTimeout(() => clearInterval(checker), ms + 100);
  });
}

async function waitOnStop(step, context) {
  if (typeof step.duration === 'number' && step.duration > 0) {
    await pause(step.duration, context.cancelToken);
  }

  if (isCancelled(context.cancelToken)) return;

  const condition = step.continueWhen || step.continueCondition || context.defaultContinueCondition;
  if (!condition) return;

  await waitForCondition(() => evaluateCondition(condition, context), context.cancelToken, context.pollIntervalMs);
}

async function evaluateCondition(condition, context) {
  if (typeof condition === 'function') {
    return !!(await condition({ camera: context.camera, sceneLoader: context.sceneLoader }));
  }
  if (typeof condition === 'string') {
    const token = condition.trim().toLowerCase();
    if (token === 'always') return true;
    if (token === 'allenemiesdead') {
      const enemies = Array.isArray(context.sceneLoader?.enemies) ? context.sceneLoader.enemies : [];
      return enemies.every((enemy) => {
        if (!enemy) return true;
        if (enemy._isActive === false) return true;
        return !!(enemy._isDead || enemy._isDying);
      });
    }
  }
  return !!condition;
}

function openDoorStep(step, sceneLoader, cancelToken) {
  return new Promise((resolve) => {
    if (isCancelled(cancelToken)) {
      resolve();
      return;
    }

    const doorId = step.doorId || step.id;
    if (!doorId) {
      console.warn('openDoor step missing doorId:', step);
      resolve();
      return;
    }

    const door = sceneLoader?.propsById?.[doorId] || null;
    if (!door) {
      console.warn('openDoor step could not find door:', doorId);
      resolve();
      return;
    }

    if (typeof door.openDoor === 'function') {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      try {
        door.openDoor(done);
      } catch (e) {
        console.warn('openDoor step failed:', doorId, e);
        done();
        return;
      }

      if (step.waitForComplete === false) {
        done();
      }

      return;
    }

    resolve();
  });
}

async function waitForCondition(checkFn, cancelToken, pollIntervalMs) {
  while (!isCancelled(cancelToken)) {
    try {
      if (await checkFn()) return;
    } catch (e) {
      console.warn('Camera rails continue condition failed:', e);
    }
    await pause(pollIntervalMs, cancelToken);
  }
}

function moveTo(camera, position, duration, cancelToken) {
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
    }, cancelToken);
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

function lookAt(camera, target, duration, cancelToken) {

  if (!target || typeof target.x !== "number") {
    console.error("Invalid lookAt target:", target);
    return Promise.resolve(); // fail gracefully
  }

  return new Promise(resolve => {
    const startQuat = camera.quaternion.clone();

    camera.lookAt(target.x, target.y, target.z);
    const endQuat = camera.quaternion.clone();
    camera.quaternion.copy(startQuat);

    animateLerp(duration, t => {
      camera.quaternion.slerp(endQuat, t);
    }, resolve, cancelToken);
  });
}
function rotate(camera, rotation, duration, cancelToken) {
  return new Promise(resolve => {
    const startQuat = camera.quaternion.clone();
    // Accept numeric rotation as shorthand (degrees around Y), or an object {x,y,z}
    const rot = (typeof rotation === 'number') ? { x: 0, y: rotation, z: 0 } : (rotation || {});
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rot.x || 0),
      THREE.MathUtils.degToRad(rot.y || 0),
      THREE.MathUtils.degToRad(rot.z || 0),
      'YXZ'
    );
    const endQuat = new THREE.Quaternion().setFromEuler(euler).multiply(startQuat);

    animateLerp(duration, t => {
      camera.quaternion.slerp(endQuat, t);
    }, resolve, cancelToken);
  });
}

function animateLerp(duration, update, done, cancelToken) {
  const ms = Math.max(0, Number(duration) || 0);
  if (ms <= 0 || isCancelled(cancelToken)) {
    update(1);
    done();
    return;
  }

  let startTime = null;

  function frame(time) {
    if (isCancelled(cancelToken)) {
      done();
      return;
    }

    if (!startTime) startTime = time;
    const t = Math.min((time - startTime) / ms, 1);
    update(t);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      done();
    }
  }

  requestAnimationFrame(frame);
}
