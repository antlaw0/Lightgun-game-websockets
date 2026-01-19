import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { buildPrefab } from "./prefabLibrary.js";
import { ENEMY_INSTANCES } from "./enemy.js";
window.ENEMY_INSTANCES = ENEMY_INSTANCES;

import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';

import { Explosion } from './explosion.js';

import { Enemy } from "./enemy.js";
import { Prop as PropClass } from "./prop.js";
import { ENEMY_DEFS } from "./scenes.js";
import { Projectile } from "./projectile.js";

export class SceneLoader {
  constructor(scene, camera, player) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
	// --- NOTE: changed from object maps to arrays for runtime lists ---
    // Arrays are authoritative for iteration; maps exist for O(1) lookup by id.
    this.enemies = [];         // array of Enemy instances
    this.enemiesById = {};     // map id -> Enemy

    this.props = [];           // array of Prop instances
    this.propsById = {};       // map id -> Prop
this.staticObjects = [];
window.sceneLoader = this;

    // meshes lists used for raycasting / intersectables (kept in sync by helpers)
    this.enemyMeshes = [];
    this.propMeshes = [];

    // projectiles (kept as map like before)
    this.projectiles = {};
    this.projectileMeshes = [];
    this.nextProjectileId = 1;

    // explosions tracked by SceneLoader (Explosion instances pushed via addExplosion)
    this.explosions = [];      // array of explosion instances (any object with update/destroy/dispose)

    this.sceneDef = null;
    this.roomMeshes = [];

    this.frameCount = 0;

    this.roomWidth = 10;
    this.roomHeight = 5;
    this.roomDepth = 12;

    this.padding = 2;

    this.sceneLights = [];
  }

  // -------------------------
  // Registration helpers
  // -------------------------
  addProp(propInstance) {
    if (!propInstance || !propInstance.mesh) return;
    // push into array and map
    this.props.push(propInstance);
    if (propInstance.id) this.propsById[propInstance.id] = propInstance;

    // scene + mesh tracking
    this.scene.add(propInstance.mesh);
    propInstance.mesh.traverse(obj => {
  if (obj.isMesh) {
    this.propMeshes.push(obj);
  }
});

	
  }

  addEnemy(enemyInstance) {
    if (!enemyInstance || !enemyInstance.mesh) return;
    this.enemies.push(enemyInstance);
    if (enemyInstance.id) this.enemiesById[enemyInstance.id] = enemyInstance;

    this.scene.add(enemyInstance.mesh);
    enemyInstance.mesh.traverse(obj => {
  if (obj.isMesh) {
    this.enemyMeshes.push(obj);
  }
});

	
  }

  addExplosion(explosionInstance) {
    if (!explosionInstance) return;
    this.explosions.push(explosionInstance);
    // If the explosion has a mesh or points object, SceneLoader won't assume the property name.
    // Explosion author should add its mesh to scene themselves or expose `mesh` property for us to add.
    if (explosionInstance.mesh) this.scene.add(explosionInstance.mesh);
    // If explosion exposes `addToScene(scene)` use it (optional)
    if (typeof explosionInstance.addToScene === "function") explosionInstance.addToScene(this.scene);
  }


