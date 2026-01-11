import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { getWeapon } from "./weapons.js";
import { createMannequin } from './humanoid.js';
import { createWalkRunAnimations } from './animations.js';
export let ENEMY_AI_ENABLED = true;

export function setEnemyAIEnabled(enabled) {
  ENEMY_AI_ENABLED = !!enabled;
  console.log("Enemy AI:", ENEMY_AI_ENABLED ? "ENABLED" : "DISABLED");
}

export const ENEMY_INSTANCES = [];
//import { ENEMY_DEFS } from "./scenes.js";
//
// Weapon class
//
export class Weapon {
  constructor(def) {
    this.name = def.name || "weapon";
    this.fireSound = def.fireSound || null;
    this.fireRateMs = def.fireRateMs || 500;
    this.damage = def.damage || 1;
	this.reloadUntilMs = 0;

    this.clipSize = def.clipSize || 6;
    this.reloadTimeMs = def.reloadTimeMs || 1500;
    this.reloadSound = def.reloadSound || null;
    this.ammoInClip = this.clipSize;
    this.ammoReserve =
  (typeof def.ammoReserve === "number")
    ? def.ammoReserve
    : Infinity;

	this.lastFireTimestamp = -Infinity;
    this.isReloading = false;
  }

  canFire(nowMs) {
  if (this.isReloading) return false;
  if (nowMs < this.reloadUntilMs) return false;
  if (nowMs - this.lastFireTimestamp < this.fireRateMs) return false;
  if (this.ammoInClip <= 0) return false;
  return true;
}

  recordFire(nowMs) {
    this.lastFireTimestamp = nowMs;
    this.ammoInClip--;

    if (this.fireSound) {
      const s = new Audio(this.fireSound);
      s.currentTime = 0;
      s.play().catch(() => {});
    }

    if (this.ammoInClip <= 0) {
      this.startReload(nowMs);
    }
  }

