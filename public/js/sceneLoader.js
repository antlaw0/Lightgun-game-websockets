import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { buildPrefab } from "./prefabLibrary.js";
import { ENEMY_INSTANCES } from "./enemy.js";
window.ENEMY_INSTANCES = ENEMY_INSTANCES;

import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';

import { Explosion } from './explosion.js';

import { Enemy } from "./enemy.js";
import { Prop as PropClass } from "./prop.js";
import { ENEMY_DEFS } from "./listOfEnemies.js";
import { PROP_DEFS } from "./listOfprops.js";
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
    
    // No room-based centering; all objects use absolute world positions
    this.roomCenterOffset = new THREE.Vector3(0, 0, 0);

    this.sceneLights = [];
    // audio helpers
    this._audioLoader = new THREE.AudioLoader();
    this._audioBufferCache = {};
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
      if (!obj.isMesh) return;
      try {
        // Shadow setup
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Only register mesh parts for hit-tests if the enemy is active.
        if (enemyInstance._isActive) {
          if (!this.enemyMeshes.includes(obj)) this.enemyMeshes.push(obj);
        }
        // Tag mesh with enemy id for lookup later (always present even if inactive)
        obj.userData = Object.assign({}, obj.userData || {}, { enemyId: enemyInstance.id });
        obj.frustumCulled = false;
      } catch (e) {}
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

      case "hemisphere":
        light = new THREE.HemisphereLight(
          def.skyColor ?? def.color ?? 0xffffff,
          def.groundColor ?? 0x444444,
          def.intensity ?? 1
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

    // Helper: convert edge-based (min-corner) position -> center-based position
    function _ensureCenterPosition(def) {
      if (!def || !def.position) return;
      // avoid double conversion
      if (def._convertedToCenter) return;

      const sx = Number(def.size?.x ?? 1);
      const sz = Number(def.size?.z ?? 1);

      const cx = (def.position.x ?? 0) + sx / 2;
      const cz = (def.position.z ?? 0) + sz / 2;
      const by = def.position.y ?? 0; // keep y as base (bottom)

      def.position = { x: cx, y: by, z: cz };
      def._convertedToCenter = true;
    }

    for (let idx = 0; idx < staticObjects.length; idx++) {
      let pdef = staticObjects[idx];

      // Convert edge-based authored maps into center-based positions/sizes
      // (map export uses min-corner grid coordinates; Three.js expects centered geometry positions)
      if (pdef && pdef.position && pdef.size) {
        _ensureCenterPosition(pdef);
      }
  
  // Apply base definition if present
  if (pdef.def && PROP_DEFS[pdef.def]) {
    pdef = { ...PROP_DEFS[pdef.def], ...pdef };
  }

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
    // preserve original scene definition on the runtime instance
    try { propInstance._sceneDef = pdef; } catch(e){}
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
          obj.userData = Object.assign({}, obj.userData || {}, {
            propId: pdef.id,
            solid: true
          });
        }
      });

      // Create a small prop wrapper that respects hp/indestructible
      const hpVal = (typeof pdef.hp === 'number') ? pdef.hp : (pdef.hp ? Number(pdef.hp) : 1);
      const ind = !!pdef.indestructible;
      const hitSounds = Array.isArray(pdef.hitSounds) ? pdef.hitSounds.map(path => { const a = new Audio(path); a.load(); return a; }) : [];
      const deathSounds = Array.isArray(pdef.deathSounds) ? pdef.deathSounds.map(path => { const a = new Audio(path); a.load(); return a; }) : [];

      const propWrapper = {
        id: pdef.id,
        mesh: model,
        position: pdef.position ?? { x: 0, y: 0, z: 0 },
        size: pdef.size ?? { x: 1, y: 1, z: 1 },
        hp: hpVal,
        maxHp: hpVal,
        indestructible: ind,
        hitSounds,
        deathSounds,
        explosion: pdef.explosion ?? null,
        takeDamage(amount) {
          try { if (this.hitSounds && this.hitSounds.length) { const s = this.hitSounds[Math.floor(Math.random()*this.hitSounds.length)]; s.currentTime = 0; s.play().catch(()=>{}); } } catch(e){}
          if (this.indestructible) return false;
          this.hp -= amount;
          if (this.hp <= 0) {
            // die
            try { if (this.deathSounds && this.deathSounds.length) { const s = this.deathSounds[Math.floor(Math.random()*this.deathSounds.length)]; s.currentTime = 0; s.play().catch(()=>{}); } } catch(e){}
            // spawn explosion if defined
            if (this.explosion && window.spawnTestExplosion) {
              const worldPos = new THREE.Vector3();
              this.mesh.getWorldPosition(worldPos);
              window.spawnTestExplosion({ x: worldPos.x, y: worldPos.y, z: worldPos.z, blastRadius: this.explosion.blastRadius, maxDamage: this.explosion.maxDamage, explosionSounds: this.explosion.explosionSounds });
            }
            // remove mesh from scene
            if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
            return true;
          }
          return false;
        },
        dispose() {
          try { if (this.mesh) { this.mesh.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); o.material?.dispose(); } }); } } catch(e){}
        }
      };

      // attach raw definition so the editor can preserve arbitrary keys
      try { propWrapper._sceneDef = pdef; } catch(e){}
      this.addProp(propWrapper);
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

    // pdef.position is converted above to center-x/center-z and base-y
    door.position.set(
      pdef.position.x ?? 0,
      (pdef.position.y ?? 0) + height / 2,
      pdef.position.z ?? 0
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

    // Doors may optionally be destructible via pdef.hp / pdef.indestructible
    const doorHp = (typeof pdef.hp === 'number') ? pdef.hp : (pdef.hp ? Number(pdef.hp) : 1);
    const doorInd = !!pdef.indestructible;
    const doorWrapper = {
      id: pdef.id,
      mesh: door,
      size: { x: width, y: height, z: depth },
      hp: doorHp,
      maxHp: doorHp,
      indestructible: doorInd,
      hitSounds: pdef.hitSounds ?? [],
      deathSounds: pdef.deathSounds ?? [],
      takeDamage(amount) {
        try { if (this.hitSounds && this.hitSounds.length) { const s = this.hitSounds[Math.floor(Math.random()*this.hitSounds.length)]; const a = new Audio(s); a.play().catch(()=>{}); } } catch(e){}
        if (this.indestructible) return false;
        this.hp -= amount;
        if (this.hp <= 0) {
          if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
          return true;
        }
        return false;
      },
      dispose() {
        try { if (this.mesh) { this.mesh.geometry?.dispose(); if (this.mesh.material?.map) this.mesh.material.map.dispose(); this.mesh.material?.dispose(); } } catch(e){}
      }
    };

    try { doorWrapper._sceneDef = pdef; } catch(e){}
    this.addProp(doorWrapper);

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

  try { p._sceneDef = pdef; } catch(e){}
  this.addProp(p);
}