_applyCameraSettings() {
  const camDef = this.sceneDef?.camera;
  if (!camDef || !this.camera) return;

  // Position
  if (camDef.position) {
    this.camera.position.set(
      camDef.position.x ?? this.camera.position.x,
      camDef.position.y ?? this.camera.position.y,
      camDef.position.z ?? this.camera.position.z
    );
  }

  // Look-at
  if (camDef.lookAt) {
    this.camera.lookAt(
      camDef.lookAt.x ?? 0,
      camDef.lookAt.y ?? 0,
      camDef.lookAt.z ?? 0
    );
  }

  // Projection params (PerspectiveCamera only)
  if (this.camera.isPerspectiveCamera) {
    if (typeof camDef.fov === "number") this.camera.fov = camDef.fov;
    if (typeof camDef.near === "number") this.camera.near = camDef.near;
    if (typeof camDef.far === "number") this.camera.far = camDef.far;
    this.camera.updateProjectionMatrix();
  }
}

  // -----------------------------
  // Lights (unchanged)
  // -----------------------------
  _createLights() {
  // Clear previous lights
  this.sceneLights.forEach(l => this.scene.remove(l));
  this.sceneLights = [];

  const defs = this.sceneDef?.lights;
  if (!Array.isArray(defs)) return;

  defs.forEach(def => {
    let light;

    switch (def.type) {
      case "ambient":
        light = new THREE.AmbientLight(
          def.color ?? 0xffffff,
          def.intensity ?? 1
        );
        break;

      case "directional":
        light = new THREE.DirectionalLight(
          def.color ?? 0xffffff,
          def.intensity ?? 1
        );
        break;

      case "point":
        light = new THREE.PointLight(
          def.color ?? 0xffffff,
          def.intensity ?? 1,
          def.distance ?? 0,
          def.decay ?? 1
        );
        break;

      case "spot":
        light = new THREE.SpotLight(
          def.color ?? 0xffffff,
          def.intensity ?? 1,
          def.distance ?? 0,
          def.angle ?? Math.PI / 4,
          def.penumbra ?? 0,
          def.decay ?? 1
        );
        break;

      default:
        console.warn("Unknown light type:", def.type);
        return;
    }

    
	
	// Position
    if (def.position) {
      light.position.set(
        def.position.x ?? 0,
        def.position.y ?? 0,
        def.position.z ?? 0
      );
    }

    // Target (directional / spot)
    if (def.target && light.target) {
      const t = new THREE.Object3D();
      t.position.set(def.target.x, def.target.y, def.target.z);
      this.scene.add(t);
      light.target = t;
    }

    // Shadows
    if (def.castShadow) {
      light.castShadow = true;

      const s = def.shadow ?? {};
      if (s.mapSize) {
        light.shadow.mapSize.set(
          s.mapSize.width ?? 1024,
          s.mapSize.height ?? 1024
        );
      }
      if (typeof s.bias === "number") {
        light.shadow.bias = s.bias;
      }
      if (typeof s.radius === "number") {
        light.shadow.radius = s.radius;
      }

      if (light.shadow.camera) {
        light.shadow.camera.near = s.near ?? 0.1;
        light.shadow.camera.far  = s.far ?? def.distance ?? 50;
      }
    }

    this.scene.add(light);

    this.sceneLights.push(light);
  });

}


  // -----------------------------
  // Load Scene (adjusted)
  // -----------------------------
  loadScene(sceneDef) {
    this.unloadScene();
    this.sceneDef = sceneDef;

    console.log(`SceneLoader loading scene: ${sceneDef.name}`);

    // Props (including full-cover walls)
const staticObjects = sceneDef.environment?.staticObjects ?? [];

for (let idx = 0; idx < staticObjects.length; idx++) {
  const pdef = staticObjects[idx];
  if (!pdef.id) pdef.id = `prop_${idx}`;

  // =============================
  // PREFAB PROP
  // =============================
// =============================
// PREFAB PROP (updated for Prop instances)
// =============================
// =============================
// PREFAB PROP
// =============================
// =============================
// PREFAB PROPS (Prop-based)
// =============================
if (pdef.type === "prefab" && pdef.prefab) {
    // Build the Prop instance via prefabLibrary
    const propInstance = buildPrefab(pdef.prefab, pdef);

    if (!propInstance || !propInstance.mesh) {
        console.warn("Failed to build prefab:", pdef.prefab, pdef.id);
        continue;
    }

    // Override transforms if defined
    if (pdef.position) {
        propInstance.mesh.position.set(
            pdef.position.x ?? 0,
            pdef.position.y ?? 0,
            pdef.position.z ?? 0
        );
    }

    if (pdef.rotation) {
        propInstance.mesh.rotation.set(
            pdef.rotation.x ?? 0,
            pdef.rotation.y ?? 0,
            pdef.rotation.z ?? 0
        );
    }

    if (pdef.scale) {
        propInstance.mesh.scale.set(
            pdef.scale.x ?? 1,
            pdef.scale.y ?? 1,
            pdef.scale.z ?? 1
        );
    }

    // Traverse the mesh for shadow / hit detection
    propInstance.mesh.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            Object.assign(obj.userData, {
                propId: pdef.id,
                solid: true
            });
        }
    });

    // Add prop to SceneLoader (tracks props + adds mesh to scene)
    this.addProp(propInstance);

    console.log(`Prefab prop loaded: ${pdef.id}`, propInstance.mesh.position);

    continue;
}

  // =============================
  // GLB PROP
  // =============================
  if (pdef.type === "glb" && pdef.file) {
    const loader = new GLTFLoader();

    loader.load(pdef.file, (gltf) => {
      const model = gltf.scene;

      model.position.set(
        pdef.position?.x ?? 0,
        pdef.position?.y ?? 0,
        pdef.position?.z ?? 0
      );

      if (pdef.scale) {
        model.scale.set(pdef.scale.x, pdef.scale.y, pdef.scale.z);
      }

      if (pdef.rotation) {
        model.rotation.set(
          pdef.rotation.x,
          pdef.rotation.y,
          pdef.rotation.z
        );
      }

      model.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.userData = {
            propId: pdef.id,
            solid: true
          };
        }
      });

      this.addProp({
        id: pdef.id,
        mesh: model,
        takeDamage: () => false
      });
    });

    continue;
  }

  // =============================
  // DOOR PROP
  // =============================
  if (pdef.type === "door") {
    const width  = pdef.size?.x ?? 1.2;
    const height = pdef.size?.y ?? 2.2;
    const depth  = pdef.size?.z ?? 0.15;

    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      roughness: 0.6,
      metalness: 0.1
    });

    const door = new THREE.Mesh(geo, mat);

    door.position.set(
      pdef.position.x + width / 2,
      pdef.position.y + height / 2,
      pdef.position.z
    );

    if (pdef.rotationY !== undefined) {
      door.rotation.y = THREE.MathUtils.degToRad(pdef.rotationY);
    }

    door.castShadow = true;
    door.receiveShadow = true;
    door.userData = {
      propId: pdef.id,
      type: "door",
      solid: true
    };

    this.scene.add(door);

    this.addProp({
      id: pdef.id,
      mesh: door,
      size: { x: width, y: height, z: depth },
      takeDamage: () => false
    });

    const transitions = this.sceneDef.transitionObjects;
    if (Array.isArray(transitions)) {
      const t = transitions.find(t => t.id === pdef.id);
      if (t) t.object3D = door;
    }

    continue;
  }

  // =============================
  // DEFAULT PROP (PropClass)
  // =============================
  const p = new PropClass({
    ...pdef,
    id: pdef.id,
    coverType: pdef.coverType ?? "none",
    materialParams: pdef.materialParams ?? {}
  });

  p.mesh.traverse(obj => {
    if (obj.isMesh) {
      obj.userData = {
        propId: pdef.id,
        coverType: pdef.coverType ?? "none",
        solid: true
      };
    }
  });

  this.addProp(p);
}