  startReload(nowMs) {
  if (this.isReloading) return;

  this.isReloading = true;
  this.reloadUntilMs = nowMs + this.reloadTimeMs;

  if (this.reloadSound) {
    const s = new Audio(this.reloadSound);
    s.currentTime = 0;
    s.play().catch(() => {});
  }

  setTimeout(() => {
    this.ammoInClip = this.clipSize;

    if (this.ammoReserve !== Infinity) {
      this.ammoReserve = Math.max(0, this.ammoReserve - this.clipSize);
    }

    this.isReloading = false;
  }, this.reloadTimeMs);
}
}
//
// Enemy class
//
export class Enemy {
  /**
   * @param {THREE.Group} sceneGroup
   * @param {object} def Enemy definition
   * @param {object} instanceConfig Instance config (position, facing, id)
   * @param {object} player Player reference
   * @param {function} fireCallback Function(originVec3, targetVec3, speed) => Projectile
   */
  
  
  _hasClearShot(muzzle, targetPos) {
  if (!window.sceneLoader || !window.sceneLoader.staticObjects) return true;

  const rayDir = targetPos.clone().sub(muzzle).normalize();
  const raycaster = new THREE.Raycaster(muzzle, rayDir, 0.01, muzzle.distanceTo(targetPos));

  // Only test against full-cover objects
  const blockers = window.sceneLoader.staticObjects
    .filter(o => o.coverType === "full" && o.mesh)
    .map(o => o.mesh);

  if (blockers.length === 0) return true;

  const hits = raycaster.intersectObjects(blockers, false);
  return hits.length === 0;
}
_snapBasePositionToCoverEdge() {
  if (this.coverType !== "full") return;

  const cover = this._resolveCoverObject();
  if (!cover || !cover.position || !cover.size) return;

  const wallCenterX = cover.position.x;
  const wallHalfX = cover.size.x * 0.5;

  const leftEdgeX  = wallCenterX - wallHalfX;
  const rightEdgeX = wallCenterX + wallHalfX;

  // Determine nearest edge
  const distToLeft  = Math.abs(this.basePosition.x - leftEdgeX);
  const distToRight = Math.abs(this.basePosition.x - rightEdgeX);

  this._leanSide = (distToLeft < distToRight) ? -1 : 1;

  // Safety inset so sprite is fully hidden
  const inset = 0.25;

  // Snap base position
  this.basePosition.x =
    this._leanSide === -1
      ? leftEdgeX + inset
      : rightEdgeX - inset;

  // Align to wall plane (important)
  this.basePosition.z = cover.position.z;

  // Apply immediately
  this.mesh.position.copy(this.basePosition);



}

  
  _resolveCoverObject() {
  if (!this.coverObjectId) return null;
  if (!window.sceneLoader || !window.sceneLoader.staticObjects) return null;

  return window.sceneLoader.staticObjects.find(o => o.id === this.coverObjectId) || null;
}

  
  constructor(sceneGroup, def, instanceConfig, player, fireCallback) {
        // Merge base enemy def with instance config
    // Instance config MUST override base def
    const mergedDef = {
      ...def,
      ...instanceConfig
    };

	this.id = instanceConfig.id || `enemy_${Date.now()}`;
	this.firePauseMs = mergedDef.firePauseMs ?? 0;
this._nextAllowedFireMs = 0;

this.type = mergedDef.displayName || "Enemy";
this.hp = mergedDef.hp || 1;
this._hasEngagedPlayer=false

	
	this.maxHp = this.hp;
    let weaponDef = null;

if (typeof mergedDef.weapon === "string") {
  weaponDef = getWeapon(mergedDef.weapon);
} else if (mergedDef.weapon && typeof mergedDef.weapon === "object") {
  weaponDef = mergedDef.weapon;
}

// Fallback to pistol if invalid
if (!weaponDef) {
console.warn(`Enemy ${instanceConfig.id} has invalid weapon`, mergedDef.weapon);

//console.log("Enemy weapon raw:", mergedDef.weapon);
  
  weaponDef = getWeapon("pistol");
}
// Final log
//console.log("Enemy weapon raw:", mergedDef.weapon);

//console.log("Weapon resolved:", weaponDef);
// Finally construct the Weapon instance
this.weapon = new Weapon(weaponDef);
    // Improved logging
const rawWeaponStr =
  (typeof mergedDef.weapon === "string")
    ? mergedDef.weapon
    : JSON.stringify(mergedDef.weapon);

const resolvedWeaponStr = JSON.stringify(weaponDef);

//console.log(`Enemy ${instanceConfig.id} weapon info:`);
//console.log("  Raw weapon:", rawWeaponStr);
//console.log("  Resolved weapon:", resolvedWeaponStr);
this.hitSounds = Array.isArray(mergedDef.hitSounds) ? mergedDef.hitSounds : [];
this.deathSounds = Array.isArray(mergedDef.deathSounds) ? mergedDef.deathSounds : [];

	
    this.accuracy = mergedDef.accuracy || 0.5;
    this.reactionTimeMs = mergedDef.reactionTimeMs || 300;

// ----------------------------
// VOICE DEFINITIONS
// ----------------------------
this.voice = mergedDef.voice || {};

this.voicePain   = this.voice.pain   || [];
this.voiceDeath  = this.voice.death  || [];
this.voiceEngage = this.voice.engage || [];
this.voiceTaunt  = this.voice.taunt  || [];

this._nextTauntTime = null;

    


    // Register this enemy globally for debugging / mass actions
    ENEMY_INSTANCES.push(this);

    this.player = player;
    this.fireCallback = fireCallback;

    this.position = new THREE.Vector3(
      instanceConfig.position.x || 0,
      instanceConfig.position.y || 0,
      instanceConfig.position.z || 0
    );

    this.facing = instanceConfig.facing || 0;
    this.coverIndex = instanceConfig.coverIndex ?? null;
this.coverObjectId = instanceConfig.coverObject || null;

    // Behavior: default to standing, or use provided behavior
    this.behavior = instanceConfig.behavior || (mergedDef.behavior ? mergedDef.behavior : { pattern: "standInOpen", params: {} });

    // Allow explicit coverType via instanceConfig or behavior.params
    this.coverType = instanceConfig.coverType || (this.behavior.params && this.behavior.params.coverType) || mergedDef.coverType || null;
    // fallback inference: if coverIndex present assume low cover
    if (!this.coverType && this.coverIndex !== null) this.coverType = "low";

    //
    // Mesh (sprite fallback OR 3D mannequin for Grunt)
    // If this is a Grunt type, create the skinned mannequin
    this.mixer = null;
    this._walkAction = null;
    this._runAction = null;

    if (mergedDef.displayName === "Grunt Soldier") {
      const { skinnedMesh, skeleton, bones } = createMannequin();
      this.mesh = skinnedMesh;
      // place mesh at given position
      this.mesh.position.copy(this.position);
      this.basePosition = this.mesh.position.clone();
      this.baseRotationY = this.facing;
      this._lastBasePosition = this.basePosition.clone();
      // Apply weapon/arm recoil decay and bone offsets each frame
      try {
        if (this.weaponMesh && typeof this._weaponRecoil === 'number') {
          // exponential decay per-frame
          this._weaponRecoil *= Math.pow(0.85, Math.max(1, deltaMs / 16));
          // apply local z offset (push weapon back)
          const origZ = this._weaponOriginalPos ? this._weaponOriginalPos.z : (this.weaponMesh.position.z || 0);
          this.weaponMesh.position.z = origZ - (this._weaponRecoil || 0);
        }

        if (this.bones && typeof this._boneRecoil === 'number') {
          this._boneRecoil *= Math.pow(0.8, Math.max(1, deltaMs / 16));
          const upper = this.bones['upper_arm_r'];
          const lower = this.bones['lower_arm_r'];
          if (upper) upper.rotation.x = (this._boneBaseRot['upper_arm_r'] || 0) - (this._boneRecoil * 0.45);
          if (lower) lower.rotation.x = (this._boneBaseRot['lower_arm_r'] || 0) - (this._boneRecoil * 0.6);
          // slight brace on left arm
          const upperL = this.bones['upper_arm_l'];
          if (upperL) upperL.rotation.x = (this._boneBaseRot['upper_arm_l'] || 0) + (this._boneRecoil * 0.12);
        }
      } catch (e) {}

      // Setup animations
      try {
        const { walkClip, runClip } = createWalkRunAnimations(bones);
        this.mixer = new THREE.AnimationMixer(this.mesh);
        this._walkAction = this.mixer.clipAction(walkClip);
        this._walkAction.loop = THREE.LoopRepeat;
        this._runAction = this.mixer.clipAction(runClip);
        this._runAction.loop = THREE.LoopRepeat;
        // start paused; we'll play when moving
        // actions created but not started; we'll play/stop during update
      } catch (e) {
        console.warn("Failed to create grunt animations", e);
      }

      // Attach a simple weapon placeholder to right hand for visualization
      try {
        // build a simple pistol-like mesh (group) with black gunmetal material
        const pistolMat = new THREE.MeshStandardMaterial({ color: 0x111219, metalness: 0.95, roughness: 0.25 });
        const weaponMesh = new THREE.Group();
        weaponMesh.name = 'enemy_weapon_mesh';

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), pistolMat);
        body.position.set(0.02, -0.02, 0.0);
        weaponMesh.add(body);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8), pistolMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.02, 0, 0.14);
        weaponMesh.add(barrel);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.03), pistolMat);
        grip.position.set(-0.04, -0.06, -0.02);
        grip.rotation.z = 0.35;
        weaponMesh.add(grip);

        weaponMesh.position.set(0.08, -0.04, 0.08);
        weaponMesh.rotation.x = -0.15;

        // small muzzle flash object (hidden initially)
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
        const flash = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), flashMat);
        flash.name = 'muzzle_flash';
        flash.visible = false;
        flash.position.set(0.02, 0, 0.26);
        weaponMesh.add(flash);

        // attach to hand_r if available
        const handBone = this.mesh.skeleton?.bones?.find(b => b.name === 'hand_r');
        if (handBone) {
          handBone.add(weaponMesh);
        } else {
          this.mesh.add(weaponMesh);
        }

        this.weaponMesh = weaponMesh;
        this.weaponMuzzle = flash;
        this._weaponOriginalPos = weaponMesh.position.clone();
        this._weaponRecoil = 0;
        this._boneRecoil = 0;
      } catch (e) {}

      // store skeleton and bones for later manipulation
      this.skeleton = skeleton;
      this.bones = bones;
      // store base bone rotations so recoil can be applied additively and decayed
      this._boneBaseRot = {};
      Object.keys(bones).forEach(k => {
        try { this._boneBaseRot[k] = bones[k].rotation.x || 0; } catch(_) { this._boneBaseRot[k] = 0; }
      });

      // Apply optional stance overrides (e.g., wide gun stance)
      const stance = this.behavior?.params?.stance || instanceConfig.stance || null;
      if (stance === 'wideGun') {
        try {
          const ul = this.bones['upper_leg_l'];
          const ur = this.bones['upper_leg_r'];
          if (ul) {
            ul.rotation.z = 0.22; // tilt outward
            ul.position.x = -0.28; // wider
          }
          if (ur) {
            ur.rotation.z = -0.22;
            ur.position.x = 0.28;
          }
          if (this.bones['spine']) this.bones['spine'].rotation.x = -0.08; // slight forward lean
        } catch (e) {}
      }

    } else {
      // fallback sprite
      const plane = new THREE.PlaneGeometry(1.2, 1.8);
      const tex = new THREE.TextureLoader().load(mergedDef.sprite);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      this.mesh = new THREE.Mesh(plane, mat);

      // place mesh at given position
      this.mesh.position.copy(this.position);
      this.basePosition = this.mesh.position.clone(); // used for lerping back
      this.baseRotationY = this.facing;
      this._lastBasePosition = this.basePosition.clone();
    }
