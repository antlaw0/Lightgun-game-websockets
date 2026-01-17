// js/player.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

import { WEAPON_DEFS } from "./weapons.js";
import { AMMO_DEFS } from "./ammo.js";

export class Player extends EventTarget {
  constructor({ maxHp = 10000, hp = 10000 } = {}) {
    super();

    this.maxHp = maxHp;
    this.hp = hp;

// Melee state
this._lastMeleeMs = 0;
this.meleeCooldownMs = 600;


// In Player constructor
    // Private backing field
    this._position = new THREE.Vector3(0, 1.7, 5); // match camera start
    // Initialize ammo pools per type
    this.ammoPools = {};
    for (const key in AMMO_DEFS) {
      this.ammoPools[key] = AMMO_DEFS[key].startingCount;
    }

    // Instantiate all weapons from WEAPON_DEFS
    this.weapons = Object.keys(WEAPON_DEFS).map(id => {
      const def = WEAPON_DEFS[id];
      const ammoType = def.ammoType;

      // Allocate ammo for clip from ammo pool
      const ammoInClip = Math.min(def.clipSize, this.ammoPools[ammoType] || 0);
      this.ammoPools[ammoType] -= ammoInClip;

      return {
        id,
        ...def,

        ammoInClip,
        totalAmmo: 0, // now handled by ammoPools
        lastShotTime: 0
      };
    });

    // Start with weapon 0
    this.currentWeaponIndex = 0;

    // Recoil state (screen-space pixels). Cumulative per shot; decays each frame.
    // `recoilPx` is the current additional reticle radius added to visuals.
    this.recoilPx = 0;
    // Recovery time (ms) to return toward zero (exponential decay time constant).
    // This is configurable per player and controls how quickly recoil returns to neutral.
    this.recoilRecoveryMs = 1200;

    // helper: add recoil (called when firing)
    this.addRecoil = (px) => {
      this.recoilPx = (this.recoilPx || 0) + (px || 0);
    };

    // helper: per-frame update to decay recoil. Called by game loop.
    this.updateRecoil = (deltaMs) => {
      if (!this.recoilPx || this.recoilPx <= 0) {
        this.recoilPx = 0;
        return;
      }
      const tau = Math.max(1, this.recoilRecoveryMs);
      const factor = Math.exp(-deltaMs / tau);
      this.recoilPx *= factor;
      if (this.recoilPx < 0.01) this.recoilPx = 0;
    };

    // Initialize HUD
    this._emitAmmo();
  }

  get currentWeapon() {
    return this.weapons[this.currentWeaponIndex];
  }

