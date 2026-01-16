// js/game.js
// This file is written as an ES module. Include it as:
// <script type="module" src="js/game.js"></script>
import { SceneManager } from './sceneManager.js';
import { EnemyVoiceManager } from "./EnemyVoiceManager.js";

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { killAllEnemies } from "./enemy.js";
killAllEnemies();
import { ENEMY_AI_ENABLED, setEnemyAIEnabled, ENEMY_INSTANCES } from './enemy.js';
import { initSparks, spawnSparks, updateSparks } from './fx/sparks.js';

import { Level_Warehouse } from "./Level_Warehouse.js";
import { SceneLoader } from "./sceneLoader.js";


// js/game.js
import { Player } from './player.js';
import { HUD } from './hud.js';

export const player = new Player({
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
  currentWeaponIndex: 0
});


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


function resize() { cw = canvas.width = window.innerWidth; ch = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);

// WebSocket setup (unchanged)
const WS_URL = `wss://${window.location.hostname}:8080`;
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
      const w = player.currentWeapon;
      if (pFire && !window._lastControllerFire) {
        // rising edge: single-shot for semi-auto, start continuous for auto
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
    const w = player.currentWeapon;
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
player.addEventListener && player.addEventListener('ammoChanged', sendWeaponInfo);

// ------------------ Three.js Setup ------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, cw / ch, 0.1, 200);
camera.position.set(0, 1.7, 5);
camera.lookAt(0, 1.7, 0);

// FPS mode state (toggle with Tab). When true: WASD + mouse look, reticle centered.
let isFPSMode = false;
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
  player.cycleWeapon(direction);
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
  if (e.code === "KeyV") { // or MouseButton / F key
    //console.log("Key pressed for melee attack");
	player.meleeAttack();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "F4") {
    setEnemyAIEnabled(!ENEMY_AI_ENABLED);
    logDebug(`Enemy AI toggled: ${ENEMY_AI_ENABLED ? "ON" : "OFF"}`);
  }
});
        
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
    if (e.key.toLowerCase() !== 'r') return;

    const now = performance.now();
    if (now - lastReloadPressMs < RELOAD_COOLDOWN_MS) {
        return; // Prevent reload spam
    }

    const w = player.currentWeapon;
    if (!w) return;

    // Only reload if ammoInClip < clipSize
    if (w.ammoInClip < w.clipSize) {
        lastReloadPressMs = now;
        triggerReload();
    } else {
        // Optional: debug log to show reload is blocked
        logDebug("Reload ignored: clip full.");
    }
});


window.cam = () => {
  console.log(`Camera position -> x: ${camera.position.x.toFixed(2)}, y: ${camera.position.y.toFixed(2)}, z: ${camera.position.z.toFixed(2)}`);
};


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


// ------------------ Reticle Tracking ------------------
let ret = { x: cw/2, y: ch/2 };         // target position from controller (pixels)
let displayedRet = { x: cw/2, y: ch/2 }; // smoothed position shown on screen
const LERP_SPEED = 0.9;

// ------------------ Raycaster ------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ------------------ Scene / Level management ------------------

  // Load using SceneManager for on-rails intro/exit
// ------------------ Scene / Level management ------------------
window.sceneLoader = new SceneLoader(scene, camera, player);
let currentLevel = Level_Warehouse;
let currentSceneIndex = 0;
window.sceneManager = new SceneManager(camera, sceneLoader);

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
    const w = player.currentWeapon;
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
    if (!player.useAmmo(1)) {
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

    // Aim direction is the camera ray through the reticle (so projectiles travel through reticle)
    const forwardDir = raycaster.ray.direction.clone().normalize();

    // Compute a muzzle origin relative to the camera so bullets visually come from lower-center
    const muzzleOffset = new THREE.Vector3(0, -0.35, -0.6); // moved lower: down and forward in camera space
    const shootOrigin = camera.position.clone().add(muzzleOffset.applyQuaternion(camera.quaternion));

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
            explosive: w.explosive ?? false,
            trail: true,
            isEnemy: false
        });
    }

    // --- Play weapon-specific sound ---
    try {
        if (w.fireSound) {
            const snd = new Audio(w.fireSound);
            snd.currentTime = 0;
            snd.play().catch(() => {});
        }
    } catch (e) {}

    // Debug: log the shot
    // console.log(`Fired ${w.name} at ${now}`);
}


// ------------------ Fire / Reload functions ------------------
function triggerReload() {
   try { const reloadSound = new Audio('sounds/reload.ogg'); reloadSound.currentTime = 0; reloadSound.play().catch(()=>{}); } catch(e){}
    
   player.reload();
  logDebug("Player reloaded"); 
}