// NOW path behavior can safely initialize
if (this.behavior.pattern === "path") {
  this._initPathBehavior(this.behavior.params || {});
}
    // preserve initial scale
    this.baseScale = this.mesh.scale.clone();

    this.mesh.rotation.y = this.baseRotationY;
    this.mesh.userData.enemyId = this.id;
    this.mesh.name = `enemy_${this.id}`;

    this.sceneGroup = sceneGroup;
    this.sceneGroup.add(this.mesh);

    // animation/pop state variables
    this._lastUpdateMs = performance.now();
    this._isDead = false;
this._isFullyPoppedTarget = false;
    // gait/footfall state
    this._gaitPhase = 0; // radians
    this._gaitOffset = 0; // current bob offset

    // Pop/out timing configuration with jitter
    const p = this.behavior.params || {};
    this._coverParams = {
      hideDurationMs: (p.hideDurationMs ?? 1200),
      popDurationMs: (p.popDurationMs ?? 800),
      firingDurationMs: (p.firingDurationMs ?? 900),
      minIntervalMs: (p.minIntervalMs ?? 700),
      maxIntervalMs: (p.maxIntervalMs ?? 2200),
      popTransitionMs: (p.popTransitionMs ?? 180), // lerp time when popping out
      retreatTransitionMs: (p.retreatTransitionMs ?? 220), // lerp time when retreating
      leanOffset: (p.leanOffset ?? 0.28),
      crouchOffsetY: (p.crouchOffsetY ?? -0.55),
      crouchScale: (p.crouchScale ?? 0.92),
      leanRotationRad: (p.leanRotationRad ?? 0.20),
      fireIntervalMs: (p.fireIntervalMs ?? 400)
    };

    // initialize pop/cover state - will randomize first hide
    this._popState = {
      phase: "hidden", // hidden | popping | firing | retreating
      phaseSince: performance.now(),
      // next interval chosen randomly to stagger many enemies
      nextHiddenDuration: this._randInterval(this._coverParams.hideDurationMs, this._coverParams.maxIntervalMs)
    };

    // offsets used for animation targets (computed per enemy; lean side chosen randomly)
