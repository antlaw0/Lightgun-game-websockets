import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// explosion.js
export class Explosion {
  constructor(scene, position, options = {}) {
    this.scene = scene;
    this.position = position.clone();

    this.blastRadius = options.blastRadius ?? 4;
    this.maxDamage = options.maxDamage ?? 10;
    this.floorY = options.floorY ?? 0;
    this.explosionSounds = options.explosionSounds ?? [];
    this.age = 0;
    this.lifespan = options.lifespan ?? 0.3;
    this.isDone = false;
// --- Explosion particles ---
this.particleCount = options.particleCount ?? 60;
this.particles = null;
this.particleVelocities = [];

this._createParticles();


    const geo = new THREE.SphereGeometry(0.1, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    this._appliedDamage = false;
	
	    this._playExplosionSound();
  }
  _playExplosionSound() {
    if (!this.explosionSounds || this.explosionSounds.length === 0) return;

    const i = Math.floor(Math.random() * this.explosionSounds.length);
    const src = this.explosionSounds[i];

    const audio = new Audio(src);
    audio.currentTime = 0;
    audio.play().catch(err => {
      console.warn("Explosion sound failed:", err);
    });
  }

  
  _createParticles() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(this.particleCount * 3);

  this.particleVelocities.length = 0;

  for (let i = 0; i < this.particleCount; i++) {
    const i3 = i * 3;

    // Start at explosion center
    positions[i3] = this.position.x;
    positions[i3 + 1] = this.position.y;
    positions[i3 + 2] = this.position.z;

    // Random outward velocity
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();

    const speed = THREE.MathUtils.lerp(2, 6, Math.random());
    this.particleVelocities.push(dir.multiplyScalar(speed));
  }

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffaa33,
    size: 0.15,
    transparent: true,
    opacity: 1,
    depthWrite: false
  });

  this.particles = new THREE.Points(geometry, material);
  this.scene.add(this.particles);
}



_updateParticles(deltaSeconds) {
  if (!this.particles) return;

  const positions = this.particles.geometry.attributes.position.array;

  for (let i = 0; i < this.particleCount; i++) {
    const i3 = i * 3;
    const vel = this.particleVelocities[i];

    positions[i3]     += vel.x * deltaSeconds;
    positions[i3 + 1] += vel.y * deltaSeconds;
    positions[i3 + 2] += vel.z * deltaSeconds;
  }

  this.particles.geometry.attributes.position.needsUpdate = true;

  // Fade out
  this.particles.material.opacity =
    1 - Math.min(this.age / this.lifespan, 1);
}

  
  update(deltaSeconds) {
    if (this.isDone) return;
    this.age += deltaSeconds;

    const scale = Math.min(this.age / this.lifespan, 1) * this.blastRadius;
    if (this.mesh) this.mesh.scale.set(scale, scale, scale);
this._updateParticles(deltaSeconds);

    if (!this._appliedDamage) {
      this._applyExplosionDamage();
      this._appliedDamage = true;
    }

    if (this.age >= this.lifespan) this.isDone = true;
  }

  destroy() {
  if (this.mesh && this.mesh.parent) {
    this.mesh.parent.remove(this.mesh);
  }

  if (this.particles && this.particles.parent) {
    this.particles.parent.remove(this.particles);
  }
}

dispose() {
  if (this.mesh) {
    this.mesh.geometry?.dispose();
    this.mesh.material?.dispose();
  }

  if (this.particles) {
    this.particles.geometry?.dispose();
    this.particles.material?.dispose();
  }
}
_lineIntersectsMesh(start, end, mesh) {
  if (!mesh || !mesh.isMesh) return false;

  const dir = new THREE.Vector3().subVectors(end, start);
  const distance = dir.length();
  dir.normalize();

  const raycaster = new THREE.Raycaster(start, dir);
  const hits = raycaster.intersectObject(mesh, true);

  return hits.length > 0 && hits[0].distance <= distance;
}

  _applyExplosionDamage() {
  if (!window.sceneLoader) return;
  const loader = window.sceneLoader;

  const targets = [
    ...loader.props.map(p => ({ obj: p, type: "prop", pos: p.mesh.position })),
    ...loader.enemies.map(e => ({ obj: e, type: "enemy", pos: e.mesh.position }))
  ];

  targets.sort((a, b) => a.pos.distanceTo(this.position) - b.pos.distanceTo(this.position));

  const computeDamage = (dist) => {
    if (dist > this.blastRadius) return 0;
    return this.maxDamage * (1 - dist / this.blastRadius);
  };

  for (const target of targets) {
    const toTarget = new THREE.Vector3().subVectors(target.pos, this.position);
    const dist = toTarget.length();
    if (dist > this.blastRadius) continue;

    let damage = computeDamage(dist);
    if (damage <= 0) continue;

    console.log(`Explosion: Target ${target.obj.id || target.obj.mesh?.userData.propId || 'unknown'} type=${target.type}, dist=${dist.toFixed(2)}, damage=${damage.toFixed(2)}`);

    // Check LOS blocked by props
    let blocked = false;
    for (const prop of loader.props) {
      if (prop.coverType === "none") continue;
        const mesh =
    prop.mesh && prop.mesh.isMesh ? prop.mesh : null;

  if (!mesh) continue;

  if (this._lineIntersectsMesh(this.position, target.pos, mesh)) {
	    console.log(`Explosion: LOS hit prop ${prop.id}, coverType=${prop.coverType}`);
        if (target.obj === prop && target.type === "prop") {
          const result = prop.applyExplosionDamage(damage);
          console.log(`Explosion: Prop ${prop.id} absorbed ${result.absorbed}, passed ${result.passedThrough}, destroyed=${result.destroyed}`);
          damage = result.passedThrough;
          if (result.destroyed && prop.coverType === "full") blocked = true;
          break;
        } else {
          const result = prop.applyExplosionDamage(damage);
          console.log(`Explosion: Blocking prop ${prop.id} absorbed ${result.absorbed}, passed ${result.passedThrough}, destroyed=${result.destroyed}`);
          damage = result.passedThrough;
          if (prop.coverType === "full" && damage <= 0) {
            blocked = true;
            break;
          }
        }
      }
    }

    if (damage <= 0 || blocked) continue;

    if (target.type === "prop") {
      console.log(`Explosion: Applying ${damage.toFixed(2)} damage to prop ${target.obj.id}`);
      const died = target.obj.takeDamage(damage);
      if (died) console.log(`Explosion: Prop ${target.obj.id} died!`);
    } else if (target.type === "enemy") {
      console.log(`Explosion: Applying ${damage.toFixed(2)} damage to enemy ${target.obj.id}`);
      target.obj.takeDamage(damage);
    }
  }
}
}