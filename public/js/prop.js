import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

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

    // Health
    this.hp = def.hp ?? 1;
    this.maxHp = def.maxHp ?? this.hp;

    // Visuals
    this.texture = def.texture || null; // legacy support
    this.materialDef = def.material ?? {};

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

    this._playRandom(this.hitSounds);

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
  applyExplosionDamage(explosionDamage) {
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

    if (this.hp <= 0) {
      const absorbed = before;
      const passed = explosionDamage - before;

      this._die();

      return {
        absorbed,
        passedThrough: passed,
        destroyed: true
      };
    }

    return {
      absorbed: explosionDamage,
      passedThrough: 0,
      destroyed: false
    };
  }

  //
  // Explosion LOS collision test
  //
  intersectsLine(start, end) {
    const half = {
      x: this.size.x * 0.5,
      y: this.size.y * 0.5,
      z: this.size.z * 0.5
    };

    const min = {
      x: this.position.x - half.x,
      y: this.position.y - half.y,
      z: this.position.z - half.z
    };

    const max = {
      x: this.position.x + half.x,
      y: this.position.y + half.y,
      z: this.position.z + half.z
    };

    let tmin = 0;
    let tmax = 1;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;

    const testAxis = (startCoord, d, minB, maxB) => {
      if (Math.abs(d) < 1e-6) {
        if (startCoord < minB || startCoord > maxB) return false;
        return true;
      }
      const ood = 1 / d;
      let t1 = (minB - startCoord) * ood;
      let t2 = (maxB - startCoord) * ood;
      if (t1 > t2) [t1, t2] = [t2, t1];
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

  //
  // MESH / MATERIAL CREATION (UPDATED)
  //
  _createMesh() {
    const geo = new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    const texLoader = new THREE.TextureLoader();

    const matParams = {
      color: this.materialDef.color ?? 0x8b5a2b,
      roughness: this.materialDef.roughness ?? 0.8,
      metalness: this.materialDef.metalness ?? 0.0,
      emissive: this.materialDef.emissive ?? 0x000000,
      transparent: this.materialDef.transparent ?? false,
      opacity: this.materialDef.opacity ?? 1
    };

    // Legacy texture support
    if (this.texture) {
      matParams.map = texLoader.load(this.texture);
    }

    // PBR maps
    if (this.materialDef.map) {
      matParams.map = texLoader.load(this.materialDef.map);
    }
    if (this.materialDef.normalMap) {
      matParams.normalMap = texLoader.load(this.materialDef.normalMap);
    }
    if (this.materialDef.roughnessMap) {
      matParams.roughnessMap = texLoader.load(this.materialDef.roughnessMap);
    }
    if (this.materialDef.metalnessMap) {
      matParams.metalnessMap = texLoader.load(this.materialDef.metalnessMap);
    }

    const mat = new THREE.MeshStandardMaterial(matParams);
    const mesh = new THREE.Mesh(geo, mat);

    mesh.position.set(
      this.position.x,
      this.position.y + this.size.y / 2,
      this.position.z
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData.propId = this.id;
    mesh.userData.coverType = this.coverType;
    mesh.userData.size = this.size;

    return mesh;
  }

  _die() {
    this._playRandom(this.deathSounds);

    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);

    if (window.sceneLoader) {
      const index = window.sceneLoader.props.indexOf(this);
      if (index !== -1) window.sceneLoader.props.splice(index, 1);
    }
  }

  dispose() {
    if (!this.mesh) return;
    try {
      this.mesh.geometry?.dispose();
      if (this.mesh.material) {
        this.mesh.material.map?.dispose();
        this.mesh.material.normalMap?.dispose();
        this.mesh.material.roughnessMap?.dispose();
        this.mesh.material.metalnessMap?.dispose();
        this.mesh.material.dispose();
      }
    } catch {}
  }
}
