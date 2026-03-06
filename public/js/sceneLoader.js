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

/**
 * Door class - handles door opening/closing with animation
 * Properties:
 *   - openDirection: 1 (right hinge) or -1 (left hinge)
 *   - openInOut: 1 (opens away from camera) or -1 (opens toward camera)
 *   - openDuration: milliseconds to open 90 degrees
 *   - openSound: path to sound file in public/assets/sfx/props/
 */
export class Door {
  constructor(def) {
    this.id = def.id || 'door_' + Math.random();
    this.mesh = def.mesh; // THREE.Group with hinge at origin
    this.hinge = this.mesh; // same as mesh - the rotating group
    this.position = def.position || { x: 0, y: 0, z: 0 };
    this.size = def.size || { x: 1, y: 2, z: 0.15 };
    this.hp = 9999;
    this.maxHp = 9999;
    this.indestructible = true;
    
    // Door-specific properties
    this.openDirection = def.openDirection || 1; // 1=right, -1=left
    this.openInOut = def.openInOut || 1; // 1=outward, -1=inward
    this.openDuration = def.openDuration || 800; // milliseconds
    this.openSound = def.openSound || null;
    
    // Door state
    this.isOpen = false;
    this.isAnimating = false;
    this.currentRotation = 0; // in radians, 0 to PI/2
    this.openedRotation = 0; // stores the final rotation when door is open
    this.doorMesh = def.doorMesh; // the loaded GLB geometry
    this.openAngle = Math.PI / 2; // Always swing doors by 90 degrees
    // Keep a stable closed yaw so animation works for any scene rotation.
    this.closedRotationY = this.hinge?.rotation?.y ?? 0;
    // Keep closed/open poses as quaternions so rotation is robust for any orientation.
    this.closedQuaternion = this.hinge?.quaternion?.clone() ?? new THREE.Quaternion();
    this.openQuaternion = this.closedQuaternion.clone();
    
    // Audio
    if (this.openSound) {
      try {
        this.audioElement = new Audio(this.openSound);
        this.audioElement.volume = 0.7;
      } catch (e) {
        console.warn('Failed to preload door sound:', this.openSound, e);
        this.audioElement = null;
      }
    }
  }
  
