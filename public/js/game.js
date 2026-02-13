// js/game.js
// This file is written as an ES module. Include it as:
// <script type="module" src="js/game.js"></script>
import { SceneManager } from './sceneManager.js';
import { EnemyVoiceManager } from "./EnemyVoiceManager.js";

import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/SSAOPass.js';
import { FXAAShader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/shaders/FXAAShader.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/postprocessing/ShaderPass.js';

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

function setEditorMode(enabled) {
  window.engine.isEditorMode = !!enabled;
  if (window.engine.isEditorMode) {
    // disable enemy AI and combat, enable free FPS movement
    try { setEnemyAIEnabled(false); } catch(_) {}
    isFPSMode = true;
    window.engine.disableCombat = true;
    console.log('[EDITOR] Editor mode ENABLED');
    try { if (window.speak) window.speak('Editor mode on', { interrupt: true }); } catch(e){}
    toggleLightHelpers(true);
  } else {
    try { setEnemyAIEnabled(true); } catch(_) {}
    window.engine.disableCombat = false;
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
            lightType: light.isDirectionalLight ? 'directional' : (light.isSpotLight ? 'spot' : (light.isHemisphereLight ? 'hemisphere' : 'point')),
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

// will be created after camera is initialized
export let player = null;


// Example usage:
setTimeout(() => player.takeDamage(30), 2000);
setTimeout(() => player.useAmmo(1), 2500);
setTimeout(() => player.reload(), 4000);

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

// Helper: clamp accuracy to allowed domain [0.01, 1.0]
function clampAccuracy(a) {
  return THREE.MathUtils.clamp(a ?? 1.0, 0.01, 1.0);
}

// Convert accuracy -> full cone angle (radians). Uses explicit constant above.
// inaccuracy = 1.0 - accuracy; coneAngleFull = inaccuracy * MAX_CONE_ANGLE_DEG
function accuracyToConeHalfAngleRad(accuracy) {
  const acc = clampAccuracy(accuracy);
  const inaccuracy = 1.0 - acc;
  const coneFullDeg = inaccuracy * MAX_CONE_ANGLE_DEG;
  // half-angle in radians for sampling spherical-cap
  return THREE.MathUtils.degToRad(coneFullDeg * 0.5);
}

// Sample a random direction uniformly inside a cone (spherical cap) around `forward`.
// If accuracy == 1.0 the halfAngle will be zero and this returns the forward vector
function sampleDirectionInCone(forward, halfAngleRad) {
  const forwardN = forward.clone().normalize();
  if (halfAngleRad <= 0) return forwardN.clone();

  // Build orthonormal basis
  let right = new THREE.Vector3().crossVectors(forwardN, new THREE.Vector3(0, 1, 0)).normalize();
  if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  const up = new THREE.Vector3().crossVectors(right, forwardN).normalize();

  // Uniform spherical-cap sampling
  const u = Math.random();
  const v = Math.random();
  const cosTheta = 1 - u * (1 - Math.cos(halfAngleRad));
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = 2 * Math.PI * v;

  const sample = forwardN.clone().multiplyScalar(cosTheta)
    .add(right.clone().multiplyScalar(Math.cos(phi) * sinTheta))
    .add(up.clone().multiplyScalar(Math.sin(phi) * sinTheta))
    .normalize();

  return sample;
}

// Generate pellet directions for shotguns: final pellet direction = accuracy cone + pellet spread cone
function generateShotgunPelletDirections(forwardDir, numPellets, weaponAccuracy, pelletSpreadDeg) {
  const directions = [];
  // Base aim direction is sampled once from the accuracy cone
  const accHalf = accuracyToConeHalfAngleRad(weaponAccuracy);
  const baseDir = sampleDirectionInCone(forwardDir, accHalf);

  const pelletHalfRad = THREE.MathUtils.degToRad(pelletSpreadDeg ?? 0) * 0.5;

  for (let i = 0; i < numPellets; i++) {
    // Each pellet is sampled inside the pellet spread cone around the base direction
    const pelletDir = sampleDirectionInCone(baseDir, pelletHalfRad);
    directions.push(pelletDir);
  }

  return directions;
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


function sendDesktopPayload(overrides = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = {
        x: (ret.x / cw) * 2 - 1,
        y: (ret.y / ch) * 2 - 1,
        alpha: 0,
        beta: 0,
        gamma: 0,
        fire: isFiring,
        reload: false,
        calibrate: false,
        ...overrides
    };

    ws.send(JSON.stringify({ type: "controller", payload }));
}

// WebSocket setup (unchanged)
// Use secure WS when page is HTTPS, otherwise plain WS.
const WS_URL = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + window.location.hostname + ':8080';
const ws = new WebSocket(WS_URL);
ws.onopen = () => { connStatus && (connStatus.textContent = 'WS: connected'); ws.send(JSON.stringify({ type:'register', client:'game' })); };
ws.onclose = () => { connStatus && (connStatus.textContent = 'WS: disconnected'); };
ws.onerror = (e) => { connStatus && (connStatus.textContent = 'WS: error'); console.error(e); };
ws.onmessage = (ev) => {
  try {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'registered') { logDebug(`WS registered ${msg.client}`); return; }
    if (msg.type === 'controller') {
      const p = msg.payload;
      // p.x and p.y are normalized -1..1 from controller
      // In FPS mode ignore controller positional updates; keep fire/reload commands
      if (!isFPSMode) {
        ret.x = ((p.x+1)/2)*cw;
        ret.y = ((p.y+1)/2)*ch;
      }
      if (retXY) retXY.textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
      if (abc) abc.textContent = `${p.alpha?.toFixed(1) ?? ''}, ${p.beta?.toFixed(1) ?? ''}, ${p.gamma?.toFixed(1) ?? ''}`;
      // Handle firing with edge detection so semi-auto fires once per press
      const pFire = !!p.fire;
      const w = player?.currentWeapon;
      if (pFire && !window._lastControllerFire) {
        // rising edge: single-shot for semi-auto, start continuous for auto
        if (w) w._dryFirePlayed = false;
        if (w && w.fireMode === 'semi-auto') {
          triggerFire();
        } else {
          isFiring = true;
        }
      } else if (!pFire && window._lastControllerFire) {
        // falling edge: stop auto fire
        isFiring = false;
      }
      window._lastControllerFire = pFire;

      if (p.reload) triggerReload();
    }
  } catch (e) {
    console.warn("ws message parse failed", e);
  }
};

// Send current weapon info to controller so it can play weapon sounds locally
function sendWeaponInfo() {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const w = player?.currentWeapon;
    if (!w) return;
    const payload = {
      currentWeapon: {
        id: w.id,
        name: w.name,
        fireSound: w.fireSound,
        reloadSound: w.reloadSound,
        fireMode: w.fireMode
      }
    };
    ws.send(JSON.stringify({ type: 'game', payload }));
    console.log('Sent weapon info to controller', payload);
  } catch (e) { console.warn('sendWeaponInfo failed', e); }
}

// Send initial weapon info on connect + when player's ammo/weapon changes
ws.addEventListener('open', () => { setTimeout(sendWeaponInfo, 200); });
if (player && player.addEventListener) player.addEventListener('ammoChanged', sendWeaponInfo);

// ------------------ Three.js Setup ------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, cw / ch, 0.1, 200);
camera.position.set(0, 1.7, 5);
camera.lookAt(0, 1.7, 0);
// expose camera globally for modules that expect it
window.camera = camera;
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
  .loadWeapons({
    pistol: 'assets/models/weapons/pistol.glb',
    shotgun: 'assets/models/weapons/shotgun.glb',
    assaultRifle: 'assets/models/weapons/assault_rifle.glb'
  })
  .then(() => {
    weaponManager.registerWeaponOrder(['pistol','shotgun','assaultRifle']);
    weaponManager.equipWeapon('pistol'); // now it will appear
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


// -----------------------------------------------------
// DEBUG FREE CAMERA (WASD + QE + Arrow keys)
// -----------------------------------------------------
const camSpeed = 0.1;
const camRotSpeed = 0.02;

window.addEventListener(
  "pointerdown",
  () => {
    if (window.enemyVoiceManager?.listener?.context.state !== "running") {
      window.enemyVoiceManager.listener.context.resume();
      console.log("[AUDIO] AudioContext resumed");
    }
  },
  { once: true }
);

window.addEventListener("wheel", e => {
  const direction = e.deltaY > 0 ? 1 : -1;
  if (player && typeof player.cycleWeapon === 'function') player.cycleWeapon(direction);
});

// Toggle FPS mode with Tab: pointer lock + mouse look. Press Tab again to exit.
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    isFPSMode = !isFPSMode;
    if (isFPSMode) {
      // enter FPS: center reticle and request pointer lock
      ret.x = cw / 2; ret.y = ch / 2;
      try { canvas.requestPointerLock(); } catch(_) {}
      document.body.style.cursor = 'none';
      fpsState.yaw = camera.rotation.y; fpsState.pitch = camera.rotation.x;
    } else {
      try { if (document.exitPointerLock) document.exitPointerLock(); } catch(_) {}
      document.body.style.cursor = 'auto';
    }
  }
});

// Pointer lock change handler: if pointer lock leaves unexpectedly, disable FPS mode
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && isFPSMode) {
    isFPSMode = false;
    document.body.style.cursor = 'auto';
  }
});

