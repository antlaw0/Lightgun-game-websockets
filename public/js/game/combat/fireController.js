export function createFireController({
  THREE,
  camera,
  audioManager,
  clampAccuracy,
  logDebug,
  getPlayer,
  getWeaponManager,
  getSceneLoader,
  getIsEditorMode,
  getIsFiring,
  getLastPlayerFireMs,
  setLastPlayerFireMs,
  getRet,
  getViewport,
  getDisplayedRet,
  generateSpreadDirections,
  spawnProjectileUnified
}) {
  function triggerReload() {
    const weaponManager = getWeaponManager();
    if (weaponManager && weaponManager.isSwitching) return;

    const player = getPlayer();
    const w = player?.currentWeapon;
    if (w && w.isReloading) return;

    const soundPath = w?.reloadSound ? w.reloadSound : 'sounds/reload.ogg';
    try {
      const reloadSound = new Audio(soundPath);
      reloadSound.currentTime = 0;
      reloadSound.play().catch(() => {});
    } catch (_) {}

    if (player && typeof player.reload === 'function') player.reload();
    try {
      if (weaponManager && typeof weaponManager.triggerReload === 'function') {
        weaponManager.triggerReload();
      }
    } catch (e) {
      console.warn('weaponManager.triggerReload failed', e);
    }
    logDebug('Player reloaded');
  }

  function updateAutoFire(nowMs) {
    const player = getPlayer();
    const w = player?.currentWeapon;
    if (!w) return;

    if (w.fireMode === 'auto') {
      if (!getIsFiring()) return;
      const elapsed = nowMs - getLastPlayerFireMs();
      if (elapsed >= w.rateOfFire) {
        triggerFire();
      }
    }
  }

  function triggerFire() {
    if (getIsEditorMode()) {
      logDebug('Editor mode: firing disabled');
      return false;
    }

    const weaponManager = getWeaponManager();
    if (weaponManager && weaponManager.isSwitching) return false;

    const player = getPlayer();
    const w = player?.currentWeapon;
    if (!w) return false;

    const now = performance.now();
    const rof = w.rateOfFire || 100;
    if (w.lastShotTime && now - w.lastShotTime < rof) {
      return false;
    }

    if (!(player && player.useAmmo && player.useAmmo(1))) {
      if (w.isReloading) return false;
      if (w.fireMode === 'auto') {
        if (w._dryFirePlayed) return false;
        w._dryFirePlayed = true;
      }

      logDebug('No ammo! Reload first.');
      try {
        const clickSound = new Audio('sounds/click.ogg');
        clickSound.currentTime = 0;
        clickSound.play().catch(() => {});
      } catch (_) {}
      return false;
    }

    w.lastShotTime = now;
    setLastPlayerFireMs(now);

    try {
      if (weaponManager && typeof weaponManager.triggerFire === 'function') {
        weaponManager.triggerFire({ soundDelayMs: 0, muzzleFlash: true });
      }
    } catch (e) {
      console.warn('weaponManager.triggerFire failed', e);
    }

    if (w.fireSound) {
      if (w.fireSound.includes('/') || w.fireSound.includes('.')) {
        const s = new Audio(w.fireSound);
        s.currentTime = 0;
        s.play().catch(() => {});
      } else {
        try {
          audioManager.play2D(w.fireSound);
        } catch (e) {
          console.warn('audioManager.play2D failed', e);
        }
      }
    }

    const { cw, ch } = getViewport();
    const ret = getRet();
    const retNDC = new THREE.Vector2((ret.x / cw) * 2 - 1, -(ret.y / ch) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(retNDC, camera);

    const sceneLoader = getSceneLoader();
    const intersectables = sceneLoader ? sceneLoader.getIntersectableMeshes() : [];
    const hits = raycaster.intersectObjects(intersectables, true);
    const targetPoint = hits.length > 0 ? hits[0].point : raycaster.ray.at(100, new THREE.Vector3());

    let shootOrigin = weaponManager ? weaponManager.getMuzzlePosition() : null;
    if (!shootOrigin) {
      const muzzleOffset = new THREE.Vector3(0, -0.35, -0.6);
      shootOrigin = camera.position.clone().add(muzzleOffset.applyQuaternion(camera.quaternion));
    }

    const forwardDir = new THREE.Vector3().subVectors(targetPoint, shootOrigin).normalize();

    const recoilInfluence = Math.min(
      0.9,
      (player.recoilPx || 0) / (Math.min(window.innerWidth, window.innerHeight) * 0.5)
    );
    const effectiveAcc = clampAccuracy((w.accuracy ?? 1.0) - recoilInfluence);
    const directions = generateSpreadDirections(
      forwardDir,
      w.projectilesPerShot,
      w.projectileSpread,
      effectiveAcc
    );

    for (const dir of directions) {
      spawnProjectileUnified(shootOrigin, dir, {
        damage: w.damage,
        explosive: w.explosive,
        explosionRadius: w.explosionRadius,
        explosionDamage: w.explosionDamage,
        explosionSounds: w.explosionSounds,
        projectileType: w.projectileType ?? 'bullet'
      });
    }

    try {
      if (player.addRecoil) player.addRecoil(w.recoil || 0);
    } catch (_) {}

    try {
      const displayedRet = getDisplayedRet();
      if (window.hud && window.hud.onWeaponFire) {
        window.hud.onWeaponFire({
          retX: displayedRet.x,
          retY: displayedRet.y,
          weapon: w,
          isAuto: w.fireMode === 'auto'
        });
      }
    } catch (_) {}

    return true;
  }

  return {
    triggerReload,
    updateAutoFire,
    triggerFire
  };
}
