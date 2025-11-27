// js/prop.js
//import * as THREE from './lib/three.module.js';

export class Prop {
  constructor(def) {
    // def matches Scene staticObjects entry
    this.id = def.id;
    this.type = def.type || "prop";
    this.position = def.position ?? { x: 0, y: 0, z: 0 };
    this.size = def.size ?? { x: 1, y: 1, z: 1 };
    this.texture = def.texture || null;
    this.hp = def.hp ?? 1;
    this.maxHp = def.maxHp ?? this.hp;
    this.hitSounds = def.hitSounds ?? [];
    this.deathSounds = def.deathSounds ?? [];
    this.deathAction = def.deathAction ?? "disappear";
    this.mesh = this._createMesh();
  }

  _createMesh() {
    const geo = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    const matOptions = { color: 0x8b5a2b };
    const loader = new THREE.TextureLoader();
    if (this.texture) {
      const tex = loader.load(this.texture);
      matOptions.map = tex;
    }
    const mat = new THREE.MeshStandardMaterial(matOptions);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.position.x, this.position.y, this.position.z);
    mesh.userData.propId = this.id;
    return mesh;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this._die();
      return true; // died
    } else {
      this._playRandom(this.hitSounds);
      return false;
    }
  }

  _playRandom(arr) {
    if (!arr || arr.length === 0) return;
    const i = Math.floor(Math.random() * arr.length);
    try {
      const s = new Audio(arr[i]);
      s.currentTime = 0;
      s.play().catch(() => {});
    } catch (e) {}
  }

  _die() {
    this._playRandom(this.deathSounds);
    // For now: simple disappearance. You can extend with explosion effects.
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
  }

  dispose() {
    if (!this.mesh) return;
    try {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (this.mesh.material.map) this.mesh.material.map.dispose();
        this.mesh.material.dispose();
      }
    } catch (e) {}
  }
}