// Mouse look when pointer locked (FPS mode)
document.addEventListener('mousemove', (e) => {
  if (!isFPSMode) return;
  if (document.pointerLockElement !== canvas) return;
  fpsState.yaw -= e.movementX * fpsState.mouseSensitivity;
  fpsState.pitch -= e.movementY * fpsState.mouseSensitivity;
  // clamp pitch to avoid flipping
  const maxPitch = Math.PI / 2 - 0.01;
  fpsState.pitch = Math.max(-maxPitch, Math.min(maxPitch, fpsState.pitch));
  camera.rotation.set(fpsState.pitch, fpsState.yaw, 0, 'YXZ');
});

// Key state for continuous movement in FPS mode
document.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  // movement keys: WASD, Q (ascend), Z (descend), X (snap to ground)
  if (e.code === 'KeyX') {
    if (isFPSMode) camera.position.y = 1.7; // snap to ground height
    return;
  }
  // When FPS enabled, intercept movement keys
  if (isFPSMode) {
    switch (e.code) {
      case 'KeyW': fpsState.keys.w = true; break;
      case 'KeyS': fpsState.keys.s = true; break;
      case 'KeyA': fpsState.keys.a = true; break;
      case 'KeyD': fpsState.keys.d = true; break;
      case 'KeyQ': fpsState.keys.q = true; break; // ascend
      case 'KeyZ': fpsState.keys.z = true; break; // descend
    }
  }
});
document.addEventListener('keyup', (e) => {
  if (isFPSMode) {
    switch (e.code) {
      case 'KeyW': fpsState.keys.w = false; break;
      case 'KeyS': fpsState.keys.s = false; break;
      case 'KeyA': fpsState.keys.a = false; break;
      case 'KeyD': fpsState.keys.d = false; break;
      case 'KeyQ': fpsState.keys.q = false; break;
      case 'KeyZ': fpsState.keys.z = false; break;
    }
  }
});

// =========================
// Mouse Auto-Fire
// =========================
window.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
        isFiring = true;
        if (player?.currentWeapon) player.currentWeapon._dryFirePlayed = false;
        sendDesktopPayload({ fire: true });
    }
});

window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
        isFiring = false;
        sendDesktopPayload({ fire: false });
    }
});

window.addEventListener("mouseleave", () => {
    isFiring = false;
    sendDesktopPayload({ fire: false });
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
// Toggle Editor Mode (F2)
window.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  if (e.code === 'F2') {
    setEditorMode(!window.engine.isEditorMode);
    logDebug(`Editor mode: ${window.engine.isEditorMode ? 'ON' : 'OFF'}`);
  }
});

// Editor spawn key bindings
window.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  if (!window.engine?.isEditorMode) return;
  if (e.code === 'Digit1') { e.preventDefault(); spawnEditorObject('wall'); }
  else if (e.code === 'Digit2') { e.preventDefault(); spawnEditorObject('door'); }
  else if (e.code === 'Digit3') { e.preventDefault(); showLightPicker(); }
  else if (e.code === 'Digit4') { e.preventDefault(); spawnEditorObject('crate'); }
});

// Cycle editor grid with G (Off -> 1 -> 0.5 -> 0.25)
window.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  if (!window.engine?.isEditorMode) return;
  if (e.code === 'KeyG') {
    e.preventDefault();
    const g = window.engine.editorGrid = window.engine.editorGrid || { sizes: [0,1,0.5,0.25], index: 0, size: 0 };
    g.index = (g.index + 1) % g.sizes.length;
    g.size = g.sizes[g.index];
    try { window.updateEditorGrid(); } catch (err) {}
    logDebug(`Editor grid: ${g.size === 0 ? 'OFF' : g.size}`);
  }
});

// Selection binding: press E to raycast from camera center and select nearest object
window.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  if (!window.engine?.isEditorMode) return;
  if (e.code === 'KeyE') {
    e.preventDefault();
    selectObjectFromCenter();
  }
});

// Open JSON editor for selected object with T (works even if other handlers exist)
window.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  if (!window.engine?.isEditorMode) return;
  if (e.code === 'KeyT') {
    e.preventDefault();
    console.log('KeyT pressed - attempting to open JSON editor');
    openEditSelectedJSON();
  }
});

// Editor manipulation: move, rotate, delete selected object via keyboard
window.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  if (!window.engine?.isEditorMode) return;
  if (!window.selectedObject) return;

  // Determine step size
  // Determine step size: use editor grid size as base when active, otherwise 0.1
  let baseStep = 0.1;
  try { const gs = window.engine?.editorGrid?.size; if (gs && gs > 0) baseStep = gs; } catch (e) {}
  let step = baseStep;
  if (e.shiftKey) step = baseStep / 10;
  else if (e.ctrlKey) step = baseStep / 100;

  const obj = window.selectedObject;
  const mesh = obj.mesh;
  if (!mesh) return;

  let moved = false;

  switch (e.code) {
    case 'ArrowUp':
      mesh.position.z -= step; moved = true; e.preventDefault(); break;
    case 'ArrowDown':
      mesh.position.z += step; moved = true; e.preventDefault(); break;
    case 'ArrowLeft':
      mesh.position.x -= step; moved = true; e.preventDefault(); break;
    case 'ArrowRight':
      mesh.position.x += step; moved = true; e.preventDefault(); break;
    case 'PageUp':
      mesh.position.y += step; moved = true; e.preventDefault(); break;
    case 'PageDown':
      mesh.position.y -= step; moved = true; e.preventDefault(); break;
    case 'KeyR':
      // rotate Y by 90 degrees
      mesh.rotation.y += Math.PI / 2; moved = true; e.preventDefault(); break;
    case 'Delete':
    case 'Backspace':
      // delete selected object
      try {
        // remove mesh from scene
        if (mesh.parent) mesh.parent.remove(mesh);

        // remove from sceneLoader lists if present
        const sl = window.sceneLoader;
        if (sl) {
          // props
          const pidx = sl.props.findIndex(p => p === obj || p.id === obj.id);
          if (pidx >= 0) { const p = sl.props.splice(pidx,1)[0]; if (p.id) delete sl.propsById[p.id]; }
          // staticObjects
          const sidx = sl.staticObjects.findIndex(s => s === obj || s.id === obj.id);
          if (sidx >= 0) sl.staticObjects.splice(sidx,1);
          // also remove from sceneDef.environment.staticObjects if present
          try {
            if (sl.sceneDef && sl.sceneDef.environment && Array.isArray(sl.sceneDef.environment.staticObjects)) {
              const aidx = sl.sceneDef.environment.staticObjects.findIndex(s => s && ((s.id && obj.id && s.id === obj.id) || s === obj));
              if (aidx >= 0) sl.sceneDef.environment.staticObjects.splice(aidx,1);
            }
            if (obj.light && sl.sceneDef && Array.isArray(sl.sceneDef.lights)) {
              const lidx = sl.sceneDef.lights.findIndex(l => l && l.id && obj.id && l.id === obj.id);
              if (lidx >= 0) sl.sceneDef.lights.splice(lidx,1);
            }
          } catch(e) {}
          // sceneLights
          if (obj.light) {
            const li = sl.sceneLights.indexOf(obj.light);
            if (li >= 0) sl.sceneLights.splice(li,1);
          }
        }

        // clear highlight and selection
        _clearHighlight(window.selectedObject);
        window.selectedObject = null;
        logDebug('Editor: object deleted');
      } catch (err) { console.warn('Delete failed', err); }
      e.preventDefault();
      return;
  }

  if (moved) {
    // Snap to editor grid if active
    try {
      if (window.engine?.editorGrid?.size) snapVector3ToEditorGrid(mesh.position);
    } catch (e) {}

    // sync wrapper position fields if present
    try {
      if (obj.position) {
        obj.position.x = mesh.position.x;
        obj.position.y = mesh.position.y;
        obj.position.z = mesh.position.z;
      } else {
        obj.position = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
      }
      // rotation store in degrees for easier scene export
      if (obj.rotation) {
        obj.rotation.x = mesh.rotation.x;
        obj.rotation.y = mesh.rotation.y;
        obj.rotation.z = mesh.rotation.z;
      } else {
        obj.rotation = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
      }
      if (obj.size && mesh.geometry && mesh.geometry.parameters) {
        // attempt to keep size in sync for box geometries
        const p = mesh.geometry.parameters;
        if (p.width !== undefined) obj.size.x = p.width * mesh.scale.x;
        if (p.height !== undefined) obj.size.y = p.height * mesh.scale.y;
        if (p.depth !== undefined) obj.size.z = p.depth * mesh.scale.z;
      }
      if (obj._editorHighlight) obj._editorHighlight.update();
      logDebug(`Editor: moved/rotated ${obj.id || '(no-id)'} -> ${mesh.position.x.toFixed(3)},${mesh.position.y.toFixed(3)},${mesh.position.z.toFixed(3)}`);
    } catch (e) { console.warn('sync after move failed', e); }
    e.preventDefault();
  }
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
        if (target === 'x') sel.mesh.position.x = n;
        else if (target === 'y') sel.mesh.position.y = n;
        else if (target === 'z') sel.mesh.position.z = n;
        else return console.warn('Unknown position axis');

        // sync wrapper position
        if (sel.position) {
          sel.position.x = sel.mesh.position.x;
          sel.position.y = sel.mesh.position.y;
          sel.position.z = sel.mesh.position.z;
        } else {
          sel.position = { x: sel.mesh.position.x, y: sel.mesh.position.y, z: sel.mesh.position.z };
        }

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
        
		// Movement
        document.addEventListener('keydown', (e) => {
      if (isFPSMode) return; // don't run debug free-camera keys while FPS mode active
    switch(e.key.toLowerCase()) {
        case 'w': // forward
            camera.position.z -= camSpeed;
            break;
        case 's': // backward
            camera.position.z += camSpeed;
            break;
        case 'a': // left
            camera.position.x -= camSpeed;
            break;
        case 'd': // right
            camera.position.x += camSpeed;
            break;
        case 'q': // down
            camera.position.y -= camSpeed;
            break;
        case 'e': // up
            camera.position.y += camSpeed;
            break;
        case 'arrowleft':
            camera.rotation.y += camRotSpeed;
            break;
        case 'arrowright':
            camera.rotation.y -= camRotSpeed;
            break;
        case 'arrowup':
            camera.rotation.x += camRotSpeed;
            break;
        case 'arrowdown':
            camera.rotation.x -= camRotSpeed;
            break;
    }
});