// Enemies
    const enemyDefs = sceneDef.enemies ?? [];
    enemyDefs.forEach((edef) => {
      if (!edef.type) return;
      const def = ENEMY_DEFS[edef.type];
      // Diagnostic: log enemy entries and whether a type definition exists
      try {
        console.log(`SceneLoader: enemy entry id='${edef.id}' type='${edef.type}' defFound=${!!def} modelUrl='${def && def.modelUrl ? def.modelUrl : "(none)"}'`);
      } catch (e) { /* ignore logging errors */ }
      if (!def) { console.warn(`SceneLoader: unknown enemy type '${edef.type}' for id='${edef.id}'`); return; }

      const e = new Enemy(this.scene, def, edef, this.player, () => {});
      e.lastHitFrame = -1;

  // Hook automatic objective check on death
  e.onDeath = (id) => {
    this._checkObjectiveAfterHit();
  };
      // register via helper
      this.addEnemy(e);
    });

    // Construct room around enemies/props
    //this._calculateRoomBounds();
    //this._createRoom();
if (sceneDef.room) {
  this._useDefinedRoom(sceneDef.room);
} else {
  this._calculateRoomBounds();
}

this._createRoom();


    // Lights must be created AFTER room and AFTER sceneDef exists
    this._createLights();
// After room + lights are ready
this._applyCameraSettings();

    // Enemy firing callback
    const fireCallback = (origin, target, speed = 28) => {
      this.spawnProjectile(
        new THREE.Vector3(origin.x, origin.y, origin.z),
        new THREE.Vector3(target.x, target.y, target.z),
        speed
      );
    };

    // assign callbacks to enemies we created
    enemyDefs.forEach((edef) => {
      const e = this.enemiesById[edef.id];
      if (e) e.fireCallback = fireCallback;
    });

    this.objective = sceneDef.objective ?? null;

    //this._notifyLoaded();
  }

  // -----------------------------
  // Calculate Room Bounds (adjusted to arrays)
  // -----------------------------
  _calculateRoomBounds() {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Props: iterate array
    this.props.forEach(p => {
      const sx = p.size.x / 2;
      const sy = p.size.y;
      const sz = p.size.z / 2;

      minX = Math.min(minX, p.position.x - sx);
      maxX = Math.max(maxX, p.position.x + sx);
      minY = Math.min(minY, p.position.y);
      maxY = Math.max(maxY, p.position.y + sy);
      minZ = Math.min(minZ, p.position.z - sz);
      maxZ = Math.max(maxZ, p.position.z + sz);
    });
this.staticObjects.forEach(o => {
  o.position = o.mesh.position;
});

    // Enemies: iterate array
    this.enemies.forEach(e => {
      const pos = e.mesh?.position ?? { x: 0, y: 0, z: 0 };
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + 1);
      minZ = Math.min(minZ, pos.z);
      maxZ = Math.max(maxZ, pos.z);
    });

    // Padding
    minX -= this.padding;
    maxX += this.padding;
    minY -= this.padding;
    maxY += this.padding;
    minZ -= this.padding;
    maxZ += this.padding;

    // Room size
    this.roomWidth = maxX - minX;
    this.roomHeight = maxY - minY;
    this.roomDepth = maxZ - minZ;

    // Room center offset
    this.roomCenterOffset = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );

