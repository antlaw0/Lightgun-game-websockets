// js/player.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

import { WEAPON_DEFS } from "./weapons.js";
import { AMMO_DEFS } from "./ammo.js";

export class Player extends EventTarget {
  constructor({ maxHp = 10000, hp = 10000 } = {}) {
    super();

    this.maxHp = maxHp;
    this.hp = hp;
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

    // Initialize HUD
    this._emitAmmo();
  }

  get currentWeapon() {
    return this.weapons[this.currentWeaponIndex];
  }

  takeDamage(amount) {
    window.hud.shakeCamera(0.3, 0.4);
	this.hp = Math.max(this.hp - amount, 0);
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
  meleeAttack() {
    const nowMs = performance.now();
    const reach = 2.0;          // how far the melee can reach
    const radius = 1.5;         // radius around hit point
    const damage = 15;          // melee damage
    const knockbackForce = 0.3; // how much enemies get pushed

    if (!this.mesh) return;

    const forward = this.getForwardVector();
    const origin = this.mesh.position.clone();
    const hitPos = origin.clone().add(forward.multiplyScalar(reach));

    // Find all alive enemies within melee range
    const hitEnemies = window.ENEMY_INSTANCES.filter(e => {
      if (e._isDead) return false;
      const dist = e.mesh.position.distanceTo(hitPos);
      return dist <= radius;
    });

    hitEnemies.forEach(e => {
      // Apply melee damage
      e.takeDamage(damage, "melee");

      // Apply knockback
      const dir = e.mesh.position.clone().sub(origin).normalize();
      e._knockback.add(dir.multiplyScalar(knockbackForce));

      // Optional: trigger enemy hit sounds (already handled in takeDamage)
    });
  }

  getForwardVector() {
    // Assumes player is facing along Z axis (adjust if you use camera)
    // If you have a camera reference: use camera.getWorldDirection()
    const forward = new THREE.Vector3(0, 0, -1);
    if (this.mesh) {
      forward.applyQuaternion(this.mesh.quaternion).normalize();
    }
    return forward;
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
