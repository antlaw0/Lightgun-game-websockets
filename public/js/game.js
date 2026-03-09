// js/game.js
// This file is written as an ES module. Include it as:
// <script type="module" src="js/game.js"></script>
import { SceneManager } from './sceneManager.js';
import { EnemyVoiceManager } from "./EnemyVoiceManager.js";
import { AudioManager } from "./audio/AudioManager.js";
import { AUDIO_MANIFEST } from "./audio/audioManifest.js";
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
import { configureGltfLoaderForKtx2, configureKtx2ForRenderer } from './textureSupport.js';
import { createRenderPipeline } from './game/renderPipeline.js';
import { attachInputController } from './game/inputController.js';
import { attachEditorInputController } from './game/editorInputController.js';
import { setupCrashRuntime } from './game/crashRuntime.js';
import { setupSceneRuntime } from './game/sceneRuntime.js';
import { createDynamicReticleUpdater } from './game/reticleRuntime.js';
import { createFireController } from './game/combat/fireController.js';
import { createProjectileRuntime } from './game/combat/projectileRuntime.js';
import { createControllerRuntime } from './game/network/controllerRuntime.js';
import { attachDesktopSimulation } from './game/input/desktopSimulation.js';
import { createBallistics } from './game/combat/ballistics.js';
import { createDoorRuntime } from './game/doorRuntime.js';
import { setupEditorJsonModal } from './game/editorJsonModal.js';

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { killAllEnemies } from "./enemy.js";
killAllEnemies();
import { ENEMY_AI_ENABLED, setEnemyAIEnabled, ENEMY_INSTANCES } from './enemy.js';
import { WeaponManager } from './weaponManager.js';
// Editor mode flag and helpers (default OFF)
window.engine = window.engine || { isEditorMode: false };

const DEFAULT_LIGHT_DEFINITIONS = {
  point: {
    type: "point",
    color: 16777215,
    intensity: 1.5,
    position: { x: 0, y: 5, z: 0 },
    distance: 50,
    decay: 2,
    castShadow: true,
    shadow: {
      mapSize: { width: 1024, height: 1024 },
      camera: { near: 0.5, far: 50 },
      bias: -0.0001
    }
  },
  directional: {
    type: "directional",
    color: 0xffffff,
    intensity: 1.6,
    position: { x: 0, y: 10, z: 0 },
    target: { x: 0, y: 1.4, z: -6 },
    castShadow: true,
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 50 }
    }
  },
  spot: {
    type: "spot",
    color: 16777215,
    intensity: 2,
    position: { x: 0, y: 5, z: 5 },
    target: { x: 0, y: 1.4, z: 0 },
    distance: 50,
    angle: 0.5235987755982988,
    penumbra: 0.3,
    decay: 2,
    castShadow: true,
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: { near: 0.5, far: 50 }
    }
  },
  hemisphere: {
    type: "hemisphere",
    skyColor: 16777215,
    groundColor: 4473924,
    intensity: 0.6
  }
};

// Assigned after post-processing passes are created.
let applyEditorRenderPerformanceMode = () => {};

function setEditorMode(enabled) {
  window.engine.isEditorMode = !!enabled;
  const g = window.engine.editorGrid = window.engine.editorGrid || { sizes: [0, 1, 0.5, 0.25], index: 0, size: 0, helper: null, worldSize: 200 };

  if (window.engine.isEditorMode) {
    // disable enemy AI and combat, enable free FPS movement
    try { setEnemyAIEnabled(false); } catch(_) {}
    isFPSMode = true;
    window.engine.disableCombat = true;
    // Restore last active grid size, if any, when re-entering editor mode.
    if (!g.size && g.lastEditorSize) g.size = g.lastEditorSize;
    applyEditorRenderPerformanceMode(true);
    console.log('[EDITOR] Editor mode ENABLED');
    try { if (window.speak) window.speak('Editor mode on', { interrupt: true }); } catch(e){}
    toggleLightHelpers(true);
  } else {
    try { setEnemyAIEnabled(true); } catch(_) {}
    window.engine.disableCombat = false;
    // Force grid off outside editor mode to avoid unnecessary GPU load.
    if (g.size > 0) g.lastEditorSize = g.size;
    g.size = 0;
    applyEditorRenderPerformanceMode(false);
    console.log('[EDITOR] Editor mode DISABLED');
    try { if (window.speak) window.speak('Editor mode off', { interrupt: true }); } catch(e){}
    toggleLightHelpers(false);
  }
  // Ensure any grid state updates after editor toggle (safe if updateEditorGrid defined later)
  try { requestAnimationFrame(() => { if (window.updateEditorGrid) window.updateEditorGrid(); }); } catch (e) {}
}

function toggleLightHelpers(enabled) {
  if (!window.sceneLoader) return;
  const sl = window.sceneLoader;

  sl.sceneLights.forEach(light => {
    if (light.isAmbientLight) return;

    let wrapper = sl.staticObjects.find(o => o.light === light);

    if (enabled) {
      if (!wrapper) {
        const id = light.userData.id || `light_${light.id}`;
        light.userData.id = id;
        light.userData.propId = id;
        light.userData.type = 'light';

        let helper = light.userData.editorHelper;
        if (!helper) {
            const sgeo = new THREE.SphereGeometry(0.2, 8, 8);
            const smat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
            helper = new THREE.Mesh(sgeo, smat);
            light.add(helper);
            light.userData.editorHelper = helper;
            
            if (Array.isArray(sl.propMeshes) && !sl.propMeshes.includes(helper)) {
                sl.propMeshes.push(helper);
            }
        }
        helper.visible = true;

        wrapper = {
            id: id,
            mesh: light,
            light: light,
            type: 'light',
            lightType: light.isDirectionalLight ? 'directional' : (light.isSpotLight ? 'spot' : (light.isHemisphereLight ? 'hemisphere' : (light.isRectAreaLight ? 'rectArea' : 'point'))),
            position: { x: light.position.x, y: light.position.y, z: light.position.z },
            _sceneDef: _lightToDef(light)
        };
        if (wrapper._sceneDef) wrapper._sceneDef.id = id;
        sl.staticObjects.push(wrapper);
      } else {
          if (light.userData.editorHelper) {
              light.userData.editorHelper.visible = true;
          } else if (wrapper.mesh && wrapper.mesh !== light) {
              wrapper.mesh.traverse(c => {
                  if (c.isMesh && c.geometry && c.geometry.type === 'SphereGeometry') c.visible = true;
              });
          }
      }
    } else {
      if (light.userData.editorHelper) {
          light.userData.editorHelper.visible = false;
      }
      if (wrapper && wrapper.mesh && wrapper.mesh !== light) {
           wrapper.mesh.traverse(c => {
                if (c.isMesh && c.geometry && c.geometry.type === 'SphereGeometry') c.visible = false;
            });
      }
    }
  });
}

import { initSparks, spawnSparks, updateSparks } from './fx/sparks.js';

import { Level_Warehouse } from "./Level_Warehouse.js";
import { SceneLoader } from "./sceneLoader.js";
import { ALL_SCENES } from "./sceneIndex.js";


// js/game.js
import { Player } from './player.js';
import { HUD } from './hud.js';
import { WEAPON_DEFS } from './weapons.js';

// will be created after camera is initialized
export let player = null;


// Basic console helper (screen-reader friendly)
function logDebug(msg) {
  const ts = new Date().toLocaleTimeString();
  const el = document.getElementById('debugConsole');
  if (el) {
    el.textContent = `${ts} - ${msg}\n` + el.textContent;
    el.textContent = el.textContent.split('\n').slice(0,200).join('\n');
  } else {
    console.log(msg);
  }
}

// prevent duplicate firing from multiple input sources (ms)
let lastPlayerFireMs = 0;
const FIRE_COOLDOWN_MS = 150; // 150 ms minimum between fired shots
let isFiring = false;
let fireController = null;
let projectileRuntime = null;
let controllerRuntime = null;
let doorRuntime = null;
let editorJsonModalRuntime = null;

function triggerReload() {
  return fireController?.triggerReload();
}

function updateAutoFire(nowMs) {
  return fireController?.updateAutoFire(nowMs);
}

function triggerFire() {
  return fireController?.triggerFire() ?? false;
}