// ========================
// Reload Key (R) With Rules
// ========================
let lastReloadPressMs = 0;
const RELOAD_COOLDOWN_MS = 500; // half-second cooldown

document.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  if (e.key.toLowerCase() !== 'r') return;

    const now = performance.now();
    if (now - lastReloadPressMs < RELOAD_COOLDOWN_MS) {
        return; // Prevent reload spam
    }

    const w = player?.currentWeapon;
    if (!w) return;
    if (w.isReloading) return;

    // Only reload if ammoInClip < clipSize
    if (w.ammoInClip < w.clipSize) {
        lastReloadPressMs = now;
        triggerReload();
    } else {
        // Optional: debug log to show reload is blocked
        logDebug("Reload ignored: clip full.");
    }
});

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
  // If a stored raw scene definition exists, prefer it (preserves arbitrary keys)
  if (o && o._sceneDef && typeof o._sceneDef === 'object') {
    try {
      const out = JSON.parse(JSON.stringify(o._sceneDef)); // deep clone to avoid mutation
      // Ensure id exists
      out.id = out.id ?? (o.id || null);
      // Overlay runtime transforms so exported data matches live scene
      if (o.position && o.position.x !== undefined) out.position = { x: o.position.x, y: o.position.y, z: o.position.z };
      else if (o.mesh && o.mesh.position) out.position = _serializeVector3(o.mesh.position);
      if (o.rotation && o.rotation.x !== undefined) out.rotation = { x: o.rotation.x ?? 0, y: o.rotation.y ?? 0, z: o.rotation.z ?? 0 };
      else if (o.mesh && o.mesh.rotation) out.rotation = { x: o.mesh.rotation.x, y: o.mesh.rotation.y, z: o.mesh.rotation.z };
      if (o.size) out.size = Object.assign({}, o.size);
      else if (o.mesh && o.mesh.scale) out.size = { x: o.mesh.scale.x, y: o.mesh.scale.y, z: o.mesh.scale.z };
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
  if (o.position && o.position.x !== undefined) out.position = { x: o.position.x, y: o.position.y, z: o.position.z };
  else if (o.mesh && o.mesh.position) out.position = _serializeVector3(o.mesh.position);
  if (o.rotation && o.rotation.y !== undefined) out.rotation = { x: o.rotation.x ?? 0, y: o.rotation.y ?? 0, z: o.rotation.z ?? 0 };
  else if (o.mesh && o.mesh.rotation) out.rotation = { x: o.mesh.rotation.x, y: o.mesh.rotation.y, z: o.mesh.rotation.z };
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
          lights.push(_cleanLightObject(o));
          if (o.id) processedLightIds.add(o.id);
      }
  });

  // 2. Existing lights from sceneDef that weren't edited/wrapped (if any)
  if (Array.isArray(sl.sceneDef?.lights)) {
      sl.sceneDef.lights.forEach(ld => {
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


const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(cw, ch);
renderer.physicallyCorrectLights = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 1);
scene.background = new THREE.Color(0x000000);

// --- Post-processing ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.4, 0.85);
composer.addPass(bloomPass);

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 16;
composer.addPass(ssaoPass);

const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
composer.addPass(fxaaPass);

function resize() {
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
    renderer.setSize(cw, ch);
    composer.setSize(cw, ch);
    fxaaPass.material.uniforms['resolution'].value.set(1 / cw, 1 / ch);
    ssaoPass.setSize(cw, ch);
}
window.addEventListener('resize', resize);

// ------------------ Editor Grid (visual + snapping) ------------------
window.engine = window.engine || {};
window.engine.editorGrid = window.engine.editorGrid || { sizes: [0, 1, 0.5, 0.25], index: 0, size: 0, helper: null, worldSize: 200 };

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
    const divisions = Math.max(2, Math.round(world / g.size));

    // Create three overlaid grid helpers with different colors for contrast
    const colors = [0x000000, 0xffffff, 0xffff00];
    const opacities = [0.6, 0.95, 0.95];
    for (let i = 0; i < colors.length; i++) {
      const col = colors[i];
      const grid = new THREE.GridHelper(world, divisions, col, col);
      grid.position.y = 0.5; // raised up 0.5 units as requested
      grid.renderOrder = 9999 + i;
      // Ensure visibility and layered rendering
      try {
        if (Array.isArray(grid.material)) {
          grid.material.forEach(m => { m.opacity = opacities[i]; m.transparent = true; m.depthTest = false; });
        } else {
          grid.material.opacity = opacities[i]; grid.material.transparent = true; grid.material.depthTest = false;
        }
      } catch (e) {}
      scene.add(grid);
      g.helpers.push(grid);
    }
  } catch (e) { console.warn('updateEditorGrid failed', e); }
};



// ------------------ Reticle Tracking ------------------
let ret = { x: cw/2, y: ch/2 };         // target position from controller (pixels)
let displayedRet = { x: cw/2, y: ch/2 }; // smoothed position shown on screen
const LERP_SPEED = 0.9;

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
    while (obj && obj.userData && !obj.userData.propId && !obj.userData.enemyId && !obj.userData.type) {
      obj = obj.parent;
    }
    if (!obj) continue;

    let wrapper = null;
    if (obj.userData && obj.userData.propId) {
      wrapper = window.sceneLoader.propsById?.[obj.userData.propId] || window.sceneLoader.staticObjects.find(o => o.id === obj.userData.propId) || null;
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
      const pos = wrapper.mesh && wrapper.mesh.position ? wrapper.mesh.position : wrapper.position || { x: 0, y: 0, z: 0 };
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
function _getEditableDefForSelected() {
  const sel = window._editorModalTarget || window.selectedObject;
  const oldSize = sel && sel.size ? { x: sel.size.x, y: sel.size.y, z: sel.size.z } : null;
  if (!sel) return null;
  try {
    // Use existing helper to produce a clean static object definition when possible
    const def = _cleanStaticObject(sel);
    // include extra known properties if present
    if (sel.hp !== undefined) def.hp = sel.hp;
    if (sel.coverType) def.coverType = sel.coverType;
    if (sel.type) def.type = sel.type;
    if (sel.type === 'light') {
        // Use the specialized cleaner for lights to get full properties
        return _cleanLightObject(sel);
    }
    if (sel.size) def.size = Object.assign({}, sel.size);
    return def;
  } catch (e) {
    return { id: sel.id || null, type: sel.type || null };
  }
}

// Format an object as a JavaScript object literal string
function _formatAsJsLiteral(obj, indent = 4, level = 0) {
  const pad = (n) => ' '.repeat(n);
  const cur = pad(level * indent);
  const next = pad((level + 1) * indent);

  if (obj === null) return 'null';
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(it => {
      if (typeof it === 'object') return _formatAsJsLiteral(it, indent, level + 1);
      return typeof it === 'string' ? JSON.stringify(it) : String(it);
    }).map(s => next + s).join(',\n');
    return '[\n' + items + '\n' + cur + ']';
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    const lines = keys.map(k => {
      const v = obj[k];
      let valStr;
      if (typeof v === 'object') valStr = _formatAsJsLiteral(v, indent, level + 1);
      else if (typeof v === 'string') valStr = JSON.stringify(v);
      else valStr = String(v);
      return next + k + ': ' + valStr;
    });
    return '{\n' + lines.join(',\n') + '\n' + cur + '}';
  }

  if (typeof obj === 'string') return JSON.stringify(obj);
  return String(obj);
}

