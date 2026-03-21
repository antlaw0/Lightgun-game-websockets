import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { Explosion } from '../explosion.js';

export function notifyLoadedEvents(self) {
  if (typeof window.onSceneLoaded === 'function') {
    window.onSceneLoaded(self.sceneDef);
  }
  window.dispatchEvent(new CustomEvent('sceneLoaded', {
    detail: { scene: self.sceneDef }
  }));
}

export function clearSceneEvents(self) {
  for (const p of self.props) {
    if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    try {
      p.dispose?.();
    } catch {}
  }
  self.props.length = 0;
  self.propsById = {};
  self.propMeshes = [];
  self.staticObjects = [];

  for (const e of self.enemies) {
    if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
    try {
      e.dispose?.();
    } catch {}
  }
  self.enemies.length = 0;
  self.enemiesById = {};
  self.enemyMeshes = [];

  for (const ex of self.explosions) {
    try {
      if (typeof ex.destroy === 'function') ex.destroy();
      if (typeof ex.dispose === 'function') ex.dispose();
    } catch {}
    if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
  }
  self.explosions.length = 0;
}

export function destroySceneLoaderEvents(self) {
  try {
    self.clearScene();
  } catch (e) {}
  self._activeHdriRequestId++;
  try {
    self.scene.environment = null;
  } catch (e) {}
  if (self._isHdriBackgroundActive) {
    try {
      self.scene.background = null;
    } catch (e) {}
    self._isHdriBackgroundActive = false;
  }
  self._activeHdriPath = null;
  self.disposeCaches();
}

export function registerSpawnTestExplosionGlobal() {
  window.spawnTestExplosion = function ({
    x = 0,
    y = 1,
    z = 0,
    blastRadius = 4,
    maxDamage = 10,
    explosionRadius,
    explosionDamage,
    explosive = true,
    explosionSounds = []
  } = {}) {
    if (explosive === false) return;

    const finalBlastRadius = Number.isFinite(Number(explosionRadius))
      ? Number(explosionRadius)
      : Number(blastRadius);
    const finalMaxDamage = Number.isFinite(Number(explosionDamage))
      ? Number(explosionDamage)
      : Number(maxDamage);

    if (!window.sceneLoader) {
      console.warn('sceneLoader not found!');
      return;
    }

    const pos = new THREE.Vector3(x, y, z);

    const explosion = new Explosion(
      window.sceneLoader.scene,
      pos,
      {
        blastRadius: finalBlastRadius,
        maxDamage: finalMaxDamage,
        explosionSounds,
        floorY: y - 0.1
      }
    );

    window.sceneLoader.addExplosion(explosion);

    console.log(`Spawned explosion at (${x}, ${y}, ${z}), radius ${finalBlastRadius}, damage ${finalMaxDamage}`);
  };
}
