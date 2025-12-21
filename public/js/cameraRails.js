export async function runCameraSteps(camera, steps) {
    for (let step of steps) {
        if (step.type === 'move') {
            await moveCamera(camera, step.value, step.duration);
        } else if (step.type === 'rotate') {
            await rotateCamera(camera, step.value, step.duration, step.axis || 'y');
        }
    }
}

function moveCamera(camera, distance, duration) {
    return new Promise(resolve => {
        const startPos = camera.position.clone();
        const direction = new THREE.Vector3(0, 0, -1); // forward in local space
        direction.applyQuaternion(camera.quaternion).normalize();
        const endPos = startPos.clone().add(direction.multiplyScalar(distance));
        let startTime = null;

        function animate(time) {
            if (!startTime) startTime = time;
            let t = (time - startTime) / duration;
            if (t > 1) t = 1;

            camera.position.lerpVectors(startPos, endPos, t);

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(animate);
    });
}

function rotateCamera(camera, degrees, duration, axis) {
    return new Promise(resolve => {
        const startQuat = camera.quaternion.clone();
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler[axis] = THREE.MathUtils.degToRad(degrees);
        const endQuat = new THREE.Quaternion().setFromEuler(euler).multiply(startQuat);

        let startTime = null;

        function animate(time) {
            if (!startTime) startTime = time;
            let t = (time - startTime) / duration;
            if (t > 1) t = 1;

            THREE.Quaternion.slerp(startQuat, endQuat, camera.quaternion, t);

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(animate);
    });
}