function spawnProjectileUnified(origin, direction, options = {}) {
  return projectileRuntime?.spawnProjectileUnified(origin, direction, options);
}

function updateProjectiles(dt) {
  return projectileRuntime?.updateProjectiles(dt);
}

function updateEnemyProjectiles(dt) {
  return projectileRuntime?.updateEnemyProjectiles(dt);
}

function updateSmokeParticles(dt) {
  return projectileRuntime?.updateSmokeParticles(dt);
}

function sendDesktopPayload(overrides = {}) {
  return controllerRuntime?.sendDesktopPayload(overrides);
}

function sendWeaponInfo() {
  return controllerRuntime?.sendWeaponInfo();
}

function tryInteractDoor() {
  return doorRuntime?.tryInteractDoor();
}

function openEditSelectedJSON() {
  return editorJsonModalRuntime?.openEditSelectedJSON();
}

function closeEditModal() {
  return editorJsonModalRuntime?.closeEditModal();
}

function applyEditedJSON() {
  return editorJsonModalRuntime?.applyEditedJSON();
}
// ------------------ Projectiles ------------------
const projectiles = [];
const PROJECTILE_SPEED = 50;  // units per second
const PROJECTILE_LIFETIME = 2.0; // seconds

const enemyProjectiles = [];

// ------------------ Accuracy & Reticle Constants ------------------
// MAX_CONE_ANGLE_DEG: full cone angle (degrees) when accuracy == 0.01 (worst)
// Accuracy is in range [0.01, 1.0]. We map accuracy -> inaccuracy = 1-accuracy
// then coneAngle = inaccuracy * MAX_CONE_ANGLE_DEG (full angle). Half-angle used for sampling.
// Maximum full cone angle (degrees) when accuracy == worst. Reduced to make reticle less exaggerated.
const MAX_CONE_ANGLE_DEG = 6; // full cone degrees at worst accuracy (clear named constant)

// Reticle mapping constants (pixels). MIN_RETICLE_RADIUS is the radius at perfect accuracy (1.0)
const MIN_RETICLE_RADIUS_PX = 8; // smallest reticle radius when accuracy == 1.0
// Maximum radius is a fraction of the screen; computed at runtime from viewport size
const MAX_RETICLE_RADIUS_PCT = 0.45; // use min(width,height) * this for maximum radius

const ballistics = createBallistics({
  THREE,
  maxConeAngleDeg: MAX_CONE_ANGLE_DEG,
  getFallbackQuaternion: () => window.camera?.quaternion || null
});

// Helper: clamp accuracy to allowed domain [0.01, 1.0]
function clampAccuracy(a) {
  return ballistics.clampAccuracy(a);
}

// Convert accuracy -> full cone angle (radians). Uses explicit constant above.
// inaccuracy = 1.0 - accuracy; coneAngleFull = inaccuracy * MAX_CONE_ANGLE_DEG
function accuracyToConeHalfAngleRad(accuracy) {
  return ballistics.accuracyToConeHalfAngleRad(accuracy);
}

// Sample a random direction uniformly inside a cone (spherical cap) around `forward`.
// If accuracy == 1.0 the halfAngle will be zero and this returns the forward vector
function sampleDirectionInCone(forward, halfAngleRad) {
  return ballistics.sampleDirectionInCone(forward, halfAngleRad);
}

// Generate pellet directions for shotguns: final pellet direction = accuracy cone + pellet spread cone
function generateShotgunPelletDirections(forwardDir, numPellets, weaponAccuracy, pelletSpreadDeg) {
  return ballistics.generateShotgunPelletDirections(forwardDir, numPellets, weaponAccuracy, pelletSpreadDeg);
}


// ---- UI elements assumed in page ----
const canvas = document.getElementById('canvas');
const reticleDiv = document.getElementById('reticle');
const connStatus = document.getElementById('connStatus');
const retXY = document.getElementById('retXY');
const abc = document.getElementById('abc');
const debugConsole = document.getElementById('debugConsole');

let cw = canvas.width = window.innerWidth;
let ch = canvas.height = window.innerHeight;

// Reticle state must be initialized before input listeners are attached.
let ret = { x: cw / 2, y: ch / 2 }; // target position from controller (pixels)
let displayedRet = { x: cw / 2, y: ch / 2 }; // smoothed position shown on screen
const LERP_SPEED = 0.9;

controllerRuntime = createControllerRuntime({
  connStatus,
  retXY,
  abc,
  logDebug,
  getRet: () => ret,
  setRet: ({ x, y }) => { ret.x = x; ret.y = y; },
  getViewport: () => ({ cw, ch }),
  getIsFiring: () => isFiring,
  setIsFiring: (next) => { isFiring = !!next; },
  getIsFPSMode: () => isFPSMode,
  getPlayer: () => player,
  triggerFire,
  triggerReload
});

// ------------------ Three.js Setup ------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, cw / ch, 0.1, 200);
camera.position.set(0, 1.7, 5);
camera.lookAt(0, 1.7, 0);
// expose camera globally for modules that expect it
window.camera = camera;

const audioManager = new AudioManager(camera, scene);
await audioManager.loadFromManifest(AUDIO_MANIFEST);
// If player already has arm loaded, attach it now
try { if (player && typeof player._attachArmToCamera === 'function') player._attachArmToCamera(); } catch(_) {}
// Ensure camera is part of the scene so camera-attached children are rendered
try {
  scene.add(camera);
  console.log('Camera added to scene so camera children will render');
} catch (_) {}

// FPS mode state (toggle with Tab). When true: WASD + mouse look, reticle centered.
let isFPSMode = false;
let playerStandingHeight = 1.7;
const fpsState = {
  yaw: camera.rotation.y,
  pitch: camera.rotation.x,
  // Increased speed for responsive FPS movement (units per second)
  speed: 4.0,
  mouseSensitivity: 0.0025,
  keys: {}
};


const audioListener = new THREE.AudioListener();
camera.add(audioListener);

const enemyVoiceManager = new EnemyVoiceManager(
  camera,
  audioListener
);
// Expose globally so Enemy.js can request voices
window.enemyVoiceManager = enemyVoiceManager;
// Initialize WeaponManager (loads weapon GLBs, animations, muzzle flashes)
let weaponManager = null;
 
    weaponManager = new WeaponManager(scene, camera);
window.weaponManager = weaponManager;

weaponManager
  .loadWeapons()
  .then(() => {
    weaponManager.registerWeaponOrder(Object.keys(WEAPON_DEFS));
    weaponManager.equipWeapon('pistol'); // now it will appear
  });