  /**
   * Open the door with animation
   * @param {Function} onComplete - callback when animation finishes
   */
  openDoor(onComplete) {
    if (this.isAnimating || this.isOpen) {
      if (onComplete) onComplete();
      return;
    }
    
    this.isAnimating = true;
    const startTime = Date.now();
    const directionSign = (this.openInOut * this.openDirection) >= 0 ? 1 : -1;
    const targetRotation = this.openAngle; // 90 degrees
    const signedTarget = targetRotation * directionSign;

    this.closedRotationY = this.hinge?.rotation?.y ?? this.closedRotationY;
    this.closedQuaternion.copy(this.hinge?.quaternion ?? this.closedQuaternion);
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), signedTarget);
    this.openQuaternion.copy(this.closedQuaternion).multiply(deltaQuat);
    
    // Calculate final rotation based on door properties
    this.openedRotation = this.closedRotationY + signedTarget;
    
    console.log(`[Door ${this.id}] Opening: targetRotation=${targetRotation}, openInOut=${this.openInOut}, openDirection=${this.openDirection}, will rotate to ${this.openedRotation}`);
    
    // Play door sound
    if (this.audioElement) {
      try {
        this.audioElement.currentTime = 0;
        this.audioElement.play().catch(e => console.warn('Door sound play failed:', e));
      } catch (e) {
        console.warn('Door sound play error:', e);
      }
    }
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.openDuration, 1);
      
      // Slerp local hinge orientation so doors open consistently regardless of scene orientation.
      this.hinge.quaternion.slerpQuaternions(this.closedQuaternion, this.openQuaternion, progress);
      this.currentRotation = signedTarget * progress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.isOpen = true;
        // Use the pre-calculated final rotation
        this.currentRotation = signedTarget;
        this.hinge.quaternion.copy(this.openQuaternion);
        console.log(`[Door ${this.id}] Opened. currentRotation=${this.currentRotation}, hinge.rotation.y=${this.hinge.rotation.y}`);
        if (onComplete) onComplete();
      }
    };
    
    animate();
  }
  
  /**
   * Close the door with animation
   * @param {Function} onComplete - callback when animation finishes
   */
  closeDoor(onComplete) {
    if (this.isAnimating || !this.isOpen) {
      if (onComplete) onComplete();
      return;
    }
    
    this.isAnimating = true;
    const startTime = Date.now();
    const directionSign = (this.openInOut * this.openDirection) >= 0 ? 1 : -1;
    const signedTarget = this.openAngle * directionSign;
    
    // Store the starting rotation and explicitly set it to ensure no jump
    const closedY = this.closedRotationY;
    const startQuaternion = this.hinge.quaternion.clone();
    this.openQuaternion.copy(startQuaternion);
    
    console.log(`[Door ${this.id}] Closing from rotation ${this.hinge.rotation.y} to ${closedY}.`);
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.openDuration, 1);
      
      this.hinge.quaternion.slerpQuaternions(startQuaternion, this.closedQuaternion, progress);
      this.currentRotation = signedTarget * (1 - progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.isOpen = false;
        this.currentRotation = 0;
        this.openedRotation = closedY;
        this.hinge.quaternion.copy(this.closedQuaternion);
        console.log(`[Door ${this.id}] Closed. currentRotation=${this.currentRotation}, hinge.rotation.y=${this.hinge.rotation.y}`);
        if (onComplete) onComplete();
      }
    };
    
    animate();
  }
  
  /**
   * Instantly toggle door state
   */
  toggleDoor() {
    if (this.isOpen) {
      this.closeDoor();
    } else {
      this.openDoor();
    }
  }
  
  /**
   * Get the center position of the door in world space
   */
  getDoorCenterPosition() {
    const worldPos = new THREE.Vector3();
    if (this.doorMesh) {
      try {
        const bounds = new THREE.Box3().setFromObject(this.doorMesh);
        if (!bounds.isEmpty()) {
          bounds.getCenter(worldPos);
          return worldPos;
        }
      } catch (e) {}
    }
    if (this.hinge) {
      this.hinge.getWorldPosition(worldPos);
    }
    return worldPos;
  }
  
  /**
   * Check if player is within proximity (in units)
   */
  isPlayerNear(playerPos, proximityDistance = 3) {
    const doorCenter = this.getDoorCenterPosition();
    const distance = playerPos.distanceTo(doorCenter);
    return distance <= proximityDistance;
  }
  
  // Compatibility with prop system
  takeDamage(amount) {
    return false; // doors are indestructible
  }
  
  dispose() {
    try {
      if (this.hinge) {
        this.hinge.traverse(o => {
          if (o.isMesh) {
            o.geometry?.dispose();
            o.material?.dispose();
          }
        });
      }
    } catch (e) {}
  }
}

