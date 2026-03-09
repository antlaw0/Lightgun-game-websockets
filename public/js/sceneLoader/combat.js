import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { Projectile } from '../projectile.js';

export function spawnProjectileCombat(self, startPos, targetPos, opts = {}) {
  let speed = 1;
  let projectileType = 'bullet';
  let lifetime = undefined;
  if (typeof opts === 'number') speed = opts;
  else {
    speed = opts.speed ?? 1;
    projectileType = opts.projectileType ?? 'bullet';
    lifetime = opts.lifetime;
  }

  const id = 'proj_' + (self.nextProjectileId++);
  const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();

  const p = new Projectile({
    id,
    scene: self.scene,
    startPos: startPos.clone(),
    direction: dir,
    speed,
    lifetime,
    projectileType
  });

  self.projectiles[id] = p;
  return p;
}

export function updateCombat(self, deltaMs, nowMs) {
  self.frameCount++;

  Object.entries(self.projectiles).forEach(([id, proj]) => {
    proj.update(deltaMs);

    const hit = proj.checkCollision(self.getIntersectableMeshes());
    if (hit) {
      const hitObj = hit.object;
      const hitPoint = hit.point ?? proj.position;

      if (proj.projectileType === 'bullet') {
        let obj = hitObj;
        while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId && obj.userData.type !== 'room') {
          obj = obj.parent;
        }
        if (obj && obj.userData && obj.userData.type === 'room') {
          const paths = [
            'assets/sfx/ric1.ogg',
            'assets/sfx/ric2.ogg',
            'assets/sfx/ric3.ogg',
            'assets/sfx/ric4.ogg',
            'assets/sfx/ric5.ogg'
          ];
          self.playPositionalImpactSound(paths, hitPoint, 0.9, 6);
        }
      } else {
        const sounds = hitObj.userData?.hitSounds;
        if (Array.isArray(sounds) && sounds.length > 0) {
          const sound = sounds[Math.floor(Math.random() * sounds.length)];
          self.playImpactSound(sound, hitPoint);
        }
      }

      self.applyDamageToMesh(hitObj, proj.damage, { suppressRoomSound: proj.projectileType === 'bullet' });

      proj.dispose();
      delete self.projectiles[id];
      return;
    }
  });

  self.enemies.forEach((en) => {
    try {
      en.update(deltaMs, nowMs, self.player);
    } catch (e) {
      console.warn('Enemy update error', e);
    }
  });

  for (let i = self.explosions.length - 1; i >= 0; i--) {
    const ex = self.explosions[i];
    try {
      if (typeof ex.update === 'function') {
        ex.update(deltaMs / 1000);
      }
      let expired = false;
      if (typeof ex.isExpired === 'function') expired = ex.isExpired();
      else if (typeof ex.isDone === 'boolean') expired = ex.isDone;
      else if (typeof ex.age === 'number' && typeof ex.lifespan === 'number') {
        if (ex.age >= ex.lifespan) expired = true;
      }

      if (expired) {
        if (typeof ex.destroy === 'function') ex.destroy();
        if (typeof ex.dispose === 'function') ex.dispose();
        if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
        self.explosions.splice(i, 1);
      }
    } catch (e) {
      console.warn('Explosion update error', e);
      try {
        if (typeof ex.destroy === 'function') ex.destroy();
        if (typeof ex.dispose === 'function') ex.dispose();
        if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
      } catch (e2) {}
      self.explosions.splice(i, 1);
    }
  }
}

export function applyDamageToMeshCombat(self, mesh, damage = 1, opts = {}) {
  if (!mesh) return false;

  let obj = mesh;

  while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId && obj.userData.type !== 'room') {
    obj = obj.parent;
  }

  if (!obj || !obj.userData) return false;

  if (obj.userData.enemyId) {
    const en = self.enemiesById[obj.userData.enemyId];
    if (!en) return false;
    if (en.lastHitFrame === self.frameCount) return true;
    en.lastHitFrame = self.frameCount;
    en.takeDamage(damage);
    self._checkObjectiveAfterHit();
    return true;
  }

  if (obj.userData.propId) {
    const pr = self.propsById[obj.userData.propId];
    if (pr) {
      const died = pr.takeDamage(damage);
      if (died) {
        const idx = self.props.indexOf(pr);
        if (idx >= 0) self.props.splice(idx, 1);
        delete self.propsById[obj.userData.propId];
        const pmIdx = self.propMeshes.findIndex((m) => m.userData && m.userData.propId === obj.userData.propId);
        if (pmIdx >= 0) self.propMeshes.splice(pmIdx, 1);
      }
    }
    return true;
  }

  if (obj.userData.type === 'room') {
    if (!(opts && opts.suppressRoomSound)) {
      const sounds = obj.userData.hitSounds;
      if (Array.isArray(sounds) && sounds.length > 0) {
        const sound = sounds[Math.floor(Math.random() * sounds.length)];
        self.playImpactSound(sound, mesh.position);
      }
    }
    return true;
  }

  return false;
}

export function checkObjectiveAfterHitCombat(self) {
  if (!self.objective) return;

  if (self.objective.type === 'eliminateAllEnemies') {
    const remaining = self.enemies.filter((e) => !(e._isDead || e._isDying));
    console.log('Enemies still alive:', remaining.length);

    if (remaining.length === 0) {
      console.log('All enemies defeated!');

      self.enemies = [];
      self.enemiesById = {};
      self.enemyMeshes = [];

      if (typeof window.onSceneComplete === 'function') {
        window.onSceneComplete(self.sceneDef);
      } else {
        window.dispatchEvent(new CustomEvent('sceneComplete', {
          detail: { scene: self.sceneDef }
        }));
      }
    }
  }
}

export function getIntersectableMeshesCombat(self) {
  return [
    ...self.enemyMeshes,
    ...self.propMeshes,
    ...self.roomMeshes
  ];
}
