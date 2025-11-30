
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
    camera = null          // required for enemy projectiles
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

    // Direction (possibly modified by enemy accuracy)
    this.dir = direction.clone().normalize();

    if (type === "enemy") {
      //this._applyAccuracyError(accuracy);
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
    const maxAngle = THREE.MathUtils.degToRad(10);  // Max deviation at acc=0
    const deviation = maxAngle * (1 - acc);

    if (deviation > 0.0001) {
      const randAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();

      this.dir.applyAxisAngle(randAxis, (Math.random() - 0.5) * deviation);
      this.dir.normalize();
    }
  }

  //------------------------------------------------------------
  // Update position each frame
  //------------------------------------------------------------
  update(deltaMs) {
    const dt = deltaMs / 1000;
    this.mesh.position.addScaledVector(this.dir, this.speed * dt);

    if (this.type === "enemy") {
      this._checkHitPlayer();
    }
  }

  //------------------------------------------------------------
  // Check collision against player's camera hit sphere
  //------------------------------------------------------------
  _checkHitPlayer() {
    if (!this.camera) return;
    if (!this.onHitPlayer) return;

    const playerPos = this.camera.position;
    const dist = this.mesh.position.distanceTo(playerPos);

    const HIT_RADIUS = 0.3;  // tweak as needed

    if (dist < HIT_RADIUS) {
      // Enemy projectile hits the player
      this.onHitPlayer(this.damage);
      this.destroyedByHit = true;
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