// Enemies
    const enemyDefs = sceneDef.enemies ?? [];
    enemyDefs.forEach((edef) => {
      // Resolve base definition
      let def = null;
      if (edef.def && ENEMY_DEFS[edef.def]) {
        def = ENEMY_DEFS[edef.def];
      } else if (edef.type && ENEMY_DEFS[edef.type]) {
        def = ENEMY_DEFS[edef.type];
      }

      // Diagnostic: log enemy entries and whether a type definition exists
      try {
        console.log(`SceneLoader: enemy entry id='${edef.id}' type='${edef.type}' def='${edef.def}' defFound=${!!def} modelUrl='${def && def.modelUrl ? def.modelUrl : "(none)"}'`);
      } catch (e) { /* ignore logging errors */ }
      if (!def) { console.warn(`SceneLoader: unknown enemy type/def '${edef.type || edef.def}' for id='${edef.id}'`); return; }

      // Convert enemy instance edge-based positions to center-based (if present)
      if (edef && edef.position) {
        const sx = Number(edef.size?.x ?? def?.size?.x ?? 1);
        const sz = Number(edef.size?.z ?? def?.size?.z ?? 1);
        edef.position = {
          x: (edef.position.x ?? 0) + sx / 2,
          y: edef.position.y ?? 0,
          z: (edef.position.z ?? 0) + sz / 2
        };
        edef._convertedToCenter = true;
      }

      const e = new Enemy(this.scene, def, edef, this.player, () => {});
      e.lastHitFrame = -1;

  // Hook automatic objective check on death
  e.onDeath = (id) => {
    this._checkObjectiveAfterHit();
  };
      // register via helper
      this.addEnemy(e);
    });

        // Use absolute world positions - no room centering or bounds calculation needed
        // Scene author defines exact positions. If they want walls/floor, add them as staticObjects.

        // Lights created after props/enemies loaded
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

    this._notifyLoaded();
  }

  // Legacy room methods removed - scenes now use absolute world positions
  // No longer needed: room centering, bounds calculation, or implicit room generation
  // Scene author defines exact positions; room-like objects should be staticObjects


  // Room creation removed - define walls/floor/ceiling as staticObjects in scene instead.
  // This provides full control and simplifies scene authoring without implicit room generation.
  
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

    // Props — remove meshes from scene and dispose
    this.props.forEach((pr) => {
      try { if (pr.mesh && pr.mesh.parent) pr.mesh.parent.remove(pr.mesh); } catch (e) {}
      try { if (typeof pr.dispose === 'function') pr.dispose(); } catch (e) {}
    });
    this.props = [];
    this.propsById = {};
    this.propMeshes = [];
    this.staticObjects = [];

    // Explosions
    this.explosions.forEach((ex) => { try { if (typeof ex.destroy === 'function') ex.destroy(); if (typeof ex.dispose === 'function') ex.dispose(); } catch {} });
    this.explosions = [];
  }