function openEditSelectedJSON() {
  if (!window.engine?.isEditorMode) return;
  const sel = window._editorModalTarget || window.selectedObject;
  const oldSize = sel && sel.size ? { x: sel.size.x, y: sel.size.y, z: sel.size.z } : null;
  if (!sel) { alert('No object selected'); return; }
  console.log('openEditSelectedJSON called for', sel && (sel.id || sel.mesh && sel.mesh.userData && sel.mesh.userData.propId));
  const modal = document.getElementById('jsonEditModal');
  const ta = document.getElementById('jsonEditInput');
  const title = document.getElementById('jsonEditTitle');
  const errs = document.getElementById('jsonEditErrors');
  // accessibility: save focus, hide background from AT, announce
  window._lastFocusedBeforeModal = document.activeElement;
  // hide all body children except modal from assistive tech
  Array.from(document.body.children).forEach(ch => { if (ch.id !== 'jsonEditModal') ch.setAttribute('aria-hidden', 'true'); });
  errs.textContent = '';
  const def = _getEditableDefForSelected();
  title.textContent = `Edit Object JSON - ${def.id || '(no-id)'} `;
  try { ta.value = _formatAsJsLiteral(def, 4); } catch(e){ ta.value = '{}'; }
  modal.style.display = 'flex';
  // ensure focus goes to input and NVDA is aware
  setTimeout(() => { try { ta.focus(); ta.setSelectionRange(0,0); } catch(e){} }, 50);

  // install focus trap
  _installModalFocusTrap(modal);
  // mark modal open and remember selected object to ensure apply targets it
  window._editorModalOpen = true;
  window._editorModalTarget = sel;
}

function closeEditModal() {
  const modal = document.getElementById('jsonEditModal');
  modal.style.display = 'none';
  // restore aria-hidden on body children
  Array.from(document.body.children).forEach(ch => { if (ch.id !== 'jsonEditModal') ch.removeAttribute('aria-hidden'); });
  // remove focus trap
  _removeModalFocusTrap();
  // restore focus
  try { if (window._lastFocusedBeforeModal && typeof window._lastFocusedBeforeModal.focus === 'function') window._lastFocusedBeforeModal.focus(); } catch(e){}
  // clear modal flags
  window._editorModalOpen = false;
  window._editorModalTarget = null;
}

