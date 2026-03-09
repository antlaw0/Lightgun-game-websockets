export function createBallistics({ THREE, maxConeAngleDeg = 6, getFallbackQuaternion = null }) {
  function clampAccuracy(a) {
    return THREE.MathUtils.clamp(a ?? 1.0, 0.01, 1.0);
  }

  function accuracyToConeHalfAngleRad(accuracy) {
    const acc = clampAccuracy(accuracy);
    const inaccuracy = 1.0 - acc;
    const coneFullDeg = inaccuracy * maxConeAngleDeg;
    return THREE.MathUtils.degToRad(coneFullDeg * 0.5);
  }

  function sampleDirectionInCone(forward, halfAngleRad) {
    const forwardN = forward.clone().normalize();
    if (halfAngleRad <= 0) return forwardN.clone();

    let right = new THREE.Vector3().crossVectors(forwardN, new THREE.Vector3(0, 1, 0)).normalize();
    if (right.lengthSq() < 1e-6) {
      const fallbackQ = getFallbackQuaternion ? getFallbackQuaternion() : null;
      right = new THREE.Vector3(1, 0, 0);
      if (fallbackQ) right.applyQuaternion(fallbackQ);
      right.normalize();
    }
    const up = new THREE.Vector3().crossVectors(right, forwardN).normalize();

    const u = Math.random();
    const v = Math.random();
    const cosTheta = 1 - u * (1 - Math.cos(halfAngleRad));
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = 2 * Math.PI * v;

    return forwardN
      .clone()
      .multiplyScalar(cosTheta)
      .add(right.clone().multiplyScalar(Math.cos(phi) * sinTheta))
      .add(up.clone().multiplyScalar(Math.sin(phi) * sinTheta))
      .normalize();
  }

  function generateShotgunPelletDirections(forwardDir, numPellets, weaponAccuracy, pelletSpreadDeg) {
    const directions = [];
    const accHalf = accuracyToConeHalfAngleRad(weaponAccuracy);
    const baseDir = sampleDirectionInCone(forwardDir, accHalf);

    const pelletHalfRad = THREE.MathUtils.degToRad(pelletSpreadDeg ?? 0) * 0.5;
    for (let i = 0; i < numPellets; i++) {
      directions.push(sampleDirectionInCone(baseDir, pelletHalfRad));
    }

    return directions;
  }

  function generateSpreadDirections(forwardDir, numProjectiles, spreadDeg = 0, weaponAccuracy = 1.0) {
    const acc = clampAccuracy(weaponAccuracy);

    if (numProjectiles <= 1) {
      const half = accuracyToConeHalfAngleRad(acc);
      return [sampleDirectionInCone(forwardDir, half)];
    }

    if (numProjectiles > 1 && (spreadDeg ?? 0) > 0) {
      return generateShotgunPelletDirections(forwardDir, numProjectiles, acc, spreadDeg);
    }

    const half = accuracyToConeHalfAngleRad(acc);
    const dirs = [];
    for (let i = 0; i < numProjectiles; i++) {
      dirs.push(sampleDirectionInCone(forwardDir, half));
    }
    return dirs;
  }

  return {
    clampAccuracy,
    accuracyToConeHalfAngleRad,
    sampleDirectionInCone,
    generateShotgunPelletDirections,
    generateSpreadDirections
  };
}
