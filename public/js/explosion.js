// explosion.js
// Requires THREE in global scope and a SceneLoader instance passed into constructor.
// Usage:
// import { Explosion, PointsParticlePool } from './explosion.js';
// new Explosion({ sceneLoader, position: vec3, blastRadius: 4, damage: 80, ... });

/**
 * Fast pooled particle system using THREE.Points.
 * - poolSize: max number of particles tracked
 * - textureUrl: optional sprite (alpha)
 */
export class PointsParticlePool {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.poolSize = opts.poolSize ?? 600;
    this.particleSize = opts.particleSize ?? 0.14;
    this.textureUrl = opts.textureUrl ?? null;

    // Per-particle state
    this.positions = new Float32Array(this.poolSize * 3);
    this.velocities = new Float32Array(this.poolSize * 3);
    this.lifetimes = new Float32Array(this.poolSize);
    this.maxLifetime = new Float32Array(this.poolSize);
    this.alive = new Uint8Array(this.poolSize);

    // BufferGeometry + attributes
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aLifetime', new THREE.BufferAttribute(this.lifetimes, 1)); // optional
    this.geometry.setDrawRange(0, this.poolSize);

    const materialOpts = {
      size: this.particleSize,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    };
    if (this.textureUrl) {
      const loader = new THREE.TextureLoader();
      materialOpts.map = loader.load(this.textureUrl);
      materialOpts.alphaTest = 0.01;
    } else {
      // no explicit color option here; PointsMaterial defaults to white if not set
      materialOpts.color = 0xffcc88;
    }

    this.material = new THREE.PointsMaterial(materialOpts);
    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);

    // init
    for (let i = 0; i < this.poolSize; i++) {
      this.alive[i] = 0;
      // move off-screen
      const p = i * 3;
      this.positions[p] = this.positions[p + 1] = this.positions[p + 2] = 1e9;
      this.lifetimes[i] = 0;
      this.maxLifetime[i] = 0.0001;
    }
    this.geometry.attributes.position.needsUpdate = true;

    this._nextIndex = 0;
  }

  emit(pos, vel, lifetimeSec = 0.9) {
    // linear probe for free slot
    for (let i = 0; i < this.poolSize; i++) {
      const idx = (this._nextIndex + i) % this.poolSize;
      if (!this.alive[idx]) {
        this._nextIndex = (idx + 1) % this.poolSize;
        const pi = idx * 3;
        this.positions[pi] = pos.x;
        this.positions[pi + 1] = pos.y;
        this.positions[pi + 2] = pos.z;
        this.velocities[pi] = vel.x;
        this.velocities[pi + 1] = vel.y;
        this.velocities[pi + 2] = vel.z;
        this.lifetimes[idx] = lifetimeSec;
        this.maxLifetime[idx] = lifetimeSec;
        this.alive[idx] = 1;
        this.geometry.attributes.position.needsUpdate = true;
        return true;
      }
    }
    return false; // pool exhausted
  }

  update(deltaSec) {
    if (deltaSec <= 0) return;
    let any = false;
    for (let i = 0; i < this.poolSize; i++) {
      if (!this.alive[i]) continue;
      any = true;
      const pi = i * 3;
      this.positions[pi] += this.velocities[pi] * deltaSec;
      this.positions[pi + 1] += this.velocities[pi + 1] * deltaSec;
      this.positions[pi + 2] += this.velocities[pi + 2] * deltaSec;

      // gentle gravity and drag
      this.velocities[pi + 1] -= 9.8 * 0.6 * deltaSec;
      this.velocities[pi] *= 0.995;
      this.velocities[pi + 1] *= 0.995;
      this.velocities[pi + 2] *= 0.995;

      this.lifetimes[i] -= deltaSec;
      if (this.lifetimes[i] <= 0) {
        this.alive[i] = 0;
        // hide
        this.positions[pi] = this.positions[pi + 1] = this.positions[pi + 2] = 1e9;
      }
    }
    if (any) this.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    try { this.scene.remove(this.points); } catch {}
    try { this.geometry.dispose(); } catch {}
    try { this.material.dispose(); } catch {}
  }
}

/**
 * Explosion class (Option 1).
 * options:
 *  - sceneLoader: required (SceneLoader instance)
 *  - position: THREE.Vector3 required
 *  - blastRadius: number
 *  - damage: number
 *  - damageType: string
 *  - sounds: array (urls or Audio objects)
 *  - particleCount / particleQuality
 *  - particleTexture (optional)
 *  - particlePool (optional) -> Shares an existing PointsParticlePool
 *  - lifespanMs
 *  - audioVolume
 */
