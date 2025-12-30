// js/player.js
import { WEAPON_DEFS } from "./weapons.js";
import { AMMO_DEFS } from "./ammo.js";

export class Player extends EventTarget {
  constructor({ maxHp = 100, hp = 100 } = {}) {
    super();

    this.maxHp = maxHp;
    this.hp = hp;

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
