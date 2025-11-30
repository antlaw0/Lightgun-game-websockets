//import * as THREE from "three";
import { ENEMY_DEFS } from "./scenes.js";

//
// Weapon class
//
export class Weapon {
  constructor(def) {
    this.name = def.name || "weapon";
    this.fireSound = def.fireSound || null;
    this.fireRateMs = def.fireRateMs || 500;
    this.damage = def.damage || 1;
    this.clipSize = def.clipSize || 6;
    this.reloadTimeMs = def.reloadTimeMs || 1500;
    this.reloadSound = def.reloadSound || null;
    this.ammoInClip = this.clipSize;
    this.ammoReserve = def.ammoReserve || 0;
    this.lastFireTimestamp = -Infinity;
    this.isReloading = false;
  }

  canFire(nowMs) {
    if (this.isReloading) return false;
    if (nowMs - this.lastFireTimestamp < this.fireRateMs) return false;
    if (this.ammoInClip <= 0) return false;
    return true;
  }

  recordFire(nowMs) {
    this.lastFireTimestamp = nowMs;
    this.ammoInClip--;

    if (this.fireSound) {
      const s = new Audio(this.fireSound);
      s.currentTime = 0;
      s.play().catch(() => {});
    }

    if (this.ammoInClip <= 0) {
      this.startReload(nowMs);
    }
  }

  startReload(nowMs) {
    if (this.isReloading) return;
    this.isReloading = true;

    if (this.reloadSound) {
      const s = new Audio(this.reloadSound);
      s.currentTime = 0;
      s.play().catch(() => {});
    }

    setTimeout(() => {
      const needed = this.clipSize - this.ammoInClip;
      const taken = Math.min(needed, this.ammoReserve);
      this.ammoInClip += taken;
      this.ammoReserve -= taken;
      this.isReloading = false;
    }, this.reloadTimeMs);
  }
}

//
// Enemy class
//
export class Enemy {
  /**
   * @param {THREE.Group} sceneGroup
   * @param {object} def Enemy definition
   * @param {object} instanceConfig Instance config (position, facing, id)
   * @param {object} player Player reference
   * @param {function} fireCallback Function(originVec3, targetVec3, speed) => Projectile
   */
  constructor(sceneGroup, def, instanceConfig, player, fireCallback) {
    this.id = instanceConfig.id || `enemy_${Date.now()}`;
    this.type = def.displayName || "Enemy";
    this.hp = def.hp || 1;
    this.maxHp = this.hp;
    this.weapon = new Weapon(def.weapon || {});
    this.hitSounds = def.hitSounds || [];
    this.deathSounds = def.deathSounds || [];
    this.accuracy = def.accuracy || 0.5;
    this.reactionTimeMs = def.reactionTimeMs || 300;

    this.player = player;
    this.fireCallback = fireCallback;

    this.position = new THREE.Vector3(
      instanceConfig.position.x || 0,
      instanceConfig.position.y || 0,
      instanceConfig.position.z || 0
    );

    this.facing = instanceConfig.facing || 0;
    this.coverIndex = instanceConfig.coverIndex ?? null;
    this.behavior = instanceConfig.behavior || { pattern: "standInOpen", params: {} };

    //
    // Mesh
    //
    const plane = new THREE.PlaneGeometry(1.2, 1.8);
    const tex = new THREE.TextureLoader().load(def.sprite);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    this.mesh = new THREE.Mesh(plane, mat);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.facing;

    this.mesh.userData.enemyId = this.id;
    this.mesh.name = `enemy_${this.id}`;

    this.sceneGroup = sceneGroup;
    this.sceneGroup.add(this.mesh);

    this._lastUpdateMs = performance.now();
    this._isDead = false;
  }

  _playRandom(arr) {
    if (!arr || arr.length === 0) return;
    const s = new Audio(arr[Math.floor(Math.random() * arr.length)]);
    s.currentTime = 0;
    s.play().catch(() => {});
  }

  takeDamage(amount) {
    if (this._isDead) return;
    this.hp -= amount;

    this._playRandom(this.hitSounds);

    if (this.hp <= 0) this.die();
  }