export class Explosion {
  constructor(options = {}) {
    if (!options.sceneLoader) throw new Error('Explosion requires sceneLoader option');
    if (!options.position) throw new Error('Explosion requires position (THREE.Vector3)');

    this.sceneLoader = options.sceneLoader;
    this.scene = this.sceneLoader.scene;
    this.position = options.position.clone();
    this.blastRadius = options.blastRadius ?? 4;
    this.damage = options.damage ?? 50;
    this.damageType = options.damageType ?? 'normal';
    this.sounds = options.sounds ?? [];
    this.audioVolume = options.audioVolume ?? 1.0;
    this.graphicsType = options.graphicsType ?? 'default';
    this.lifespan = options.lifespanMs ?? 1000;
    this.age = 0;
    this.isDone = false;

    // particle count by quality
    if (options.particleCount) this.particleCount = options.particleCount;
    else {
      switch (options.particleQuality ?? 'medium') {
        case 'low': this.particleCount = 36; break;
        case 'high': this.particleCount = 160; break;
        default: this.particleCount = 88;
      }
    }

    // assign or create pool
    if (options.particlePool) {
      this.particlePool = options.particlePool;
      this._ownsPool = false;
    } else {
      // create a pool sized by particleCount
      const poolSize = Math.max(128, Math.min(1200, this.particleCount * 6));
      this.particlePool = new PointsParticlePool(this.scene, {
        poolSize,
        particleSize: Math.max(0.06, this.blastRadius * 0.03),
        textureUrl: options.particleTexture ?? null
      });
      this._ownsPool = true;
    }

    // flash sphere visual (simple)
    this.flashSphere = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.06, this.blastRadius * 0.08), 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0.95, depthWrite: false })
    );
    this.flashSphere.position.copy(this.position);
    this.scene.add(this.flashSphere);

    // register with SceneLoader (so it will call update)
    if (typeof this.sceneLoader.addExplosion === 'function') {
      this.sceneLoader.addExplosion(this);
    } else if (Array.isArray(this.sceneLoader.explosions)) {
      this.sceneLoader.explosions.push(this);
    }

    // play random sound
    this._playSound();

    // spawn points burst
    this._spawnParticles();

    // immediate damage application
    this._applyDamage();

    // expose mesh so SceneLoader helpers can optionally add/remove it
    this.mesh = this.flashSphere;
  }

  _playSound() {
    if (!this.sounds || this.sounds.length === 0) return;
    const sel = this.sounds[Math.floor(Math.random() * this.sounds.length)];
    try {
      if (typeof sel === 'string') {
        const a = new Audio(sel);
        a.volume = Math.min(1, this.audioVolume);
        a.play().catch(()=>{});
      } else if (sel instanceof Audio) {
        sel.volume = Math.min(1, this.audioVolume);
        sel.play().catch(()=>{});
      }
    } catch (e) { /* ignore audio errors */ }
  }

  _spawnParticles() {
    const count = this.particleCount;
    for (let i = 0; i < count; i++) {
      // random direction
      const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      const speed = (0.6 + Math.random() * 6.0) * (this.blastRadius / 4);
      const vel = dir.multiplyScalar(speed);
      const lifetime = 0.45 + Math.random() * 0.95;
      this.particlePool.emit(this.position, vel, lifetime);
    }
  }

  // damage falloff function (squared falloff)
  _falloffDamage(distance) {
    const r = this.blastRadius;
    const t = Math.max(0, 1 - (distance / r));
    return this.damage * (t * t);
  }

  _getEntityPosition(ent) {
    if (!ent) return new THREE.Vector3();
    if (ent.position && typeof ent.position.x === 'number') return new THREE.Vector3(ent.position.x, ent.position.y, ent.position.z);
    if (ent.mesh && ent.mesh.position) return ent.mesh.position.clone();
    return new THREE.Vector3();
  }

  // main damage logic: iterates enemies & props within radius and raycasts to each target
  _applyDamage() {
    const sl = this.sceneLoader;
    const origin = this.position;
    const radius = this.blastRadius;

    // build candidates (shallow copy)
    const enemies = Array.isArray(sl.enemies) ? sl.enemies.slice() : [];
    const props = Array.isArray(sl.props) ? sl.props.slice() : [];

    const candidates = [];

    enemies.forEach(e => {
      const pos = this._getEntityPosition(e);
      if (pos.distanceTo(origin) <= radius + 0.0001) candidates.push({ kind: 'enemy', ref: e, pos });
    });
    props.forEach(p => {
      const pos = this._getEntityPosition(p);
      if (pos.distanceTo(origin) <= radius + 0.0001) candidates.push({ kind: 'prop', ref: p, pos });
    });

    if (candidates.length === 0) return;

    const ray = new THREE.Raycaster();
    ray.far = radius + 0.01;

    const meshes = (typeof sl.getIntersectableMeshes === 'function') ? sl.getIntersectableMeshes() : [];

    for (const cand of candidates) {
      const to = cand.pos;
      const dir = new THREE.Vector3().subVectors(to, origin);
      const dist = dir.length();
      if (dist <= 0) {
        // treat as at center -> full damage
        const dmg = this._falloffDamage(0);
        if (cand.kind === 'enemy') {
          if (typeof cand.ref.takeExplosionDamage === 'function') cand.ref.takeExplosionDamage(dmg, this.damageType, origin);
          else if (typeof cand.ref.takeDamage === 'function') cand.ref.takeDamage(dmg, this.damageType);
        } else {
          if (typeof cand.ref.applyExplosionDamage === 'function') {
            const res = cand.ref.applyExplosionDamage(dmg);
            if (res && res.destroyed) this._cleanupProp(cand.ref);
          } else if (typeof cand.ref.takeDamage === 'function') {
            const died = cand.ref.takeDamage(dmg);
            if (died) this._cleanupProp(cand.ref);
          }
        }
        continue;
      }

      dir.normalize();
      ray.set(origin, dir);
      ray.far = dist + 0.0001;

      const intersects = ray.intersectObjects(meshes, true);

      // build hit chain of props/enemies using userData propId/enemyId
      const chain = [];
      for (const it of intersects) {
        let obj = it.object;
        while (obj && obj.userData && !obj.userData.propId && !obj.userData.enemyId) obj = obj.parent;
        if (!obj || !obj.userData) continue;
        if (obj.userData.propId) {
          const pid = obj.userData.propId;
          const prop = sl.propsById ? sl.propsById[pid] : null;
          if (prop) chain.push({ type: 'prop', ref: prop, distance: it.distance });
        } else if (obj.userData.enemyId) {
          const eid = obj.userData.enemyId;
          const enemy = sl.enemiesById ? sl.enemiesById[eid] : null;
          if (enemy) chain.push({ type: 'enemy', ref: enemy, distance: it.distance });
        }
      }

      // compute initial damage for this target by falloff distance to target (not to first hit)
      let remaining = this._falloffDamage(dist);
      if (remaining <= 0.001) continue;

      if (chain.length === 0) {
        // direct apply
        if (cand.kind === 'enemy') {
          if (typeof cand.ref.takeExplosionDamage === 'function') cand.ref.takeExplosionDamage(remaining, this.damageType, origin);
          else if (typeof cand.ref.takeDamage === 'function') cand.ref.takeDamage(remaining, this.damageType);
        } else {
          if (typeof cand.ref.applyExplosionDamage === 'function') {
            const res = cand.ref.applyExplosionDamage(remaining);
            if (res && res.destroyed) this._cleanupProp(cand.ref);
          } else if (typeof cand.ref.takeDamage === 'function') {
            const died = cand.ref.takeDamage(remaining);
            if (died) this._cleanupProp(cand.ref);
          }
        }
        continue;
      }

      // find candidate index in chain (if any)
      let targetIdx = -1;
      for (let i = 0; i < chain.length; i++) {
        if (chain[i].ref === cand.ref) { targetIdx = i; break; }
      }

      // if first hit is the candidate -> direct
      if (targetIdx === 0) {
        if (cand.kind === 'enemy') {
          if (typeof cand.ref.takeExplosionDamage === 'function') cand.ref.takeExplosionDamage(remaining, this.damageType, origin);
          else if (typeof cand.ref.takeDamage === 'function') cand.ref.takeDamage(remaining, this.damageType);
        } else {
          if (typeof cand.ref.applyExplosionDamage === 'function') {
            const res = cand.ref.applyExplosionDamage(remaining);
            if (res && res.destroyed) this._cleanupProp(cand.ref);
          } else if (typeof cand.ref.takeDamage === 'function') {
            const died = cand.ref.takeDamage(remaining);
            if (died) this._cleanupProp(cand.ref);
          }
        }
        continue;
      }

      // otherwise process nodes in order until we hit the candidate or run out of damage
      for (let ni = 0; ni < chain.length && remaining > 0.0001; ni++) {
        const node = chain[ni];
        if (node.type === 'prop') {
          const prop = node.ref;
          if (prop.indestructible) {
            // blocks everything behind it; stop processing
            remaining = 0;
            break;
          }

          if (typeof prop.applyExplosionDamage === 'function') {
            const res = prop.applyExplosionDamage(remaining);
            remaining = res.passedThrough ?? 0;
            if (res && res.destroyed) this._cleanupProp(prop);
          } else {
            // fallback: let takeDamage absorb everything
            const died = prop.takeDamage ? prop.takeDamage(remaining) : false;
            if (died) this._cleanupProp(prop);
            remaining = 0;
          }
        } else if (node.type === 'enemy') {
          const enemy = node.ref;
          if (typeof enemy.takeExplosionDamage === 'function') enemy.takeExplosionDamage(remaining, this.damageType, origin);
          else if (typeof enemy.takeDamage === 'function') enemy.takeDamage(remaining, this.damageType);
          // enemies do not block blast by default
        }

        // if we've reached candidate, apply remaining to it (already handled in loop)
        if (node.ref === cand.ref) {
          if (remaining > 0.0001) {
            if (cand.kind === 'enemy') {
              if (typeof cand.ref.takeExplosionDamage === 'function') cand.ref.takeExplosionDamage(remaining, this.damageType, origin);
              else if (typeof cand.ref.takeDamage === 'function') cand.ref.takeDamage(remaining, this.damageType);
            } else {
              if (typeof cand.ref.applyExplosionDamage === 'function') {
                const res = cand.ref.applyExplosionDamage(remaining);
                if (res && res.destroyed) this._cleanupProp(cand.ref);
                remaining = res.passedThrough ?? 0;
              } else if (typeof cand.ref.takeDamage === 'function') {
                const died = cand.ref.takeDamage(remaining);
                if (died) this._cleanupProp(cand.ref);
                remaining = 0;
              }
            }
          }
          break;
        }
      } // end chain loop
    } // end candidates
  }

  // Remove prop from sceneLoader lists/maps when destroyed
  _cleanupProp(prop) {
    if (!prop || !prop.id) return;
    const sl = this.sceneLoader;
    try {
      if (Array.isArray(sl.props)) {
        const idx = sl.props.indexOf(prop);
        if (idx >= 0) sl.props.splice(idx, 1);
      }
      if (sl.propsById && sl.propsById[prop.id]) delete sl.propsById[prop.id];

      // remove mesh
      if (prop.mesh && prop.mesh.parent) prop.mesh.parent.remove(prop.mesh);
      if (Array.isArray(sl.propMeshes)) {
        const pmIdx = sl.propMeshes.findIndex(m => m.userData && m.userData.propId === prop.id);
        if (pmIdx >= 0) sl.propMeshes.splice(pmIdx, 1);
      }
    } catch (e) { /* ignore cleanup errors */ }
  }

  update(deltaMs) {
    if (this.isDone) return;
    this.age += deltaMs;
    const t = this.age / Math.max(1, this.lifespan);

    // simple flash grow/fade
    const scale = 0.25 + t * (this.blastRadius * 0.6);
    if (this.flashSphere) {
      this.flashSphere.scale.setScalar(scale);
      if (this.flashSphere.material) this.flashSphere.material.opacity = Math.max(0, 1 - t * 1.3);
    }

    // update particle pool (seconds)
    this.particlePool.update(deltaMs / 1000);

    if (this.age >= this.lifespan) {
      this.destroy();
    }
  }

  destroy() {
    if (this.isDone) return;
    this.isDone = true;
    try { if (this.flashSphere && this.flashSphere.parent) this.flashSphere.parent.remove(this.flashSphere); } catch {}
    if (this._ownsPool && this.particlePool) {
      try { this.particlePool.dispose(); } catch {}
      this.particlePool = null;
    }
    // unregister from sceneLoader
    try {
      const sl = this.sceneLoader;
      if (Array.isArray(sl.explosions)) {
        const idx = sl.explosions.indexOf(this);
        if (idx >= 0) sl.explosions.splice(idx, 1);
      }
    } catch (e) {}
  }

  dispose() {
    this.destroy();
  }
}
// If loaded as a module, attach to window anyway for console testing
if (typeof window !== 'undefined') {
    window.Explosion = Explosion;
    window.PointsParticlePool = PointsParticlePool;
}