// Shift props and enemies ONLY if room was auto-calculated
if (!this.sceneDef.room) {
  this.props.forEach(p => {
    p.mesh.position.sub(this.roomCenterOffset);
  });

  this.enemies.forEach(e => {
    if (e.mesh) e.mesh.position.sub(this.roomCenterOffset);
    if (e.basePosition) e.basePosition.sub(this.roomCenterOffset);
  });
}
  }

_useDefinedRoom(roomDef) {
  this.roomWidth  = roomDef.width;
  this.roomHeight = roomDef.height;
  this.roomDepth  = roomDef.depth;

  // Default center is origin
  this.roomCenterOffset = new THREE.Vector3(0, 0, 0);

  // Optional center override
  if (roomDef.center) {
    this.roomCenterOffset.set(
      roomDef.center.x ?? 0,
      roomDef.center.y ?? 0,
      roomDef.center.z ?? 0
    );
  }
}


  // -----------------------------
  // Create Room (unchanged)
  // -----------------------------
_createRoom() {
  const w = this.roomWidth;
  const h = this.roomHeight;
  const d = this.roomDepth;

  const thickness = 0.25; // collision thickness for all room surfaces

  const texLoader = new THREE.TextureLoader();
  const roomTex = this.sceneDef.roomTextures || {};

  // --- Materials ---
  const floorMat = roomTex.floor
    ? new THREE.MeshStandardMaterial({ map: texLoader.load(roomTex.floor) })
    : new THREE.MeshStandardMaterial({ color: 0x444444 });

  const ceilingMat = roomTex.ceiling
    ? new THREE.MeshStandardMaterial({ map: texLoader.load(roomTex.ceiling) })
    : new THREE.MeshStandardMaterial({ color: 0x666666 });

  const wallMat = roomTex.wall
    ? new THREE.MeshStandardMaterial({ map: texLoader.load(roomTex.wall) })
    : new THREE.MeshStandardMaterial({ color: 0x888888 });

  const backWallMat = roomTex.backWall
    ? new THREE.MeshStandardMaterial({ map: texLoader.load(roomTex.backWall) })
    : wallMat;

  // -----------------
  // Floor
  // -----------------
  const floorGeo = new THREE.BoxGeometry(w, thickness, d);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -thickness / 2, 0);
  floor.position.sub(this.roomCenterOffset);
  floor.receiveShadow = true;
  floor.castShadow = false;
  floor.userData = { type: "room", solid: true, 
    hitSounds: ["assets/sfx/ric1.ogg", "assets/sfx/ric2.ogg"]
  };
  this.scene.add(floor);
  this.roomMeshes.push(floor);

  // -----------------
  // Ceiling
  // -----------------
  const ceilingGeo = new THREE.BoxGeometry(w, thickness, d);
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.set(0, h + thickness / 2, 0);
  ceiling.position.sub(this.roomCenterOffset);
  ceiling.receiveShadow = true;
  ceiling.castShadow = false;
  ceiling.userData = { type: "room", solid: true, 
      hitSounds: ["assets/sfx/ric1.ogg", "assets/sfx/ric2.ogg"]

  };
  this.scene.add(ceiling);
  this.roomMeshes.push(ceiling);

  // -----------------
  // Back Wall
  // -----------------
  const backWallGeo = new THREE.BoxGeometry(w, h, thickness);
  const backWall = new THREE.Mesh(backWallGeo, backWallMat);
  backWall.position.set(0, h / 2, -d / 2 - thickness / 2);
  backWall.position.sub(this.roomCenterOffset);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  backWall.userData = { type: "room", solid: true,
    hitSounds: ["assets/sfx/ric1.ogg", "assets/sfx/ric2.ogg"]

  };
  this.scene.add(backWall);
  this.roomMeshes.push(backWall);

  // -----------------
  // Left Wall
  // -----------------
  const sideWallGeo = new THREE.BoxGeometry(thickness, h, d);
  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.position.set(-w / 2 - thickness / 2, h / 2, 0);
  leftWall.position.sub(this.roomCenterOffset);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  leftWall.userData = { type: "room", solid: true,
    hitSounds: ["assets/sfx/ric1.ogg", "assets/sfx/ric2.ogg"]

  };
  this.scene.add(leftWall);
  this.roomMeshes.push(leftWall);

  // -----------------
  // Right Wall
  // -----------------
  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.position.set(w / 2 + thickness / 2, h / 2, 0);
  rightWall.position.sub(this.roomCenterOffset);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  rightWall.userData = { type: "room", solid: true, 
      hitSounds: ["assets/sfx/ric1.ogg", "assets/sfx/ric2.ogg"]

  };
  this.scene.add(rightWall);
  this.roomMeshes.push(rightWall);

  // -----------------
  // Enable shadows on props and enemies
  // -----------------
  this.props.forEach(p => {
    if (p.mesh) {
      p.mesh.castShadow = true;
      p.mesh.receiveShadow = true;
    }
  });

  this.enemies.forEach(e => {
    if (e.mesh) {
      e.mesh.castShadow = true;
      e.mesh.receiveShadow = true;
    }
  });
}
  
  // -----------------------------
  // Projectiles (unchanged)
  // -----------------------------
  spawnProjectile(startPos, targetPos, opts = {}) {
    // opts may be a number (speed) for backward compatibility, or an object
    let speed = 1;
    let projectileType = "bullet";
    let lifetime = undefined;
    if (typeof opts === 'number') speed = opts;
    else {
      speed = opts.speed ?? 1;
      projectileType = opts.projectileType ?? "bullet";
      lifetime = opts.lifetime;
    }

    const id = "proj_" + (this.nextProjectileId++);
    const dir = new THREE.Vector3().subVectors(targetPos, startPos).normalize();

    const p = new Projectile({
      id,
      scene: this.scene,
      startPos: startPos.clone(),
      direction: dir,
      speed,
      lifetime,
      projectileType
    });

    this.projectiles[id] = p;
    return p;
  }

  // -----------------------------
  // Unload Scene (adjusted to arrays)
  // -----------------------------
  unloadScene() {
    // Clear room
    this.roomMeshes.forEach((m) => {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
    this.roomMeshes = [];

    // Clear lights
    this.sceneLights.forEach(light => this.scene.remove(light));
    this.sceneLights = [];

    // Projectiles
    Object.values(this.projectiles).forEach((p) => { try { p.dispose(); } catch {} });
    this.projectiles = {};
    this.projectileMeshes = [];

    // Enemies
    this.enemies.forEach((en) => { try { en.dispose(); } catch {} });
    this.enemies = [];
    this.enemiesById = {};
    this.enemyMeshes = [];

    // Props
    this.props.forEach((pr) => { try { pr.dispose(); } catch {} });
    this.props = [];
    this.propsById = {};
    this.propMeshes = [];
this.staticObjects = [];

    // Explosions
    this.explosions.forEach((ex) => { try { if (typeof ex.destroy === 'function') ex.destroy(); if (typeof ex.dispose === 'function') ex.dispose(); } catch {} });
    this.explosions = [];
  }

_createPrefabProp(pdef, prefab) {
  return {
    id: pdef.id,
    mesh: prefab,
    size: pdef.size ?? { x: 1, y: 1, z: 1 },
    position: pdef.position ?? { x: 0, y: 0, z: 0 },
    takeDamage: () => false,
    dispose() {
      prefab.traverse(obj => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          if (obj.material?.map) obj.material.map.dispose();
          obj.material?.dispose();
        }
      });
    }
  };
}


  // -----------------------------
  // Update (enemies, projectiles, explosions)
  // -----------------------------
  update(deltaMs, nowMs) {
    this.frameCount++;

Object.entries(this.projectiles).forEach(([id, proj]) => {
  proj.update(deltaMs);

const hit = proj.checkCollision(this.getIntersectableMeshes());
if (hit) {
  const hitObj = hit.object;
  const hitPoint = hit.point ?? proj.position;

  // Play a random impact sound if the object defines one
  const sounds = hitObj.userData?.hitSounds;
  if (Array.isArray(sounds) && sounds.length > 0) {
    const sound =
      sounds[Math.floor(Math.random() * sounds.length)];
    this.playImpactSound(sound, hitPoint);
  }

  // Apply damage to enemy or prop (room surfaces usually ignore damage)
  this.applyDamageToMesh(hitObj, proj.damage);

  proj.dispose();
  delete this.projectiles[id];
  return;
}
});
// SceneLoader.update(deltaMs)
    // Enemies (iterate array)
    this.enemies.forEach((en) => {
      try { en.update(deltaMs, nowMs, this.player); } catch (e) { console.warn("Enemy update error", e); }
    });

    
    // Explosions: call update on each; remove and cleanup when finished.
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      try {
        if (typeof ex.update === "function") {
          ex.update(deltaMs / 1000);
        }
        // Remove if the explosion exposes an isExpired/isDone function
        let expired = false;
        if (typeof ex.isExpired === "function") expired = ex.isExpired();
        else if (typeof ex.isDone === "boolean") expired = ex.isDone;
        else if (typeof ex.age === "number" && typeof ex.lifespan === "number") {
          if (ex.age >= ex.lifespan) expired = true;
        }

        if (expired) {
          if (typeof ex.destroy === "function") ex.destroy();
          if (typeof ex.dispose === "function") ex.dispose();
          // remove from scene if it has a mesh/points
          if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
          this.explosions.splice(i, 1);
        }
      } catch (e) {
        console.warn("Explosion update error", e);
        // best-effort remove if it throws repeatedly
        try {
          if (typeof ex.destroy === "function") ex.destroy();
          if (typeof ex.dispose === "function") ex.dispose();
          if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
        } catch (e2) {}
        this.explosions.splice(i, 1);
      }
    }
  }