// Focus trap helpers
function _installModalFocusTrap(modal) {
  if (!modal) return;
  // ensure we only install once
  if (modal._focusTrapInstalled) return;
  modal._focusTrapInstalled = true;
  modal._focusHandler = function(e) {
    if (e.key !== 'Tab') return;
    const focusable = modal.querySelectorAll('button, [href], textarea, input, select, [tabindex]:not([tabindex="-1"])');
    const list = Array.from(focusable).filter(el => !el.hasAttribute('disabled'));
    if (list.length === 0) { e.preventDefault(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', modal._focusHandler);
}

function _removeModalFocusTrap() {
  const modal = document.getElementById('jsonEditModal');
  if (!modal || !modal._focusTrapInstalled) return;
  document.removeEventListener('keydown', modal._focusHandler);
  modal._focusTrapInstalled = false;
  modal._focusHandler = null;
}

function _validateEditedDef(obj, sel) {
  const errors = [];
  if (typeof obj !== 'object' || obj === null) { errors.push('Top-level JSON must be an object'); return errors; }

  // Allow arbitrary properties for static props; only validate types when present

  if (obj.position) {
    ['x','y','z'].forEach(k => { if (obj.position[k] === undefined || typeof obj.position[k] !== 'number') errors.push(`position.${k} must be a number`); });
  }
  if (obj.rotation) {
    ['x','y','z'].forEach(k => { if (obj.rotation[k] === undefined || typeof obj.rotation[k] !== 'number') errors.push(`rotation.${k} must be a number`); });
  }
  if (obj.scale) {
    ['x','y','z'].forEach(k => { if (obj.scale[k] === undefined || typeof obj.scale[k] !== 'number') errors.push(`scale.${k} must be a number`); });
  }
  if (obj.size) {
    ['x','y','z'].forEach(k => { if (obj.size[k] === undefined || typeof obj.size[k] !== 'number') errors.push(`size.${k} must be a number`); });
  }
  if (obj.hitSounds && !Array.isArray(obj.hitSounds)) errors.push('hitSounds must be an array of sound paths');
  if (obj.texture && typeof obj.texture !== 'string') errors.push('texture must be a string path');
  return errors;
}

function applyEditedJSON() {
  const ta = document.getElementById('jsonEditInput');
  const errsHost = document.getElementById('jsonEditErrors');
  errsHost.textContent = '';
  let parsed;
  const raw = ta.value;
  // Try JSON.parse first (handles strict JSON)
  try {
    parsed = JSON.parse(raw);
  } catch (e1) {
    // Try converting JS-style unquoted keys to quoted keys for JSON.parse
    try {
      const quoted = raw.replace(/([\{,\n\r\s])([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
      parsed = JSON.parse(quoted);
    } catch (e2) {
      // Last resort: attempt to evaluate as JS expression (object literal)
      try {
        // Use Function to evaluate in local scope safely-ish
        // Wrap in parentheses so object literal parses correctly
        parsed = Function('"use strict"; return (' + raw + ')')();
      } catch (e3) {
        errsHost.textContent = 'JSON parse error: ' + e1.message + ' — fallback parse failed: ' + (e2 && e2.message ? e2.message : (e3 && e3.message ? e3.message : 'invalid input'));
        try { if (window.speak) window.speak('JSON parse error', { interrupt: true }); } catch(e){}
        return;
      }
    }
  }
  const sel = window._editorModalTarget || window.selectedObject;
  const oldSize = sel && sel.size ? { x: sel.size.x, y: sel.size.y, z: sel.size.z } : null;
  const errors = _validateEditedDef(parsed, sel);
  if (errors.length) {
    errsHost.innerHTML = errors.map(s => `- ${s}`).join('<br>');
    try { if (window.speak) window.speak('Errors found, changes not applied', { interrupt: true }); } catch(e){}
    return;
  }

  // apply to selected object
  if (!sel) { errsHost.textContent = 'No selected object'; return; }

  // Store raw user-edited definition on the runtime wrapper so unknown keys are preserved
  try { sel._sceneDef = parsed; } catch (e) { /* ignore */ }

  // update id mapping if changed
  const oldId = sel.id;
  if (parsed.id && parsed.id !== oldId) {
    sel.id = parsed.id;
    const sl = window.sceneLoader;
    try {
      if (sl) {
        if (sl.propsById && oldId && sl.propsById[oldId]) { delete sl.propsById[oldId]; sl.propsById[sel.id] = sel; }
        if (sl.enemiesById && oldId && sl.enemiesById[oldId]) { delete sl.enemiesById[oldId]; sl.enemiesById[sel.id] = sel; }
      }
    } catch (e) { /* ignore */ }
  }

  // reflect parsed values into runtime fields (but keep arbitrary keys inside _sceneDef)
  try {
    // transforms
    if (sel.mesh) {
      if (parsed.position) sel.mesh.position.set(parsed.position.x, parsed.position.y, parsed.position.z);
      if (parsed.rotation) sel.mesh.rotation.set(parsed.rotation.x, parsed.rotation.y, parsed.rotation.z);
      if (parsed.size) {
        try {
          const ms = sel.mesh.scale || { x: 1, y: 1, z: 1 };
          if (oldSize && oldSize.x && oldSize.y && oldSize.z) {
            const fx = parsed.size.x / oldSize.x;
            const fy = parsed.size.y / oldSize.y;
            const fz = parsed.size.z / oldSize.z;
            sel.mesh.scale.set((ms.x || 1) * fx, (ms.y || 1) * fy, (ms.z || 1) * fz);
          } else {
            sel.mesh.scale.set(parsed.size.x, parsed.size.y, parsed.size.z);
          }
        } catch (e) {}
        sel.size = parsed.size;
      }
      if (parsed.scale) sel.mesh.scale.set(parsed.scale.x, parsed.scale.y, parsed.scale.z);

      // ensure userData updated for id/propId/type
      if (!sel.mesh.userData) sel.mesh.userData = {};
      if (sel.id) sel.mesh.userData.propId = sel.id;
      if (sel.type || parsed.type) sel.mesh.userData.type = parsed.type ?? sel.type;

      // texture
      if (parsed.texture && typeof parsed.texture === 'string') {
        try {
          const loader = new THREE.TextureLoader();
          const tex = loader.load(parsed.texture, () => { try { if (sel.mesh && sel.mesh.material) { sel.mesh.material.map = tex; sel.mesh.material.needsUpdate = true; } } catch(e){} });
        } catch (e) { console.warn('Failed to load texture', e); }
      }

      // hit sounds
      if (parsed.hitSounds && Array.isArray(parsed.hitSounds)) {
        sel.hitSounds = parsed.hitSounds.slice();
      }

      // common runtime props
      if (parsed.hp !== undefined) sel.hp = parsed.hp;
      if (parsed.maxHp !== undefined) sel.maxHp = parsed.maxHp;
      if (parsed.indestructible !== undefined) sel.indestructible = !!parsed.indestructible;
    } else {
      if (parsed.position) sel.position = parsed.position;
      if (parsed.rotation) sel.rotation = parsed.rotation;
    }

    // Lights: update light object if present
    if (sel.light || (sel.type === 'light' && sel.mesh)) {
      const light = sel.light || (sel.mesh && sel.mesh.children && sel.mesh.children.find(c => c.isLight));
      const holder = sel.mesh || null;
      if (holder && parsed.position) {
        holder.position.set(parsed.position.x, parsed.position.y, parsed.position.z);
      }
      if (light) {
        if (parsed.color !== undefined) {
          try { if (typeof parsed.color === 'number') light.color.setHex(parsed.color); else light.color.set(parsed.color); } catch(e){}
        }
        if (parsed.intensity !== undefined) light.intensity = parsed.intensity;
        if (parsed.distance !== undefined) light.distance = parsed.distance;
        if (parsed.decay !== undefined) light.decay = parsed.decay;
        if (parsed.angle !== undefined) light.angle = parsed.angle;
        if (parsed.penumbra !== undefined) light.penumbra = parsed.penumbra;
        if (parsed.castShadow !== undefined) light.castShadow = !!parsed.castShadow;
        
        // Hemisphere specific
        if (light.isHemisphereLight) {
             if (parsed.groundColor !== undefined) {
                 try { if (typeof parsed.groundColor === 'number') light.groundColor.setHex(parsed.groundColor); else light.groundColor.set(parsed.groundColor); } catch(e){}
             }
             if (parsed.skyColor !== undefined) {
                 try { if (typeof parsed.skyColor === 'number') light.color.setHex(parsed.skyColor); else light.color.set(parsed.skyColor); } catch(e){}
             }
        }
      }
    }
  } catch (e) {
    errsHost.textContent = 'Failed to apply transforms: ' + e.message;
    return;
  }

  // reflect updated raw def into scene-level sceneDef if present (so file -> editor round-trip preserved)
  try {
    const sl = window.sceneLoader;
    if (sl && sl.sceneDef && sl.sceneDef.environment && Array.isArray(sl.sceneDef.environment.staticObjects)) {
      const arr = sl.sceneDef.environment.staticObjects;
      const idx = arr.findIndex(o => (o && o.id && sel.id && o.id === sel.id) || (o === sel));
      if (idx >= 0) {
        arr[idx] = JSON.parse(JSON.stringify(parsed));
      } else {
        arr.push(JSON.parse(JSON.stringify(parsed)));
      }
    }

    // If editing a light and sceneDef.lights exists, update or append
    if (sl && sel && (sel.type === 'light' || sel.light) && sl.sceneDef && Array.isArray(sl.sceneDef.lights)) {
      const lids = sl.sceneDef.lights;
      const li = lids.findIndex(l => l && l.id && sel.id && l.id === sel.id);
      if (li >= 0) lids[li] = JSON.parse(JSON.stringify(parsed));
      else lids.push(JSON.parse(JSON.stringify(parsed)));
    }

    // reflect in the sceneLoader staticObjects array
    if (sl && Array.isArray(sl.staticObjects)) {
      const idx2 = sl.staticObjects.findIndex(o => o === sel || (o.id && sel.id && o.id === sel.id));
      if (idx2 >= 0) sl.staticObjects[idx2] = sel;
    }
  } catch (e) {}

  // success
  try { if (window.speak) window.speak('Changes applied', { interrupt: true }); } catch(e){}
  closeEditModal();
}

// Hook up modal buttons and keyboard
document.addEventListener('DOMContentLoaded', () => {
  const cancel = document.getElementById('jsonEditCancel');
  const submit = document.getElementById('jsonEditSubmit');
  const modal = document.getElementById('jsonEditModal');
  const ta = document.getElementById('jsonEditInput');
  if (cancel) cancel.addEventListener('click', () => closeEditModal());
  if (submit) submit.addEventListener('click', () => applyEditedJSON());
  // ESC closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEditModal();
    // open editor with T when in editor mode and selection exists
    if (e.key.toLowerCase() === 't' && window.engine?.isEditorMode) {
      // prevent typing into textarea from re-opening modal
      if (document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) return;
      e.preventDefault();
      openEditSelectedJSON();
    }
  });
  // Note: Enter should create a newline in the textarea. Apply only via the Apply button.
});

// ------------------ Scene / Level management ------------------

  // Load using SceneManager for on-rails intro/exit
// ------------------ Scene / Level management ------------------
window.sceneLoader = new SceneLoader(scene, camera, player);
// Expose spawn helper and enemy list for console testing


let currentLevel = Level_Warehouse;
let currentSceneIndex = 0;
window.sceneManager = new SceneManager(camera, sceneLoader);

// Debug helper: load a scene by its name from the browser console.
// Usage: loadSceneByName("Scene Name")
window.loadSceneByName = async function(name) {
  if (!name) {
    console.warn('Usage: loadSceneByName("Scene Name")');
    return;
  }
  if (!window.sceneManager) {
    console.warn('sceneManager not available');
    return;
  }

  const matchName = (s) => s && s.name && s.name.toLowerCase() === name.toLowerCase();

  // Try current level first
  let target = currentLevel?.scenes?.find(matchName);
  let levelFound = currentLevel;

  // Fallback: try known level `Level_Warehouse`
  if (!target && typeof Level_Warehouse !== 'undefined') {
    target = Level_Warehouse.scenes?.find(matchName);
    if (target) levelFound = Level_Warehouse;
  }

  // Fallback: try any levels exposed on window.ALL_LEVELS (optional)
  if (!target && window.ALL_LEVELS && Array.isArray(window.ALL_LEVELS)) {
    for (const lv of window.ALL_LEVELS) {
      target = lv.scenes?.find(matchName);
      if (target) { levelFound = lv; break; }
    }
  }

  if (!target) {
    console.warn(`Scene not found: ${name}`);
    return;
  }

  // Set current level/index so `nextScene()` works as expected
  currentLevel = levelFound;
  currentSceneIndex = currentLevel.scenes.indexOf(target);

  console.log(`Loading scene '${target.name}' (index ${currentSceneIndex}) from level '${currentLevel.name || 'unknown'}'`);
  await window.sceneManager.loadScene(target);
};

// --- Scene picker UI (F3) --------------------------------------------------
// Creates an overlay select element populated from `ALL_SCENES`.
(function installScenePicker() {
  if (typeof document === 'undefined') return;

  const overlay = document.createElement('div');
  overlay.id = 'scene-picker-overlay';
  overlay.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:#fff;padding:12px;border-radius:8px;z-index:9999;display:none;min-width:320px;';

  const label = document.createElement('div');
  label.textContent = 'Select scene (Enter to load, Esc to close)';
  label.style.marginBottom = '8px';
  overlay.appendChild(label);

  const sel = document.createElement('select');
  sel.id = 'scene-picker-select';
  sel.style.width = '100%';
  sel.style.fontSize = '14px';
  sel.size = 8; // show multiple rows
  overlay.appendChild(sel);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px';
  hint.style.opacity = '0.8';
  hint.textContent = `Scenes: ${ALL_SCENES.length}`;
  overlay.appendChild(hint);

  document.body.appendChild(overlay);

  function populate() {
    sel.innerHTML = '';
    ALL_SCENES.forEach((entry, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = entry.scene.name || entry.id || (`Scene ${i}`);
      sel.appendChild(opt);
    });
    hint.textContent = `Scenes: ${ALL_SCENES.length}`;
  }

  function show() {
    populate();
    overlay.style.display = 'block';
    sel.focus();
    // select first if none selected
    if (sel.selectedIndex < 0) sel.selectedIndex = 0;
  }

  function hide() {
    overlay.style.display = 'none';
  }

  // Toggle on F3, close on Esc
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      if (overlay.style.display === 'block') hide();
      else show();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (overlay.style.display === 'block') { hide(); e.preventDefault(); }
    } else if (e.key === 'Enter') {
      if (overlay.style.display === 'block' && document.activeElement === sel) {
        const idx = Number(sel.value || sel.selectedIndex || 0);
        const entry = ALL_SCENES[idx];
        if (entry && entry.scene) {
          // set currentLevel/currentSceneIndex so nextScene behaves reasonably
          currentLevel = { name: '(single)', scenes: [entry.scene] };
          currentSceneIndex = 0;
          window.sceneManager.loadScene(entry.scene);
        }
        hide();
        e.preventDefault();
      }
    }
  }, true);

  // Double-click or double-press Enter loads too
  sel.addEventListener('dblclick', () => {
    const idx = Number(sel.value || sel.selectedIndex || 0);
    const entry = ALL_SCENES[idx];
    if (entry && entry.scene) {
      currentLevel = { name: '(single)', scenes: [entry.scene] };
      currentSceneIndex = 0;
      window.sceneManager.loadScene(entry.scene);
    }
    hide();
  });

})();

function loadLevel(level) {
    currentLevel = level;
    currentSceneIndex = 0;
    loadSceneIndex(currentSceneIndex);
}

async function loadSceneIndex(index) {
    if (!currentLevel?.scenes) return;
    if (index < 0 || index >= currentLevel.scenes.length) return;

    const sceneObj = currentLevel.scenes[index];

    await window.sceneManager.loadScene(sceneObj);

    logDebug(`Scene complete: ${sceneObj.name}`);
}

function nextScene() {
    const next = currentSceneIndex + 1;
    if (next < currentLevel.scenes.length) {
        currentSceneIndex = next;
        loadSceneIndex(currentSceneIndex);
    } else {
        logDebug(`Level ${currentLevel.name} complete.`);
        window.dispatchEvent(new CustomEvent("levelComplete", { detail: { level: currentLevel } }));
    }
}

// Hook sceneLoaded event to announce
window.addEventListener("sceneLoaded", (e) => {
  logDebug(`sceneLoaded: ${e.detail.scene.name}`);
  // Sync player height and FPS state to the new scene camera
  playerStandingHeight = camera.position.y;
  fpsState.yaw = camera.rotation.y;
  fpsState.pitch = camera.rotation.x;
});

// Hook enemyDied event for info
window.addEventListener("enemyDied", (e) => {
  logDebug(`enemyDied: ${e.detail.id}`);
});

// Hook enemyFiredHitPlayer
window.addEventListener("enemyFiredHitPlayer", (e) => {
  const dmg = e.detail.damage || 1;
  if (player && typeof player.takeDamage === "function") player.takeDamage(dmg);
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
  const acc = clampAccuracy(weaponAccuracy);

  // Single projectile: accuracy drives the cone. No shotgun logic.
  if (numProjectiles <= 1) {
    const half = accuracyToConeHalfAngleRad(acc);
    // If accuracy == 1.0 half==0 and this returns forward exactly (deterministic)
    return [sampleDirectionInCone(forwardDir, half)];
  }

  // Multiple projectiles: if spreadDeg > 0 treat as shotgun (pellet spread)
  if (numProjectiles > 1 && (spreadDeg ?? 0) > 0) {
    return generateShotgunPelletDirections(forwardDir, numProjectiles, acc, spreadDeg);
  }

  // Otherwise: multiple projectiles but no shotgun spread -> each projectile is affected by accuracy cone individually
  const half = accuracyToConeHalfAngleRad(acc);
  const dirs = [];
  for (let i = 0; i < numProjectiles; i++) {
    dirs.push(sampleDirectionInCone(forwardDir, half));
  }
  return dirs;
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
(function setupDesktopControls() {
    logDebug("Desktop control simulation ON");

    let lastX = 0;
    let lastY = 0;

    // Desktop → WS payload sender
    function sendDesktopPayload(overrides = {}) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const payload = {
            x: lastX,
            y: lastY,
            alpha: 0,
            beta: 0,
            gamma: 0,
            fire: isFiring,
            reload: false,
            calibrate: false,
            ...overrides
        };

        ws.send(JSON.stringify({ type: "controller", payload }));
    }   // <--- CORRECT CLOSING BRACE


    // ------------------------------
    // MOUSE MOVEMENT
    // ------------------------------
    window.addEventListener("mousemove", (e) => {
      if (isFPSMode) return; // ignore desktop mouse while in FPS mode
      lastX = (e.clientX / window.innerWidth) * 2 - 1;
      lastY = (e.clientY / window.innerHeight) * 2 - 1;
      sendDesktopPayload();   // keep fire state
    });


    // ------------------------------
    // LEFT CLICK → FIRE
    // ------------------------------
    window.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isFiring = true;
        sendDesktopPayload({ fire: true });
    });

    window.addEventListener("mouseup", (e) => {
        if (e.button !== 0) return;
        isFiring = false;
        sendDesktopPayload({ fire: false });
    });


    // ------------------------------
    // RIGHT CLICK = RELOAD
    // ------------------------------
    window.addEventListener("contextmenu", (e) => {
        e.preventDefault();

        try {
            const reloadSound = new Audio("sounds/reload.ogg");
            reloadSound.currentTime = 0;
            reloadSound.play().catch(() => {});
        } catch (_) {}

        sendDesktopPayload({ reload: true });
        triggerReload();
    });

})();   // <--- CORRECT CLOSING OF IIFE


let lastFireMs = 0;

function handleFire() {
  const w = player?.currentWeapon;
  if (!w || !isFiring) return;

    const now = performance.now();

    // Initialize lastShotTime if missing
    if (typeof w.lastShotTime !== "number") w.lastShotTime = 0;

    const elapsed = now - w.lastShotTime;

    // Enforce rate of fire
    if (elapsed < (w.rateOfFire || 100)) return;

    // --- Semi-auto logic ---
    if (w.fireMode === "semi-auto") {
        if (!w._semiAutoReady) return; // already fired this trigger
        w._semiAutoReady = false;      // block until next trigger
    }

    // --- Ammo check ---
    if (!(player && player.useAmmo && player.useAmmo(1))) {
        if (w.isReloading) return;

        if (w.fireMode === 'auto') {
            if (w._dryFirePlayed) return;
            w._dryFirePlayed = true;
        }

        logDebug("No ammo!");
        try { new Audio('sounds/click.ogg').play().catch(() => {}); } catch(e) {}
        return;
    }

    w.lastShotTime = now;

    // --- Compute shooting direction ---
    const retNDC = new THREE.Vector2(
      (ret.x / cw) * 2 - 1,
      -(ret.y / ch) * 2 + 1
    );
    raycaster.setFromCamera(retNDC, camera);

    // 1. Find target point in world space (what we are aiming at)
    const intersectables = window.sceneLoader ? window.sceneLoader.getIntersectableMeshes() : [];
    const hits = raycaster.intersectObjects(intersectables, true);
    const targetPoint = (hits.length > 0) ? hits[0].point : raycaster.ray.at(100, new THREE.Vector3());

    // 2. Determine shoot origin (muzzle)
    let shootOrigin = window.weaponManager ? window.weaponManager.getMuzzlePosition(w.id) : null;
    if (!shootOrigin) {
        // Fallback to camera relative if no weapon model/muzzle found
        const muzzleOffset = new THREE.Vector3(0, -0.35, -0.6);
        shootOrigin = camera.position.clone().add(muzzleOffset.applyQuaternion(camera.quaternion));
    }

    // 3. Determine direction from muzzle to target
    const forwardDir = new THREE.Vector3().subVectors(targetPoint, shootOrigin).normalize();

    // --- Generate spread directions ---
    // Factor player recoil into weapon accuracy: recoilPx reduces effective accuracy.
    const recoilInfluence = Math.min(0.9, (player.recoilPx || 0) / (Math.min(window.innerWidth, window.innerHeight) * 0.5));
    const effectiveAcc = clampAccuracy((w.accuracy ?? 1.0) - recoilInfluence);
    const dirs = generateSpreadDirections(forwardDir, w.projectilesPerShot || 1, w.projectileSpread || 0, effectiveAcc);

    for (const dir of dirs) {
        spawnProjectileUnified(shootOrigin, dir, {
            damage: w.damage || 1,
            color: w.color ?? 0xffff00,
            speed: w.projectileSpeed ?? PROJECTILE_SPEED,
            size: w.projectileSize ?? 0.02,
            lifetime: w.projectileLifetime ?? PROJECTILE_LIFETIME,
        projectileType: w.projectileType ?? "bullet",
            explosive: w.explosive ?? false,
            trail: true,
            isEnemy: false
        });
    }

    // --- Play weapon-specific sound ---
    try {
      let _skipLocal = false;
      if (window.weaponManager && typeof window.weaponManager.triggerFire === 'function') {
        try { window.weaponManager.triggerFire({ soundDelayMs: 0, muzzleFlash: true }); } catch(e) { console.warn('weaponManager.triggerFire failed', e); }
        const wmEntry = window.weaponManager.weapons && window.weaponManager.weapons[w.id];
        if (wmEntry && wmEntry.audio && wmEntry.audio.buffer) _skipLocal = true;
      }
      if (!_skipLocal && w.fireSound) {
        const snd = new Audio(w.fireSound);
        snd.currentTime = 0;
        snd.play().catch(() => {});
      }
    } catch (e) { console.warn('play fire sound failed', e); }

    // Debug: log the shot
    // console.log(`Fired ${w.name} at ${now}`);
}


// ------------------ Fire / Reload functions ------------------
function triggerReload() {
   const w = player?.currentWeapon;
   if (w && w.isReloading) return;
   const soundPath = (w && w.reloadSound) ? w.reloadSound : 'sounds/reload.ogg';

   try { const reloadSound = new Audio(soundPath); reloadSound.currentTime = 0; reloadSound.play().catch(()=>{}); } catch(e){}
    
  if (player && typeof player.reload === 'function') player.reload();
  try { if (window.weaponManager && typeof window.weaponManager.triggerReload === 'function') window.weaponManager.triggerReload(); } catch(e) { console.warn('weaponManager.triggerReload failed', e); }
  logDebug("Player reloaded"); 
}


function updateAutoFire(nowMs) {
  const w = player?.currentWeapon;
  if (!w) return;

    if (w.fireMode === "auto") {
        if (!isFiring) return;

        const elapsed = nowMs - lastPlayerFireMs;
        if (elapsed >= w.rateOfFire) {
            triggerFire();
        }
    }
}

// In your game loop or input handler
let firingInterval = null;

function startFiring(player) {
  const weapon = player.currentWeapon;
  if (!weapon) return;

  // Only start if auto-fire
  if (weapon.fireMode === "auto" && !firingInterval) {
    firingInterval = setInterval(() => {
      const now = performance.now();
      if (now - weapon.lastShotTime >= weapon.rateOfFire) {
        if (player.useAmmo(1)) {
          weapon.lastShotTime = now;
          // trigger firing effect, e.g., spawn bullets, play sound
        } else {
          stopFiring();
        }
      }
    }, 10); // check every 10ms
  } else if (weapon.fireMode === "semi-auto") {
    // For semi-auto, just fire once
    if (player.useAmmo(1)) {
      weapon.lastShotTime = performance.now();
      // trigger firing effect
    }
  }
}

function stopFiring() {
  clearInterval(firingInterval);
  firingInterval = null;
}


function triggerFire() {
  if (window.engine && window.engine.isEditorMode) {
    logDebug('Editor mode: firing disabled');
    return false;
  }
  const w = player?.currentWeapon;
  if (!w) return false;

  if (!(player && player.useAmmo && player.useAmmo(1))) {
        if (w.isReloading) return false;
        if (w.fireMode === 'auto') w._dryFirePlayed = true;

        logDebug("No ammo! Reload first.");
        try {
            const clickSound = new Audio('sounds/click.ogg');
            clickSound.currentTime = 0;
            clickSound.play().catch(()=>{});
        } catch(e){}
        return false;
    }

    lastPlayerFireMs = performance.now();
    
    // Try to trigger weapon manager animation/sound/muzzle flash if available.
    let _skipLocalFireSound = false;
    try {
      if (window.weaponManager && typeof window.weaponManager.triggerFire === 'function') {
        window.weaponManager.triggerFire({ soundDelayMs: 0, muzzleFlash: true });
        const wmEntry = window.weaponManager.weapons && window.weaponManager.weapons[w.id];
        if (wmEntry && wmEntry.audio && wmEntry.audio.buffer) _skipLocalFireSound = true;
      }
    } catch (e) { console.warn('weaponManager.triggerFire failed', e); }

    if (!_skipLocalFireSound) {
      try {
        const fireSound = new Audio(w.fireSound);
        fireSound.currentTime = 0;
        fireSound.play().catch(()=>{});
      } catch (e) {}
    }
        
	
    // Compute shooting origin and forward direction:
    // Aim along the camera ray through the reticle so projectiles pass through the reticle center.
    const retNDC = new THREE.Vector2((ret.x / cw) * 2 - 1, -(ret.y / ch) * 2 + 1);
    raycaster.setFromCamera(retNDC, camera);

    // 1. Find target point in world space (what we are aiming at)
    const intersectables = window.sceneLoader ? window.sceneLoader.getIntersectableMeshes() : [];
    const hits = raycaster.intersectObjects(intersectables, true);
    const targetPoint = (hits.length > 0) ? hits[0].point : raycaster.ray.at(100, new THREE.Vector3());

    // 2. Determine shoot origin (muzzle)
    let shootOrigin = window.weaponManager ? window.weaponManager.getMuzzlePosition() : null;
    if (!shootOrigin) {
        const muzzleOffset = new THREE.Vector3(0, -0.35, -0.6);
        shootOrigin = camera.position.clone().add(muzzleOffset.applyQuaternion(camera.quaternion));
    }

    // 3. Determine direction from muzzle to target
    const forwardDir = new THREE.Vector3().subVectors(targetPoint, shootOrigin).normalize();

    // Generate spread directions around the aim direction (pass accuracy adjusted by recoil)
    const recoilInfluence2 = Math.min(0.9, (player.recoilPx || 0) / (Math.min(window.innerWidth, window.innerHeight) * 0.5));
    const effectiveAcc2 = clampAccuracy((w.accuracy ?? 1.0) - recoilInfluence2);
    const directions = generateSpreadDirections(forwardDir, w.projectilesPerShot, w.projectileSpread, effectiveAcc2);

    // Spawn each projectile
    for (const dir of directions) {
      spawnProjectileUnified(shootOrigin, dir, {
        damage: w.damage,
        explosive: w.explosive,
        explosionRadius: w.explosionRadius,
        explosionDamage: w.explosionDamage,
        explosionSounds: w.explosionSounds,
        projectileType: w.projectileType ?? "bullet"
      });
    }
    // Apply weapon recoil to player (visual reticle expansion + accuracy influence)
    try { player.addRecoil && player.addRecoil(w.recoil || 0); } catch(_) {}

    // Trigger HUD visual feedback (frame-based) from single hook
    try { window.hud && window.hud.onWeaponFire && window.hud.onWeaponFire({ retX: displayedRet.x, retY: displayedRet.y, weapon: w, isAuto: (w.fireMode === 'auto') }); } catch(_) {}
}
// ------------------ Reticle Accuracy Projection (WORLD-CORRECT) ------------------
// ------------------ Reticle Accuracy Projection (WORLD-CORRECT) ------------------
function updateDynamicReticle({
  camera,
  weapon,
  projectionDistance = 15,
  basePlayerConeRad = 0.0015,
  maxWeaponInaccuracyRad = 0.008
}) {
  if (!camera || !weapon) return;
  // Weapon stats: clamp accuracy only at [0.01, 1.0] per spec
  const weaponAccuracy = clampAccuracy(weapon.accuracy ?? 1.0);

  // Compute cone half-angle (radians) from accuracy and MAX_CONE constants
  const accHalfAngle = accuracyToConeHalfAngleRad(weaponAccuracy);

  // Project the accuracy cone to world point at projectionDistance, then to screen to measure radius
  const retNDC = new THREE.Vector2(
    (ret.x / window.innerWidth) * 2 - 1,
    -(ret.y / window.innerHeight) * 2 + 1
  );

  const tmpRay = new THREE.Raycaster();
  tmpRay.setFromCamera(retNDC, camera);
  const camPos = camera.position.clone();
  const forward = tmpRay.ray.direction.clone().normalize();
  const centerWorld = camPos.clone().add(forward.clone().multiplyScalar(projectionDistance));

  // world-space spread radius from accuracy cone only
  const spreadRadiusWorld = Math.tan(accHalfAngle) * projectionDistance;

  // Project a point at the right edge of the cone to screen and measure pixel radius
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  const edgeWorld = centerWorld.clone().add(right.clone().multiplyScalar(spreadRadiusWorld));
  const projectToScreen = v => {
    const p = v.clone().project(camera);
    return {
      x: (p.x * 0.5 + 0.5) * window.innerWidth,
      y: (-p.y * 0.5 + 0.5) * window.innerHeight
    };
  };

  const centerScreen = projectToScreen(centerWorld);
  const edgeScreen = projectToScreen(edgeWorld);
  let radiusPx = Math.hypot(edgeScreen.x - centerScreen.x, edgeScreen.y - centerScreen.y);

  // Shotguns: optionally add visual offset for pellet spread (not used for single-shot reticle)
  if ((weapon.projectileSpread ?? 0) > 0) {
    const pelletHalfRad = THREE.MathUtils.degToRad(weapon.projectileSpread) * 0.5;
    const pelletSpreadWorld = Math.tan(pelletHalfRad) * projectionDistance;
    const pelletEdgeWorld = centerWorld.clone().add(right.clone().multiplyScalar(pelletSpreadWorld));
    const pelletEdgeScreen = projectToScreen(pelletEdgeWorld);
    const pelletRadiusPx = Math.hypot(pelletEdgeScreen.x - centerScreen.x, pelletEdgeScreen.y - centerScreen.y);
    // Visual offset: add pellet spread to reticle so player sees potential pellet extent
    radiusPx += pelletRadiusPx;
    document.documentElement.style.setProperty("--reticle-pellet-spread", `${weapon.projectileSpread}`);
  } else {
    document.documentElement.style.removeProperty("--reticle-pellet-spread");
  }

  // Clamp radius to reasonable values to avoid overly large/small visuals
  const clampedRadius = THREE.MathUtils.clamp(
    radiusPx,
    MIN_RETICLE_RADIUS_PX,
    Math.min(window.innerWidth, window.innerHeight) * MAX_RETICLE_RADIUS_PCT
  );

  // Add player's current recoil (screen-space px) to the reticle visual radius
  const extraRecoilPx = (player && player.recoilPx) ? player.recoilPx : 0;
  const finalRadius = clampedRadius + extraRecoilPx;

  document.documentElement.style.setProperty("--reticle-size", `${(finalRadius * 2).toFixed(1)}px`);
}

/**
 * Spawn a projectile (player or enemy)
 * @param {THREE.Vector3} origin - start position
 * @param {THREE.Vector3} direction - normalized travel direction
 * @param {Object} options - extra options
 *   - damage: number
 *   - color: hex color
 *   - speed: units/sec
 *   - isEnemy: boolean
 *   - size: bullet size (radius)
 *   - lifetime: seconds
 *   - explosive: boolean
 *   - trail: boolean
 */
function spawnProjectileUnified(origin, direction, options = {}) {
    const {
        damage = 1,
        color = 0xffff00,
    speed = PROJECTILE_SPEED,
        isEnemy = false,
        size = 0.02,
        lifetime = PROJECTILE_LIFETIME,
        explosive = false,
        trail = true
  ,        projectileType = "bullet"
    } = options;

    const dir = direction.clone().normalize();

  // Geometry & material
  let geo, mat;
  let finalSpeed = speed;
  if (projectileType === "laser") {
    const radius = Math.max(0.005, size);
    const length = 0.5;
    geo = new THREE.CylinderGeometry(radius, radius, length, 8, 1);
    geo.rotateX(Math.PI / 2); // make cylinder's axis point along +Z
    mat = new THREE.MeshBasicMaterial({ color: color ?? 0xffffff });
    // Make lasers faster by default if caller didn't override speed
    if (typeof options.speed === 'undefined') finalSpeed = PROJECTILE_SPEED * 4;
  } else {
    geo = new THREE.CapsuleGeometry(size, size * 4, 4, 8);
    mat = new THREE.MeshBasicMaterial({ color });
  }

  const bullet = new THREE.Mesh(geo, mat);
  bullet.position.copy(origin);

  // Orient to travel direction
  if (projectileType === "laser") {
    bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  } else {
    bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

    bullet.userData = {
      direction: dir,
      bornTime: performance.now(),
      damage,
      isEnemy,
      explosive,
      speed: finalSpeed,
      trail: null,
      projectileType
    };

    // Motion trail
    if (trail) {
      const trailLength = Math.max(0.02, size * 5);
      let points;
      if (projectileType === "laser") points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -trailLength)];
      else points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -trailLength, 0)];

      const trailGeo = new THREE.BufferGeometry().setFromPoints(points);
      const trailMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const line = new THREE.Line(trailGeo, trailMat);
      bullet.add(line);
      bullet.userData.trail = line;
    }

    scene.add(bullet);

    if (isEnemy) enemyProjectiles.push(bullet);
    else projectiles.push(bullet);

    return bullet;
}

