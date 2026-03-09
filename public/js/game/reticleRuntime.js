export function createDynamicReticleUpdater({
  THREE,
  clampAccuracy,
  accuracyToConeHalfAngleRad,
  minReticleRadiusPx,
  maxReticleRadiusPct,
  getRet,
  getPlayer
}) {
  return function updateDynamicReticle({
    camera,
    weapon,
    projectionDistance = 15,
    basePlayerConeRad = 0.0015,
    maxWeaponInaccuracyRad = 0.008
  }) {
    if (!camera || !weapon) return;

    // Keep these args for API compatibility with existing call sites.
    void basePlayerConeRad;
    void maxWeaponInaccuracyRad;

    const weaponAccuracy = clampAccuracy(weapon.accuracy ?? 1.0);
    const accHalfAngle = accuracyToConeHalfAngleRad(weaponAccuracy);

    const ret = getRet();
    const retNDC = new THREE.Vector2(
      (ret.x / window.innerWidth) * 2 - 1,
      -(ret.y / window.innerHeight) * 2 + 1
    );

    const tmpRay = new THREE.Raycaster();
    tmpRay.setFromCamera(retNDC, camera);
    const camPos = camera.position.clone();
    const forward = tmpRay.ray.direction.clone().normalize();
    const centerWorld = camPos.clone().add(forward.clone().multiplyScalar(projectionDistance));

    const spreadRadiusWorld = Math.tan(accHalfAngle) * projectionDistance;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const edgeWorld = centerWorld.clone().add(right.clone().multiplyScalar(spreadRadiusWorld));

    const projectToScreen = (v) => {
      const p = v.clone().project(camera);
      return {
        x: (p.x * 0.5 + 0.5) * window.innerWidth,
        y: (-p.y * 0.5 + 0.5) * window.innerHeight
      };
    };

    const centerScreen = projectToScreen(centerWorld);
    const edgeScreen = projectToScreen(edgeWorld);
    let radiusPx = Math.hypot(edgeScreen.x - centerScreen.x, edgeScreen.y - centerScreen.y);

    if ((weapon.projectileSpread ?? 0) > 0) {
      const pelletHalfRad = THREE.MathUtils.degToRad(weapon.projectileSpread) * 0.5;
      const pelletSpreadWorld = Math.tan(pelletHalfRad) * projectionDistance;
      const pelletEdgeWorld = centerWorld.clone().add(right.clone().multiplyScalar(pelletSpreadWorld));
      const pelletEdgeScreen = projectToScreen(pelletEdgeWorld);
      const pelletRadiusPx = Math.hypot(
        pelletEdgeScreen.x - centerScreen.x,
        pelletEdgeScreen.y - centerScreen.y
      );
      radiusPx += pelletRadiusPx;
      document.documentElement.style.setProperty('--reticle-pellet-spread', `${weapon.projectileSpread}`);
    } else {
      document.documentElement.style.removeProperty('--reticle-pellet-spread');
    }

    const clampedRadius = THREE.MathUtils.clamp(
      radiusPx,
      minReticleRadiusPx,
      Math.min(window.innerWidth, window.innerHeight) * maxReticleRadiusPct
    );

    const player = getPlayer();
    const extraRecoilPx = player?.recoilPx ? player.recoilPx : 0;
    const finalRadius = clampedRadius + extraRecoilPx;
    document.documentElement.style.setProperty('--reticle-size', `${(finalRadius * 2).toFixed(1)}px`);
  };
}
