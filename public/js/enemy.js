// js/enemy.js
//import * as THREE from './lib/three.module.js';

import { ENEMY_DEFS } from "./scenes.js";

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
	this.lastHitFrame = -1;
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
      s.play().catch(() => console.warn("fire sound play prevented"));
    }
    if (this.ammoInClip <= 0) {
      this.startReload(nowMs);
    }
  }

  startReload(nowMs) {
    if (this.isReloading) return;
    if (this.reloadSound) {
      const s = new Audio(this.reloadSound);
      s.currentTime = 0;
      s.play().catch(() => {});
    }
    this.isReloading = true;
    setTimeout(() => {
      const needed = this.clipSize - this.ammoInClip;
      const taken = Math.min(needed, this.ammoReserve);
      this.ammoInClip += taken;
      this.ammoReserve -= taken;
      this.isReloading = false;
      console.log(`[Weapon] reloaded ${this.name}: ammoInClip=${this.ammoInClip} reserve=${this.ammoReserve}`);
    }, this.reloadTimeMs);
  }
}

export class Enemy {
  constructor(sceneGroup, def, instanceConfig) {
    // sceneGroup: THREE.Group to attach meshes to.
    // def: the ENEMY_DEFS entry
    // instanceConfig: {id, position, behavior, coverIndex, facing}
    this.id = instanceConfig.id || `enemy_${Date.now()}`;
    this.type = def && def.displayName ? def.displayName : "Enemy";
    this.hp = def.hp || 1;
    this.maxHp = this.hp;
    this.weapon = new Weapon(def.weapon || {});
    this.hitSounds = def.hitSounds || [];
    this.deathSounds = def.deathSounds || [];
    this.accuracy = def.accuracy || 0.5;
    this.reactionTimeMs = def.reactionTimeMs || 300;

    this.position = new THREE.Vector3(
      instanceConfig.position.x || 0,
      instanceConfig.position.y || 0,
      instanceConfig.position.z || 0
    );

    this.facing = instanceConfig.facing || 0;
    this.coverIndex = instanceConfig.coverIndex ?? null;

    // Behavior config
    this.behavior = instanceConfig.behavior || { pattern: "standInOpen", params: {} };
    this.state = "idle"; // idle, inCover, poppingOut, firing, reloading, dead
    this.stateSince = performance.now();

    // Create a simple plane mesh using sprite texture:
    const plane = new THREE.PlaneGeometry(1.2, 1.8); // width, height - tweak for sprite ratio
    const tex = new THREE.TextureLoader().load(def.sprite);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    this.mesh = new THREE.Mesh(plane, mat);
    this.mesh.position.copy(this.position);
    // Optional: rotate to face camera or player; for now rotate Y by facing
    this.mesh.rotation.y = this.facing;

    // Mark the mesh so raycasts can find which enemy was hit.
    // Also set a human-friendly name for debug.
    this.mesh.userData = this.mesh.userData || {};
    this.mesh.userData.enemyId = this.id;
    this.mesh.name = `enemy_${this.id}`;
    
	this.sceneGroup = sceneGroup;
    this.sceneGroup.add(this.mesh);

    // Behavior internals
    this._aiTimer = 0;
    this._lastUpdateMs = performance.now();
    this._isDead = false;
  }

  _playRandom(arr) {
    if (!arr || arr.length === 0) return;
    const i = Math.floor(Math.random() * arr.length);
    const s = new Audio(arr[i]);
    s.currentTime = 0;
    s.play().catch(() => {});
  }

  takeDamage(amount) {
    if (this._isDead) return;
    this.hp -= amount;
    console.log(`[Enemy ${this.id}] took ${amount} damage. HP=${this.hp}/${this.maxHp}`);
    this._playRandom(this.hitSounds);
    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    if (this._isDead) return;
    this._isDead = true;
    this.state = "dead";
    this.stateSince = performance.now();
    this.mesh.visible = false; // hide for now; you can play death animation
    this._playRandom(this.deathSounds);
    console.log(`[Enemy ${this.id}] died.`);
    // dispatch event so LevelManager can pick it up (simple custom event)
    const ev = new CustomEvent("enemyDied", { detail: { id: this.id } });
    window.dispatchEvent(ev);
  }