  takeDamage(amount) {
    window.hud.shakeCamera(0.3, 0.4);
	this.hp = Math.max(this.hp - amount, 0);
            try {
    const s = new Audio("assets/sfx/player/gethit1.ogg");
    s.currentTime = 0;
    s.play().catch(() => {
        // optional: handle play error here
    });
} catch (e) {
    // optional: handle error
}

			        
	
	this._emitHealth();
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
    this._emitHealth();
  }
  get position() {
    // Assume your player is represented by a camera or some 3D position
    //return window.camera.position.clone(); // or wherever your player "is"
return this._position;	
  }
  getForwardVector() {
    const forward = new THREE.Vector3(0, 0, -1);
    if (window.camera && window.camera.getWorldDirection) {
        window.camera.getWorldDirection(forward);
    } else if (this.mesh) {
        forward.applyQuaternion(this.mesh.quaternion).normalize();
    }
    return forward;
}

meleeAttack() {
    console.log("Melee function triggered");

    const nowMs = performance.now();
    if (nowMs - this._lastMeleeMs < this.meleeCooldownMs) {
        console.log("Melee on cooldown");
        return;
    }

    // Use camera if available, otherwise player position
    const origin = window.camera?.position?.clone() || this._position.clone();
    const forward = new THREE.Vector3();

    if (window.camera?.getWorldDirection) {
        window.camera.getWorldDirection(forward);
    } else {
        forward.set(0, 0, -1); // default forward if camera missing
    }

    const reach = 2.2;
    const radius = 1.4;
    const damage = 15;
    const knockbackForce = 0.35;

    const hitPos = origin.clone().add(forward.multiplyScalar(reach));

    let hitSomething = false;

    // ✅ Safely get enemies from window
    const enemies = window.ENEMY_INSTANCES || [];
    if (enemies.length === 0) {
        console.log("No enemies available to hit");
    }

      console.log(`Melee origin=${origin.x.toFixed(2)},${origin.y.toFixed(2)},${origin.z.toFixed(2)} hitPos=${hitPos.x.toFixed(2)},${hitPos.y.toFixed(2)},${hitPos.z.toFixed(2)} enemies=${enemies.length}`);
      for (const enemy of enemies) {
        if (!enemy.mesh || enemy._isDead) continue;
        // Use world position to account for parent transforms
        const enemyPos = new THREE.Vector3();
        try {
          enemy.mesh.getWorldPosition(enemyPos);
        } catch (_) {
          enemyPos.copy(enemy.mesh.position || new THREE.Vector3());
        }

        // Compute distance from enemy to the line segment (capsule) from origin->hitPos
        const segVec = hitPos.clone().sub(origin); // vector from origin to hitPos
        const segLenSq = segVec.lengthSq() || 1;
        const toEnemy = enemyPos.clone().sub(origin);
        let t = segVec.dot(toEnemy) / segLenSq; // projection factor along segment
        t = Math.max(0, Math.min(1, t));
        const closest = origin.clone().add(segVec.clone().multiplyScalar(t));

        // 3D distance (for diagnostics)
        const dist3D = enemyPos.distanceTo(closest);
        // Horizontal (XZ) distance: ignore vertical offset so camera/player height doesn't prevent hits
        const dx = enemyPos.x - closest.x;
        const dz = enemyPos.z - closest.z;
        const distXZ = Math.hypot(dx, dz);

        console.log(`  enemy=${enemy.id || enemy.name || 'unknown'} pos=${enemyPos.x.toFixed(2)},${enemyPos.y.toFixed(2)},${enemyPos.z.toFixed(2)} closest=${closest.x.toFixed(2)},${closest.y.toFixed(2)},${closest.z.toFixed(2)} dist3D=${dist3D.toFixed(2)} distXZ=${distXZ.toFixed(2)}`);

        if (distXZ > radius) continue;

        // Apply damage and knockback
        try {
          enemy.takeDamage(damage, "melee");
        } catch (err) {
          console.warn("Error calling takeDamage on enemy:", err);
        }
        const dir = enemyPos.clone().sub(origin).normalize();
        if (!enemy._knockback) enemy._knockback = new THREE.Vector3();
        enemy._knockback.add(dir.multiplyScalar(knockbackForce));
        hitSomething = true;
        console.log(`Hit enemy: ${enemy.name || enemy.id || "unknown"}, horizDist=${distXZ.toFixed(2)}, 3Ddist=${dist3D.toFixed(2)}`);
      }

    if (hitSomething) {
        this._lastMeleeMs = nowMs;
        try {
            const s = new Audio("assets/sfx/swing_medium.ogg");
            s.currentTime = 0;
            s.play().catch(() => {});
        } catch (_) {}
    } else {
        console.log("Melee hit nothing");
    }
}
  
    set position(v) {
    // copy the vector so _position stays updated
    this._position.copy(v);
  }
  
  // Cycle weapons forward/backward
  cycleWeapon(direction = 1) {
    if (!this.weapons || this.weapons.length === 0) return;

    this.currentWeaponIndex = (this.currentWeaponIndex + direction + this.weapons.length) % this.weapons.length;
    this._emitAmmo();
try {
            const switchSound = new Audio("assets/sfx/weapons/switch_weapon.ogg");
            switchSound.currentTime = 0;
            switchSound.play().catch(() => {});
        } catch (_) {}

        
    //console.log(`Switched to weapon: ${this.currentWeapon.name}`);
  }

  useAmmo(amount = 1) {
    const weapon = this.currentWeapon;
    if (!weapon) return false;

    if (weapon.ammoInClip >= amount) {
      weapon.ammoInClip -= amount;
      this._emitAmmo();
      return true;
    }
    return false;
  }

  reload() {
    const weapon = this.currentWeapon;
    if (!weapon) return;

    const ammoType = weapon.ammoType;
    const pool = this.ammoPools[ammoType] || 0;

    const needed = weapon.clipSize - weapon.ammoInClip;
    const toLoad = Math.min(needed, pool);

    if (toLoad <= 0) return; // nothing to reload

    weapon.ammoInClip += toLoad;
    this.ammoPools[ammoType] -= toLoad;

    this._emitAmmo();
  }

  switchWeapon(index) {
    if (index < 0 || index >= this.weapons.length) return;
    this.currentWeaponIndex = index;
    this._emitAmmo();
  }
  
 
  _emitHealth() {
    this.dispatchEvent(
      new CustomEvent("healthChanged", {
        detail: {
          hp: this.hp,
          maxHp: this.maxHp
        }
      })
    );
  }

  _emitAmmo() {
    const weapon = this.currentWeapon;
    const ammoType = weapon.ammoType;
    const pool = this.ammoPools[ammoType] || 0;

    this.dispatchEvent(
      new CustomEvent("ammoChanged", {
        detail: {
          id: weapon.id,
          name: weapon.name,
          ammoInClip: weapon.ammoInClip,
          totalAmmo: pool, // total ammo is now shared pool
          clipSize: weapon.clipSize
        }
      })
    );
  }
}