  die() {
    if (this._isDead) return;
    this._isDead = true;
    this.mesh.visible = false;

    this._playRandom(this.deathSounds);

    window.dispatchEvent(new CustomEvent("enemyDied", {
      detail: { id: this.id }
    }));
  }

  update(deltaMs, nowMs, player) {
    if (this._isDead) return;

    const pattern = this.behavior.pattern;
    const p = this.behavior.params || {};

    if (pattern === "popOutFromCover") {
      this._updatePopOut(deltaMs, nowMs, p);
    } else if (pattern === "patrol") {
      this._updatePatrol(deltaMs, nowMs, p);
    } else {
      this._updateStand(deltaMs, nowMs, p);
    }
  }

  //
  // Fire projectile using SceneLoader callback
  //
  _attemptFire(nowMs) {
    if (!this.weapon.canFire(nowMs) || !this.player || !this.fireCallback) return;

    this.weapon.recordFire(nowMs);

    const muzzle = this.mesh.position.clone();
    muzzle.y += 0.9;
    const targetPos = this.player.mesh?.position.clone() || new THREE.Vector3(0, 1.7, 0);

    // Compute direction with accuracy deviation
    const idealDir = targetPos.clone().sub(muzzle).normalize();
    const deviatedDir = idealDir.clone();
    if (this.accuracy < 1.0) {
      const maxAngle = (1 - this.accuracy) * (Math.PI / 6);
      const randAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      const angle = Math.random() * maxAngle;
      deviatedDir.applyAxisAngle(randAxis, angle).normalize();
    }

    // Call SceneLoader spawnProjectile
    this.fireCallback(muzzle, muzzle.clone().add(deviatedDir.multiplyScalar(28)), 28);

    // Optional: hit player immediately for testing
    const angleBetween = idealDir.angleTo(deviatedDir);
    const hitThreshold = 0.03;
    if (angleBetween <= hitThreshold) {
      window.dispatchEvent(new CustomEvent("enemyFiredHitPlayer", {
        detail: { id: this.id, damage: this.weapon.damage }
      }));
    }
  }

  //
  // Behaviors
  //
  _updateStand(deltaMs, nowMs, params) {
    const interval = params.fireIntervalMs || 1200;
    if (!this._lastStandFire) this._lastStandFire = 0;
    if (nowMs - this._lastStandFire > interval) {
      this._attemptFire(nowMs);
      this._lastStandFire = nowMs;
    }
  }

  _updatePatrol(deltaMs, nowMs, params) {
    if (!this._patrol) {
      this._patrol = {
        dir: 1,
        minX: (params.minX ?? this.position.x - 2),
        maxX: (params.maxX ?? this.position.x + 2),
        speed: (params.speed ?? 0.004)
      };
    }

    const p = this._patrol;
    const newX = this.mesh.position.x + p.dir * p.speed * deltaMs;

    if (newX < p.minX || newX > p.maxX) {
      p.dir *= -1;
    } else {
      this.mesh.position.x = newX;
    }

    if (!this._lastPatrolFire || nowMs - this._lastPatrolFire > (params.fireIntervalMs || 1500)) {
      this._attemptFire(nowMs);
      this._lastPatrolFire = nowMs;
    }
  }

  _updatePopOut(deltaMs, nowMs, params) {
    if (!this._popState) {
      this._popState = { phase: "hidden", phaseSince: nowMs };
      this.mesh.visible = false;
    }

    const phase = this._popState.phase;
    const elapsed = nowMs - this._popState.phaseSince;

    if (phase === "hidden") {
      if (elapsed >= (params.hideDurationMs || 1200)) {
        this._popState.phase = "popping";
        this._popState.phaseSince = nowMs;
        this.mesh.visible = true;
      }
    } else if (phase === "popping") {
      this._popState.phase = "firing";
      this._popState.phaseSince = nowMs;
      this._attemptFire(nowMs);
    } else if (phase === "firing") {
      this._attemptFire(nowMs);
      if (elapsed >= (params.popDurationMs || 800)) {
        this._popState.phase = "hidden";
        this._popState.phaseSince = nowMs;
        this.mesh.visible = false;
      }
    }
  }

  dispose() {
    if (this.mesh && this.sceneGroup) {
      this.sceneGroup.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (this.mesh.material.map) this.mesh.material.map.dispose();
      this.mesh.material.dispose();
    }
  }
}