// Make Door class globally accessible
window.Door = Door;

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
    
    // --- Pending Scene Data (for preloading) ---
    this.pendingSceneDef = null;
    this.pendingProps = [];
    this.pendingPropsById = {};
    this.pendingEnemies = [];
    this.pendingEnemiesById = {};
    this.pendingSceneLights = [];
    this.pendingStaticObjects = [];

    // audio helpers
    this._audioLoader = new THREE.AudioLoader();
    this._audioBufferCache = {};
  }

  // -------------------------
  // Registration helpers
  // -------------------------
  addProp(propInstance, isPending = false) {
    if (!propInstance || !propInstance.mesh) return;

    // Ensure editor/raycast lookup can always resolve a wrapper from any hit mesh.
    const propId = propInstance.id || propInstance.mesh?.userData?.propId;
    const propType = propInstance.type || propInstance.mesh?.userData?.type || (propInstance.mesh?.userData?.isDoor ? 'door' : undefined);
    try {
      propInstance.mesh.userData = Object.assign({}, propInstance.mesh.userData || {}, {
        ...(propId ? { propId } : {}),
        ...(propType ? { type: propType } : {})
      });
    } catch (e) {}
    
    if (isPending) {
        this.pendingProps.push(propInstance);
        if (propInstance.id) this.pendingPropsById[propInstance.id] = propInstance;
        this.scene.add(propInstance.mesh);
        // Ensure hidden initially
        propInstance.mesh.visible = false;
        propInstance.mesh.traverse(obj => { if (obj.isMesh) obj.visible = false; });
    } else {
        // push into array and map
        this.props.push(propInstance);
        if (propInstance.id) this.propsById[propInstance.id] = propInstance;

        // scene + mesh tracking
        this.scene.add(propInstance.mesh);
        propInstance.mesh.traverse(obj => {
          if (obj.isMesh) {
            // Keep mesh identity tags in sync for editor selection and scene export.
            try {
              obj.userData = Object.assign({}, obj.userData || {}, {
                ...(propId ? { propId } : {}),
                ...(propType ? { type: propType } : {})
              });
            } catch (e) {}
            if (!this.propMeshes.includes(obj)) this.propMeshes.push(obj);
          }
        });
    }
  }

  addEnemy(enemyInstance, isPending = false) {
    if (!enemyInstance || !enemyInstance.mesh) return;
    
    if (isPending) {
        this.pendingEnemies.push(enemyInstance);
        if (enemyInstance.id) this.pendingEnemiesById[enemyInstance.id] = enemyInstance;
        this.scene.add(enemyInstance.mesh);
        // Ensure hidden and inactive
        enemyInstance.setActive(false);
        enemyInstance.mesh.visible = false;
    } else {
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
  _createLights(sceneDef, isPending = false) {
      const targetArray = isPending ? this.pendingSceneLights : this.sceneLights;
      
      // If not pending, clear existing lights first
      if (!isPending) {
          this.sceneLights.forEach(l => this.scene.remove(l));
          this.sceneLights = [];
      }

  const defs = sceneDef?.lights;
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

        case "rectArea":
        light = new THREE.RectAreaLight(
          def.color ?? 0xffffff,
          def.intensity ?? 1,
          def.width ?? (def.size?.x ?? 10),
          def.height ?? (def.size?.y ?? 10)
        );
        if (def.lookAt) {
          light.lookAt(def.lookAt.x, def.lookAt.y, def.lookAt.z);
        }
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
    if (isPending) light.visible = false;

    if (def.id) {
      light.userData.id = def.id;
    }

    targetArray.push(light);
  });

}


  // -----------------------------
  // Load Scene (adjusted)
  // -----------------------------
  loadScene(sceneDef) {
    this.unloadScene();
    this._loadSceneData(sceneDef, false);
    this._applyCameraSettings(sceneDef);
    this._notifyLoaded();
  }

  preloadScene(sceneDef) {
      console.log(`SceneLoader preloading scene: ${sceneDef.name}`);
      // Clear any previous pending data
      this._clearPending();
      this.pendingSceneDef = sceneDef;
      this._loadSceneData(sceneDef, true);
  }

  hasPendingScene() {
      return !!this.pendingSceneDef;
  }

  commitPendingScene() {
      if (!this.pendingSceneDef) return;
      
      console.log(`SceneLoader committing pending scene: ${this.pendingSceneDef.name}`);
      
      // 1. Unload current scene (removes current props/enemies/lights from scene)
      this.unloadScene();
      
      // 2. Promote pending data to current
      this.sceneDef = this.pendingSceneDef;
      this.props = this.pendingProps;
      this.propsById = this.pendingPropsById;
      this.enemies = this.pendingEnemies;
      this.enemiesById = this.pendingEnemiesById;
      this.sceneLights = this.pendingSceneLights;
          this.staticObjects = this.pendingStaticObjects; 
      
      // 3. Make everything visible and active
      this.props.forEach(p => {
          if (p.mesh) {
              p.mesh.visible = true;
              p.mesh.traverse(o => { if (o.isMesh) { o.visible = true; this.propMeshes.push(o); } });
          }
      });
      
      this.enemies.forEach(e => {
          e.setActive(true); 
      });
      
      this.sceneLights.forEach(l => {
          l.visible = true;
      });
      
      // 4. Apply camera settings
      this._applyCameraSettings(this.sceneDef);
      
      // 5. Clear pending
      this.pendingSceneDef = null;
      this.pendingProps = [];
      this.pendingPropsById = {};
      this.pendingEnemies = [];
      this.pendingEnemiesById = {};
      this.pendingSceneLights = [];
      this.pendingStaticObjects = [];
      
      this._notifyLoaded();
  }

  _clearPending() {
      // Cleanup any pending objects if we preload again before committing
      this.pendingProps.forEach(p => {
          if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
          try { p.dispose?.(); } catch(e){}
      });
      this.pendingEnemies.forEach(e => {
          if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
          try { e.dispose?.(); } catch(e){}
      });
      this.pendingSceneLights.forEach(l => {
          if (l.parent) l.parent.remove(l);
      });
      
      this.pendingProps = [];
      this.pendingPropsById = {};
      this.pendingEnemies = [];
      this.pendingEnemiesById = {};
      this.pendingSceneLights = [];
      this.pendingStaticObjects = [];
      this.pendingSceneDef = null;
  }

  _loadSceneData(sceneDef, isPending) {
    if (!isPending) {
        this.sceneDef = sceneDef;
        console.log(`SceneLoader loading scene: ${sceneDef.name}`);
    }

    // Props (including full-cover walls)
    const staticObjects = sceneDef.environment?.staticObjects ?? [];
    
    // Track static objects for pending if needed, though mostly used for props list
    if (isPending) {
        // We don't have a separate pendingStaticObjects list logic in addProp, 
        // but we can store the raw defs if needed. 
        // For now, addProp handles the instances.
    }

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

    const _toRadiansIfNeeded = (value) => {
      const n = Number(value ?? 0);
      return Math.abs(n) > (Math.PI * 2 + 0.0001) ? THREE.MathUtils.degToRad(n) : n;
    };

    for (let idx = 0; idx < staticObjects.length; idx++) {
      let pdef = staticObjects[idx];

      // Convert edge-based authored maps into center-based positions/sizes
      // (map export uses min-corner grid coordinates; Three.js expects centered geometry positions)
      const isDoorDef = !!(pdef && pdef.type === 'door');
      if (pdef && pdef.position && pdef.size && !isDoorDef) {
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
        if (typeof pdef.scale === 'number') {
            const s = pdef.scale;
            propInstance.mesh.scale.set(s, s, s);
            // Update logical size for collision (clone to avoid mutating def)
            if (propInstance.size) {
                propInstance.size = { ...propInstance.size };
                propInstance.size.x *= s;
                propInstance.size.y *= s;
                propInstance.size.z *= s;
            }
        } else {
            const sx = pdef.scale.x ?? 1;
            const sy = pdef.scale.y ?? 1;
            const sz = pdef.scale.z ?? 1;
            propInstance.mesh.scale.set(sx, sy, sz);
            if (propInstance.size) {
                propInstance.size = { ...propInstance.size };
                propInstance.size.x *= sx;
                propInstance.size.y *= sy;
                propInstance.size.z *= sz;
            }
        }
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
    this.addProp(propInstance, isPending);

    console.log(`Prefab prop loaded: ${pdef.id}`, propInstance.mesh.position);

    continue;
}

  // =============================
  // DOOR PROP (GLB-based with animation)
  // =============================
  if (pdef.type === 'door') {
    const rx = pdef.rotation?.x ?? pdef.rotationX ?? 0;
    const ry = pdef.rotation?.y ?? pdef.rotationY ?? 0;
    const rz = pdef.rotation?.z ?? pdef.rotationZ ?? 0;
    const hinge = new THREE.Group();
    hinge.position.set(
        pdef.position.x ?? 0,
        pdef.position.y ?? 0,
        pdef.position.z ?? 0
    );
    hinge.rotation.set(
      _toRadiansIfNeeded(rx),
      _toRadiansIfNeeded(ry),
      _toRadiansIfNeeded(rz)
    );
    hinge.userData = Object.assign({}, hinge.userData || {}, {
      isDoor: true,
      propId: pdef.id,
      type: 'door'
    });

    // Create Door instance with properties
    const door = new Door({
        id: pdef.id,
        mesh: hinge,
        position: pdef.position,
        size: pdef.size,
        openDirection: pdef.openDirection ?? 1,
        openInOut: pdef.openInOut ?? 1,
        openDuration: pdef.openDuration ?? 800,
        openSound: pdef.openSound
    });

    const doorModelPath = pdef.model;
    if (!doorModelPath) {
      console.warn(`Door '${pdef.id}' is missing required 'model' path; skipping load.`);
      continue;
    }

    const loader = new GLTFLoader();
    loader.load(doorModelPath, (gltf) => {
        const doorMesh = gltf.scene;
        
        // Apply custom model rotation if specified in scene def (for correcting GLB orientation)
        if (pdef.modelRotation) {
            doorMesh.rotation.set(
                pdef.modelRotation.x ?? 0,
                pdef.modelRotation.y ?? 0,
                pdef.modelRotation.z ?? 0
            );
        }
        
        // Apply scale if specified
        if (pdef.scale) {
            if (typeof pdef.scale === 'number') {
                doorMesh.scale.set(pdef.scale, pdef.scale, pdef.scale);
            } else {
                doorMesh.scale.set(
                    pdef.scale.x ?? 1,
                    pdef.scale.y ?? 1,
                    pdef.scale.z ?? 1
                );
            }
        }
        
        // Position the door model relative to hinge (pivot point)
        if (pdef.modelPivotOffset) {
            doorMesh.position.set(
                pdef.modelPivotOffset.x ?? 0,
                pdef.modelPivotOffset.y ?? 0,
                pdef.modelPivotOffset.z ?? 0
            );
        } else {
            // Default: offset by half width along X-axis
            const doorWidth = pdef.size?.x ?? 1;
            doorMesh.position.x = doorWidth / 2;
        }
        
        // Also apply rotation to all child meshes if needed
        doorMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            child.userData = Object.assign({}, child.userData || {}, {
              isDoor: true,
              propId: pdef.id,
              type: 'door'
            });
            // Door GLB children are loaded async; register when this door is active in current scene.
            const isActiveDoor = !!(door.id && this.propsById && this.propsById[door.id] === door);
            if (isActiveDoor && !this.propMeshes.includes(child)) this.propMeshes.push(child);
            }
        });
        
        hinge.add(doorMesh);
        door.doorMesh = doorMesh;
        
        console.log('Door loaded:', pdef.id, 'model:', doorModelPath, 'Rotation:', doorMesh.rotation, 'Position:', doorMesh.position);
      }, undefined, (err) => {
        console.warn(`Failed to load door model for '${pdef.id}' from '${doorModelPath}':`, err);
      });

    try { door._sceneDef = pdef; } catch(e){}

    this.addProp(door, isPending);
    continue;
}
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
      this.addProp(propWrapper, isPending);
    });

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
  this.addProp(p, isPending);
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
      this.addEnemy(e, isPending);
    });

        // Use absolute world positions - no room centering or bounds calculation needed
        // Scene author defines exact positions. If they want walls/floor, add them as staticObjects.

        // Lights created after props/enemies loaded
        this._createLights(sceneDef, isPending);

    // Enemy firing callback
    const fireCallback = (origin, target, speed = 28) => {
      this.spawnProjectile(
        new THREE.Vector3(origin.x, origin.y, origin.z),
        new THREE.Vector3(target.x, target.y, target.z),
        speed
      );
    };

    // assign callbacks to enemies we created
    // Note: if pending, we assign callback but enemy is inactive so it won't fire yet.
    const targetEnemies = isPending ? this.pendingEnemies : this.enemies;
    targetEnemies.forEach((e) => {
      if (e) e.fireCallback = fireCallback;
    });

    if (!isPending) {
        this.objective = sceneDef.objective ?? null;
    }
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