this._targetOffset = new THREE.Vector3(0, 0, 0);
    
this._leanSide = 1; // default right

// Explicit override from behavior params
if (this.behavior?.params?.leanSide) {
  this._leanSide = (this.behavior.params.leanSide === "left") ? -1 : 1;
} else if (this.coverType === "full") {
  const cover = this._resolveCoverObject();
  if (cover && cover.position && cover.size) {
    const wallCenterX = cover.position.x;
    const wallHalfX = cover.size.x * 0.5;

    const leftEdgeX  = wallCenterX - wallHalfX;
    const rightEdgeX = wallCenterX + wallHalfX;

    const distToLeft  = Math.abs(this.basePosition.x - leftEdgeX);
    const distToRight = Math.abs(this.basePosition.x - rightEdgeX);

    // Lean out from the nearest edge
    this._leanSide = (distToLeft < distToRight) ? -1 : 1;
  }
}
if (this.coverType === "full") {
  this._snapBasePositionToCoverEdge();
}

    // knockback vector applied on top of other offsets (decays over time)
    this._knockback = new THREE.Vector3();

    // For firing cadence while popped
    this._lastFireWhilePopped = 0;

    // Safety: clamp mesh visible initially depending on state
    if (this._popState.phase === "hidden") {
      this.mesh.visible = (this.behavior.pattern !== "popOutFromCover"); // visible if not cover pattern
    }
  }

  	
	_postSpawnInit() {
  if (this._hasEngagedPlayer) return;
  this._hasEngagedPlayer = true;
  this._playVoice("engage");
}


  _randInterval(min, max) {
    // return a random ms interval between min and max
    return min + Math.floor(Math.random() * Math.max(0, (max - min)));
  }
_randomTauntDelay() {
  return 4000 + Math.random() * 8000; // 4–12 seconds
} // end _randomTauntDelay

  
  //
  // Generic damage entrypoint (used by projectiles, bullets, explosions)
  // Accepts optional damageType
  //
  takeDamage(amount, damageType = "normal") {
    if (this._isDead) return;
    //console.log("current HP:  "+this.hp+", damage dealt is "+amount)
	this.hp -= amount;

    this._playRandom(this.hitSounds);

      if (this.hp > 0) {
    this._playVoice("pain");
  } else {
    this._playVoice("death");
    this.die();
  }
  }

  //
  // Explosion-specific damage entrypoint.
  // explosionPos is optional (THREE.Vector3) and used to compute knockback direction.
  // This exists so Explosion class can call takeExplosionDamage(...) if it wants to include knockback.
  //
  takeExplosionDamage(amount, damageType = "normal", explosionPos = null) {
    if (this._isDead) return;

    // apply HP damage
    this.takeDamage(amount, damageType);

    // apply knockback impulse away from explosion center
    if (explosionPos && this.mesh) {
      const dir = this.mesh.position.clone().sub(explosionPos);
      const dist = dir.length();
      if (dist > 0) {
        dir.normalize();
        // scale knockback by damage and inverse distance attenuation (clamped)
        const falloff = Math.max(0.15, 1 - (dist / Math.max(1, (dist + 0.0001))));
        // tweak multiplier to taste; smaller values to avoid flying sprites too far
        const impulse = (amount / Math.max(1, this.maxHp)) * 0.25 * falloff;
        this._knockback.add(dir.multiplyScalar(impulse));
      }
    }
  }

  die() {
    if (this._isDead) return;  // prevent double death
    this._isDead = true;
  this._playRandom(this.deathSounds);
    // Hide the mesh immediately
    if (this.mesh) this.mesh.visible = false;

    // Remove from enemyMeshes so raycasting no longer hits it
    if (this.mesh) {
        this.mesh.traverse(obj => {
            if (obj.isMesh) {
                const idx = window.sceneLoader.enemyMeshes.indexOf(obj);
                if (idx >= 0) window.sceneLoader.enemyMeshes.splice(idx, 1);
            }
        });
    }

    // Trigger death callback (objective check)
    if (typeof this.onDeath === "function") this.onDeath(this.id);

    console.log("Enemy died:", this.id, "Enemies remaining:", 
        window.sceneLoader.enemies.filter(e => !e._isDead).length
    );
}





