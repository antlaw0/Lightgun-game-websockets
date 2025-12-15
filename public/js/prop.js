export class Prop {
  constructor(def) {
    this.id = def.id;
    this.type = def.type || "prop";

    // Explosion interaction flags
    this.coverType = def.coverType || "none"; 
    // "none" | "low" | "full"
    this.indestructible = def.indestructible ?? false;

    // Position & size (essential for LOS and bounding box hit tests)
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

  //
  // DAMAGE FROM NORMAL SOURCES
  //
  takeDamage(amount) {
    console.log("Hit prop");

    // Play hit sounds (preloaded)
    this._playRandom(this.hitSounds);

    // Indestructible: ignore HP changes
    if (this.indestructible) return false;

    this.hp -= amount;
    if (this.hp <= 0) {
      console.log("prop died");
      this._die();
      return true;
    }

    return false;
  }

  //
  // EXPLOSION-SPECIFIC DAMAGE HANDLING
  //
  // explosionDamage: number
  // Returns an object:
  // { absorbed: number, passedThrough: number, destroyed: boolean }
  //
  applyExplosionDamage(explosionDamage) {
    // If it blocks but is indestructible → absorbs all damage, passes 0
    if (this.indestructible) {
      this._playRandom(this.hitSounds);
      return {
        absorbed: explosionDamage,
        passedThrough: 0,
        destroyed: false
      };
    }

    this._playRandom(this.hitSounds);

    const before = this.hp;
    this.hp -= explosionDamage;

    // If destroyed, return leftover damage
    if (this.hp <= 0) {
      const absorbed = before;
      const passed = explosionDamage - before;

      this._die();

      return {
        absorbed: absorbed,
        passedThrough: passed,
        destroyed: true
      };
    }

    // Survived → absorbed everything
    return {
      absorbed: explosionDamage,
      passedThrough: 0,
      destroyed: false
    };
  }

  //
  // Explosion LOS collision test
  // Used by Explosion.js to determine whether this prop blocks the path
  //
  intersectsLine(start, end) {
    // Create AABB for prop
    const half = {
      x: this.size.x * 0.5,
      y: this.size.y * 0.5,
      z: this.size.z * 0.5,
    };

    const min = {
      x: this.position.x - half.x,
      y: this.position.y - half.y,
      z: this.position.z - half.z,
    };

    const max = {
      x: this.position.x + half.x,
      y: this.position.y + half.y,
      z: this.position.z + half.z,
    };

    // Ray-box intersection test
    // Using parametric line t in [0,1]
    let tmin = 0;
    let tmax = 1;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;

    const testAxis = (startCoord, d, minB, maxB) => {
      if (Math.abs(d) < 1e-6) {
        // Parallel: if start outside slab → no hit
        if (startCoord < minB || startCoord > maxB) return false;
        return true; // continue
      }
      const ood = 1 / d;
      let t1 = (minB - startCoord) * ood;
      let t2 = (maxB - startCoord) * ood;
      if (t1 > t2) [t1, t2] = [t2, t1]; // swap
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      return tmin <= tmax;
    };

    if (!testAxis(start.x, dx, min.x, max.x)) return false;
    if (!testAxis(start.y, dy, min.y, max.y)) return false;
    if (!testAxis(start.z, dz, min.z, max.z)) return false;

    return true;
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

  // Remove mesh from scene
  if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);

  // Remove from sceneLoader.props so it stops being processed/rendered
  if (window.sceneLoader) {
    const index = window.sceneLoader.props.indexOf(this);
    if (index !== -1) window.sceneLoader.props.splice(index, 1);
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
