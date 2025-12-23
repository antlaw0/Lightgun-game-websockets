import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export async function runCameraRails(camera, steps) {
  for (const step of steps) {
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

      default:
        console.warn("Unknown camera rail step:", step);
    }

    // Trigger optional callback when this step is reached
    if (typeof step.onReach === 'function') {
      await step.onReach();
    }
  }
}

function moveTo(camera, position, duration) {
  return new Promise(resolve => {
    const start = camera.position.clone();
    const end = new THREE.Vector3(position.x, position.y, position.z);

    animateLerp(duration, t => {
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

    animateLerp(duration, t => {
      camera.quaternion.slerp(endQuat, t); // instance method
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
      camera.quaternion.slerp(endQuat, t); // instance method
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