playImpactSound(soundPath, position, volume = 0.7) {
  if (!soundPath) return;

  const audio = new Audio(soundPath);
  audio.volume = volume;
  audio.play().catch(() => {});

  // Optional: if you later switch to THREE.PositionalAudio,
  // this function becomes the single upgrade point.
}


  // -----------------------------
  // Damage Handling (adapted to arrays/maps)
  // -----------------------------
applyDamageToMesh(mesh, damage = 1) {
  if (!mesh) return false;

  let obj = mesh;

  // climb until we find something with enemyId, propId, or type=room
  while (obj && obj.userData &&
        !obj.userData.enemyId &&
        !obj.userData.propId &&
        obj.userData.type !== "room") {
    obj = obj.parent;
  }

  if (!obj || !obj.userData) return false;

  // Enemy
  if (obj.userData.enemyId) {
    const en = this.enemiesById[obj.userData.enemyId];
    if (!en) return false;
    if (en.lastHitFrame === this.frameCount) return true;
    en.lastHitFrame = this.frameCount;
    en.takeDamage(damage);
    this._checkObjectiveAfterHit();
    return true;
  }

  // Prop
  if (obj.userData.propId) {
    const pr = this.propsById[obj.userData.propId];
    if (pr) {
      const died = pr.takeDamage(damage);
      if (died) {
        const idx = this.props.indexOf(pr);
        if (idx >= 0) this.props.splice(idx, 1);
        delete this.propsById[obj.userData.propId];
        const pmIdx = this.propMeshes.findIndex(m => m.userData && m.userData.propId === obj.userData.propId);
        if (pmIdx >= 0) this.propMeshes.splice(pmIdx, 1);
      }
    }
    return true;
  }

  // Room surfaces
  if (obj.userData.type === "room") {
    const sounds = obj.userData.hitSounds;
    if (Array.isArray(sounds) && sounds.length > 0) {
      const sound = sounds[Math.floor(Math.random() * sounds.length)];
      this.playImpactSound(sound, mesh.position);
    }
    return true;
  }

  return false;
}

  // -----------------------------
  // Objective Check
  // -----------------------------
  _checkObjectiveAfterHit() {
    if (!this.objective) return;

    if (this.objective.type === "eliminateAllEnemies") {
        const remaining = this.enemies.filter(e => !e._isDead);
        console.log("Enemies still alive:", remaining.length);

        if (remaining.length === 0) {
            console.log("All enemies defeated!");

            // Optional: remove dead enemies from array now
            this.enemies = [];
            this.enemiesById = {};
            this.enemyMeshes = [];

            if (typeof window.onSceneComplete === "function") {
                window.onSceneComplete(this.sceneDef);
            } else {
                window.dispatchEvent(new CustomEvent("sceneComplete", {
                    detail: { scene: this.sceneDef }
                }));
            }
        }
    }
}

