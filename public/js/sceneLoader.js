import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { ENEMY_INSTANCES } from "./enemy.js";
window.ENEMY_INSTANCES = ENEMY_INSTANCES;

import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/EXRLoader.js';
import { configureGltfLoaderForKtx2 } from './textureSupport.js';

import { Enemy } from "./enemy.js";
import { Door } from "./sceneLoader/door.js";
import { ensureUv2ForAo, meshHasAoMap } from "./sceneLoader/utils.js";
import {
  applyHdriForSceneCache,
  disposeAllHdriCacheEntries,
  disposeCachesModule,
  disposeHdriCacheEntry,
  getPmremTextureForHdriCache,
  loadModelCache,
  preloadHdriCache,
  releaseModelCacheRefs,
  resolveHdriConfigCache,
  trimHdriCache
} from "./sceneLoader/cache.js";
import {
  clearPendingLifecycle,
  commitPendingSceneLifecycle,
  hasPendingSceneLifecycle,
  loadSceneLifecycle,
  preloadSceneLifecycle,
  unloadSceneLifecycle
} from "./sceneLoader/lifecycle.js";
import { loadSceneDataEntities } from "./sceneLoader/entities.js";
import {
  applyDamageToMeshCombat,
  checkObjectiveAfterHitCombat,
  getIntersectableMeshesCombat,
  spawnProjectileCombat,
  updateCombat
} from "./sceneLoader/combat.js";
import {
  getAudioListenerAudio,
  playImpactSoundAudio,
  playPositionalImpactSoundAudio
} from "./sceneLoader/audio.js";
import {
  clearSceneEvents,
  destroySceneLoaderEvents,
  notifyLoadedEvents,
  registerSpawnTestExplosionGlobal
} from "./sceneLoader/events.js";

const SHADOW_MAP_MAX_SIZE = 1024;

// Make Door class globally accessible
window.Door = Door;
export { Door };

export class SceneLoader {
  constructor(scene, camera, player, renderer = null) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.renderer = renderer;
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

    // GLTF cache (keyed by model path). We cache the loaded source scene once,
    // then return clones so geometry/material/texture GPU assets are shared.
    this._gltfLoader = new GLTFLoader();
    configureGltfLoaderForKtx2(this._gltfLoader, this.renderer);
    this.modelCache = new Map();

    // HDRI/PMREM state and cache (keyed by exr file path)
    this._exrLoader = new EXRLoader();
    this._hdriCache = new Map();
    this._activeHdriPath = null;
    this._activeHdriRequestId = 0;
    this._isHdriBackgroundActive = false;
    this._pmremGenerator = this.renderer ? new THREE.PMREMGenerator(this.renderer) : null;
    if (this._pmremGenerator) {
      this._pmremGenerator.compileEquirectangularShader();
    } else {
      console.warn('SceneLoader: renderer missing, HDRI PMREM generation disabled.');
    }
    
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

  async loadModel(path) {
    return loadModelCache(this, path);
  }

  _resolveHdriConfig(sceneDef) {
    return resolveHdriConfigCache(sceneDef);
  }

  async _preloadHdri(sceneDef) {
    return preloadHdriCache(this, sceneDef);
  }

  async _applyHdriForScene(sceneDef) {
    return applyHdriForSceneCache(this, sceneDef);
  }

  _getPmremTextureForHdri(hdriPath) {
    return getPmremTextureForHdriCache(this, hdriPath);
  }

  _disposeHdriCacheEntry(path, entry) {
    return disposeHdriCacheEntry(this, path, entry);
  }

  _trimHdriCache(preferredPath = null) {
    return trimHdriCache(this, preferredPath);
  }

  _disposeAllHdriCacheEntries() {
    return disposeAllHdriCacheEntries(this);
  }

  releaseModelCache() {
    return releaseModelCacheRefs(this);
  }

  disposeCaches() {
    return disposeCachesModule(this);
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

    // AO maps sample uv2 in Three.js. Ensure uv2 exists for all meshes under this prop.
    try {
      propInstance.mesh.traverse(obj => {
        if (!obj?.isMesh) return;
        if (meshHasAoMap(obj.material)) ensureUv2ForAo(obj);
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
      const requestedShadowWidth = s.mapSize?.width ?? 1024;
      const requestedShadowHeight = s.mapSize?.height ?? 1024;
      const shadowWidth = Math.max(128, Math.min(SHADOW_MAP_MAX_SIZE, requestedShadowWidth));
      const shadowHeight = Math.max(128, Math.min(SHADOW_MAP_MAX_SIZE, requestedShadowHeight));
      light.shadow.mapSize.set(shadowWidth, shadowHeight);

      if (requestedShadowWidth > SHADOW_MAP_MAX_SIZE || requestedShadowHeight > SHADOW_MAP_MAX_SIZE) {
        console.warn(`SceneLoader: clamped shadow map for '${def.id || def.type || 'light'}' to ${shadowWidth}x${shadowHeight} (requested ${requestedShadowWidth}x${requestedShadowHeight}).`);
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
    return loadSceneLifecycle(this, sceneDef);
  }

  preloadScene(sceneDef) {
      return preloadSceneLifecycle(this, sceneDef);
  }

  hasPendingScene() {
      return hasPendingSceneLifecycle(this);
  }

  commitPendingScene() {
      return commitPendingSceneLifecycle(this);
  }

  _clearPending() {
      return clearPendingLifecycle(this);
  }

  _loadSceneData(sceneDef, isPending) {
    return loadSceneDataEntities(this, sceneDef, isPending);
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
    return spawnProjectileCombat(this, startPos, targetPos, opts);
  }

  // -----------------------------
  // Unload Scene (adjusted to arrays)
  // -----------------------------
  unloadScene() {
    return unloadSceneLifecycle(this);
  }


  // -----------------------------
  // Update (enemies, projectiles, explosions)
  // -----------------------------
  update(deltaMs, nowMs) {
    return updateCombat(this, deltaMs, nowMs);
  }

playImpactSound(soundPath, position, volume = 0.7) {
  return playImpactSoundAudio(this, soundPath, position, volume);
}


// Find an AudioListener attached to the camera (or fallback to window.audioListener)
_getAudioListener() {
  return getAudioListenerAudio(this);
}

// Play a positional impact sound at the given world `position` (THREE.Vector3).
// Falls back to non-positional Audio if no AudioListener / WebAudio is available.
playPositionalImpactSound(soundPathOrArray, position, volume = 0.8, refDistance = 6) {
  return playPositionalImpactSoundAudio(this, soundPathOrArray, position, volume, refDistance);
}


  // -----------------------------
  // Damage Handling (adapted to arrays/maps)
  // -----------------------------
applyDamageToMesh(mesh, damage = 1, opts = {}) {
  return applyDamageToMeshCombat(this, mesh, damage, opts);
}

  // -----------------------------
  // Objective Check
  // -----------------------------
  _checkObjectiveAfterHit() {
    return checkObjectiveAfterHitCombat(this);
}

// -----------------------------
  // Raycasting Mesh List
  // -----------------------------
getIntersectableMeshes() {
  return getIntersectableMeshesCombat(this);
}

  // -----------------------------
  // -----------------------------
  _notifyLoaded() {
    return notifyLoadedEvents(this);
  }

  // -----------------------------
  // Scene / resource cleanup helper
  // -----------------------------
  clearScene() {
    return clearSceneEvents(this);
  }

  destroy() {
    return destroySceneLoaderEvents(this);
  }
}

registerSpawnTestExplosionGlobal();
