// js/player.js
export class Player extends EventTarget {
  constructor({ maxHp = 100, hp = 100, weapons = [], currentWeaponIndex = 0 }) {
    super();
    this.maxHp = maxHp;
    this.hp = hp;
    this.weapons = weapons;
    this.currentWeaponIndex = currentWeaponIndex;
  }

  get currentWeapon() {
    return this.weapons[this.currentWeaponIndex];
  }

  takeDamage(amount) {
    this.hp = Math.max(this.hp - amount, 0);
    this._emitHealth();
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
    this._emitHealth();
  }

  useAmmo(amount = 1) {
    const weapon = this.currentWeapon;
    if (!weapon) return;

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

    const needed = weapon.clipSize - weapon.ammoInClip;
    const available = Math.min(needed, weapon.totalAmmo);
    weapon.ammoInClip += available;
    weapon.totalAmmo -= available;
    this._emitAmmo();
  }

  switchWeapon(index) {
    if (index < 0 || index >= this.weapons.length) return;
    this.currentWeaponIndex = index;
    this._emitAmmo();
  }

  _emitHealth() {
    this.dispatchEvent(new CustomEvent('healthChanged', { detail: { hp: this.hp, maxHp: this.maxHp } }));
  }

  _emitAmmo() {
    const weapon = this.currentWeapon;
    this.dispatchEvent(new CustomEvent('ammoChanged', { detail: { 
      ammoInClip: weapon.ammoInClip, 
      totalAmmo: weapon.totalAmmo 
    }}));
  }
}