_createPrefabProp(pdef, prefab) {
  const hpVal = (typeof pdef.hp === 'number') ? pdef.hp : (pdef.hp ? Number(pdef.hp) : 1);
  const ind = !!pdef.indestructible;
  const hitSounds = Array.isArray(pdef.hitSounds) ? pdef.hitSounds.map(path => { const a = new Audio(path); a.load(); return a; }) : [];
  const deathSounds = Array.isArray(pdef.deathSounds) ? pdef.deathSounds.map(path => { const a = new Audio(path); a.load(); return a; }) : [];

  return {
    id: pdef.id,
    mesh: prefab,
    size: pdef.size ?? { x: 1, y: 1, z: 1 },
    position: pdef.position ?? { x: 0, y: 0, z: 0 },
    hp: hpVal,
    maxHp: hpVal,
    indestructible: ind,
    hitSounds,
    deathSounds,
    takeDamage(amount) {
      try { if (this.hitSounds && this.hitSounds.length) { const s = this.hitSounds[Math.floor(Math.random()*this.hitSounds.length)]; s.currentTime = 0; s.play().catch(()=>{}); } } catch(e){}
      if (this.indestructible) return false;
      this.hp -= amount;
      if (this.hp <= 0) {
        try { if (this.deathSounds && this.deathSounds.length) { const s = this.deathSounds[Math.floor(Math.random()*this.deathSounds.length)]; s.currentTime = 0; s.play().catch(()=>{}); } } catch(e){}
        if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
        return true;
      }
      return false;
    },
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

  // Play bullet ricochet as positional audio only for room surfaces.
  // Do NOT play ricochet when hitting props or enemies (handled elsewhere).
  if (proj.projectileType === "bullet") {
    // climb to find a parent that identifies as room/prop/enemy
    let obj = hitObj;
    while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId && obj.userData.type !== "room") {
      obj = obj.parent;
    }
    if (obj && obj.userData && obj.userData.type === "room") {
      const paths = [
        "assets/sfx/ric1.ogg",
        "assets/sfx/ric2.ogg",
        "assets/sfx/ric3.ogg",
        "assets/sfx/ric4.ogg",
        "assets/sfx/ric5.ogg"
      ];
      this.playPositionalImpactSound(paths, hitPoint, 0.9, 6);
    }
  } else {
    // Non-bullet projectiles: keep existing mesh-defined hit sound behavior
    const sounds = hitObj.userData?.hitSounds;
    if (Array.isArray(sounds) && sounds.length > 0) {
      const sound = sounds[Math.floor(Math.random() * sounds.length)];
      this.playImpactSound(sound, hitPoint);
    }
  }

  // Apply damage to enemy or prop (room surfaces usually ignore damage)
  this.applyDamageToMesh(hitObj, proj.damage, { suppressRoomSound: proj.projectileType === "bullet" });

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


// Find an AudioListener attached to the camera (or fallback to window.audioListener)
_getAudioListener() {
  try {
    if (this.camera && this.camera.children && this.camera.children.length) {
      for (const c of this.camera.children) {
        if (!c) continue;
        if (c.isAudioListener || c.type === 'AudioListener') return c;
      }
    }
  } catch (e) {}
  if (window.audioListener) return window.audioListener;
  return null;
}

// Play a positional impact sound at the given world `position` (THREE.Vector3).
// Falls back to non-positional Audio if no AudioListener / WebAudio is available.
playPositionalImpactSound(soundPathOrArray, position, volume = 0.8, refDistance = 6) {
  if (!soundPathOrArray || !position) return;

  // Allow passing an array of candidate paths; pick one randomly here so
  // callers can simply provide multiple options and we ensure a single
  // randomly chosen positional sound plays at the impact point.
  let soundPath = soundPathOrArray;
  if (Array.isArray(soundPathOrArray) && soundPathOrArray.length) {
    soundPath = soundPathOrArray[Math.floor(Math.random() * soundPathOrArray.length)];
  }

  const listener = this._getAudioListener();
  if (!listener) {
    // fallback to non-positional playback
    this.playImpactSound(soundPath, position, volume);
    return;
  }

  const loader = this._audioLoader;
  const cache = this._audioBufferCache;
  const scene = this.scene;

  const playBuffer = (buffer) => {
    try {
      const sound = new THREE.PositionalAudio(listener);
      sound.setBuffer(buffer);
      sound.setRefDistance(refDistance);
      sound.setVolume(volume);

      const holder = new THREE.Object3D();
      holder.position.copy(position);
      holder.add(sound);
      scene.add(holder);

      // cleanup when ended (and guard with timeout in case onEnded isn't reliable)
      sound.onEnded = () => { try { scene.remove(holder); } catch (e) {} };
      try { sound.play(); } catch (e) { console.warn('Positional play failed', e); }

      const maxMs = Math.max(4000, Math.round((buffer.duration || 1) * 1000) + 2000);
      setTimeout(() => { try { if (scene && holder && holder.parent) scene.remove(holder); } catch (e) {} }, maxMs);
    } catch (e) {
      console.warn('playBuffer failed', e);
    }
  };

  if (cache[soundPath]) {
    playBuffer(cache[soundPath]);
    return;
  }

  loader.load(soundPath,
    (buffer) => {
      cache[soundPath] = buffer;
      playBuffer(buffer);
    },
    undefined,
    (err) => {
      console.warn('Positional audio load failed', soundPath, err);
      this.playImpactSound(soundPath, position, volume);
    }
  );
}


  // -----------------------------
  // Damage Handling (adapted to arrays/maps)
  // -----------------------------
applyDamageToMesh(mesh, damage = 1, opts = {}) {
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
    // Allow caller to suppress the default (non-positional) room hit sound
    if (!(opts && opts.suppressRoomSound)) {
      const sounds = obj.userData.hitSounds;
      if (Array.isArray(sounds) && sounds.length > 0) {
        const sound = sounds[Math.floor(Math.random() * sounds.length)];
        this.playImpactSound(sound, mesh.position);
      }
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
      // Treat enemies that are dying as effectively removed for objective checks.
      const remaining = this.enemies.filter(e => !(e._isDead || e._isDying));
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
    window.dispatchEvent(new CustomEvent("sceneLoaded", {
      detail: { scene: this.sceneDef }
    }));
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
