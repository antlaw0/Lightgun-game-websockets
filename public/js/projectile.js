import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Simple helper: does segment AB come within `radius` of `center`?
function segmentIntersectsSphere(a, b, center, radius) {
  const ab = b.clone().sub(a);
  const abLenSq = ab.lengthSq();
  if (abLenSq === 0) return a.distanceToSquared(center) <= (radius * radius);

  const t = THREE.MathUtils.clamp(center.clone().sub(a).dot(ab) / abLenSq, 0, 1);
  const closest = a.clone().add(ab.multiplyScalar(t));
  return closest.distanceToSquared(center) <= (radius * radius);
}

export class Projectile {
  /**
   * type: "player" or "enemy"
   * onHitPlayer: callback(damage)   // Only for enemy projectiles
   */
  constructor({
    id,
    scene,
    startPos,
    direction,
    speed = 10,
    lifetime = 2000,
    type = "player",
    damage = 1,
    accuracy = 1.0,        // enemy accuracy: 0–1
    onHitPlayer = null,    // callback when player is hit
    camera = null,         // required for enemy projectiles
    // player hit detection tuning
    playerHitRadius = 0.35,
    playerHitForwardOffset = 0.15
  }) {
    this.id = id;
    this.scene = scene;
    this.speed = speed;
    this.lifetime = lifetime;
    this.birth = performance.now();
    this.type = type;
    this.damage = damage;
    this.onHitPlayer = onHitPlayer;
    this.camera = camera;
    this.playerHitRadius = playerHitRadius;
    this.playerHitForwardOffset = playerHitForwardOffset;

    // Direction (possibly modified by enemy accuracy)
    this.dir = direction.clone().normalize();

    if (type === "enemy") {
      // Apply accuracy cone to enemy projectiles. When accuracy == 1.0 this
      // produces zero deviation (deterministic straight shot).
      this._applyAccuracyError(accuracy);
    }

    // Mesh
    const geo = new THREE.SphereGeometry(0.2, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: type === "enemy" ? 0xffff00 : 0xff0000
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(startPos);
    this.mesh.userData.projectileId = id;

    scene.add(this.mesh);
  }

  //------------------------------------------------------------
  // Apply accuracy cone to enemy projectiles
  //------------------------------------------------------------
  _applyAccuracyError(acc) {
    // Clamp accuracy only at [0.01, 1.0] per spec
    const accuracy = THREE.MathUtils.clamp(acc ?? 1.0, 0.01, 1.0);

    // Convert accuracy -> cone half-angle (radians). MAX_CONE_ANGLE_DEG is the
    // full cone angle at worst accuracy (acc==0.01 -> near max).
    const MAX_CONE_ANGLE_DEG = 10; // clearly defined local constant for projectile sampling
    const inaccuracy = 1.0 - accuracy;
    const coneFullDeg = inaccuracy * MAX_CONE_ANGLE_DEG;
    const halfAngleRad = THREE.MathUtils.degToRad(coneFullDeg * 0.5);

    // If accuracy==1.0, halfAngleRad == 0 and direction is unchanged (deterministic)
    if (halfAngleRad <= 0) return;

    // Sample uniformly inside the cone (spherical cap) around current direction
    const forwardN = this.dir.clone().normalize();
    let right = new THREE.Vector3().crossVectors(forwardN, new THREE.Vector3(0, 1, 0)).normalize();
    if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0).normalize();
    const up = new THREE.Vector3().crossVectors(right, forwardN).normalize();

    const u = Math.random();
    const v = Math.random();
    const cosTheta = 1 - u * (1 - Math.cos(halfAngleRad));
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = 2 * Math.PI * v;

    const sample = forwardN.clone().multiplyScalar(cosTheta)
      .add(right.clone().multiplyScalar(Math.cos(phi) * sinTheta))
      .add(up.clone().multiplyScalar(Math.sin(phi) * sinTheta))
      .normalize();

    this.dir.copy(sample);
  }

  //------------------------------------------------------------
  // Update position each frame
  //------------------------------------------------------------
  update(deltaMs) {
  const dt = deltaMs / 1000;

  // store previous position for swept collision
  this.prevPosition = this.mesh.position.clone();

  // move projectile
  this.mesh.position.addScaledVector(this.dir, this.speed * dt);

  if (this.type === "enemy") {
    this._checkHitPlayer();
  }
}

//------------------------------------------------------------
// Check collision against world geometry using swept ray
//------------------------------------------------------------
checkCollision(intersectables) {
  if (!this.prevPosition || !this.mesh) return null;

  const travelVec = new THREE.Vector3()
    .subVectors(this.mesh.position, this.prevPosition);

  const travelDist = travelVec.length();
  if (travelDist === 0) return null;

  const raycaster = new THREE.Raycaster(
    this.prevPosition,
    travelVec.normalize(),
    0,
    travelDist
  );

  const hits = raycaster.intersectObjects(intersectables, true);
  return hits.length > 0 ? hits[0] : null;
}

  //------------------------------------------------------------
  // Check collision against player's camera hit sphere
  //------------------------------------------------------------
  _checkHitPlayer() {
    if (!this.camera) return;
    if (!this.onHitPlayer) return;

    // Swept-segment (prevPosition -> current) against a sphere around the
    // player's camera to avoid tunneling when projectiles move fast.
    const a = this.prevPosition ? this.prevPosition.clone() : this.mesh.position.clone();
    const b = this.mesh.position.clone();

    // Define sphere center slightly forward from camera so hits in front of
    // the camera register (reduces cases where near-misses occur due to camera origin)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const center = this.camera.position.clone().add(forward.multiplyScalar(this.playerHitForwardOffset));
    const radius = this.playerHitRadius;

    if (segmentIntersectsSphere(a, b, center, radius)) {
      this.onHitPlayer(this.damage);
      this.destroyedByHit = true;
      return;
    }

    // Optional: small head sphere (slightly above camera) for better 'headshot' feel
    const headCenter = center.clone().add(new THREE.Vector3(0, 0.18, 0));
    const headRadius = Math.max(0.12, radius * 0.6);
    if (segmentIntersectsSphere(a, b, headCenter, headRadius)) {
      this.onHitPlayer(this.damage);
      this.destroyedByHit = true;
      return;
    }
  }

  //------------------------------------------------------------
  // Is projectile expired (or hit something)?
  //------------------------------------------------------------
  isExpired(now) {
    return (
      (now - this.birth) > this.lifetime ||
      this.destroyedByHit === true
    );
  }

  //------------------------------------------------------------
  // Cleanup
  //------------------------------------------------------------
  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