// Load rocket projectile model
let rocketModel = null;
configureGltfLoaderForKtx2(new GLTFLoader()).load('assets/models/weapons/rocket.glb', (gltf) => {
    rocketModel = gltf.scene;
    rocketModel.traverse(c => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
});

// Create player now that camera exists so it can be passed in
player = new Player({
  maxHp: 10000,
  hp: 10000,
  weapons: [
    {
      name: "Starter Pistol",
      image: "/assets/hud/weapon_placeholder.png",
      fireMode:  "auto",
      rateOfFireMs: 120,
      ammoType: "bullets",
      clipSize: 12,
      ammoInClip: 12,
      damage: 10,
      projectilesPerShot: 8,
      projectileSpread:  10,
      spreadPattern:  "normal",
      totalAmmo: 48
    }
  ],
  currentWeaponIndex: 0,
  camera: camera
});
// Expose for debugging / cross-module access
window.player = player;

HUD.init(player, camera);
window.hud = HUD;
//console.log("HUD object:", HUD);
//console.log("HUD shakeCamera:", HUD.shakeCamera);
window.hud = HUD;
console.log("window.hud:", window.hud);

initSparks(scene);

doorRuntime = createDoorRuntime({ THREE });
window.openDoorById = (doorId, callback) => doorRuntime?.openDoorById(doorId, callback);
window.closeDoorById = (doorId, callback) => doorRuntime?.closeDoorById(doorId, callback);

projectileRuntime = createProjectileRuntime({
  THREE,
  scene,
  camera,
  getPlayer: () => player,
  getSceneLoader: () => window.sceneLoader,
  getProjectiles: () => projectiles,
  getEnemyProjectiles: () => enemyProjectiles,
  getRocketModel: () => rocketModel,
  projectileSpeed: PROJECTILE_SPEED,
  projectileLifetime: PROJECTILE_LIFETIME,
  spawnSparks,
  logDebug,
  getSpawnTestExplosion: () => window.spawnTestExplosion
});

fireController = createFireController({
  THREE,
  camera,
  audioManager,
  clampAccuracy,
  logDebug,
  getPlayer: () => player,
  getWeaponManager: () => window.weaponManager,
  getSceneLoader: () => window.sceneLoader,
  getIsEditorMode: () => !!(window.engine && window.engine.isEditorMode),
  getIsFiring: () => isFiring,
  getLastPlayerFireMs: () => lastPlayerFireMs,
  setLastPlayerFireMs: (value) => { lastPlayerFireMs = value; },
  getRet: () => ret,
  getViewport: () => ({ cw, ch }),
  getDisplayedRet: () => displayedRet,
  generateSpreadDirections,
  spawnProjectileUnified
});


// -----------------------------------------------------
// DEBUG FREE CAMERA (WASD + QE + Arrow keys)
// -----------------------------------------------------
const camSpeed = 0.1;
const camRotSpeed = 0.02;
const inputController = attachInputController({
  canvas,
  camera,
  fpsState,
  ret,
  getViewportSize: () => ({ cw, ch }),
  getIsFPSMode: () => isFPSMode,
  setIsFPSMode: (next) => { isFPSMode = !!next; },
  setIsFiring: (next) => { isFiring = !!next; },
  sendDesktopPayload,
  getPlayer: () => player,
  getEnemyVoiceManager: () => window.enemyVoiceManager,
  triggerReload,
  logDebug,
  camSpeed,
  camRotSpeed
});

window.addEventListener("keydown", e => {
  if (window._editorModalOpen) return;
  const code = e.code || '';
  const key = e.key || '';
  if (code === 'KeyV' || key === 'v' || key === 'V') {
    console.log('KeyV pressed -> melee');
    try {
      if (typeof player !== 'undefined' && player && typeof player.meleeAttack === 'function') {
        player.meleeAttack();
      } else if (window.player && typeof window.player.meleeAttack === 'function') {
        window.player.meleeAttack();
      } else {
        console.warn('meleeAttack not available on player');
      }
    } catch (err) {
      console.error('meleeAttack call failed', err);
    }
  }
});

window.addEventListener("keydown", (e) => {
  if (window._editorModalOpen) return;
  if (e.code === "F4") {
    setEnemyAIEnabled(!ENEMY_AI_ENABLED);
    logDebug(`Enemy AI toggled: ${ENEMY_AI_ENABLED ? "ON" : "OFF"}`);
  }
});

// Door interaction (F key)
window.addEventListener("keydown", (e) => {
  if (window._editorModalOpen) return;
  if (e.code === "KeyF") {
    e.preventDefault();
    tryInteractDoor();
  }
});

const editorInputController = attachEditorInputController({
  setEditorMode,
  logDebug,
  spawnEditorObject,
  showLightPicker,
  selectObjectFromCenter,
  openEditSelectedJSON,
  clearHighlight: _clearHighlight,
  snapVector3ToEditorGrid,
  syncWrapperAuthoredPositionFromMesh: _syncWrapperAuthoredPositionFromMesh,
  getAuthoredPositionForObject: _getAuthoredPositionForObject
});

  // -----------------------------
  // Simple editor console commands
  // Usage from browser console: execEditorCommand('size x 2')
  // Supported: size x|y|z <value>, rot y <degrees>, light intensity <value>
  window.execEditorCommand = function(cmd) {
    if (!cmd || typeof cmd !== 'string') return console.warn('execEditorCommand expects a string');
    const parts = cmd.trim().split(/\s+/);
    if (parts.length < 3) return console.warn('Invalid command');
    const verb = parts[0].toLowerCase();
    const target = parts[1].toLowerCase();
    const val = Number(parts[2]);
    if (Number.isNaN(val)) return console.warn('Value must be numeric');
    const sel = window.selectedObject;
    if (!sel) return console.warn('No selected object');

    try {
      if (verb === 'size') {
        // scale along axis for mesh (box-like objects)
        if (!sel.mesh) return console.warn('Selected has no mesh');
        const mesh = sel.mesh;
        // ensure numeric
        const n = Number(val);
        if (Number.isNaN(n)) return console.warn('Invalid numeric value');

        if (target === 'x') mesh.scale.set(n, mesh.scale.y, mesh.scale.z);
        else if (target === 'y') mesh.scale.set(mesh.scale.x, n, mesh.scale.z);
        else if (target === 'z') mesh.scale.set(mesh.scale.x, mesh.scale.y, n);
        else return console.warn('Unknown size axis');

        // update wrapper size if present
        if (sel.size) {
          if (target === 'x') sel.size.x = n;
          if (target === 'y') sel.size.y = n;
          if (target === 'z') sel.size.z = n;
        }

        // Try to update highlight bounding box
        try {
          if (sel._editorHighlight) {
            // BoxHelper has .update(); call it and also recompute matrix world
            if (typeof sel._editorHighlight.update === 'function') sel._editorHighlight.update();
            else sel._editorHighlight.setFromObject(mesh);
          }
        } catch (e) { /* non-fatal */ }

        console.log(`Applied size ${target}=${n} to ${sel.id || '(no-id)'} `);
        return true;
      }

      // position editing: `pos x 1.5` or `position z -2`
      if (verb === 'pos' || verb === 'position') {
        if (!sel.mesh) return console.warn('Selected has no mesh');
        const n = Number(val);
        if (Number.isNaN(n)) return console.warn('Invalid numeric value');
        const authoredPos = _getAuthoredPositionForObject(sel) || { x: sel.mesh.position.x, y: sel.mesh.position.y, z: sel.mesh.position.z };
        if (target === 'x') authoredPos.x = n;
        else if (target === 'y') authoredPos.y = n;
        else if (target === 'z') authoredPos.z = n;
        else return console.warn('Unknown position axis');

        const runtimePos = _authoredToRuntimePosition(sel, authoredPos, sel._sceneDef) || authoredPos;
        sel.mesh.position.set(runtimePos.x, runtimePos.y, runtimePos.z);

        // sync wrapper position
        _syncWrapperAuthoredPositionFromMesh(sel);

        try { if (sel._editorHighlight) sel._editorHighlight.update(); } catch (e) {}
        console.log(`Applied position ${target}=${n} to ${sel.id || '(no-id)'} `);
        return true;
      }

      if (verb === 'rot') {
        if (!sel.mesh) return console.warn('Selected has no mesh');
        if (target === 'y') {
          sel.mesh.rotation.y = THREE.MathUtils.degToRad(val);
          if (!sel.rotation) sel.rotation = {};
          sel.rotation.y = sel.mesh.rotation.y;
          if (sel._editorHighlight) sel._editorHighlight.update();
          console.log(`Applied rot y=${val}deg to ${sel.id || '(no-id)'} `);
          return;
        }
        return console.warn('Unsupported rot axis');
      }

      if (verb === 'light' && target === 'intensity') {
        // allow `light intensity <value>`
        if (sel.light) {
          sel.light.intensity = val;
          console.log(`Set light intensity=${val} on ${sel.id || '(no-id)'} `);
          return;
        }
        // If selecting wrapper that contains .light property
        if (sel.light === undefined && sel.mesh) {
          // try find THREE.Light child
          let found = null;
          sel.mesh.traverse(c => { if (!found && c.isLight) found = c; });
          if (found) { found.intensity = val; console.log(`Set light intensity=${val} on ${sel.id || '(no-id)'} `); return; }
        }
        return console.warn('Selected object is not a light');
      }

      console.warn('Unknown command');
    } catch (e) {
      console.error('execEditorCommand failed', e);
    }
  };

// Editor spawning: keys 1-4 spawn objects when editor mode active
window.engine.editorCounters = window.engine.editorCounters || { wall: 0, door: 0, light: 0, crate: 0 };

function _nextId(prefix) {
  const c = window.engine.editorCounters;
  c[prefix] = (c[prefix] || 0) + 1;
  return `${prefix}_${String(c[prefix]).padStart(2,'0')}`;
}

function spawnEditorObject(type, defOverride = null) {
  if (!window.engine.isEditorMode) return;
  if (!window.sceneLoader) { console.warn('No sceneLoader'); return; }
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const pos = camera.position.clone().add(dir.multiplyScalar(2));

  const sl = window.sceneLoader;
  let id, wrapper;

  if (type === 'wall') {
    id = _nextId('wall');
    const width = 2; const height = 2; const depth = 0.2;
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({ color: 0x228833 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    // Snap placement to editor grid when active
    try { snapVector3ToEditorGrid(mesh.position); } catch (e) {}
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { propId: id, type: 'wall', solid: true };

    wrapper = {
      id,
      mesh,
      size: { x: width, y: height, z: depth },
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      hp: 9999,
      maxHp: 9999,
      indestructible: true,
      takeDamage() { return false; },
      dispose() { try { mesh.geometry?.dispose(); mesh.material?.dispose(); } catch(e){} }
    };

    try { wrapper._sceneDef = _cleanStaticObject(wrapper); } catch(e){}
    sl.addProp(wrapper);
    sl.staticObjects.push(wrapper);
    console.log('Editor: spawned wall', id, mesh.position);
    return wrapper;
  }

  if (type === 'door') {
    id = _nextId('door');
    const width = 1.2; const height = 2.2; const depth = 0.15;
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const door = new THREE.Mesh(geo, mat);
    door.position.copy(pos);
    try { snapVector3ToEditorGrid(door.position); } catch (e) {}
    door.castShadow = true; door.receiveShadow = true;
    door.userData = { propId: id, type: 'door', solid: true };

    wrapper = {
      id,
      mesh: door,
      size: { x: width, y: height, z: depth },
      position: { x: door.position.x, y: door.position.y, z: door.position.z },
      hp: 1,
      maxHp: 1,
      indestructible: false,
      takeDamage(amount) { this.hp -= amount; if (this.hp <= 0) { if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh); return true; } return false; },
      dispose() { try { this.mesh.geometry?.dispose(); this.mesh.material?.dispose(); } catch(e){} }
    };

    try { wrapper._sceneDef = _cleanStaticObject(wrapper); } catch(e){}
    sl.addProp(wrapper);
    sl.staticObjects.push(wrapper);
    console.log('Editor: spawned door', id, door.position);
    return wrapper;
  }

  if (type === 'light') {
    id = _nextId('light');
    const def = defOverride || DEFAULT_LIGHT_DEFINITIONS.point;
    
    const holder = new THREE.Object3D();
    holder.position.copy(pos);
    // Apply definition position if provided (relative to spawn or absolute? usually spawn at camera look)
    // But let's respect the spawn logic (in front of camera) and just use def properties for light params.
    
    try { snapVector3ToEditorGrid(holder.position); } catch (e) {}
    
    let light;
    if (def.type === 'directional') {
        light = new THREE.DirectionalLight(def.color, def.intensity);
        if (def.target) {
            light.target.position.set(def.target.x - def.position.x, def.target.y - def.position.y, def.target.z - def.position.z);
            holder.add(light.target);
        }
    } else if (def.type === 'spot') {
        light = new THREE.SpotLight(def.color, def.intensity, def.distance, def.angle, def.penumbra, def.decay);
        if (def.target) {
            light.target.position.set(def.target.x - def.position.x, def.target.y - def.position.y, def.target.z - def.position.z);
            holder.add(light.target);
        }
    } else if (def.type === 'hemisphere') {
        light = new THREE.HemisphereLight(def.skyColor, def.groundColor, def.intensity);
    } else {
        // point
        light = new THREE.PointLight(def.color, def.intensity, def.distance, def.decay);
    }
    
    light.position.set(0,0,0);
    if (def.castShadow) light.castShadow = true;
    if (def.shadow) {
        if (def.shadow.mapSize) {
            light.shadow.mapSize.width = def.shadow.mapSize.width;
            light.shadow.mapSize.height = def.shadow.mapSize.height;
        }
        if (def.shadow.bias) light.shadow.bias = def.shadow.bias;
        if (def.shadow.camera) {
            if (def.shadow.camera.near) light.shadow.camera.near = def.shadow.camera.near;
            if (def.shadow.camera.far) light.shadow.camera.far = def.shadow.camera.far;
        }
    }

    holder.add(light);
    
    // Add white sphere for selection representation
    const sgeo = new THREE.SphereGeometry(0.2, 8, 8);
    const smat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const s = new THREE.Mesh(sgeo, smat);
    holder.add(s);
    
    holder.userData = { propId: id, type: 'light', lightType: def.type };

    wrapper = {
      id,
      mesh: holder,
      light: light,
      type: 'light',
      lightType: def.type,
      position: { x: holder.position.x, y: holder.position.y, z: holder.position.z },
      _sceneDef: JSON.parse(JSON.stringify(def)) // Store initial def
    };
    // Update ID in def
    wrapper._sceneDef.id = id;

    try { wrapper._sceneDef = _cleanStaticObject(wrapper); } catch(e){}
    // attach initial raw def so editor can preserve arbitrary keys
    try { wrapper._sceneDef = _cleanStaticObject(wrapper); } catch(e){}
    // register with scene lights and staticObjects for export
    sl.scene.add(holder);
    sl.sceneLights.push(light);
    // ensure the helper sphere and holder are selectable via raycasts
    try {
      holder.traverse(o => {
        if (o && o.isMesh) {
          o.userData = Object.assign({}, o.userData || {}, { propId: id, type: 'light' });
          if (Array.isArray(sl.propMeshes) && !sl.propMeshes.includes(o)) sl.propMeshes.push(o);
        }
      });
    } catch (e) {}
    sl.staticObjects.push(wrapper);
    console.log(`Editor: spawned ${def.type} light`, id, holder.position);
    return wrapper;
  }

  if (type === 'crate') {
    id = _nextId('crate');
    const size = 1.0;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color: 0x996633 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    try { snapVector3ToEditorGrid(mesh.position); } catch (e) {}
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { propId: id, type: 'crate', solid: true };

    wrapper = {
      id,
      mesh,
      size: { x: size, y: size, z: size },
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      hp: 10,
      maxHp: 10,
      indestructible: false,
      hitSounds: [],
      deathSounds: [],
      takeDamage(amount) { this.hp -= amount; if (this.hp <= 0) { if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh); return true; } return false; },
      dispose() { try { this.mesh.geometry?.dispose(); this.mesh.material?.dispose(); } catch(e){} }
    };

    try { wrapper._sceneDef = _cleanStaticObject(wrapper); } catch(e){}
    sl.addProp(wrapper);
    sl.staticObjects.push(wrapper);
    console.log('Editor: spawned crate', id, mesh.position);
    return wrapper;
  }
}

window.spawnEditorObject = spawnEditorObject;

// --- Light Picker UI ---
function showLightPicker() {
  if (document.getElementById('light-picker-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'light-picker-overlay';
  overlay.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:#fff;padding:15px;border-radius:8px;z-index:10000;min-width:250px;text-align:center;';

  const title = document.createElement('h3');
  title.textContent = 'Select Light Type';
  title.style.marginTop = '0';
  overlay.appendChild(title);

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';

  Object.keys(DEFAULT_LIGHT_DEFINITIONS).forEach(key => {
    const btn = document.createElement('button');
    btn.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    btn.style.padding = '8px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '14px';
    btn.onclick = () => {
      spawnEditorObject('light', DEFAULT_LIGHT_DEFINITIONS[key]);
      closeLightPicker();
    };
    list.appendChild(btn);
  });

  overlay.appendChild(list);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cancel';
  closeBtn.style.marginTop = '15px';
  closeBtn.onclick = closeLightPicker;
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);
}

function closeLightPicker() {
  const overlay = document.getElementById('light-picker-overlay');
  if (overlay) overlay.remove();
}

window.cam = () => {
  console.log(`Camera position -> x: ${camera.position.x.toFixed(2)}, y: ${camera.position.y.toFixed(2)}, z: ${camera.position.z.toFixed(2)}`);
};

// -----------------------------
// Scene export (F6)
// -----------------------------
function _serializeVector3(v) {
  return { x: v.x, y: v.y, z: v.z };
}

function _hasFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function _resolveObjectType(obj, defOverride = null) {
  const def = defOverride || obj?._sceneDef || null;
  return String(def?.type || obj?.type || obj?.mesh?.userData?.type || '').toLowerCase();
}

function _resolveObjectSize(obj, defOverride = null) {
  const def = defOverride || obj?._sceneDef || null;
  const sx = Number(def?.size?.x ?? obj?.size?.x);
  const sz = Number(def?.size?.z ?? obj?.size?.z);
  if (!_hasFiniteNumber(sx) || !_hasFiniteNumber(sz)) return null;
  return { x: sx, z: sz };
}

function _isEdgeAuthoredObject(obj, defOverride = null) {
  if (!obj) return false;
  const def = defOverride || obj._sceneDef || null;
  const type = _resolveObjectType(obj, def);
  if (type === 'door' || type === 'light') return false;
  const size = _resolveObjectSize(obj, def);
  if (!size) return false;
  if (def && def._convertedToCenter === true) return false;
  return true;
}

function _runtimeToAuthoredPosition(obj, runtimePos, defOverride = null) {
  if (!runtimePos) return null;
  if (!_isEdgeAuthoredObject(obj, defOverride)) {
    return { x: runtimePos.x, y: runtimePos.y, z: runtimePos.z };
  }
  const size = _resolveObjectSize(obj, defOverride) || { x: 0, z: 0 };
  return {
    x: runtimePos.x - size.x / 2,
    y: runtimePos.y,
    z: runtimePos.z - size.z / 2
  };
}

function _authoredToRuntimePosition(obj, authoredPos, defOverride = null) {
  if (!authoredPos) return null;
  if (!_isEdgeAuthoredObject(obj, defOverride)) {
    return { x: authoredPos.x, y: authoredPos.y, z: authoredPos.z };
  }
  const size = _resolveObjectSize(obj, defOverride) || { x: 0, z: 0 };
  return {
    x: authoredPos.x + size.x / 2,
    y: authoredPos.y,
    z: authoredPos.z + size.z / 2
  };
}

function _getAuthoredPositionForObject(obj) {
  if (!obj) return null;
  if (obj.mesh?.position) return _runtimeToAuthoredPosition(obj, obj.mesh.position, obj._sceneDef);
  if (obj.position && _hasFiniteNumber(obj.position.x) && _hasFiniteNumber(obj.position.y) && _hasFiniteNumber(obj.position.z)) {
    return { x: obj.position.x, y: obj.position.y, z: obj.position.z };
  }
  return null;
}

function _syncWrapperAuthoredPositionFromMesh(obj) {
  if (!obj || !obj.mesh?.position) return;
  const authoredPos = _runtimeToAuthoredPosition(obj, obj.mesh.position, obj._sceneDef);
  if (!authoredPos) return;
  obj.position = authoredPos;
  if (obj._sceneDef && typeof obj._sceneDef === 'object') {
    obj._sceneDef.position = { ...authoredPos };
  }
}

function _lightToDef(light) {
  if (!light) return null;
  const def = {};
  if (light.isAmbientLight) {
    def.type = 'ambient';
    def.color = light.color ? light.color.getHex() : 0xffffff;
    def.intensity = light.intensity;
  } else if (light.isDirectionalLight) {
    def.type = 'directional';
    def.color = light.color ? light.color.getHex() : 0xffffff;
    def.intensity = light.intensity;
    def.position = _serializeVector3(light.position);
    if (light.target && light.target.position) def.target = _serializeVector3(light.target.position);
    if (light.castShadow) def.castShadow = true;
  } else if (light.isPointLight) {
    def.type = 'point';
    def.color = light.color ? light.color.getHex() : 0xffffff;
    def.intensity = light.intensity;
    def.position = _serializeVector3(light.parent ? light.parent.position : light.position);
    if (typeof light.distance === 'number') def.distance = light.distance;
    if (typeof light.decay === 'number') def.decay = light.decay;
  } else if (light.isSpotLight) {
    def.type = 'spot';
    def.color = light.color ? light.color.getHex() : 0xffffff;
    def.intensity = light.intensity;
    def.position = _serializeVector3(light.parent ? light.parent.position : light.position);
    def.angle = light.angle;
    def.penumbra = light.penumbra;
    def.decay = light.decay;
  } else if (light.isHemisphereLight) {
    def.type = 'hemisphere';
    def.skyColor = light.color ? light.color.getHex() : 0xffffff;
    def.groundColor = light.groundColor ? light.groundColor.getHex() : 0xffffff;
    def.intensity = light.intensity;
    def.position = _serializeVector3(light.position);
  } else if (light.isRectAreaLight) {
    def.type = 'rectArea';
    def.color = light.color ? light.color.getHex() : 0xffffff;
    def.intensity = light.intensity;
    def.position = _serializeVector3(light.position);
    def.size = { x: light.width, y: light.height };
    // Reconstruct lookAt target from rotation (approximate)
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(light.quaternion);
    def.lookAt = _serializeVector3(light.position.clone().add(forward));
  } else {
    // unknown light type: fallback to point-like
    def.type = 'point';
    def.color = light.color ? light.color.getHex() : 0xffffff;
    def.intensity = light.intensity ?? 1;
    def.position = _serializeVector3(light.parent ? light.parent.position : light.position);
  }
  return def;
}

function _cleanLightObject(o) {
    // If we have a stored definition, start with that to preserve structure
    let def = o._sceneDef ? JSON.parse(JSON.stringify(o._sceneDef)) : {};
    
    // Update properties from the live object
    def.id = o.id;
    def.type = o.lightType || def.type || 'point';
    
    if (o.mesh) {
        def.position = { x: o.mesh.position.x, y: o.mesh.position.y, z: o.mesh.position.z };
    }
    
    if (o.light) {
        def.color = o.light.color.getHex();
        def.intensity = o.light.intensity;
        
        if (def.type === 'point' || def.type === 'spot') {
            def.distance = o.light.distance;
            def.decay = o.light.decay;
        }
        if (def.type === 'spot') {
            def.angle = o.light.angle;
            def.penumbra = o.light.penumbra;
        }
        if (def.type === 'hemisphere') {
            def.groundColor = o.light.groundColor.getHex();
            def.skyColor = o.light.color.getHex(); // skyColor is mapped to color in Three.js HemisphereLight
        }
    }
    return def;
}

function _cleanStaticObject(o) {
  const authoredLivePos = _getAuthoredPositionForObject(o);
  const livePos = authoredLivePos ? { x: authoredLivePos.x, y: authoredLivePos.y, z: authoredLivePos.z } : null;
  const liveRot = (o && o.mesh && o.mesh.rotation)
    ? { x: o.mesh.rotation.x, y: o.mesh.rotation.y, z: o.mesh.rotation.z }
    : null;

  // If a stored raw scene definition exists, prefer it (preserves arbitrary keys)
  if (o && o._sceneDef && typeof o._sceneDef === 'object') {
    try {
      const out = JSON.parse(JSON.stringify(o._sceneDef)); // deep clone to avoid mutation
      // Ensure id exists
      out.id = out.id ?? (o.id || null);
      // Overlay runtime transforms so exported data matches live scene
      if (livePos) out.position = livePos;
      else if (o.position && o.position.x !== undefined) out.position = { x: o.position.x, y: o.position.y, z: o.position.z };
      if (liveRot) out.rotation = liveRot;
      else if (o.rotation && o.rotation.x !== undefined) out.rotation = { x: o.rotation.x ?? 0, y: o.rotation.y ?? 0, z: o.rotation.z ?? 0 };
      if (o.size) out.size = Object.assign({}, o.size);
      else if (o.mesh && o.mesh.scale) out.size = { x: o.mesh.scale.x, y: o.mesh.scale.y, z: o.mesh.scale.z };
      if (out._convertedToCenter !== undefined) delete out._convertedToCenter;
      if (typeof o.hp === 'number') out.hp = o.hp;
      if (o.coverType) out.coverType = o.coverType;
      if (o.type) out.type = out.type ?? o.type;
      return out;
    } catch (e) {
      // fallback to synthesized def below
      console.warn('Failed to clone _sceneDef', e);
    }
  }

  const out = {};
  out.id = o.id || null;
  // type: prefer explicit, then mesh userData
  out.type = o.type || (o.mesh && o.mesh.userData && o.mesh.userData.type) || 'prop';
  if (livePos) out.position = livePos;
  else if (o.position && o.position.x !== undefined) out.position = { x: o.position.x, y: o.position.y, z: o.position.z };
  if (liveRot) out.rotation = liveRot;
  else if (o.rotation && o.rotation.y !== undefined) out.rotation = { x: o.rotation.x ?? 0, y: o.rotation.y ?? 0, z: o.rotation.z ?? 0 };
  if (o.size) out.size = Object.assign({}, o.size);
  if (typeof o.hp === 'number') out.hp = o.hp;
  if (o.coverType) out.coverType = o.coverType;
  // material/texture info not available for editor-spawned objects; leave out if missing
  return out;
}

function _cleanEnemy(e, existingDefsById) {
  const out = {};
  out.id = e.id || (`enemy_${Date.now()}`);
  // attempt to find original def in existing sceneDef.enemies
  if (existingDefsById && existingDefsById[out.id] && existingDefsById[out.id].type) {
    out.type = existingDefsById[out.id].type;
  } else {
    // fall back to display type or generic
    out.type = e._defType || e.type || 'Unknown';
  }
  if (e.position && typeof e.position.x === 'number') out.position = { x: e.position.x, y: e.position.y, z: e.position.z };
  if (typeof e.facing === 'number') out.facing = e.facing;
  if (typeof e.hp === 'number') out.hp = e.hp;
  if (e.coverIndex !== undefined) out.coverIndex = e.coverIndex;
  if (e.coverObjectId) out.coverObject = e.coverObjectId;
  return out;
}

function exportSceneToJS() {
  if (!window.sceneLoader) { console.warn('No sceneLoader'); return; }
  const sl = window.sceneLoader;

  // Compose camera def
  const cam = { position: _serializeVector3(camera.position) };
  try {
    const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
    const lookAt = camera.position.clone().add(forward.multiplyScalar(10));
    cam.lookAt = _serializeVector3(lookAt);
    if (camera.isPerspectiveCamera) { cam.fov = camera.fov; cam.near = camera.near; cam.far = camera.far; }
  } catch (e) {}

  // Lights: Rebuild lights list from staticObjects (editor wrappers) + existing sceneDef lights that weren't wrapped
  let lights = [];
  const processedLightIds = new Set();

  // 1. Lights from editor (staticObjects with type 'light')
  (Array.isArray(sl.staticObjects) ? sl.staticObjects : []).forEach(o => {
      if (o.type === 'light') {
          // Filter out temporary/debug lights
          if (o.light && (o.light.userData.temporary || o.light.userData.debug)) return;
          if (o.userData && (o.userData.temporary || o.userData.debug)) return;

          lights.push(_cleanLightObject(o));
          if (o.id) processedLightIds.add(o.id);
      }
  });

  // 2. Existing lights from sceneDef that weren't edited/wrapped (if any)
  if (Array.isArray(sl.sceneDef?.lights)) {
      sl.sceneDef.lights.forEach(ld => {
          // Filter out temporary/debug lights from defs
          if (ld.userData && (ld.userData.temporary || ld.userData.debug)) return;

          if (!processedLightIds.has(ld.id)) {
              lights.push(ld);
          }
      });
  }

  // Static objects
  const staticObjects = [];
  (Array.isArray(sl.staticObjects) ? sl.staticObjects : []).forEach(o => {
    if (o.type === 'light') return; // Skip lights, handled above
    try { staticObjects.push(_cleanStaticObject(o)); } catch (e) { console.warn('clean static obj failed', e); }
  });

  // Props (include as staticObjects if not already present)
  (Array.isArray(sl.props) ? sl.props : []).forEach(p => {
    const exists = staticObjects.find(s => s.id && p.id && s.id === p.id);
    if (!exists) staticObjects.push(_cleanStaticObject(p));
  });

  // Enemies: start from sceneDef.enemies then add other runtime enemies
  const enemiesOut = [];
  const existingDefsById = {};
  if (Array.isArray(sl.sceneDef?.enemies)) {
    sl.sceneDef.enemies.forEach(ed => { existingDefsById[ed.id] = ed; enemiesOut.push(ed); });
  }
  (Array.isArray(sl.enemies) ? sl.enemies : []).forEach(en => {
    if (existingDefsById[en.id]) return; // already included
    enemiesOut.push(_cleanEnemy(en, existingDefsById));
  });

  const sceneObj = {
    name: `Exported Scene ${new Date().toISOString()}`,
    camera: cam,
    lights: lights,
    environment: { staticObjects },
    enemies: enemiesOut
  };

    const jsonStr = JSON.stringify(sceneObj, null, 2);
    const jsObjLiteral = jsonStr.replace(/"([A-Za-z0-9_]+)"\s*:/g, '$1:');
    const jsText = 'export const Scene_Exported = ' + jsObjLiteral + ';\n';
  const blob = new Blob([jsText], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scene_export_${Date.now()}.js`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  console.log('Scene exported to file');
}

// Bind F6 to export when in editor mode (prevent browser reload)
window.addEventListener('keydown', (e) => {
  if (e.code === 'F6' && window.engine?.isEditorMode) {
    e.preventDefault();
    exportSceneToJS();
  }
});


const {
  renderer,
  composer,
  renderQualityState,
  applyRenderQualityProfile,
  handleResize: resizeRenderPipeline
} = createRenderPipeline({
  THREE,
  canvas,
  scene,
  camera,
  width: cw,
  height: ch
});

window.engine = window.engine || {};
window.engine.renderer = renderer;
configureKtx2ForRenderer(renderer);

window.setRenderQuality = function(quality = 'medium') {
  applyRenderQualityProfile(quality);
};

applyEditorRenderPerformanceMode = (isEditorMode) => {
  try {
    if (isEditorMode) {
      renderQualityState.previousBeforeEditor = renderQualityState.current;
      applyRenderQualityProfile('low');
    } else {
      applyRenderQualityProfile(renderQualityState.previousBeforeEditor || 'medium');
    }
  } catch (err) {
    console.warn('applyEditorRenderPerformanceMode failed', err);
  }
};

function resize() {
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
  resizeRenderPipeline(cw, ch);
}
window.addEventListener('resize', resize);

function vec3Snapshot(v) {
  if (!v) return null;
  return {
    x: Number(v.x.toFixed(4)),
    y: Number(v.y.toFixed(4)),
    z: Number(v.z.toFixed(4))
  };
}

const { crashReporter, runtimeCrashState, stopLoopAndReport } = setupCrashRuntime({
  canvas,
  renderer,
  camera,
  scene,
  vec3Snapshot,
  getPlayer: () => player,
  getIsFPSMode: () => isFPSMode,
  getEnemyCount: () => ENEMY_INSTANCES.length,
  getPlayerProjectilesCount: () => projectiles.length,
  getEnemyProjectilesCount: () => enemyProjectiles.length,
  getDisplayedRet: () => displayedRet,
  logDebug
});

// ------------------ Editor Grid (visual + snapping) ------------------
window.engine = window.engine || {};
window.engine.editorGrid = window.engine.editorGrid || { sizes: [0, 1, 0.5, 0.25], index: 0, size: 0, helper: null, worldSize: 200 };
const MAX_EDITOR_GRID_DIVISIONS = 200;

function _snapToGridValue(v, spacing) {
  if (!spacing || spacing <= 0) return v;
  return Math.round(v / spacing) * spacing;
}

function snapVector3ToEditorGrid(vec) {
  const g = window.engine?.editorGrid;
  if (!g || !g.size) return;
  vec.x = _snapToGridValue(vec.x, g.size);
  vec.y = _snapToGridValue(vec.y, g.size);
  vec.z = _snapToGridValue(vec.z, g.size);
}

window.updateEditorGrid = function() {
  const g = window.engine?.editorGrid;
  if (!g) return;
  try {
    // Remove existing helpers
    if (g.helpers && Array.isArray(g.helpers)) {
      for (const h of g.helpers) {
        try { scene.remove(h); } catch (e) {}
        try { if (h.geometry) h.geometry.dispose(); } catch (e) {}
        try {
          if (h.material) {
            if (Array.isArray(h.material)) h.material.forEach(m => { try { m.dispose(); } catch(_){} });
            else h.material.dispose();
          }
        } catch (e) {}
      }
    }
    g.helpers = [];

    if (!g.size || g.size <= 0) return; // grid OFF

    const world = g.worldSize || 200;
    const requestedDivisions = Math.max(2, Math.round(world / g.size));
    const divisions = Math.min(requestedDivisions, MAX_EDITOR_GRID_DIVISIONS);
    crashReporter.addBreadcrumb('editor_grid_rebuild', {
      isEditorMode: !!window.engine?.isEditorMode,
      size: g.size,
      world,
      requestedDivisions,
      divisions,
      helperCountBefore: Array.isArray(g.helpers) ? g.helpers.length : 0,
      estimatedLinesPerHelper: (divisions + 1) * 4
    });

    const gridColor = 0x9fb8a1;
    const centerLineColor = 0x6f8f72;
    const grid = new THREE.GridHelper(world, divisions, centerLineColor, gridColor);
    grid.position.y = 0.5; // raised up 0.5 units as requested
    // Keep depth testing on so the grid does not overdraw the entire frame.
    try {
      if (Array.isArray(grid.material)) {
        grid.material.forEach(m => {
          m.transparent = false;
          m.depthTest = true;
          m.depthWrite = false;
        });
      } else {
        grid.material.transparent = false;
        grid.material.depthTest = true;
        grid.material.depthWrite = false;
      }
    } catch (e) {}
    scene.add(grid);
    g.helpers.push(grid);
  } catch (e) { console.warn('updateEditorGrid failed', e); }
};



// ------------------ Reticle Tracking ------------------

// ------------------ Raycaster ------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Editor selection state
window.selectedObject = null; // editor:selected wrapper (prop/static/light)

function _clearHighlight(obj) {
  try {
    if (!obj) return;
    if (obj._editorHighlight) {
      if (obj._editorHighlight.parent) obj._editorHighlight.parent.remove(obj._editorHighlight);
      obj._editorHighlight = null;
    }
  } catch (e) { console.warn('clearHighlight failed', e); }
}

function _applyHighlight(obj) {
  if (!obj || !obj.mesh) return;
  _clearHighlight(window.selectedObject);
  try {
    const helper = new THREE.BoxHelper(obj.mesh, 0xffff00);
    helper.material.linewidth = 2;
    scene.add(helper);
    obj._editorHighlight = helper;
  } catch (e) { console.warn('applyHighlight failed', e); }
}

function selectObjectFromCenter() {
  if (!window.engine?.isEditorMode) return null;
  if (!window.sceneLoader) return null;
  const ndc = new THREE.Vector2(0, 0);
  raycaster.setFromCamera(ndc, camera);
  const meshes = window.sceneLoader.getIntersectableMeshes();
  const intersects = raycaster.intersectObjects(meshes, true);
  if (!intersects || intersects.length === 0) {
    // clear selection
    _clearHighlight(window.selectedObject);
    window.selectedObject = null;
    logDebug('Editor: selection cleared');
    return null;
  }

  // find nearest meaningful wrapper
  for (const it of intersects) {
    let obj = it.object;
    while (obj && obj.userData && !obj.userData.propId && !obj.userData.enemyId && !obj.userData.type && !obj.userData.isDoor) {
      obj = obj.parent;
    }
    if (!obj) continue;

    let wrapper = null;
    if (obj.userData && obj.userData.propId) {
      wrapper = window.sceneLoader.propsById?.[obj.userData.propId] || window.sceneLoader.staticObjects.find(o => o.id === obj.userData.propId) || null;
    } else if (obj.userData && obj.userData.isDoor) {
      // Legacy doors may only expose isDoor on the hinge/group.
      wrapper = window.sceneLoader.props.find(p => p && p.mesh && (p.mesh === obj || p.mesh === obj.parent)) || null;
    } else if (obj.userData && obj.userData.type) {
      // room or other
      wrapper = window.sceneLoader.staticObjects.find(o => o.mesh === obj || o.id === obj.userData.id) || null;
    }

    if (!wrapper) {
      // as a fallback, attempt to match by mesh reference
      wrapper = window.sceneLoader.staticObjects.find(o => o.mesh === obj) || null;
    }

    if (wrapper) {
      // select this
      _clearHighlight(window.selectedObject);
      window.selectedObject = wrapper;
      _applyHighlight(wrapper);
      const pos = _getAuthoredPositionForObject(wrapper) || wrapper.position || { x: 0, y: 0, z: 0 };
      const type = wrapper.type || wrapper.mesh?.userData?.type || 'unknown';
      const id = wrapper.id || wrapper.mesh?.userData?.propId || '(no-id)';
      logDebug(`Selected: id=${id}, type=${type}, pos=${pos.x},${pos.y},${pos.z}`);
      console.log('Selected object:', { id, type, position: pos, wrapper });
    try { if (window.speak) window.speak(`Object ${id} selected`, { interrupt: true }); } catch(e){}
      return wrapper;
    }
  }

  // nothing matched
  _clearHighlight(window.selectedObject);
  window.selectedObject = null;
  logDebug('Editor: no selectable object under reticle');
  return null;
}

// -----------------------------
// JSON Editor for selected object
// -----------------------------
editorJsonModalRuntime = setupEditorJsonModal({
  THREE,
  cleanStaticObject: _cleanStaticObject,
  cleanLightObject: _cleanLightObject,
  authoredToRuntimePosition: _authoredToRuntimePosition,
  syncWrapperAuthoredPositionFromMesh: _syncWrapperAuthoredPositionFromMesh
});

// ------------------ Scene / Level management ------------------
const { loadLevel, nextScene } = setupSceneRuntime({
  SceneLoader,
  SceneManager,
  scene,
  camera,
  player,
  renderer,
  Level_Warehouse,
  ALL_SCENES,
  fpsState,
  setPlayerStandingHeight: (value) => { playerStandingHeight = value; },
  logDebug
});

function enemyFireProjectile(enemy, playerPos, projectileSpeed = 25) {
  // Use accuracy->cone conversion and sample inside cone. When accuracy==1.0
  // the half-angle becomes zero and the resulting direction is exactly the forward vector
  const acc = enemy.accuracy ?? 0.6;
  const origin = enemy.mesh.position.clone();
  const trueDir = playerPos.clone().sub(origin).normalize();
  const halfAngle = accuracyToConeHalfAngleRad(acc);
  const deviatedDir = sampleDirectionInCone(trueDir, halfAngle);

  // Create visual mesh like player bullets
  const geo = new THREE.SphereGeometry(0.02, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // red for enemies
  const bullet = new THREE.Mesh(geo, mat);
  bullet.position.copy(origin);
  bullet.userData = {
    direction: deviatedDir.clone(),
    bornTime: performance.now(),
    damage: 1
    ,projectileType: 'bullet'
  };
  scene.add(bullet);
  enemyProjectiles.push(bullet);
}

window.addEventListener("keydown", (e) => {
    if (e.code === "KeyK") { // press K to kill all enemies
        killAllEnemies();
    }
});
// Generate directions for a weapon shot.
// For single-projectile weapons we apply accuracy -> cone sampling only.
// For shotguns (multiple pellets with non-zero `projectileSpread`) we apply
// the accuracy cone once (base aim) and then sample each pellet inside the pellet spread cone.
function generateSpreadDirections(forwardDir, numProjectiles, spreadDeg = 0, weaponAccuracy = 1.0) {
  return ballistics.generateSpreadDirections(forwardDir, numProjectiles, spreadDeg, weaponAccuracy);
}


function spawnProjectile(origin, direction, damage = 1) {
    // Capsule geometry: radius, length, capSegments, radialSegments
    const geo = new THREE.CapsuleGeometry(0.02, 0.12, 4, 8); 
    geo.rotateX(Math.PI / 2); // point along +Z axis (matches forward direction)

    // Material
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    const bullet = new THREE.Mesh(geo, mat);
    bullet.position.copy(origin);

    // Orient the capsule to the direction of travel
    bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());

    bullet.userData = {
        direction: direction.clone().normalize(),
        bornTime: performance.now(),
        damage: damage,
        trail: null // placeholder for motion trail
      ,projectileType: 'bullet'
    };

    // Optional: create a simple motion trail
    const trailLength = 0.1; // length of line behind bullet
    const trailGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -trailLength)
    ]);
    const trailMat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 });
    const trail = new THREE.Line(trailGeo, trailMat);
    bullet.add(trail);
    bullet.userData.trail = trail;

    scene.add(bullet);
    projectiles.push(bullet);
}

// ------------------ Input: Desktop simulation (mouse/keyboard) ------------------
attachDesktopSimulation({
  logDebug,
  sendDesktopPayload,
  triggerReload,
  getIsFPSMode: () => isFPSMode,
  getIsFiring: () => isFiring,
  setIsFiring: (next) => {
    isFiring = !!next;
  }
});


// ------------------ Fire / Reload functions ------------------
// ------------------ Reticle Accuracy Projection (WORLD-CORRECT) ------------------
const updateDynamicReticle = createDynamicReticleUpdater({
  THREE,
  clampAccuracy,
  accuracyToConeHalfAngleRad,
  minReticleRadiusPx: MIN_RETICLE_RADIUS_PX,
  maxReticleRadiusPct: MAX_RETICLE_RADIUS_PCT,
  getRet: () => ret,
  getPlayer: () => player
});

// left mouse down firing (canvas click) - only attach one handler
canvas.removeEventListener('mousedown', triggerFireWrapper, false); // safe to call even if not attached
function triggerFireWrapper(e) {
  if (e.button === 0) triggerFire();
}
canvas.addEventListener('mousedown', triggerFireWrapper, false);

// ------------------ Duck & Zoom (from input controller state) ------------------

// ------------------ Reticle smoothing & render loop ------------------
const LERP = 0.9;
let lastMs = performance.now();

let frameSpikeCount = 0;
const MAX_FRAME_SPIKES = 5;       // consecutive slow frames to trigger stop
const FRAME_THRESHOLD = 100;      // ms per frame = 10 FPS
const MAX_SCENE_CHILDREN = 800;   // scene object limit for failsafe

function animate(nowMs) {
  if (runtimeCrashState.stopped) return;

  try {
    // --- Failsafe: frame time monitoring ---
    const deltaMs = nowMs - lastMs;
    lastMs = nowMs;

    if (deltaMs > FRAME_THRESHOLD) frameSpikeCount++;
    else frameSpikeCount = 0;

    if (frameSpikeCount >= MAX_FRAME_SPIKES) {
      stopLoopAndReport(
        'failsafe_frame_spikes',
        new Error('Consecutive slow frames threshold reached'),
        { deltaMs, frameSpikeCount, thresholdMs: FRAME_THRESHOLD, maxFrameSpikes: MAX_FRAME_SPIKES }
      );
      return;
    }

    // --- Failsafe: scene object limit ---
    if (scene.children.length > MAX_SCENE_CHILDREN) {
      stopLoopAndReport(
        'failsafe_scene_children_limit',
        new Error('Scene object count limit reached'),
        { sceneChildren: scene.children.length, maxSceneChildren: MAX_SCENE_CHILDREN }
      );
      return;
    }

    requestAnimationFrame(animate); // call next frame
    // --- FPS Mode Movement ---
    if (isFPSMode) {
      const moveSpeed = fpsState.speed * (deltaMs / 1000);
      // Flatten movement vectors to XZ plane so WASD doesn't change height
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      right.y = 0;
      right.normalize();

      if (fpsState.keys.w) camera.position.addScaledVector(forward, moveSpeed);
      if (fpsState.keys.s) camera.position.addScaledVector(forward, -moveSpeed);
      if (fpsState.keys.a) camera.position.addScaledVector(right, -moveSpeed);
      if (fpsState.keys.d) camera.position.addScaledVector(right, moveSpeed);
      if (fpsState.keys.q) camera.position.y += moveSpeed; // ascend
      if (fpsState.keys.z) camera.position.y -= moveSpeed; // descend
    }

    // --- Reticle Smoothing ---
    if (!isFPSMode) {
      displayedRet.x += (ret.x - displayedRet.x) * LERP_SPEED;
      displayedRet.y += (ret.y - displayedRet.y) * LERP_SPEED;
      if (reticleDiv) {
        reticleDiv.style.left = `${displayedRet.x}px`;
        reticleDiv.style.top = `${displayedRet.y}px`;
      }
    } else {
      // In FPS mode, reticle is always centered
      displayedRet.x = cw / 2;
      displayedRet.y = ch / 2;
      if (reticleDiv) {
        reticleDiv.style.left = `${cw / 2}px`;
        reticleDiv.style.top = `${ch / 2}px`;
      }
    }

    // --- Ducking/Zooming ---
    if (!isFPSMode) {
      const targetY = inputController.state.ducking ? (playerStandingHeight - 0.5) : playerStandingHeight;
      camera.position.y += (targetY - camera.position.y) * 0.1;
    }
    const targetFov = inputController.state.zoomed ? 30 : 60;
    camera.fov += (targetFov - camera.fov) * 0.1;
    camera.updateProjectionMatrix();

    // Update enemy animation mixers (advance three.js AnimationMixers)
    try {
      const deltaSec = deltaMs / 1000;
      ENEMY_INSTANCES.forEach(e => { if (e.mixer) try { e.mixer.update(deltaSec); } catch(_){} });
      try { if (window.weaponManager && typeof window.weaponManager.update === 'function') window.weaponManager.update(deltaSec); } catch(_) {}
      // Debug: once per second, log first enemy hip quaternion to verify animations
      try {
        if (!window._debug_last_bone_log) window._debug_last_bone_log = 0;
        if (nowMs - window._debug_last_bone_log > 1000) {
          window._debug_last_bone_log = nowMs;
          const en = ENEMY_INSTANCES[0];
          if (en && en.mesh) {
            let hip = null;
            try { hip = (en.mesh.skeleton && en.mesh.skeleton.bones) ? en.mesh.skeleton.bones.find(b => /hip/i.test(b.name)) : en.mesh.getObjectByName && en.mesh.getObjectByName('mixamorig9Hips'); } catch(_) { hip = null; }
            if (hip) {
              try { console.log('[DEBUG] hip quat:', hip.quaternion.toArray().map(n=>n.toFixed(4)).join(',')); } catch(_) {}
            }
          }
        }
      } catch (e) {}
    } catch (e) {}

    // Update HUD
    if (window.hud) window.hud.update(deltaMs / 1000);

    // Update Scene (enemies, etc)
    if (window.sceneLoader) window.sceneLoader.update(deltaMs, nowMs);

    // Update Scene Manager (Transitions)
    if (window.sceneManager) window.sceneManager.update(deltaMs);

    // Update projectiles
    updateProjectiles(deltaMs);
    updateEnemyProjectiles(deltaMs);

    // Update sparks
    updateSparks(deltaMs / 1000);
    updateSmokeParticles(deltaMs);

    // Update auto-fire
    updateAutoFire(nowMs);

    // Update player arm/recoil
    if (player) {
        if (typeof player.updateArm === 'function') player.updateArm(deltaMs);
        if (typeof player.updateRecoil === 'function') player.updateRecoil(deltaMs);
    }

    // Update reticle
    if (player && player.currentWeapon) {
        updateDynamicReticle({
            camera: camera,
            weapon: player.currentWeapon
        });
    }

    // Render
    composer.render();

    // Keep rolling frame diagnostics so the crash report has lead-up context.
    crashReporter.noteFrame({
      nowMs: Number(nowMs.toFixed(3)),
      deltaMs: Number(deltaMs.toFixed(3)),
      sceneChildren: scene.children.length,
      frameSpikeCount,
      enemyCount: ENEMY_INSTANCES.length,
      playerProjectiles: projectiles.length,
      enemyProjectiles: enemyProjectiles.length,
      renderCalls: renderer.info?.render?.calls ?? null,
      renderTriangles: renderer.info?.render?.triangles ?? null,
      renderPoints: renderer.info?.render?.points ?? null,
      renderLines: renderer.info?.render?.lines ?? null,
      geometries: renderer.info?.memory?.geometries ?? null,
      textures: renderer.info?.memory?.textures ?? null,
      cameraPos: vec3Snapshot(camera.position)
    });
  } catch (err) {
    stopLoopAndReport('animate_exception', err, {
      lastNowMs: nowMs,
      sceneChildren: scene.children.length,
      enemyCount: ENEMY_INSTANCES.length,
      playerProjectiles: projectiles.length,
      enemyProjectiles: enemyProjectiles.length
    });
  }
}

// Start the first level immediately
loadLevel(Level_Warehouse);

requestAnimationFrame(animate); 