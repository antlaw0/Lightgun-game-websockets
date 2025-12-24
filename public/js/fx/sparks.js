import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const MAX_SPARKS = 2000;

let positions, velocities, lifetimes;
let geometry, points;
let nextIndex = 0;

let sparkTexture = null;

export function initSparks(scene) {
  // Load texture once
  if (!sparkTexture) {
    sparkTexture = new THREE.TextureLoader().load(
      '/assets/textures/spark.png',
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      }
    );
  }

  positions  = new Float32Array(MAX_SPARKS * 3);
  velocities = new Float32Array(MAX_SPARKS * 3);
  lifetimes  = new Float32Array(MAX_SPARKS);

  geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.05,
    map: sparkTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    color: 0xffcc66
  });

  points = new THREE.Points(geometry, material);
  scene.add(points);
}

export function spawnSparks(position, normal, count = 6) {
  for (let i = 0; i < count; i++) {
    const i3 = nextIndex * 3;

    positions[i3]     = position.x;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z;

    const dir = normal.clone()
      .add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      ))
      .normalize()
      .multiplyScalar(2 + Math.random() * 2);

    velocities[i3]     = dir.x;
    velocities[i3 + 1] = dir.y;
    velocities[i3 + 2] = dir.z;

    lifetimes[nextIndex] = 0.08 + Math.random() * 0.1;

    nextIndex = (nextIndex + 1) % MAX_SPARKS;
  }

  geometry.attributes.position.needsUpdate = true;
}

export function updateSparks(dtMs) {
  const dt = dtMs / 1000;

  for (let i = 0; i < MAX_SPARKS; i++) {
    if (lifetimes[i] <= 0) continue;

    const i3 = i * 3;

    velocities[i3 + 1] -= 9.8 * dt * 0.2;

    positions[i3]     += velocities[i3]     * dt;
    positions[i3 + 1] += velocities[i3 + 1] * dt;
    positions[i3 + 2] += velocities[i3 + 2] * dt;

    lifetimes[i] -= dt;
  }

  geometry.attributes.position.needsUpdate = true;
}