  // Called each frame from main loop with delta in ms and now timestamp
  update(deltaMs, nowMs, player) {
    if (this._isDead) return;
    // Basic AI patterns:
    const pattern = this.behavior.pattern;
    const p = this.behavior.params || {};

    if (pattern === "popOutFromCover") {
      this._updatePopOut(deltaMs, nowMs, p, player);
    } else if (pattern === "patrol") {
      this._updatePatrol(deltaMs, nowMs, p, player);
    } else { // standInOpen or unknown
      this._updateStand(deltaMs, nowMs, p, player);
    }
  }

  _updatePopOut(deltaMs, nowMs, params, player) {
    // cycle: hidden -> pop -> fire -> hide -> repeat
    // represent hidden by moving slightly into cover (lower y) or set visible false
    if (!this._popState) {
      this._popState = { phase: "hidden", phaseSince: nowMs };
      this.mesh.visible = false;
    }

    const phase = this._popState.phase;
    const elapsed = nowMs - this._popState.phaseSince;

    if (phase === "hidden") {
      if (elapsed >= (params.hideDurationMs || 1200)) {
        // start pop out
        this._popState.phase = "popping";
        this._popState.phaseSince = nowMs;
        this.mesh.visible = true;
        // could animate position.y here; for now instant show
      }
    } else if (phase === "popping") {
      // Immediately go to firing for simplicity
      this._popState.phase = "firing";
      this._popState.phaseSince = nowMs;
      this._attemptFire(nowMs, player);
    } else if (phase === "firing") {
      // keep trying to fire until popDurationMs
      this._attemptFire(nowMs, player);
      if (elapsed >= (params.popDurationMs || 800)) {
        this._popState.phase = "hidden";
        this._popState.phaseSince = nowMs;
        this.mesh.visible = false;
      }
    }
  }

  _updatePatrol(deltaMs, nowMs, params, player) {
    // Very simple placeholder: move left-right on X between min/max
    if (!this._patrol) {
      this._patrol = { dir: 1, minX: (params.minX ?? this.position.x - 2), maxX: (params.maxX ?? this.position.x + 2), speed: (params.speed ?? 0.004) };
    }
    const p = this._patrol;
    const newX = this.mesh.position.x + p.dir * p.speed * deltaMs;
    if (newX < p.minX || newX > p.maxX) {
      p.dir *= -1;
    } else {
      this.mesh.position.x = newX;
    }
    // Try to fire occasionally based on fireInterval param
    if (!this._lastPatrolFire || nowMs - this._lastPatrolFire > (params.fireIntervalMs || 1500)) {
      this._attemptFire(nowMs, player);
      this._lastPatrolFire = nowMs;
    }
  }

  _updateStand(deltaMs, nowMs, params, player) {
    // Just shoot periodically
    if (!this._lastStandFire) this._lastStandFire = 0;
    const interval = params.fireIntervalMs || 1200;
    if (nowMs - this._lastStandFire > interval) {
      this._attemptFire(nowMs, player);
      this._lastStandFire = nowMs;
    }
  }

  _attemptFire(nowMs, player) {
    if (!this.weapon.canFire(nowMs)) {
      return;
    }
    // For prototyping: use accuracy to determine if it hits the player
    const roll = Math.random();
    this.weapon.recordFire(nowMs);
    console.log(`[Enemy ${this.id}] fired. roll=${roll.toFixed(2)} acc=${this.accuracy}`);
    if (roll <= this.accuracy) {
      // Hit player — dispatch event with damage
      const ev = new CustomEvent("enemyFiredHitPlayer", { detail: { id: this.id, damage: this.weapon.damage } });
      window.dispatchEvent(ev);
      console.log(`[Enemy ${this.id}] HIT player for ${this.weapon.damage}`);
    } else {
      console.log(`[Enemy ${this.id}] MISSED player`);
    }
  }

  dispose() {
    // cleanup
    if (this.mesh && this.sceneGroup) {
      this.sceneGroup.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (this.mesh.material.map) this.mesh.material.map.dispose();
      this.mesh.material.dispose();
    }
  }
}
