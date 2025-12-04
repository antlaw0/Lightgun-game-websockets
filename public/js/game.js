// js/game.js
// This file is written as an ES module. Include it as:
// <script type="module" src="js/game.js"></script>

//import * as THREE from './lib/three.module.js';

import { Level_Warehouse } from "./Level_Warehouse.js";
import { SceneLoader } from "./sceneLoader.js";


// js/game.js
import { Player } from './player.js';
import { HUD } from './hud.js';

export const player = new Player({
  maxHp: 100,
  hp: 100,
  weapons: [
    {
      name: "Starter Pistol",
      image: "/assets/hud/weapon_placeholder.png",
	  fireMode:  "auto",
	    rateOfFireMs: 120,
      ammoType: "bullets",
      clipSize: 12,
      ammoInClip: 12,
      totalAmmo: 48
    }
  ],
  currentWeaponIndex: 0
});

HUD.init(player);

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
      ret.x = ((p.x+1)/2)*cw;
      ret.y = ((p.y+1)/2)*ch;
      if (retXY) retXY.textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
      if (abc) abc.textContent = `${p.alpha?.toFixed(1) ?? ''}, ${p.beta?.toFixed(1) ?? ''}, ${p.gamma?.toFixed(1) ?? ''}`;
      isFiring = !!p.fire; // just set firing state

      if (p.reload) triggerReload();
    }
  } catch (e) {
    console.warn("ws message parse failed", e);
  }
};

// ------------------ Three.js Setup ------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, cw / ch, 0.1, 200);
camera.position.set(0, 1.7, 5);
camera.lookAt(0, 1.7, 0);


// -----------------------------------------------------
// DEBUG FREE CAMERA (WASD + QE + Arrow keys)
// -----------------------------------------------------
const camSpeed = 0.2;
const camRotSpeed = 0.02;

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