function updateProjectiles(dt) {
    const toRemove = [];
    const intersectables = sceneLoader.getIntersectableMeshes() || [];
    const rayTemp = new THREE.Raycaster();

    for (const bullet of projectiles) {
        // --- SAVE PREVIOUS POSITION ---
        const prevPos = bullet.position.clone();

        // --- MOVE BULLET ---
        const dir = bullet.userData.direction;
const moveDist = bullet.userData.speed * (dt / 1000);
		
        bullet.position.addScaledVector(dir, moveDist);

        // --- LIFETIME CHECK ---
        const aliveTime = (performance.now() - bullet.userData.bornTime) / 1000;
        if (aliveTime > PROJECTILE_LIFETIME) {
            bullet.updateMatrixWorld(true);
            const worldPos = new THREE.Vector3();
            bullet.getWorldPosition(worldPos);
            bullet.userData.explosionPos = worldPos;
            toRemove.push(bullet);
            continue;
        }

        // --- COLLISION CHECK ---
        const travelVec = new THREE.Vector3().subVectors(bullet.position, prevPos);
        const travelDist = travelVec.length();
        if (travelDist > 0) {
            rayTemp.set(prevPos, travelVec.normalize());
            rayTemp.far = travelDist;

            const hits = rayTemp.intersectObjects(intersectables, true);
            if (hits.length > 0) {
                const hit = hits[0];
				  console.log("Hit object:", hits[0].object);
  console.log("userData:", hits[0].object.userData);
                  spawnSparks(
    hit.point,
    hit.face?.normal?.clone().transformDirection(hit.object.matrixWorld)
      || new THREE.Vector3(0, 1, 0)
  );
				
				
				const mesh = hit.object;

                bullet.userData.explosionPos = hit.point.clone();

                if (mesh.userData.enemy) {
                    mesh.userData.enemy.takeDamage(bullet.userData.damage);
                } else {
                    // If this is a bullet hitting room geometry, play a positional ricochet
                    try {
                      let obj = mesh;
                      while (obj && obj.userData && !obj.userData.enemyId && !obj.userData.propId && obj.userData.type !== 'room') obj = obj.parent;
                      if (bullet.userData.projectileType === 'bullet' && obj && obj.userData && obj.userData.type === 'room') {
                        const paths = [
                          'assets/sfx/ric1.ogg',
                          'assets/sfx/ric2.ogg',
                          'assets/sfx/ric3.ogg',
                          'assets/sfx/ric4.ogg',
                          'assets/sfx/ric5.ogg'
                        ];
                        try { sceneLoader.playPositionalImpactSound(paths, hit.point, 0.9, 6); } catch (e) {}
                      }
                    } catch (e) {}

                    sceneLoader.applyDamageToMesh(mesh, bullet.userData.damage, { suppressRoomSound: bullet.userData.projectileType === 'bullet' });
                }

                logDebug(`Projectile hit ${mesh.name || "object"} for ${bullet.userData.damage} damage`);
                toRemove.push(bullet);
            }
        }
    }

    // --- REMOVE EXPIRED BULLETS ---
    for (const b of toRemove) {
        const pos = b.userData.explosionPos;
if (pos && b.userData.explosive) {			
            window.spawnTestExplosion({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                blastRadius: player?.currentWeapon?.explosionRadius,
                maxDamage: player?.currentWeapon?.explosionDamage,
                explosionSounds: player?.currentWeapon?.explosionSounds
            });
        }

        scene.remove(b);
        const idx = projectiles.indexOf(b);
        if (idx !== -1) projectiles.splice(idx, 1);
    }
}

