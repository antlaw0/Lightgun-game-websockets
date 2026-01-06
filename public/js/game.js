// js/game.js
// This file is written as an ES module. Include it as:
// <script type="module" src="js/game.js"></script>
import { SceneManager } from './sceneManager.js';
import { EnemyVoiceManager } from "./EnemyVoiceManager.js";

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { killAllEnemies } from "./enemy.js";
killAllEnemies();
import { ENEMY_AI_ENABLED, setEnemyAIEnabled } from './enemy.js';
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
  const acc = enemy.accuracy ?? 0.6;
  const origin = enemy.mesh.position.clone();
  const trueDir = playerPos.clone().sub(origin).normalize();
  const maxAngle = (1 - acc) * 0.25;
  const randomAngle = (Math.random() * 2 - 1) * maxAngle;
  const axis = new THREE.Vector3(0, 1, 0);
  const deviatedDir = trueDir.clone().applyAxisAngle(axis, randomAngle).normalize();

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
function generateSpreadDirections(forwardDir, numProjectiles, spreadDeg = 15) {
    const directions = [];
    if (numProjectiles <= 1) return [forwardDir.clone()];

    const spreadRad = THREE.MathUtils.degToRad(spreadDeg);

    for (let i = 0; i < numProjectiles; i++) {
        // evenly distribute angles horizontally
        const t = numProjectiles === 1 ? 0.5 : i / (numProjectiles - 1);
        const angleH = (t - 0.5) * spreadRad;  // -halfSpread -> +halfSpread
        const angleV = (Math.random() - 0.5) * spreadRad * 0.5; // slight random vertical offset

        let dir = forwardDir.clone();
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleH); // horizontal rotation
        dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), angleV); // vertical rotation
        directions.push(dir.normalize());
    }

    return directions;
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

    const shootOrigin = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(1));
    const retWorld = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(10));
    const forwardDir = retWorld.clone().sub(shootOrigin).normalize();

    // --- Generate spread directions ---
    const dirs = generateSpreadDirections(forwardDir, w.projectilesPerShot || 1, w.projectileSpread || 0);

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
        
	
    // Compute shooting origin and forward direction
    const retNDC = new THREE.Vector2((ret.x / cw) * 2 - 1, -(ret.y / ch) * 2 + 1);
    raycaster.setFromCamera(retNDC, camera);
    const retWorld = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(10));
    const bottomNDC = new THREE.Vector2(0, -1);
    raycaster.setFromCamera(bottomNDC, camera);
    const shootOrigin = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(1));
    const forwardDir = retWorld.clone().sub(shootOrigin).normalize();

    // Generate spread directions
    const directions = generateSpreadDirections(forwardDir, w.projectilesPerShot, w.projectileSpread);

    // Spawn each projectile
    for (const dir of directions) {
        spawnProjectileUnified(shootOrigin, dir, { damage: w.damage,
		explosive: w.explosive,
    explosionRadius: w.explosionRadius,
    explosionDamage: w.explosionDamage,
explosionSounds:  w.explosionSounds    	
		
		});
    }
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
HUD.update(deltaMs / 1000); // convert ms → seconds

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
window.player = player;
