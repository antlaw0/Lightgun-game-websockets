export class Prop {
  constructor(def) {
    this.id = def.id;
    this.type = def.type || "prop";
	this.indestructible = def.indestructible ?? false;

    this.position = def.position ?? { x: 0, y: 0, z: 0 };
    this.size = def.size ?? { x: 1, y: 1, z: 1 };
    this.texture = def.texture || null;
    this.hp = def.hp ?? 1;
    this.maxHp = def.maxHp ?? this.hp;

    // Preload sounds
    this.hitSounds = (def.hitSounds ?? []).map(path => {
      const audio = new Audio(path);
      audio.load();
      return audio;
    });

    this.deathSounds = (def.deathSounds ?? []).map(path => {
      const audio = new Audio(path);
      audio.load();
      return audio;
    });

    this.deathAction = def.deathAction ?? "disappear";

    this.mesh = this._createMesh();
  }

  takeDamage(amount) {
    console.log("Hit prop");

    // Play hit sounds (preloaded)
    this._playRandom(this.hitSounds);

    // For indestructible props, skip hp logic
    if (this.indestructible) return false;

    this.hp -= amount;
    if (this.hp <= 0) {
      console.log("prop died");
      this._die();
      return true;
    }

    return false;
  }

  _playRandom(arr) {
    if (!arr || arr.length === 0) return;
    const i = Math.floor(Math.random() * arr.length);
    const s = arr[i];
    s.currentTime = 0;
    s.play().catch(err => console.warn("Audio play failed:", err));
  }

  _createMesh() {
    const geo = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    const matOptions = { color: 0x8b5a2b };
    if (this.texture) {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(this.texture);
      matOptions.map = tex;
    }
    const mat = new THREE.MeshStandardMaterial(matOptions);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.position.x, this.position.y, this.position.z);
    mesh.userData.propId = this.id;
    return mesh;
  }

  _die() {
    this._playRandom(this.deathSounds);
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
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
