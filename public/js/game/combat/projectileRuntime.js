export function createProjectileRuntime({
  THREE,
  scene,
  camera,
  getPlayer,
  getSceneLoader,
  getProjectiles,
  getEnemyProjectiles,
  getRocketModel,
  projectileSpeed,
  projectileLifetime,
  spawnSparks,
  logDebug,
  getSpawnTestExplosion
}) {
  const smokeParticles = [];
  const smokeTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(200,200,200,1)');
    grad.addColorStop(1, 'rgba(200,200,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  })();

  function spawnSmokeTrail(pos) {
    const spriteMaterial = new THREE.SpriteMaterial({
      map: smokeTexture,
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(pos);
    const scale = 0.5 + Math.random() * 0.3;
    sprite.scale.set(scale, scale, scale);
    scene.add(sprite);
    smokeParticles.push({
      mesh: sprite,
      age: 0,
      lifetime: 0.8,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1 + 0.2,
        (Math.random() - 0.5) * 0.1
      )
    });
  }

  function updateSmokeParticles(dt) {
    const delta = dt / 1000;
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
      const p = smokeParticles[i];
      p.age += delta;
      if (p.age >= p.lifetime) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        smokeParticles.splice(i, 1);
        continue;
      }
      p.mesh.material.opacity = 0.4 * (1 - p.age / p.lifetime);
      p.mesh.scale.addScalar(delta * 1.5);
      p.mesh.position.addScaledVector(p.velocity, delta);
    }
  }

  function spawnProjectileUnified(origin, direction, options = {}) {
    const {
      damage = 1,
      color = 0xffff00,
      speed = projectileSpeed,
      isEnemy = false,
      size = 0.02,
      lifetime = projectileLifetime,
      explosive = false,
      trail = true,
      projectileType = 'bullet'
    } = options;

    const dir = direction.clone().normalize();

    let bullet;
    let finalSpeed = speed;
    const rocketModel = getRocketModel();

    if (projectileType === 'rocket' && rocketModel) {
      bullet = rocketModel.clone();
      bullet.position.copy(origin);
      bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      bullet.scale.setScalar(3.0);
    } else if (projectileType === 'laser') {
      const radius = Math.max(0.005, size);
      const length = 0.5;
      const geo = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: color ?? 0xffffff });
      if (typeof options.speed === 'undefined') finalSpeed = projectileSpeed * 4;
      bullet = new THREE.Mesh(geo, mat);
      bullet.position.copy(origin);
      bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    } else {
      const geo = new THREE.CapsuleGeometry(size, size * 4, 4, 8);
      const mat = new THREE.MeshBasicMaterial({ color });
      bullet = new THREE.Mesh(geo, mat);
      bullet.position.copy(origin);
      bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }

    bullet.userData = {
      direction: dir,
      bornTime: performance.now(),
      damage,
      isEnemy,
      explosive,
      speed: finalSpeed,
      trail: null,
      projectileType,
      lifetime
    };

    if (trail && projectileType !== 'rocket') {
      const trailLength = Math.max(0.02, size * 5);
      const points =
        projectileType === 'laser'
          ? [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -trailLength)]
          : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -trailLength, 0)];

      const trailGeo = new THREE.BufferGeometry().setFromPoints(points);
      const trailMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const line = new THREE.Line(trailGeo, trailMat);
      bullet.add(line);
      bullet.userData.trail = line;
    }

    scene.add(bullet);

    if (isEnemy) getEnemyProjectiles().push(bullet);
    else getProjectiles().push(bullet);

    return bullet;
  }

  function disposeMaterialResources(material) {
    if (!material) return;
    const mats = Array.isArray(material) ? material : [material];
    for (const mat of mats) {
      if (!mat) continue;
      try {
        mat.map?.dispose?.();
      } catch (_) {}
      try {
        mat.alphaMap?.dispose?.();
      } catch (_) {}
      try {
        mat.aoMap?.dispose?.();
      } catch (_) {}
      try {
        mat.bumpMap?.dispose?.();
      } catch (_) {}
      try {
        mat.displacementMap?.dispose?.();
      } catch (_) {}
      try {
        mat.emissiveMap?.dispose?.();
      } catch (_) {}
      try {
        mat.envMap?.dispose?.();
      } catch (_) {}
      try {
        mat.lightMap?.dispose?.();
      } catch (_) {}
      try {
        mat.metalnessMap?.dispose?.();
      } catch (_) {}
      try {
        mat.normalMap?.dispose?.();
      } catch (_) {}
      try {
        mat.roughnessMap?.dispose?.();
      } catch (_) {}
      try {
        mat.specularMap?.dispose?.();
      } catch (_) {}
      try {
        mat.dispose?.();
      } catch (_) {}
    }
  }

  function disposeObject3DResources(root) {
    if (!root) return;
    root.traverse((obj) => {
      if (!obj) return;
      try {
        obj.geometry?.dispose?.();
      } catch (_) {}
      disposeMaterialResources(obj.material);
    });
  }

  function updateProjectiles(dt) {
    const projectiles = getProjectiles();
    const toRemove = [];
    const sceneLoader = getSceneLoader();
    const intersectables = sceneLoader?.getIntersectableMeshes?.() || [];
    const rayTemp = new THREE.Raycaster();

    for (const bullet of projectiles) {
      const prevPos = bullet.position.clone();
      const dir = bullet.userData.direction;
      const moveDist = bullet.userData.speed * (dt / 1000);
      bullet.position.addScaledVector(dir, moveDist);

      if (bullet.userData.projectileType === 'rocket') {
        spawnSmokeTrail(bullet.position);
      }

      const maxLifetime = Number(bullet.userData.lifetime ?? projectileLifetime);
      const aliveTime = (performance.now() - bullet.userData.bornTime) / 1000;
      if (aliveTime > maxLifetime) {
        bullet.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        bullet.getWorldPosition(worldPos);
        bullet.userData.explosionPos = worldPos;
        toRemove.push(bullet);
        continue;
      }

      const travelVec = new THREE.Vector3().subVectors(bullet.position, prevPos);
      const travelDist = travelVec.length();
      if (travelDist > 0) {
        rayTemp.set(prevPos, travelVec.normalize());
        rayTemp.far = travelDist;

        const hits = rayTemp.intersectObjects(intersectables, true);
        if (hits.length > 0) {
          const hit = hits[0];
          console.log('Hit object:', hit.object);
          console.log('userData:', hit.object.userData);

          spawnSparks(
            hit.point,
            hit.face?.normal?.clone().transformDirection(hit.object.matrixWorld) || new THREE.Vector3(0, 1, 0)
          );

          const mesh = hit.object;
          bullet.userData.explosionPos = hit.point.clone();

          if (mesh.userData.enemy) {
            mesh.userData.enemy.takeDamage(bullet.userData.damage);
          } else {
            try {
              let obj = mesh;
              while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId && obj.userData.type !== 'room') {
                obj = obj.parent;
              }
              if (bullet.userData.projectileType === 'bullet' && obj && obj.userData && obj.userData.type === 'room') {
                const paths = [
                  'assets/sfx/ric1.ogg',
                  'assets/sfx/ric2.ogg',
                  'assets/sfx/ric3.ogg',
                  'assets/sfx/ric4.ogg',
                  'assets/sfx/ric5.ogg'
                ];
                try {
                  sceneLoader?.playPositionalImpactSound?.(paths, hit.point, 0.9, 6);
                } catch (_) {}
              }
            } catch (_) {}

            sceneLoader?.applyDamageToMesh?.(mesh, bullet.userData.damage, {
              suppressRoomSound: bullet.userData.projectileType === 'bullet'
            });
          }

          logDebug(`Projectile hit ${mesh.name || 'object'} for ${bullet.userData.damage} damage`);
          toRemove.push(bullet);
        }
      }
    }

    for (const b of toRemove) {
      const pos = b.userData.explosionPos;
      if (pos && b.userData.explosive) {
        const player = getPlayer();
        const spawnTestExplosion = getSpawnTestExplosion();
        if (spawnTestExplosion) {
          spawnTestExplosion({
            x: pos.x,
            y: pos.y,
            z: pos.z,
            blastRadius: player?.currentWeapon?.explosionRadius,
            maxDamage: player?.currentWeapon?.explosionDamage,
            explosionSounds: player?.currentWeapon?.explosionSounds
          });
        }
      }

      disposeObject3DResources(b);
      scene.remove(b);
      const idx = projectiles.indexOf(b);
      if (idx !== -1) projectiles.splice(idx, 1);
    }
  }

  function updateEnemyProjectiles(dt) {
    const enemyProjectiles = getEnemyProjectiles();
    const toRemove = [];

    const PLAYER_HIT_RADIUS = 0.35;
    const PLAYER_HIT_FORWARD_OFFSET = 0.15;

    for (const bullet of enemyProjectiles) {
      const dir = bullet.userData.direction;
      const prevPos = bullet.position.clone();
      bullet.position.addScaledVector(dir, projectileSpeed * (dt / 1000));

      const maxLifetime = Number(bullet.userData.lifetime ?? projectileLifetime);
      if ((performance.now() - bullet.userData.bornTime) / 1000 > maxLifetime) {
        toRemove.push(bullet);
        continue;
      }

      const a = prevPos;
      const b = bullet.position.clone();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      const center = camera.position.clone().add(forward.multiplyScalar(PLAYER_HIT_FORWARD_OFFSET));

      const ab = b.clone().sub(a);
      const abLenSq = ab.lengthSq();
      let hit = false;
      if (abLenSq === 0) {
        hit = a.distanceToSquared(center) <= PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS;
      } else {
        const t = THREE.MathUtils.clamp(center.clone().sub(a).dot(ab) / abLenSq, 0, 1);
        const closest = a.clone().add(ab.multiplyScalar(t));
        if (closest.distanceToSquared(center) <= PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS) hit = true;
      }

      if (!hit) {
        const headCenter = center.clone().add(new THREE.Vector3(0, 0.18, 0));
        const headRadius = Math.max(0.12, PLAYER_HIT_RADIUS * 0.6);
        const ab2 = b.clone().sub(a);
        const ab2LenSq = ab2.lengthSq();
        if (ab2LenSq === 0) {
          hit = a.distanceToSquared(headCenter) <= headRadius * headRadius;
        } else {
          const t2 = THREE.MathUtils.clamp(headCenter.clone().sub(a).dot(ab2) / ab2LenSq, 0, 1);
          const closest2 = a.clone().add(ab2.multiplyScalar(t2));
          if (closest2.distanceToSquared(headCenter) <= headRadius * headRadius) hit = true;
        }
      }

      if (hit) {
        const player = getPlayer();
        player?.takeDamage?.(bullet.userData.damage);
        toRemove.push(bullet);
      }
    }

    for (const b of toRemove) {
      disposeObject3DResources(b);
      scene.remove(b);
      const idx = enemyProjectiles.indexOf(b);
      if (idx !== -1) enemyProjectiles.splice(idx, 1);
    }
  }

  return {
    spawnProjectileUnified,
    updateProjectiles,
    updateEnemyProjectiles,
    updateSmokeParticles
  };
}
