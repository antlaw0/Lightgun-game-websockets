import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

function ensureGeometryUv2(geometry) {
  if (!geometry || !geometry.attributes || geometry.attributes.uv2 || !geometry.attributes.uv) return;
  geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));
}

export class Prop {
  constructor(def) {
    this.id = def.id;
    this.type = def.type || "prop";
this.explosion = def.explosion ?? null;

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
    const hitList = Array.isArray(def.hitSounds) ? def.hitSounds : [];
    this.hitSounds = hitList.map(path => {
      const audio = new Audio(path);
      audio.load();
      return audio;
    });

    const deathList = Array.isArray(def.deathSounds) ? def.deathSounds : [];
    this.deathSounds = deathList.map(path => {
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
console.log("indestructible?", this.indestructible);

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

    const repeatX = this.materialDef.horizontalRepeat ?? 1;
    const repeatY = this.materialDef.verticalRepeat ?? 1;

    const loadTex = (path) => {
      const tex = texLoader.load(path);
      if (repeatX !== 1 || repeatY !== 1) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
      }
      return tex;
    };

    const loadColorTex = (path) => {
      const tex = loadTex(path);
      if (tex) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const loadDataTex = (path) => {
      const tex = loadTex(path);
      if (tex) tex.colorSpace = THREE.NoColorSpace;
      return tex;
    };

    // Legacy texture support
    if (this.texture) {
      matParams.map = loadColorTex(this.texture);
    }

    // Preferred packed workflow: basecolor + normal + orm
    const baseColorPath = this.materialDef.baseColorMap ?? this.materialDef.basecolor ?? this.materialDef.map;
    const normalPath = this.materialDef.normalMap ?? this.materialDef.normal;
    const ormPath = this.materialDef.ormMap ?? this.materialDef.orm;

    if (baseColorPath) matParams.map = loadColorTex(baseColorPath);
    if (normalPath) matParams.normalMap = loadDataTex(normalPath);
    if (ormPath) {
      const ormTex = loadDataTex(ormPath);
      matParams.aoMap = ormTex;
      matParams.roughnessMap = ormTex;
      matParams.metalnessMap = ormTex;
    }

    // Legacy PBR map support
    if (!ormPath && this.materialDef.roughnessMap) matParams.roughnessMap = loadDataTex(this.materialDef.roughnessMap);
    if (!ormPath && this.materialDef.metalnessMap) matParams.metalnessMap = loadDataTex(this.materialDef.metalnessMap);
    if (!ormPath && this.materialDef.aoMap) matParams.aoMap = loadDataTex(this.materialDef.aoMap);
    if (this.materialDef.emissiveMap) matParams.emissiveMap = loadColorTex(this.materialDef.emissiveMap);
    if (this.materialDef.displacementMap) matParams.displacementMap = loadDataTex(this.materialDef.displacementMap);
    if (this.materialDef.alphaMap) matParams.alphaMap = loadDataTex(this.materialDef.alphaMap);

    const mat = new THREE.MeshStandardMaterial(matParams);
    const mesh = new THREE.Mesh(geo, mat);

    if (mat.aoMap) {
      // AO in MeshStandardMaterial samples uv2, so synthesize it from uv when absent.
      ensureGeometryUv2(geo);
      mat.aoMapIntensity = this.materialDef.aoMapIntensity ?? 1.0;
    }

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

  if (this.explosion && window.spawnTestExplosion) {
    const worldPos = new THREE.Vector3();
    this.mesh.getWorldPosition(worldPos);

    window.spawnTestExplosion({
      x: worldPos.x,
      y: worldPos.y,
      z: worldPos.z,
      blastRadius: this.explosion.blastRadius,
      maxDamage: this.explosion.maxDamage,
      explosionSounds: this.explosion.explosionSounds
    });
  }

  if (this.mesh && this.mesh.parent) {
    this.mesh.parent.remove(this.mesh);
  }

  if (window.sceneLoader) {
    const index = window.sceneLoader.props.indexOf(this);
    if (index !== -1) window.sceneLoader.props.splice(index, 1);
  }
}
}