// -----------------------------
  // Raycasting Mesh List
  // -----------------------------
getIntersectableMeshes() {
  return [
    ...this.enemyMeshes,
    ...this.propMeshes,
    ...this.roomMeshes
  ];
}

  // -----------------------------
  // -----------------------------
  _notifyLoaded() {
    if (typeof window.onSceneLoaded === "function") {
      window.onSceneLoaded(this.sceneDef);
    }
  }

  // -----------------------------
  // Scene / resource cleanup helper
  // -----------------------------
  clearScene() {
    // Remove props
    for (const p of this.props) {
      if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
      try { p.dispose?.(); } catch {}
    }
    this.props.length = 0;
    this.propsById = {};
    this.propMeshes = [];
this.staticObjects = [];

    // Remove enemies
    for (const e of this.enemies) {
      if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
      try { e.dispose?.(); } catch {}
    }
    this.enemies.length = 0;
    this.enemiesById = {};
    this.enemyMeshes = [];

    // Explosions
    for (const ex of this.explosions) {
      try {
        if (typeof ex.destroy === "function") ex.destroy();
        if (typeof ex.dispose === "function") ex.dispose();
      } catch {}
      if (ex.mesh && ex.mesh.parent) ex.mesh.parent.remove(ex.mesh);
    }
    this.explosions.length = 0;
  }
}

window.spawnTestExplosion = function({
  x = 0,
  y = 1,
  z = 0,
  blastRadius = 4,
  maxDamage = 10,
  explosionSounds = []  // array of audio file paths
} = {}) {
  if (!window.sceneLoader) {
    console.warn("sceneLoader not found!");
    return;
  }

  const pos = new THREE.Vector3(x, y, z);

  const explosion = new Explosion(
    window.sceneLoader.scene,
    pos,
    {
      blastRadius,
      maxDamage,
      explosionSounds,
      floorY: y - 0.1  // catwalk-safe
    }
  );

  window.sceneLoader.addExplosion(explosion);

  console.log(`Spawned explosion at (${x}, ${y}, ${z}), radius ${blastRadius}, damage ${maxDamage}`);
};