update(deltaMs, nowMs, player) {
    if (this._isDead) return;
    if (!ENEMY_AI_ENABLED) return; // GLOBAL STOP
      this._postSpawnInit(); // ADD THIS
	const pattern = this.behavior.pattern;
    const p = this.behavior.params || {};


if (
  !this._isDead &&
  this.voiceTaunt.length > 0 &&
  window.enemyVoiceManager
) {
  if (this._nextTauntTime === null) {
    this._nextTauntTime = nowMs + this._randomTauntDelay();
  } else if (nowMs >= this._nextTauntTime) {
    window.enemyVoiceManager.request({
      enemy: this,
      type: "taunt",
      clips: this.voiceTaunt
    });

    this._nextTauntTime = nowMs + this._randomTauntDelay();
  }
}

    
	if (pattern === "meleeRush") {
      this._updateMeleeRush(deltaMs, nowMs, this.behavior.params || {}, player);
}

	else if (pattern === "popOutFromCover") {

	  this._updatePopOut(deltaMs, nowMs, p);
    } else if (pattern === "patrol") {
      this._updatePatrol(deltaMs, nowMs, p);
	  } else if (pattern === "path") {
  this._updatePath(deltaMs);
    } else {
      this._updateStand(deltaMs, nowMs, p);
    }

    // Movement detection -> update animation state and facing
    try {
      const last = this._lastBasePosition || new THREE.Vector3();
      const moved = this.basePosition.distanceTo(last) > 0.001;

      // Face direction of intended movement (unless strafing logic applied elsewhere)
      if (moved) {
        const dir = this.basePosition.clone().sub(last);
        if (dir.lengthSq() > 1e-6) {
          const angle = Math.atan2(dir.x, dir.z);
          this._targetRotationY = angle;
        }
      }

      // toggle walk/run animations
      if (this.mixer && this._walkAction) {
        if (moved) {
          // resume walk action
          if (this._runAction && this.weapon && this.weapon.fireRateMs < 300) {
            // use run
            try { this._walkAction && this._walkAction.stop(); } catch(_){}
            try { this._runAction && this._runAction.play(); } catch(_){}
          } else {
            try { this._runAction && this._runAction.stop(); } catch(_){}
            try { this._walkAction && this._walkAction.play(); } catch(_){}
          }
        } else {
          // pause actions when idle
          try { this._walkAction && this._walkAction.stop(); } catch(_){}
          try { this._runAction && this._runAction.stop(); } catch(_){}
        }
      }
      // Footfall bob: add vertical offset driven by gait phase when moving
      try {
        const movedDist = this.basePosition.distanceTo(last);
        if (movedDist > 0.001) {
          const speed = movedDist / Math.max(1e-6, deltaMs / 1000); // units/sec
          const freq = Math.min(4.0, Math.max(1.2, speed * 1.5));
          this._gaitPhase = (this._gaitPhase || 0) + (deltaMs / 1000) * freq * Math.PI * 2;
          const amp = THREE.MathUtils.clamp(0.02 + speed * 0.005, 0.02, 0.12);
          const bob = Math.sin(this._gaitPhase) * amp;
          if (!this._targetOffset) this._targetOffset = new THREE.Vector3(0, 0, 0);
          this._targetOffset.y = (this._targetOffset.y || 0) + bob;
          this._gaitOffset = bob;
        } else {
          // decay
          this._gaitPhase = 0;
          this._gaitOffset = (this._gaitOffset || 0) * 0.75;
          if (this._targetOffset) this._targetOffset.y = (this._targetOffset.y || 0) * 0.75;
        }
      } catch (e) {}

      this._lastBasePosition = this.basePosition.clone();
    } catch (e) {}

    // always apply smoothing interpolation to the mesh transform toward target offset/rotation/scale
    this._applyAnimationSmoothing(deltaMs);
  }
