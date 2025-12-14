// js/explosion.js
// Complete, stable explosion + particle system
// Fixes particles freezing midair on catwalks by enforcing gravity, floor collision,
// lifetime decay, and proper cleanup.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// =====================================================
// PointsParticlePool
// =====================================================

class PointsParticlePool {
  constructor(scene, {
    maxParticles = 300,
    gravity = -18,
    drag = 2.5,
    floorY = 0.0
  } = {}) {
    this.scene = scene;
    this.maxParticles = maxParticles;
    this.gravity = gravity;
    this.drag = drag;
    this.floorY = floorY;

    this.count = 0;

    this.positions = new Float32Array(maxParticles * 3);
    this.velocities = new Float32Array(maxParticles * 3);
    this.lifetimes = new Float32Array(maxParticles);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 0.12,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);
  }

  emit(position, velocity, lifetime) {
    if (this.count >= this.maxParticles) return;

    const i = this.count;
    const pi = i * 3;

    this.positions[pi]     = position.x;
    this.positions[pi + 1] = position.y;
    this.positions[pi + 2] = position.z;

    this.velocities[pi]     = velocity.x;
    this.velocities[pi + 1] = velocity.y;
    this.velocities[pi + 2] = velocity.z;

    this.lifetimes[i] = lifetime;
    this.count++;
  }

  update(dt) {
    if (this.count === 0) return;

    let write = 0;

    for (let i = 0; i < this.count; i++) {
      const pi = i * 3;

      let life = this.lifetimes[i] - dt;
      if (life <= 0) continue;

      let vx = this.velocities[pi];
      let vy = this.velocities[pi + 1];
      let vz = this.velocities[pi + 2];

      // gravity
      vy += this.gravity * dt;

      // drag
      const dragFactor = Math.max(0, 1 - this.drag * dt);
      vx *= dragFactor;
      vy *= dragFactor;
      vz *= dragFactor;

      let x = this.positions[pi]     + vx * dt;
      let y = this.positions[pi + 1] + vy * dt;
      let z = this.positions[pi + 2] + vz * dt;

      // floor collision clamp
      if (y < this.floorY) {
        y = this.floorY;
        vy = 0; // stick instead of float or bounce
      }

      const wpi = write * 3;

      this.positions[wpi]     = x;
      this.positions[wpi + 1] = y;
      this.positions[wpi + 2] = z;

      this.velocities[wpi]     = vx;
      this.velocities[wpi + 1] = vy;
      this.velocities[wpi + 2] = vz;

      this.lifetimes[write] = life;
      write++;
    }

    this.count = write;
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  isEmpty() {
    return this.count === 0;
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

// =====================================================
// Explosion
// =====================================================

export class Explosion {
  constructor(scene, position, {
    particleCount = 120,
    blastRadius = 2.5,
    lifespan = 900,
    floorY = 0.0
  } = {}) {
    this.scene = scene;
    this.position = position.clone();
    this.lifespan = lifespan;
    this.ageMs = 0;
    this.done = false;

    // flash sphere
    const geo = new THREE.SphereGeometry(0.2, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffeeaa,
      transparent: true,
      opacity: 1.0
    });

    this.flash = new THREE.Mesh(geo, mat);
    this.flash.position.copy(this.position);
    this.scene.add(this.flash);

    // particles
    this.pool = new PointsParticlePool(scene, { floorY });

    for (let i = 0; i < particleCount; i++) {
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();

      const speed = (0.8 + Math.random() * 1.6) * blastRadius * 3;
      const vel = dir.multiplyScalar(speed);

      const spawn = this.position.clone();
      spawn.y += 0.25; // lift off catwalk

      this.pool.emit(spawn, vel, 0.4 + Math.random() * 0.7);
    }
  }

  update(dt) {
    if (this.done) return;

    this.ageMs += dt * 1000;

    // flash fade & expand
    if (this.flash) {
      const t = Math.min(this.ageMs / this.lifespan, 1);
      this.flash.scale.setScalar(1 + t * 4);
      this.flash.material.opacity = (1 - t) * 0.9;
    }

    this.pool.update(dt);

    if (this.ageMs >= this.lifespan && this.pool.isEmpty()) {
      this.destroy();
    }
  }

  destroy() {
    if (this.done) return;
    this.done = true;

    if (this.flash) {
      this.scene.remove(this.flash);
      this.flash.geometry.dispose();
      this.flash.material.dispose();
      this.flash = null;
    }

    this.pool.dispose();
  }
}