document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {

        // Movement
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

        // Rotation (arrow keys)
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

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// ------------------ Reticle Tracking ------------------
let ret = { x: cw/2, y: ch/2 };         // target position from controller (pixels)
let displayedRet = { x: cw/2, y: ch/2 }; // smoothed position shown on screen
const LERP_SPEED = 0.9;

// ------------------ Raycaster ------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ------------------ Scene / Level management ------------------
const sceneLoader = new SceneLoader(scene, camera, player);
let currentLevel = Level_Warehouse;
let currentSceneIndex = 0;

function loadLevel(level) {
  currentLevel = level;
  currentSceneIndex = 0;
  loadSceneIndex(currentSceneIndex);
}

function loadSceneIndex(index) {
  if (!currentLevel || !currentLevel.scenes) return;
  if (index < 0 || index >= currentLevel.scenes.length) {
    logDebug("No more scenes in level.");
    return;
  }
  const sc = currentLevel.scenes[index];
  sceneLoader.loadScene(sc);
  logDebug(`Loaded scene: ${sc.name}`);
}

// Provide onSceneComplete per your choice B: app must trigger next scene manually
window.onSceneComplete = function(sceneDef) {
  logDebug(`Scene complete: ${sceneDef.name}. Call nextScene() to advance.`);
  // You (or your UI) decide when to call nextScene(); for convenience we'll also emit an event:
  window.dispatchEvent(new CustomEvent("sceneCompleteReady", { detail: { scene: sceneDef } }));
};

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
  const acc = enemy.accuracy ?? 0.6;
  const origin = enemy.mesh.position.clone();
  const trueDir = playerPos.clone().sub(origin).normalize();
  const maxAngle = (1 - acc) * 0.25;
  const randomAngle = (Math.random() * 2 - 1) * maxAngle;
  const axis = new THREE.Vector3(0, 1, 0);
  const deviatedDir = trueDir.clone().applyAxisAngle(axis, randomAngle).normalize();

  // Create visual mesh like player bullets
  const geo = new THREE.SphereGeometry(0.05, 8, 8);
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


function spawnProjectile(origin, direction) {
  // Simple small sphere as bullet visual
  const geo = new THREE.SphereGeometry(0.03, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const bullet = new THREE.Mesh(geo, mat);

  bullet.position.copy(origin);
  bullet.userData = {
    direction: direction.clone().normalize(),
    bornTime: performance.now(),
    damage: 1
  };

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

// ------------------ Fire / Reload functions ------------------
function triggerReload() {
   try { const reloadSound = new Audio('sounds/reload.ogg'); reloadSound.currentTime = 0; reloadSound.play().catch(()=>{}); } catch(e){}
    
   player.reload();
  logDebug("Player reloaded"); 
}


function updateAutoFire(nowMs) {
    const w = player.currentWeapon;
    if (!w) return;

    // Auto mode: holds to fire
    if (w.fireMode === "auto") {
        if (!isFiring) return;

        const elapsed = nowMs - lastPlayerFireMs;
        if (elapsed >= w.rateOfFireMs) {
            triggerFire();
            lastPlayerFireMs = nowMs;
        }
    }
}

function triggerFire() {
    const w = player.currentWeapon;
    if (!w) return false;

    // Check ammo first
    if (!player.useAmmo(1)) {
        logDebug("No ammo! Reload first.");
        try {
            const clickSound = new Audio('sounds/click.ogg');
            clickSound.currentTime = 0;
            clickSound.play().catch(()=>{});
        } catch(e){}
        return false;
    }

    lastPlayerFireMs = performance.now(); // record fire time

    // --- Raycast and spawn projectile ---
    const px = ret.x;
    const py = ret.y;
    mouse.x = (px / cw) * 2 - 1;
    mouse.y = - (py / ch) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const muzzleOffset = new THREE.Vector3(0.0, -0.25, -0.3);
    const shootOrigin = camera.localToWorld(muzzleOffset.clone());
    const shootDir = raycaster.ray.direction.clone();

    spawnProjectile(shootOrigin, shootDir);

    try {
        const fireSound = new Audio('sounds/fire.ogg');
        fireSound.currentTime = 0;
        fireSound.play().catch(()=>{});
    } catch(e){}

    logDebug("Projectile fired");
}

function updateProjectiles(dt) {
  const toRemove = [];

  const intersectables = sceneLoader.getIntersectableMeshes() || [];
  const rayTemp = new THREE.Raycaster();

  for (const bullet of projectiles) {
    // Move projectile
    const dir = bullet.userData.direction;
    bullet.position.addScaledVector(dir, PROJECTILE_SPEED * (dt/1000));

    // Lifetime check
    const aliveTime = (performance.now() - bullet.userData.bornTime) / 1000;
    if (aliveTime > PROJECTILE_LIFETIME) {
      toRemove.push(bullet);
      continue;
    }

    // Collision check: cast a tiny ray from the bullet forward
    rayTemp.set(bullet.position, dir);

    const hits = rayTemp.intersectObjects(intersectables, false);
    if (hits.length > 0) {
      const mesh = hits[0].object;

      // Apply damage
      sceneLoader.applyDamageToMesh(mesh, bullet.userData.damage);
      logDebug("Projectile hit target");

      toRemove.push(bullet);
    }
  }

  // Remove dead bullets
  for (const b of toRemove) {
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
  if(e.key==='z' || e.key==='Z') zoomed=true;
});
document.addEventListener('keyup', (e) => {
  if(e.key==='Shift') ducking=false;
  if(e.key==='z' || e.key==='Z') zoomed=false;
});

// ------------------ Reticle smoothing & render loop ------------------
const LERP = 0.9;
let lastMs = performance.now();
function animate(nowMs) {
  requestAnimationFrame(animate);
  const deltaMs = nowMs - lastMs;
  lastMs = nowMs;

  
  
  updateAutoFire(nowMs);

  
  // Update displayed reticle
  displayedRet.x += (ret.x - displayedRet.x) * LERP;
  displayedRet.y += (ret.y - displayedRet.y) * LERP;
  if (reticleDiv) {
    reticleDiv.style.left = `${displayedRet.x}px`;
    reticleDiv.style.top = `${displayedRet.y}px`;
  }



  // Ducking & zoom
  camera.position.y = 1.7 - (ducking ? 0.8 : 0);
  camera.fov = zoomed ? 30 : 60;
  camera.updateProjectionMatrix();

  // Update scene loader (enemies AI)
  sceneLoader.update(deltaMs, nowMs);
  updateProjectiles(deltaMs);
updateEnemyProjectiles(deltaMs);

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// ------------------ Start by loading level/scene ------------------
loadLevel(Level_Warehouse);

// Expose nextScene globally so UI or user can advance after onSceneComplete
window.nextScene = nextScene;