_updatePath(deltaMs) {
  if (!this._path || !this._path.active) return;

  const path = this._path;
  const step = path.steps[path.stepIndex];
  if (!step) return;

  path.stepElapsedMs += deltaMs;

  if (step.type === "pause") {
    if (path.stepElapsedMs >= step.durationMs) {
      this._advancePathStep();
    }
    return;
  }

  if (step.type === "move") {
    const t = Math.min(1, path.stepElapsedMs / step.durationMs);

    const delta = step.distance * t;
    const prevDelta =
      step.distance * Math.min(1, (path.stepElapsedMs - deltaMs) / step.durationMs);

    const frameDelta = delta - prevDelta;

    switch (step.axis) {
      case "x": path.currentOffset.x += frameDelta; break;
      case "y": path.currentOffset.y += frameDelta; break;
      case "z": path.currentOffset.z += frameDelta; break;
    }

    // Apply authoritative position
    this.basePosition.copy(path.origin).add(path.currentOffset);
    this._targetPosition.copy(this.basePosition);

    if (path.stepElapsedMs >= step.durationMs) {
      this._advancePathStep();
    }
  }
}
_advancePathStep() {
  const path = this._path;
  path.stepElapsedMs = 0;
  path.stepIndex++;

  if (path.stepIndex >= path.steps.length) {
    if (path.loop) {
      path.stepIndex = 0;
    } else {
      path.active = false;
    }
  }
}
_initPathBehavior(params) {
  const steps = Array.isArray(params.steps) ? params.steps : [];

  this._path = {
    active: true,
    loop: params.loop !== false,
    steps,
    stepIndex: 0,
    stepElapsedMs: 0,

    // Path origin is the enemy's starting base position
    origin: this.basePosition.clone(),

    // Accumulated offset from origin
    currentOffset: new THREE.Vector3()
  };

  // Ensure animation targets exist
  this._targetPosition = this.basePosition.clone();
  this._targetOffset = new THREE.Vector3(0, 0, 0);
}

_playVoice(type) {
  if (!window.enemyVoiceManager) return;

  const clips = this.voice?.[type];
  if (!clips || clips.length === 0) return;

  window.enemyVoiceManager.request({
    enemy: this,
    type,
    clips
  });
}
_playRandom(arr) {
    if (!arr || arr.length === 0) return;
    const s = new Audio(arr[Math.floor(Math.random() * arr.length)]);
    s.currentTime = 0;
    s.play().catch(() => {});
  }