// left mouse down firing (canvas click) - only attach one handler
canvas.removeEventListener('mousedown', triggerFireWrapper, false); // safe to call even if not attached
function triggerFireWrapper(e) {
  if (e.button === 0) triggerFire();
}
canvas.addEventListener('mousedown', triggerFireWrapper, false);

function updateEnemyProjectiles(dt) {
  const toRemove = [];

  // tuning
  const PLAYER_HIT_RADIUS = 0.35;
  const PLAYER_HIT_FORWARD_OFFSET = 0.15;

  for (const bullet of enemyProjectiles) {
    const dir = bullet.userData.direction;

    // Save previous position for swept test
    const prevPos = bullet.position.clone();
    bullet.position.addScaledVector(dir, PROJECTILE_SPEED * (dt / 1000));

    // Lifetime check
    if ((performance.now() - bullet.userData.bornTime) / 1000 > PROJECTILE_LIFETIME) {
      toRemove.push(bullet);
      continue;
    }

    // Swept-segment vs camera-sphere to avoid tunneling
    const a = prevPos;
    const b = bullet.position.clone();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const center = camera.position.clone().add(forward.multiplyScalar(PLAYER_HIT_FORWARD_OFFSET));

    // Closest point on segment to center
    const ab = b.clone().sub(a);
    const abLenSq = ab.lengthSq();
    let hit = false;
    if (abLenSq === 0) {
      hit = a.distanceToSquared(center) <= (PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS);
    } else {
      const t = THREE.MathUtils.clamp(center.clone().sub(a).dot(ab) / abLenSq, 0, 1);
      const closest = a.clone().add(ab.multiplyScalar(t));
      if (closest.distanceToSquared(center) <= (PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS)) hit = true;
    }

    // head sphere
    if (!hit) {
      const headCenter = center.clone().add(new THREE.Vector3(0, 0.18, 0));
      const headRadius = Math.max(0.12, PLAYER_HIT_RADIUS * 0.6);
      const ab2 = b.clone().sub(a);
      const ab2LenSq = ab2.lengthSq();
      if (ab2LenSq === 0) {
        hit = a.distanceToSquared(headCenter) <= (headRadius * headRadius);
      } else {
        const t2 = THREE.MathUtils.clamp(headCenter.clone().sub(a).dot(ab2) / ab2LenSq, 0, 1);
        const closest2 = a.clone().add(ab2.multiplyScalar(t2));
        if (closest2.distanceToSquared(headCenter) <= (headRadius * headRadius)) hit = true;
      }
    }

    if (hit) {
      player.takeDamage(bullet.userData.damage);
      toRemove.push(bullet);
    }
  }

  // Remove expired bullets
  for (const b of toRemove) {
    scene.remove(b);
    const idx = enemyProjectiles.indexOf(b);
    if (idx !== -1) enemyProjectiles.splice(idx, 1);
  }
}