function updateAutoFire(nowMs) {
    const w = player.currentWeapon;
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
    const w = player.currentWeapon;
    if (!w) return false;

    if (!player.useAmmo(1)) {
        logDebug("No ammo! Reload first.");
        try {
            const clickSound = new Audio('sounds/click.ogg');
            clickSound.currentTime = 0;
            clickSound.play().catch(()=>{});
        } catch(e){}
        return false;
    }

    lastPlayerFireMs = performance.now();
    
	const fireSound = new Audio(w.fireSound);
            fireSound.currentTime = 0;
            fireSound.play();
        
	
    // Compute shooting origin and forward direction:
    // Aim along the camera ray through the reticle so projectiles pass through the reticle center.
    const retNDC = new THREE.Vector2((ret.x / cw) * 2 - 1, -(ret.y / ch) * 2 + 1);
    raycaster.setFromCamera(retNDC, camera);
    const forwardDir = raycaster.ray.direction.clone().normalize();

    // Spawn from a camera-relative muzzle (bottom-center of view)
    const muzzleOffset = new THREE.Vector3(0, -0.35, -0.6);
    const shootOrigin = camera.position.clone().add(muzzleOffset.applyQuaternion(camera.quaternion));

    // Generate spread directions around the aim direction (pass accuracy adjusted by recoil)
    const recoilInfluence2 = Math.min(0.9, (player.recoilPx || 0) / (Math.min(window.innerWidth, window.innerHeight) * 0.5));
    const effectiveAcc2 = clampAccuracy((w.accuracy ?? 1.0) - recoilInfluence2);
    const directions = generateSpreadDirections(forwardDir, w.projectilesPerShot, w.projectileSpread, effectiveAcc2);

    // Spawn each projectile
    for (const dir of directions) {
        spawnProjectileUnified(shootOrigin, dir, { damage: w.damage,
		explosive: w.explosive,
    explosionRadius: w.explosionRadius,
    explosionDamage: w.explosionDamage,
explosionSounds:  w.explosionSounds    	
		
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
    } = options;

    const dir = direction.clone().normalize();

    // Geometry & material
    const geo = new THREE.CapsuleGeometry(size, size * 4, 4, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const bullet = new THREE.Mesh(geo, mat);
    bullet.position.copy(origin);

    // Orient capsule (native +Y axis → travel direction)
    bullet.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir
    );

    bullet.userData = {
        direction: dir,
        bornTime: performance.now(),
        damage,
        isEnemy,
        explosive,
        speed,
        trail: null
    };

    // Motion trail
    if (trail) {
        const trailLength = size * 5;
        const trailGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, -trailLength, 0) // ← correct axis
        ]);
        const trailMat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.7
        });
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
                    sceneLoader.applyDamageToMesh(mesh, bullet.userData.damage);
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
                blastRadius: player.currentWeapon.explosionRadius,
                maxDamage: player.currentWeapon.explosionDamage,
                explosionSounds: player.currentWeapon.explosionSounds
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

  for (const bullet of enemyProjectiles) {
    const dir = bullet.userData.direction;
    bullet.position.addScaledVector(dir, PROJECTILE_SPEED * (dt / 1000));

    // Lifetime check
    if ((performance.now() - bullet.userData.bornTime) / 1000 > PROJECTILE_LIFETIME) {
      toRemove.push(bullet);
      continue;
    }

    // Collision with player (distance-based)
    if (bullet.position.distanceTo(camera.position) < 0.3) {
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
  if(e.key==='Shift') ducking=true;
  // Only treat Z as zoom when NOT in FPS mode
  if (!isFPSMode && (e.key==='z' || e.key==='Z')) zoomed=true;
});
document.addEventListener('keyup', (e) => {
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
  // Update enemy animation mixers (advance three.js AnimationMixers)
  try {
    const deltaSec = deltaMs / 1000;
    ENEMY_INSTANCES.forEach(e => { if (e.mixer) try { e.mixer.update(deltaSec); } catch(_){} });
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
// HUD.update moved to end of loop so camera rails/scene updates happen first
// FPS movement: apply continuous movement when enabled
  if (isFPSMode) {
    const moveDist = fpsState.speed * (deltaMs / 1000);
    // Use camera world forward projected to XZ plane for FPS-style movement
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    if (fpsState.keys.w) camera.position.addScaledVector(forward, moveDist);
    if (fpsState.keys.s) camera.position.addScaledVector(forward, -moveDist);
    if (fpsState.keys.a) camera.position.addScaledVector(right, -moveDist);
    if (fpsState.keys.d) camera.position.addScaledVector(right, moveDist);
    // Q ascends, Z descends (keep these consistent with original mapping)
    if (fpsState.keys.q) camera.position.y += moveDist; // ascend
    if (fpsState.keys.z) camera.position.y -= moveDist; // descend
    // Keep camera within reasonable Y (optional clamp)
    if (camera.position.y < -50) camera.position.y = -50;
    if (camera.position.y > 200) camera.position.y = 200;
    // ensure reticle stays centered while in FPS
    ret.x = cw / 2; ret.y = ch / 2;
  }

    // **Sync player position with camera**
    player.position.copy(camera.position);
  
  
      handleFire(); // <-- centralized firing
  updateSparks(deltaMs);

  // Update displayed reticle
  displayedRet.x += (ret.x - displayedRet.x) * LERP;
  displayedRet.y += (ret.y - displayedRet.y) * LERP;
  if (reticleDiv) {
    reticleDiv.style.left = `${displayedRet.x}px`;
    reticleDiv.style.top = `${displayedRet.y}px`;
  }


  updateDynamicReticle({
    camera,
    weapon: player.currentWeapon
  });

  // Update player recoil decay each frame (deltaMs)
  try { player.updateRecoil && player.updateRecoil(deltaMs); } catch(_) {}

  // Ducking & zoom
  // Only enforce default ground height when NOT in FPS mode; in FPS mode vertical movement is controlled by keys
  if (!isFPSMode) camera.position.y = 1.7 - (ducking ? 0.8 : 0);
  camera.fov = zoomed ? 30 : 60;
  camera.updateProjectionMatrix();

  // Update scene loader (enemies AI)
  sceneLoader.update(deltaMs, nowMs);
  updateProjectiles(deltaMs);
  updateEnemyProjectiles(deltaMs);

  // Apply HUD visual/frame-based effects after scene/camera updates
  HUD.update(deltaMs / 1000);

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// ------------------ Start by loading level/scene ------------------
loadLevel(Level_Warehouse);

// Expose nextScene globally so UI or user can advance after onSceneComplete
window.nextScene = nextScene;
window.player = player;