_updateMeleeRush(deltaMs, nowMs, params = {}, player) {

  // -------------------------------------------------
  // SAFETY GUARDS
  // -------------------------------------------------
  if (this._isDead) return; // correct death flag
  if (!this.mesh || !this.mesh.position) return;
  if (!player || !player.position) return;

  // Ensure rush target vector exists
  if (!this._rushTarget) {
    this._rushTarget = new THREE.Vector3();
  } // closing rushTarget init

  // -------------------------------------------------
  // Parameters
  // -------------------------------------------------
  const p = {
    approachSpeed: 2.2,
    meleeRange: 1.5,
    sideOffset: 1.1,
    attackCooldownMs: 700,
    ...params
  };

  const deltaSeconds = deltaMs / 1000;

  // Direction to player
  const dirToPlayer = this._rushTarget
    .copy(player.position)
    .sub(this.basePosition);

  const distanceToPlayer = dirToPlayer.length();

  // -------------------------------------------------
  // MOVEMENT
  // -------------------------------------------------
  if (distanceToPlayer > p.meleeRange) {
    dirToPlayer.normalize();

    // Side weave for less robotic motion
    const side = new THREE.Vector3()
      .crossVectors(dirToPlayer, new THREE.Vector3(0, 1, 0))
      .normalize();

    side.multiplyScalar(p.sideOffset * Math.sin(nowMs * 0.002));

    const moveVector = dirToPlayer
      .add(side)
      .normalize()
      .multiplyScalar(p.approachSpeed * deltaSeconds);

    // Advance enemy
    this.basePosition.add(moveVector);
    this._targetPosition.copy(this.basePosition);
  }

  // -------------------------------------------------
  // ATTACK
  // -------------------------------------------------
  if (distanceToPlayer <= p.meleeRange) {
    this.meleeAttack(player);
  }
}

  meleeAttack(player) {
  if (!this.mesh || this._isDead) return;
  if (!player || player.hp <= 0) return;

  const nowMs = performance.now();

  // Initialize cooldown tracker
  if (!this._lastMelee) this._lastMelee = 0;

  const meleeCooldown = 800;
  if (nowMs - this._lastMelee < meleeCooldown) return;

  const reach = 2.0;
  const radius = 1.2;
  const damage = 10;
  const knockbackForce = 0.25;

  const origin = this.mesh.position;
  const targetPos = player.position; // SAFE: Vector3

  const dist = origin.distanceTo(targetPos);

  if (dist > reach + radius) return; // ❗ no hit, no cooldown

  // ✅ HIT CONFIRMED — now consume cooldown
  this._lastMelee = nowMs;

  console.log("Melee hit!");

  player.takeDamage(damage);

  // Optional knockback
  if (player.mesh) {
const dir = targetPos.clone().sub(origin).normalize();

    
	if (!player._knockback) player._knockback = new THREE.Vector3();
    player._knockback.add(dir.multiplyScalar(knockbackForce));
  }

  try {
    const s = new Audio("assets/sfx/swing_medium.ogg");
    s.currentTime = 0;
    s.play().catch(() => {});
  } catch (_) {}
}

  //
  // Fire projectile using SceneLoader callback
  //
  _attemptFire(nowMs) {
	    if (!ENEMY_AI_ENABLED) return; // HARD STOP
    
	
	if (nowMs < this._nextAllowedFireMs) return;
  if (!this.weapon.canFire(nowMs) || !this.player || !this.fireCallback) return;

  // Compute muzzle from weapon mesh if available so projectiles originate from barrel
  let muzzle = this.mesh.position.clone();
  if (this.weaponMesh) {
    try {
      muzzle = new THREE.Vector3();
      this.weaponMesh.getWorldPosition(muzzle);
      // translate forward along weapon's world forward (z) if possible
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.weaponMesh.getWorldQuaternion(new THREE.Quaternion()));
      muzzle.add(forward.multiplyScalar(0.12));
    } catch (e) {
      muzzle = this.mesh.position.clone();
      muzzle.y += 0.9;
    }
  } else {
    muzzle.y += 0.9;
  }

  const targetPos =
    this.player.mesh?.position.clone() || new THREE.Vector3(0, 1.7, 0);

  // HARD BLOCK: do not fire if wall is between muzzle and player
  if (!this._hasClearShot(muzzle, targetPos)) {
    return;
  }

  // Fire is now physically valid
  this.weapon.recordFire(nowMs);
  // Enemy-level pause before next firing sequence
  if (this.firePauseMs > 0) {
    this._nextAllowedFireMs = nowMs + this.firePauseMs;
  }
  // Compute direction with accuracy deviation
  const idealDir = targetPos.clone().sub(muzzle).normalize();
  const deviatedDir = idealDir.clone();

  if (this.accuracy < 1.0) {
    const maxAngle = (1 - this.accuracy) * (Math.PI / 6);
    const randAxis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();
    const angle = (Math.random() - 0.5) * maxAngle;
    deviatedDir.applyAxisAngle(randAxis, angle).normalize();
  }

  // Spawn projectile
  this.fireCallback(
    muzzle,
    muzzle.clone().add(deviatedDir.multiplyScalar(28)),
    28
  );

  // Visual muzzle flash
  try {
    if (this.weaponMuzzle) {
      this.weaponMuzzle.visible = true;
      setTimeout(() => { try { this.weaponMuzzle && (this.weaponMuzzle.visible = false); } catch(_){} }, 80);
    }
  } catch (e) {}

  // Apply weapon recoil impulse (local displacement) and bone recoil
  try {
    this._weaponRecoil = Math.max(this._weaponRecoil || 0, 0.06);
    this._boneRecoil = Math.max(this._boneRecoil || 0, 0.35);
  } catch (e) {}

  // Optional immediate-hit logic
  const angleBetween = idealDir.angleTo(deviatedDir);
  const hitThreshold = 0.03;

  if (angleBetween <= hitThreshold) {
    window.dispatchEvent(
      new CustomEvent("enemyFiredHitPlayer", {
        detail: { id: this.id, damage: this.weapon.damage }
      })
    );
  }
}

  //
  // Behaviors
  //
  _updateStand(deltaMs, nowMs, params) {
	      if (!ENEMY_AI_ENABLED) return; // STOP behavior entirely
    const interval = params.fireIntervalMs || 1200;
    if (!this._lastStandFire) this._lastStandFire = 0;
    if (nowMs - this._lastStandFire > interval) {
      this._attemptFire(nowMs);
      this._lastStandFire = nowMs;
    }
  }

  _updatePatrol(deltaMs, nowMs, params) {
	      if (!ENEMY_AI_ENABLED) return; // STOP behavior entirely
    if (!this._patrol) {
      this._patrol = {
        dir: 1,
        minX: (params.minX ?? this.position.x - 2),
        maxX: (params.maxX ?? this.position.x + 2),
        speed: (params.speed ?? 0.004)
      };
    }

    const p = this._patrol;
    const newX = this.mesh.position.x + p.dir * p.speed * deltaMs;

    if (newX < p.minX || newX > p.maxX) {
      p.dir *= -1;
    } else {
      this.mesh.position.x = newX;
    }

    if (!this._lastPatrolFire || nowMs - this._lastPatrolFire > (params.fireIntervalMs || 1500)) {
      this._attemptFire(nowMs);
      this._lastPatrolFire = nowMs;
    }
  }

  _updatePopOut(deltaMs, nowMs, params) {
	      if (!ENEMY_AI_ENABLED) return; // STOP behavior entirely
    // Ensure _coverParams reflect any runtime overrides
    const cp = this._coverParams;

    // Evaluate the pop state machine
    const s = this._popState;
    const elapsed = nowMs - s.phaseSince;

    if (s.phase === "hidden") {
      // hidden: enemy should be mostly behind cover; we randomize duration on entry
      if (!s.nextHiddenDuration) {
        // initial randomization
        s.nextHiddenDuration = this._randInterval(cp.hideDurationMs, cp.maxIntervalMs);
      }
      // Make sure mesh is set to "behind cover" pose
      this._setTargetForCoverHidden(cp);

      if (elapsed >= s.nextHiddenDuration) {
        // begin popping
        s.phase = "popping";
        s.phaseSince = nowMs;
        // decide popDuration (how long transition to fully popped takes)
        s.transitionMs = cp.popTransitionMs;
        this.mesh.visible = true; // make visible and transition out
        // reset firing cadence tracker
        this._lastFireWhilePopped = 0;
      }
    } else if (s.phase === "popping") {
      // transition toward popped pose
      this._setTargetForCoverPopped(cp);

      if (elapsed >= (s.transitionMs || cp.popTransitionMs)) {
        s.phase = "firing";
        s.phaseSince = nowMs;
        // how long will we stay firing before retreat
        s.firingDuration = this._randInterval(cp.firingDurationMs * 0.6, cp.firingDurationMs * 1.4);
      }
    } else if (s.phase === "firing") {
      // hold popped pose and periodically fire
      this._setTargetForCoverPopped(cp);
if (this._isFullyPoppedTarget &&
    nowMs - this._lastFireWhilePopped > cp.fireIntervalMs) {
  this._attemptFire(nowMs);
  this._lastFireWhilePopped = nowMs;
}

      if (elapsed >= (s.firingDuration || cp.firingDurationMs)) {
        // start retreating
        s.phase = "retreating";
        s.phaseSince = nowMs;
        s.transitionMs = cp.retreatTransitionMs;
      }
    } else if (s.phase === "retreating") {
      // move back into hidden pose smoothly
      this._setTargetForCoverHidden(cp);

      if (elapsed >= (s.transitionMs || cp.retreatTransitionMs)) {
        // go hidden; pick next random wait
        s.phase = "hidden";
        s.phaseSince = nowMs;
        s.nextHiddenDuration = this._randInterval(cp.hideDurationMs, cp.maxIntervalMs);
        // optionally hide mesh if desired - keep visible but behind cover pose is enough
        // this.mesh.visible = false; // commented out so the sprite stays visible but tucked behind cover
      }
    }
  }

  // compute pose target when fully popped (shooting)
  _setTargetForCoverPopped(cp) {
  // Mark intent, not visual completion (Issue 3 fix)
  this._isFullyPoppedTarget = true;

  // Base position clone
  this._targetPosition = this.basePosition.clone();

  if (this.coverType === "full") {
    const lean = this._leanSide * cp.leanOffset;

    // Lean out from cover edge
    this._targetPosition.x += lean;

    // Slight vertical nudge for visual clarity
    this._targetPosition.y += 0.02;
  } else {
    // Low cover: vertical pop
    this._targetPosition.y = this.basePosition.y - cp.crouchOffsetY;

  }

  // No positional offset accumulation here
  this._targetOffset.set(0, 0, 0);
}

  // compute pose target when hidden (behind cover)
  _setTargetForCoverHidden(cp) {
  // Clear intent flag (Issue 3 fix)
  this._isFullyPoppedTarget = false;

  this._targetPosition = this.basePosition.clone();

  if (this.coverType === "full") {
    // Tuck slightly deeper than lean to avoid edge clipping
    const tuck = -this._leanSide * (cp.leanOffset + 0.05);
    this._targetPosition.x += tuck;
  }

  // Reset offsets cleanly
  this._targetOffset.set(0, 0, 0);
}

  // Smoothly lerp actual mesh transform toward target transforms each frame
  _applyAnimationSmoothing(deltaMs) {
    // If targets not set yet, ensure defaults
    if (!this._targetPosition) {
      this._targetPosition = this.basePosition.clone();
    }
    if (!this._targetRotationY && this._targetRotationY !== 0) {
      this._targetRotationY = this.baseRotationY;
    }
    if (!this._targetScale) {
      this._targetScale = this.baseScale.clone();
    }
    if (!this._targetOffset) {
      this._targetOffset = new THREE.Vector3(0, 0, 0);
    }

    // smoothing factor scaled by deltaMs to look consistent across framerates
    const t = Math.min(1, deltaMs / 120); // adapt speed; tweak as needed

    // position: basePosition + offset
    const desiredPos = this._targetPosition.clone().add(this._targetOffset);
    this.mesh.position.lerp(desiredPos, t);

    // Apply knockback offset on top of smooth pose
    // Decay the knockback each frame (exponential-ish)
    const decayFactor = Math.pow(0.9, Math.max(1, deltaMs / 16)); // smaller deltaMs -> slower decay steps
    this.mesh.position.add(this._knockback);
    this._knockback.multiplyScalar(decayFactor);
    if (this._knockback.lengthSq() < 1e-6) {
      this._knockback.set(0, 0, 0);
    }

    // rotation Y lerp (use simple interpolation)
    const currentY = this.mesh.rotation.y;
    const targetY = this._targetRotationY;
    // normalize angles
    let delta = targetY - currentY;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.mesh.rotation.y = currentY + delta * t;

    // scale lerp
    this.mesh.scale.lerp(this._targetScale, t);
  }

  dispose() {
    if (this.mesh && this.sceneGroup) {
      this.sceneGroup.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (this.mesh.material.map) this.mesh.material.map.dispose();
      this.mesh.material.dispose();
    }
  }
}
export function killAllEnemies() {
  ENEMY_INSTANCES.forEach(enemy => {
    if (!enemy._isDead) enemy.die();
  });
}