// ------------------ Duck & Zoom (unchanged) ------------------
let ducking = false;
let zoomed = false;
document.addEventListener('keydown', (e) => {
  if (window._editorModalOpen) return;
  if(e.key==='Shift') ducking=true;
  // Only treat Z as zoom when NOT in FPS mode
  if (!isFPSMode && (e.key==='z' || e.key==='Z')) zoomed=true;
});
document.addEventListener('keyup', (e) => {
  if (window._editorModalOpen) return;
  if(e.key==='Shift') ducking=false;
  if (!isFPSMode && (e.key==='z' || e.key==='Z')) zoomed=false;
});

// ------------------ Reticle smoothing & render loop ------------------
const LERP = 0.9;
let lastMs = performance.now();
function animate(nowMs) {
  requestAnimationFrame(animate);
  const deltaMs = nowMs - lastMs;
  lastMs = nowMs;

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
    const targetY = ducking ? (playerStandingHeight - 0.5) : playerStandingHeight;
    camera.position.y += (targetY - camera.position.y) * 0.1;
  }
  const targetFov = zoomed ? 30 : 60;
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
          } else {
            console.log('[DEBUG] hip bone not found on first enemy');
          }
        }
      }
    } catch (e) {}
  } catch (e) {}

  // Update HUD
  if (window.hud) window.hud.update(deltaMs / 1000);

  // Update Scene (enemies, etc)
  if (window.sceneLoader) window.sceneLoader.update(deltaMs, nowMs);

  // Update projectiles
  updateProjectiles(deltaMs);
  updateEnemyProjectiles(deltaMs);

  // Update sparks
  updateSparks(deltaMs / 1000);

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
}

// Start the first level immediately
loadLevel(Level_Warehouse);

requestAnimationFrame(animate);