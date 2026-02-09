import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
import { getWeapon } from "./weapons.js";
import { createMannequin } from './humanoid.js';
import { createWalkRunAnimations } from './animations.js';
import { loadCharacter, loadAnimationClips, normalizeAndGroundModel, findFootBonesMinY, computeSkinnedMeshesMinMaxY, CAMERA_HEIGHT } from './characterLoader.js';
import { equipApparelList } from './clothing/index.js';
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
    // Active state: if `active` is explicitly false in the instance config
    // the enemy is loaded but stays invisible / AI-disabled until activated.
    this._isActive = (typeof mergedDef.active === 'undefined') ? true : !!mergedDef.active;
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

    // store sceneGroup early so async loaders can attach models immediately
    this.sceneGroup = sceneGroup;

    this.player = player;
    this.fireCallback = fireCallback;

    // Public method to toggle active/inactive state at runtime.
    this.setActive = (active) => {
      const now = !!active;
      const was = !!this._isActive;
      this._isActive = now;
      if (!this.mesh) return;
      try {
        if (this._isActive) {
          // Ensure root group visible
          try { this.mesh.visible = true; } catch(e) {}
          this.mesh.traverse(o => {
            if (o.isMesh) {
              o.visible = true;
              o.frustumCulled = false;
              o.userData.enemyId = this.id;
              if (window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes) && !window.sceneLoader.enemyMeshes.includes(o)) {
                window.sceneLoader.enemyMeshes.push(o);
              }
            }
          });
          // Debug: log mesh counts after activation
          try {
            let meshCount = 0, visCount = 0;
            this.mesh.traverse(o => { if (o.isMesh) { meshCount++; if (o.visible) visCount++; } });
            console.log(`[Enemy ${this.id}] setActive(true) meshes=${meshCount} visible=${visCount}`);
          } catch (e) {}
          try { if (typeof this._postSpawnInit === 'function') this._postSpawnInit(); } catch(e) {}
        } else {
          this.mesh.traverse(o => {
            if (o.isMesh) {
              o.visible = false;
              if (window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes)) {
                const idx = window.sceneLoader.enemyMeshes.indexOf(o);
                if (idx >= 0) window.sceneLoader.enemyMeshes.splice(idx, 1);
              }
            }
          });
        }
      } catch (e) {}
    };

    // If mesh will be created asynchronously, ensure inactive enemies remain hidden.
    if (!this._isActive) {
      const _hidePoll = setInterval(() => {
        try {
          if (this.mesh) {
            this.mesh.traverse(o => {
              if (o.isMesh) {
                o.visible = false;
                if (window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes)) {
                  const idx = window.sceneLoader.enemyMeshes.indexOf(o);
                  if (idx >= 0) window.sceneLoader.enemyMeshes.splice(idx, 1);
                }
              }
            });
            clearInterval(_hidePoll);
          }
        } catch (e) {
          clearInterval(_hidePoll);
        }
      }, 40);
    }

    this.position = new THREE.Vector3(
      instanceConfig.position.x || 0,
      instanceConfig.position.y || 0,
      instanceConfig.position.z || 0
    );

    // Single source-of-truth for ground height used by all enemies.
    // Priority: explicit instanceConfig.groundY -> sceneLoader.groundY -> 0
    this._groundY = (typeof instanceConfig.groundY === 'number')
      ? instanceConfig.groundY
      : (window.sceneLoader && typeof window.sceneLoader.groundY === 'number')
        ? window.sceneLoader.groundY
        : 0;

    // Helper to consistently scale and ground loaded models so feet sit at groundY
    // Uses the centralized normalizeAndGroundModel utility for consistent behavior
    this._finalizeModel = (mesh, defObj, instanceCfg) => {
      if (!mesh) return;
      try {
        // Determine groundY from instance config, scene loader, or default to 0
        const groundY = (typeof (instanceCfg && instanceCfg.groundY) === 'number')
          ? instanceCfg.groundY
          : ((window.sceneLoader && typeof window.sceneLoader.groundY === 'number')
            ? window.sceneLoader.groundY
            : 0);

        // Get target height (defaults to camera height)
        const targetHeight = (defObj && (defObj.desiredHeight || defObj.modelDesiredHeight))
          ? (defObj.desiredHeight || defObj.modelDesiredHeight)
          : CAMERA_HEIGHT;

        // Get explicit scale settings from def or instance config
        const explicitScale = (defObj && defObj.modelScale !== undefined && defObj.modelScale !== null)
          ? Number(defObj.modelScale)
          : (instanceCfg && instanceCfg.modelScale !== undefined ? Number(instanceCfg.modelScale) : null);

        const scalePercent = (defObj && defObj.modelScalePercent !== undefined && defObj.modelScalePercent !== null)
          ? Number(defObj.modelScalePercent)
          : (instanceCfg && instanceCfg.modelScalePercent !== undefined ? Number(instanceCfg.modelScalePercent) : null);

        // Store original position X/Z to restore after normalization (which resets position)
        const origX = mesh.position.x;
        const origZ = mesh.position.z;

        // Use the centralized normalizeAndGroundModel utility
        const result = normalizeAndGroundModel(mesh, {
          targetHeight,
          groundY,
          explicitScale,
          scalePercent,
          debug: true
        });

        // Restore original X/Z position
        mesh.position.x = origX;
        mesh.position.z = origZ;
        mesh.updateMatrixWorld(true);

        console.log(`[Enemy ${this.id}] finalizeModel: scale=${result.finalScale?.toFixed(4)}, height=${result.finalHeight?.toFixed(4)}, groundOffset=${result.groundOffset?.toFixed(4)}`);

        // Ensure basePosition aligns to ground
        try {
          if (!this.basePosition) this.basePosition = mesh.position.clone();
          this.basePosition.y = groundY;
        } catch (e) {}

        // Make visible and register for hit tests (only if active)
        try {
          mesh.traverse(o => {
            if (o.isMesh) {
              o.frustumCulled = false;
              o.castShadow = true;
              o.receiveShadow = true;
              o.userData = Object.assign({}, o.userData || {}, {});
              // Respect inactive state: add meshes to scene but keep invisible until activation
              if (this._isActive) {
                o.visible = true;
                if (window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes)) {
                  if (!window.sceneLoader.enemyMeshes.includes(o)) {
                    window.sceneLoader.enemyMeshes.push(o);
                  }
                  o.userData.enemyId = this.id;
                }
              } else {
                o.visible = false;
                o.userData.enemyId = this.id;
              }
            }
          });
        } catch (e) {}
      } catch (e) { console.warn(`[Enemy ${this.id}] finalizeModel failed`, e); }
    };

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

    // If this is a Drone type, load its GLB model (no animations required)
    if (mergedDef.displayName === 'Drone' || mergedDef.type === 'Drone' || String(instanceConfig.type || '').toLowerCase() === 'drone') {
      try {
        console.log(`[Enemy ${this.id}] Drone: load requested modelUrl='${mergedDef.modelUrl}'`);
      } catch (e) {}
      if (mergedDef.modelUrl) {
        loadCharacter({ url: mergedDef.modelUrl, autoPlay: false }).then(res => {
          if (!res || !res.model) return;
          try { this.sceneGroup.remove(this.mesh); } catch(_){}
          this.mesh = res.model;
          this.mesh.userData.enemyId = this.id;
          this.mesh.name = `enemy_${this.id}`;
          try {
            if (this.position) this.mesh.position.copy(this.position);
            // Preserve explicit instance Y for flying entities (e.g., Drone).
            // Only snap to ground for non-flying enemies.
            const isDrone = (mergedDef.displayName === 'Drone' || mergedDef.type === 'Drone' || String(instanceConfig.type || '').toLowerCase() === 'drone');
            if (!isDrone && typeof this._groundY === 'number') this.mesh.position.y = this._groundY;
          } catch(e) {}
          // Normalize and ground the Drone model using the centralized utility
          try {
            // Reset to unit scale to make normalization predictable
            this.mesh.scale.setScalar(1);
            this.mesh.updateMatrixWorld(true);
            // Call centralized normalizer which handles target height, explicit scales, and grounding
            try { normalizeAndGroundModel(this.mesh, mergedDef, instanceConfig); } catch (e) { console.warn('[Enemy] normalizeAndGroundModel failed', e); }
            // Record base scale and lock to prevent later overwrites
            try { this.baseScale = this.mesh.scale.clone(); this._targetScale = this.baseScale.clone(); this._scaleLocked = true; } catch(e) {}
          } catch (e) {}

          // make sure frustum culling / shadow flags are set. Visibility depends on active state.
          try { this.mesh.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; o.visible = !!this._isActive; } }); } catch(e) {}
          try { this.sceneGroup.add(this.mesh); } catch(e) {}
          // register meshes for hit tests AFTER scaling so raycasts/bboxes reflect final size
          try {
            if (window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes)) {
              this.mesh.traverse(o => {
                if (o.isMesh) {
                  if (this._isActive) {
                    if (!window.sceneLoader.enemyMeshes.includes(o)) window.sceneLoader.enemyMeshes.push(o);
                  }
                  o.userData.enemyId = this.id;
                }
              });
            }
          } catch(e) {}
          try { this._finalizeModel && this._finalizeModel(this.mesh, mergedDef, instanceConfig); } catch(e) {}
          // Additional per-model correction: if this model is known problematic (brute),
          // sample skinned vertices and force the bottom to match groundY.
          try {
            if (/brute\.glb$/i.test(String(mergedDef.modelUrl || ''))) {
              try {
                const sk = computeSkinnedMeshesMinMaxY(this.mesh, 2000);
                if (sk && isFinite(sk.minY)) {
                  const desiredGround = (typeof this._groundY === 'number') ? this._groundY : 0;
                  const dy = desiredGround - sk.minY;
                  if (isFinite(dy) && Math.abs(dy) < 100) {
                    this.mesh.position.y += dy;
                    this.mesh.updateMatrixWorld(true);
                    console.log(`[Enemy ${this.id}] brute-specific skinned-ground adjust dy=${dy.toFixed(4)} (sk.minY=${sk.minY.toFixed(4)})`);
                  }
                }
              } catch (e) { console.warn(`[Enemy ${this.id}] brute-specific grounding failed`, e); }
            }
          } catch (e) {}
          try { console.log(`[Enemy ${this.id}] Drone model attached: ${mergedDef.modelUrl}`); } catch(e) {}
          // Log materials for each mesh in the Drone so we can inspect whether
          // textures or vertex colors are present (helps diagnose white/flat look).
          try {
            this.mesh.traverse(o => {
              if (!o.isMesh) return;
              try {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach((m, idx) => {
                  if (!m) return console.log(`[Enemy ${this.id}] mesh='${o.name}' mat[${idx}] = null`);
                  const mapPresent = !!m.map;
                  const vc = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
                  const colorHex = (m.color && typeof m.color.getHexString === 'function') ? m.color.getHexString() : 'n/a';
                  console.log(`[Enemy ${this.id}] mesh='${o.name}' mat[${idx}] type=${m.type} map=${mapPresent} vertexColors=${vc} color=#${colorHex} metalness=${m.metalness} roughness=${m.roughness}`);
                });
              } catch (e) { console.log(`[Enemy ${this.id}] material inspection error`, e); }
            });
          } catch (e) { }
        }).catch(err => { console.error(`[Enemy ${this.id}] Drone model load failed: ${mergedDef.modelUrl}`, err); });
      }
    }

    if (mergedDef.displayName === "Grunt Soldier" || mergedDef.displayName === "Grunt") {
      const { skinnedMesh, skeleton, bones } = createMannequin();
      this.mesh = skinnedMesh;
      // place mesh at given position (but snap Y to global ground)
      this.mesh.position.copy(this.position);
      try { if (typeof this._groundY === 'number') this.mesh.position.y = this._groundY; } catch (e) {}
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

      // Setup animations (procedural fallback)
      try {
        const { walkClip, runClip, idleClip, aimClip, shootClip } = createWalkRunAnimations(bones);
        this.mixer = new THREE.AnimationMixer(this.mesh);
        this._walkAction = walkClip ? this.mixer.clipAction(walkClip) : null;
        if (this._walkAction) this._walkAction.loop = THREE.LoopRepeat;
        this._runAction = runClip ? this.mixer.clipAction(runClip) : null;
        if (this._runAction) this._runAction.loop = THREE.LoopRepeat;
        this._idleAction = idleClip ? this.mixer.clipAction(idleClip) : null;
        if (this._idleAction) this._idleAction.loop = THREE.LoopRepeat;
        this._aimAction = aimClip ? this.mixer.clipAction(aimClip) : null;
        if (this._aimAction) this._aimAction.loop = THREE.LoopRepeat;
        this._shootAction = shootClip ? this.mixer.clipAction(shootClip) : null;
        if (this._shootAction) { this._shootAction.loop = THREE.LoopOnce; this._shootAction.clampWhenFinished = true; }
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

      // If this enemy's resolved weapon looks like a rifle, try to load an AK model
      try {
        const weaponName = (weaponDef && weaponDef.name) ? String(weaponDef.name).toLowerCase() : '';
        const rifleKeywords = ['rifle', 'assault', 'ak47', 'ak-47', 'ak'];
        const shouldLoadAk = rifleKeywords.some(k => weaponName.includes(k));
        const akPath = 'assets/models/ak47.glb';
        if (shouldLoadAk) {
          const loader = new GLTFLoader();
          loader.load(akPath,
            (gltf) => {
              try {
                const weaponModel = gltf.scene || gltf.scenes?.[0];
                if (!weaponModel) return;
                weaponModel.name = 'ak47_model';
                weaponModel.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = false; } });

                // heuristic: find a right-hand bone to attach to
                let handBone = null;
                try {
                  if (this.mesh && this.mesh.skeleton && Array.isArray(this.mesh.skeleton.bones)) {
                    handBone = this.mesh.skeleton.bones.find(b => /hand|righthand|hand_r|RightHand/i.test(b.name));
                  }
                } catch (e) { handBone = null; }

                // remove placeholder weaponMesh if present
                try { if (this.weaponMesh && this.weaponMesh.parent) this.weaponMesh.parent.remove(this.weaponMesh); } catch (e) {}

                // adjust scale/offset so model looks roughly right in the hand
                let modelScale = 1.0;
                // try to compute a small scale relative to mesh bbox
                try {
                  const bbox = new THREE.Box3().setFromObject(weaponModel);
                  const size = new THREE.Vector3(); bbox.getSize(size);
                  const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
                  // target approx 0.5m length on model -> scale factor
                  modelScale = 0.5 / maxDim;
                } catch (e) { modelScale = 0.01; }
                modelScale = THREE.MathUtils.clamp(modelScale, 0.005, 0.5);
                weaponModel.scale.setScalar(modelScale);

                // default local transform tweak (tweakable later)
                weaponModel.position.set(0.06, -0.04, 0.08);
                weaponModel.rotation.set(-0.15, 0, 0);

                if (handBone) {
                  handBone.add(weaponModel);
                } else if (this.mesh) {
                  this.mesh.add(weaponModel);
                }

                this.weaponMesh = weaponModel;
              } catch (e) { console.warn('Failed to attach ak47.glb to enemy:', e); }
            },
            undefined,
            (err) => { /* ignore load errors silently */ }
          );
        }
      } catch (e) { console.warn('AK attach check failed', e); }

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

      // Action map + crossfade helper
      this._actions = {};
      if (this._walkAction) this._actions.walk = this._walkAction;
      if (this._runAction) this._actions.run = this._runAction;
      if (this._idleAction) this._actions.idle = this._idleAction;
      if (this._aimAction) this._actions.aim = this._aimAction;
      if (this._shootAction) this._actions.shoot = this._shootAction;
      this._currentAction = null;
      this._activateAction = (name, fade = 0.18) => {
        if (!this.mixer || !this._actions) return;
        const next = this._actions[name];
        if (!next) return;
        const prev = this._currentAction;
        if (prev === next) return;
        try {
          next.reset();
          try { next.enabled = true; } catch(_) {}
          try { next.setEffectiveWeight(1.0); } catch(_) {}
          next.play();
          try {
            const clip = next.getClip ? next.getClip() : null;
            const tracks = clip && clip.tracks ? clip.tracks.length : 0;
            console.log(`[Enemy ${this.id}] _activateAction -> name='${name}' enabled=${next.enabled} weight=${next.getEffectiveWeight ? next.getEffectiveWeight() : 'n/a'} clipTracks=${tracks}`);
          } catch (e) {}
        } catch (e) {}
        if (prev) {
          try { prev.crossFadeTo(next, fade, false); } catch (e) {}
        }
        this._currentAction = next;
      };

      // If a model URL is provided, try to load the glTF and swap in its model/clips
      if (mergedDef.modelUrl) {
        try {
          console.log(`[Enemy ${this.id}] requesting modelUrl='${mergedDef.modelUrl}' (instance id='${instanceConfig.id}')`);
        } catch (e) {}
        loadCharacter({ url: mergedDef.modelUrl }).then(async res => {
          if (!res || !res.model) return;
          try { this.sceneGroup.remove(this.mesh); } catch(_){}
          const old = this.mesh;
          this.mesh = res.model;
          // Immediately ensure SkinnedMesh parts are bound and materials support skinning
          try {
            this.mesh.traverse(o => {
              if (!o.isSkinnedMesh) return;
              try {
                // Ensure material supports skinning
                if (o.material) {
                  if (Array.isArray(o.material)) o.material.forEach(m => { if (m) m.skinning = true; });
                  else o.material.skinning = true;
                }
                // If skeleton present, bind to ensure PropertyBinding resolves to bones under this.mesh
                if (o.skeleton && !o.bindMatrix) {
                  try { o.bind(o.skeleton, o.bindMatrix || new THREE.Matrix4()); } catch(_) {}
                } else if (o.skeleton) {
                  try { o.bind(o.skeleton, o.bindMatrix); } catch(_) {}
                }
                // normalize skin weights when available
                try { if (typeof o.normalizeSkinWeights === 'function') o.normalizeSkinWeights(); } catch(_) {}
                o.frustumCulled = false;
              } catch (e) {}
            });
            try { this.mesh.updateMatrixWorld(true); } catch(_) {}
          } catch (e) {}
          // --- Diagnostic checks (1..9) to systematically find why animations leave the model in T-pose ---
          try {
            // 1) Verify the model is skinned: traverse and log first SkinnedMesh
            let firstSkinned = null;
            this.mesh.traverse(o => { if (!firstSkinned && o.isSkinnedMesh) firstSkinned = o; });
            if (!firstSkinned) {
              console.error(`[DIAG Enemy ${this.id}] No SkinnedMesh found in loaded model`);
              // continue diagnostics but do not throw to avoid aborting load flow
            }
            console.log(`[DIAG Enemy ${this.id}] first SkinnedMesh='${firstSkinned.name || '(unnamed)'}' skeletonBones=${(firstSkinned.skeleton && firstSkinned.skeleton.bones) ? firstSkinned.skeleton.bones.length : 0}`);

            // 2) Verify animation clips exist on the loaded resource
            const animClips = (res.clips || res.animations || []);
            if (!animClips || animClips.length === 0) {
              console.error(`[DIAG Enemy ${this.id}] No animation clips found on loaded model`);
              // continue diagnostics but do not throw
            }
            console.log(`[DIAG Enemy ${this.id}] animationClips.length=${animClips.length} names=${animClips.map(c=>c.name||c.uuid).join(',')}`);

            // 3) Verify bone name compatibility: log skeleton bone names and track names
            const boneNames = (firstSkinned.skeleton && Array.isArray(firstSkinned.skeleton.bones)) ? firstSkinned.skeleton.bones.map(b => b.name) : [];
            console.log(`[DIAG Enemy ${this.id}] skeleton boneNames count=${boneNames.length}`);
            try { console.log(boneNames.join(',')); } catch(e){}

            const trackRoots = new Set();
            animClips.forEach(c => { (c.tracks||[]).forEach(t => { const root = (t.name||t.path||'').split('.')[0]; if (root) trackRoots.add(root); }); });
            const trackRootsArr = Array.from(trackRoots);
            console.log(`[DIAG Enemy ${this.id}] animation track root names count=${trackRootsArr.length}`);
            try { console.log(trackRootsArr.join(',')); } catch(e){}

            // check mapping of track roots to bone names (exact or mixamorig->mixamorig9 variant)
            const mappingReport = trackRootsArr.map(root => {
              const exact = boneNames.includes(root);
              const with9 = boneNames.includes(root.replace(/mixamorig(?!9)/i, 'mixamorig9'));
              const foundByGet = !!this.mesh.getObjectByName(root);
              return { root, exact, with9, foundByGet };
            });
            console.log(`[DIAG Enemy ${this.id}] track->bone mapping:`, mappingReport);

            // 4) Create the AnimationMixer correctly: MUST be created with the model root
            try {
              console.log(`[DIAG Enemy ${this.id}] creating AnimationMixer: new THREE.AnimationMixer(this.mesh)`);
              this.mixer = new THREE.AnimationMixer(this.mesh); // explicit constructor call
            } catch (e) { console.error(`[DIAG Enemy ${this.id}] failed creating mixer`, e); throw e; }

            // 5) Bind and play the first clip as a smoke-test: clipAction, reset, play
            try {
              const testClip = animClips[0];
              console.log(`[DIAG Enemy ${this.id}] testing clip play: '${testClip.name||testClip.uuid}'`);
              const testAction = this.mixer.clipAction(testClip);
              testAction.reset();
              testAction.play();
              console.log(`[DIAG Enemy ${this.id}] action.isRunning=${typeof testAction.isRunning==='function'?testAction.isRunning():"n/a"} timeScale=${testAction.timeScale}`);
            } catch (e) { console.error(`[DIAG Enemy ${this.id}] failed to bind/play test clip`, e); }

            // 6) Confirm mixer updates every frame: log where mixers are updated in game loop (see game.js)
            console.log(`[DIAG Enemy ${this.id}] mixer assigned; the game loop should call this.mixer.update(deltaSec) each frame for ENEMY_INSTANCES`);

            // 7) Force a pose change via setTime and check hip quaternion change
            try {
              // choose hip bone name heuristically
              const hip = firstSkinned.skeleton.bones.find(b => /hip|hips/i.test(b.name)) || firstSkinned.skeleton.bones[0];
              const before = hip.quaternion.clone();
              try { this.mixer.setTime(1.0); } catch(e) { /* setTime might not be supported on mixer in some versions */ }
              // force update to apply poses
              try { this.mixer.update(0); } catch(e) {}
              const after = hip.quaternion;
              console.log(`[DIAG Enemy ${this.id}] hip quat before=${before.toArray().map(n=>n.toFixed(4)).join(',')} after=${after.toArray().map(n=>n.toFixed(4)).join(',')}`);
              if (before.equals(after)) {
                console.warn(`[DIAG Enemy ${this.id}] hip quaternion unchanged after mixer.setTime -> indicates clips did not bind to skeleton or actions have no effect`);
              }
            } catch (e) { console.error(`[DIAG Enemy ${this.id}] failed forcing pose change`, e); }

            // 8) Confirm the animated object is attached to the scene
            try {
              console.log(`[DIAG Enemy ${this.id}] mesh.parent =`, this.mesh.parent ? (this.mesh.parent.name || this.mesh.parent.type) : null);
              if (!this.mesh.parent) { console.error(`[DIAG Enemy ${this.id}] mesh.parent is null; model is not attached to scene`); /* do not throw */ }
            } catch (e) { console.error(e); }

            // Diagnostic block complete
            console.log(`[DIAG Enemy ${this.id}] diagnostics completed successfully`);
          } catch (diagErr) {
            console.error(`[DIAG Enemy ${this.id}] diagnostics failed:`, diagErr);
            // continue without throwing so model load flow can finish
          }
          // Diagnostic: print model hierarchy and ensure skinned meshes are viewable
          try {
            const lines = [];
            const indent = (n) => '  '.repeat(n);
            const listNode = (o, depth=0) => {
              let info = `${indent(depth)}- ${o.type || o.constructor.name}`;
              if (o.name) info += ` name='${o.name}'`;
              if (o.isMesh) info += ` (mesh)`;
              if (o.isSkinnedMesh) info += ` (skinned)`;
              if (o.isBone) info += ` (bone)`;
              info += ` pos=${(o.position?.x||0).toFixed(2)},${(o.position?.y||0).toFixed(2)},${(o.position?.z||0).toFixed(2)}`;
              if (o.scale) info += ` scale=${o.scale.x.toFixed(3)},${o.scale.y.toFixed(3)},${o.scale.z.toFixed(3)}`;
              lines.push(info);
              // force skinned meshes to be visible and enable skinning on materials
              try {
                if (o.isSkinnedMesh) {
                  if (o.material) {
                    if (Array.isArray(o.material)) o.material.forEach(m => { if (m) m.skinning = true; });
                    else o.material.skinning = true;
                  }
                  o.frustumCulled = false;
                  o.visible = !!this._isActive;
                }
                if (o.isMesh && o.material) {
                  o.frustumCulled = false;
                  o.visible = !!this._isActive;
                }
              } catch (e) {}
              o.children.forEach(c => listNode(c, depth+1));
            };
            listNode(this.mesh, 0);
            console.log(`[Enemy ${this.id}] model hierarchy:\n` + lines.join('\n'));
            // per-mesh bbox (world)
            this.mesh.traverse(o => {
              if (o.isMesh) {
                try {
                  const b = new THREE.Box3().setFromObject(o);
                  const s = new THREE.Vector3();
                  b.getSize(s);
                  console.log(`[Enemy ${this.id}] mesh '${o.name || o.type}' size=${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)}`);
                } catch (e) {}
              }
            });
          } catch (e) { console.warn('Enemy model diagnostic failed', e); }
          // preserve transforms (ensure Y aligns to global ground truth)
          try {
            const preservePos = (this.basePosition || old.position || new THREE.Vector3()).clone();
            if (typeof this._groundY === 'number') preservePos.y = this._groundY;
            this.mesh.position.copy(preservePos);
          } catch(_){}
          try { this.mesh.rotation.y = this.baseRotationY; } catch(_){ }
          // Apply model scaling: prefer explicit `modelScale` on the enemy definition,
          // otherwise auto-scale the glTF to a reasonable target height so it matches
          // the previous procedural mannequin size and doesn't appear gigantic.
          try {
            const desiredHeight = 1.7; // target height in world units
            // allow scene author to override with either an exact scalar or percent
            const explicitScale = mergedDef.modelScale || instanceConfig.modelScale || null;
            const explicitPercent = mergedDef.modelScalePercent ?? instanceConfig.modelScalePercent ?? null;

            // Robust auto-scaling behavior:
            // - If `modelScale` is provided, use it directly (explicit override).
            // - Otherwise compute an auto-scale so model height == `desiredHeight`.
            // - If `modelScalePercent` is provided, interpret it as a multiplier of the auto-scale
            //   (e.g., 50 -> half the auto-scale, 100 -> auto-scale, 200 -> double the auto-scale).
            try {
              // measure native bounds at scale 1 to compute auto-scale
              this.mesh.scale.setScalar(1);
              this.mesh.updateMatrixWorld(true);
              const box = new THREE.Box3().setFromObject(this.mesh);
              const size = new THREE.Vector3();
              box.getSize(size);
              const height = size.y || 1.0;

              const autoScale = (height > 0.001) ? (desiredHeight / height) : 0.02;

              let finalScale = autoScale;
              if (explicitScale !== null && explicitScale !== undefined) {
                finalScale = Number(explicitScale) || autoScale;
              } else if (explicitPercent !== null && explicitPercent !== undefined) {
                const p = Number(explicitPercent) || 0;
                const percentScalar = p / 100;
                finalScale = autoScale * percentScalar;
              }

              // Guard against extreme or non-finite values from malformed FBX/GLB assets
              if (!isFinite(finalScale) || Number.isNaN(finalScale)) finalScale = autoScale;
              // clamp to a sensible range so models don't become microscopic or gigantic
              finalScale = THREE.MathUtils.clamp(finalScale, 0.02, 5);

              this.mesh.scale.setScalar(finalScale);
              this.mesh.updateMatrixWorld(true);
            } catch (e) {
              // if scaling computation fails, leave mesh scale unchanged
            }

            // after scaling, align feet to basePosition.y so model sits on the floor
            try {
                // compute bounding box robustly (fall back to per-geometry boxes if needed)
                let box2 = new THREE.Box3().setFromObject(this.mesh);
                if (!isFinite(box2.min.x) || !isFinite(box2.min.y) || !isFinite(box2.min.z)) {
                  // fallback: union individual geometry bounding boxes
                  box2 = new THREE.Box3();
                  this.mesh.traverse(o => {
                    if (o.isMesh && o.geometry) {
                      try {
                        o.geometry.computeBoundingBox();
                        const b = o.geometry.boundingBox.clone();
                        b.applyMatrix4(o.matrixWorld);
                        box2.union(b);
                      } catch (e) {}
                    }
                  });
                }

                let minY = box2.min.y;
                if (!isFinite(minY)) minY = 0;
                // Use single ground truth for alignment
                const groundY = (typeof this._groundY === 'number') ? this._groundY : (this.basePosition?.y ?? old.position?.y ?? 0);
                // shift the mesh vertically so its bottom (minY) matches groundY
                let dy = groundY - minY;
                // clamp excessive shifts (likely from malformed bbox) to avoid moving models off-screen
                if (!isFinite(dy) || Math.abs(dy) > 10) {
                  console.warn(`Enemy ${this.id} alignment dy=${dy} suspicious — clamping to within +/-10`);
                  dy = THREE.MathUtils.clamp(isFinite(dy) ? dy : 0, -10, 10);
                }
                this.mesh.position.y = (this.mesh.position.y || 0) + dy;
                this.mesh.updateMatrixWorld(true);
                // ensure basePosition Y aligns to ground truth after grounding
                try {
                  if (!this.basePosition) this.basePosition = this.mesh.position.clone();
                  this.basePosition.y = groundY;
                } catch (e) {}
                // Ensure model visibility/frustum settings respect active state
                this.mesh.visible = !!this._isActive;
                this.mesh.traverse(o => { if (o.isMesh) { o.visible = !!this._isActive; o.frustumCulled = false; } });

                // Colorize parts to simulate clothing: legs (dark blue), torso/arms (dark gray), feet (brown)
                try {
                  const modelBox = (() => {
                    try { return new THREE.Box3().setFromObject(this.mesh); } catch (e) { return null; }
                  })();
                  if (modelBox) {
                    const minY = isFinite(modelBox.min.y) ? modelBox.min.y : 0;
                    const maxY = isFinite(modelBox.max.y) ? modelBox.max.y : minY + 1.7;
                    const height = Math.max(0.001, maxY - minY);
                    const legsThreshold = minY + height * 0.45; // below -> legs
                    const feetThreshold = minY + height * 0.18; // below -> feet
                    const torsoThreshold = minY + height * 0.65; // between legs and torso

                    const COLOR = {
                      legs: 0x0b3b8c, // dark blue
                      torso: 0x444444, // dark gray
                      feet: 0x8b5a2b,  // brown
                      flesh: 0xffd7c4  // light flesh tone
                    };

                    this.mesh.traverse(o => {
                      if (!o.isMesh) return;
                      try {
                        // If this mesh already has a texture map, preserve it and don't overwrite
                        try {
                          const hasOrigMap = !!(o.material && (o.material.map || (Array.isArray(o.material) && o.material.some(m => m && m.map))));
                          if (hasOrigMap) {
                            try {
                              if (Array.isArray(o.material)) {
                                o.material.forEach(m => { try { if ('skinning' in m) m.skinning = !!o.isSkinnedMesh; if (!m.side) m.side = THREE.FrontSide; m.needsUpdate = true; } catch(_) {} });
                              } else if (o.material) {
                                try { if ('skinning' in o.material) o.material.skinning = !!o.isSkinnedMesh; } catch(_) {}
                                o.material.side = o.material.side || THREE.FrontSide;
                                o.material.needsUpdate = true;
                              }
                              o.castShadow = true; o.receiveShadow = true;
                            } catch(_) {}
                            return;
                          }
                        } catch(_) {}

                        // try name-based detection for head/hands first
                        const name = (o.name || '').toLowerCase();
                        const isHead = /head|face|skull|ceph|mixamorighead/.test(name);
                        const isHand = /hand|thumb|index|middle|ring|pinky/.test(name);

                        if (isHead || isHand) {
                          const hasV = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
                          if (hasV) {
                            try {
                              if (o.material) {
                                try { o.material.vertexColors = true; } catch(_) {}
                                o.material.needsUpdate = true;
                              } else {
                                const mm = new THREE.MeshBasicMaterial({ vertexColors: true });
                                try { if (o.isSkinnedMesh) mm.skinning = true; } catch(_) {}
                                o.material = mm;
                              }
                              o.castShadow = true; o.receiveShadow = true;
                            } catch (e) {}
                            return;
                          }

                          const m = new THREE.MeshStandardMaterial({ color: COLOR.flesh });
                          try { m.skinning = !!o.isSkinnedMesh; } catch (_) {}
                          o.material = m;
                          o.castShadow = true;
                          o.receiveShadow = true;
                          o.material.needsUpdate = true;
                          return;
                        }

                        // compute bounding box center safely
                        let box;
                        try { box = new THREE.Box3().setFromObject(o); } catch (e) { box = null; }
                        if (!box) return;
                        const center = new THREE.Vector3();
                        box.getCenter(center);
                        const cy = center.y;

                        let color = null;
                        if (cy <= feetThreshold) color = COLOR.feet;
                        else if (cy <= legsThreshold) color = COLOR.legs;
                        else if (cy <= torsoThreshold) color = COLOR.torso;
                        else {
                          // head/upper torso region: leave flesh for recognized head meshes, otherwise keep original
                          // but avoid overwriting accessories/textures
                          return;
                        }

                        // Create a shader-augmented material that picks color by world Y position
                        try {
                          const hexToVec = (h) => {
                            const r = ((h >> 16) & 255) / 255;
                            const g = ((h >> 8) & 255) / 255;
                            const b = (h & 255) / 255;
                            return `${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}`;
                          };
                          const feetColor = hexToVec(COLOR.feet);
                          const legsColor = hexToVec(COLOR.legs);
                          const torsoColor = hexToVec(COLOR.torso);

                          const hasV = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
                          if (hasV) {
                            // Use vertex colors directly when present
                            const vm = new THREE.MeshBasicMaterial({ vertexColors: true });
                            try { if (o.isSkinnedMesh) vm.skinning = true; } catch(_) {}
                            o.material = vm;
                            o.castShadow = true;
                            o.receiveShadow = true;
                            o.material.needsUpdate = true;
                          } else {
                            const baseMat = new THREE.MeshStandardMaterial({ color: color });
                            // enable skinning if mesh is skinned
                            if (o.isSkinnedMesh) baseMat.skinning = true;

                            baseMat.onBeforeCompile = (shader) => {
                              shader.vertexShader = 'varying vec3 vWorldPos;\n' + shader.vertexShader;
                              shader.vertexShader = shader.vertexShader.replace('\n#define BEGIN_LIGHTING', '\n#define BEGIN_LIGHTING\n vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;');
                              shader.fragmentShader = 'varying vec3 vWorldPos;\n' + shader.fragmentShader;
                              const inject = `
                                vec3 feetC = vec3(${feetColor});
                                vec3 legsC = vec3(${legsColor});
                                vec3 torsoC = vec3(${torsoColor});
                                float y = vWorldPos.y;
                                vec3 c = vec3(${color>>16 & 255}/255.0, ${color>>8 & 255}/255.0, ${color & 255}/255.0);
                                if (y <= ${feetThreshold.toFixed(3)}) c = feetC;
                                else if (y <= ${legsThreshold.toFixed(3)}) c = legsC;
                                else if (y <= ${torsoThreshold.toFixed(3)}) c = torsoC;
                                diffuseColor = vec4(c, opacity);
                              `;
                              shader.fragmentShader = shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', inject);
                            };

                            o.material = baseMat;
                            o.castShadow = true;
                            o.receiveShadow = true;
                            o.material.needsUpdate = true;
                          }
                        } catch (e) {
                          const m = new THREE.MeshStandardMaterial({ color });
                          try { m.skinning = !!o.isSkinnedMesh; } catch (_) {}
                          o.material = m;
                          o.material.needsUpdate = true;
                        }
                      } catch (e) {}
                    });
                  }
                } catch (e) { console.warn('Apparel colorize failed', e); }
            } catch (e) {}
          } catch (e) {}
          this.mesh.userData.enemyId = this.id;
          this.mesh.name = `enemy_${this.id}`;
          try { if (this.position) this.mesh.position.copy(this.position); if (typeof this._groundY === 'number') this.mesh.position.y = this._groundY; } catch (e) {}
          this.sceneGroup.add(this.mesh);
          try { this._finalizeModel && this._finalizeModel(this.mesh, mergedDef, instanceConfig); } catch(e) {}
          // Ensure any SkinnedMesh parts are correctly bound to their skeletons
          try {
            this.mesh.traverse(o => {
              if (!o.isSkinnedMesh) return;
              try {
                // Ensure materials support skinning
                if (o.material) {
                  if (Array.isArray(o.material)) o.material.forEach(m => { if (m) m.skinning = true; });
                  else o.material.skinning = true;
                }
                // Bind skeleton if not already bound
                if (o.skeleton) {
                  try { o.bind(o.skeleton, o.bindMatrix); } catch(_) {}
                  try { o.skeleton.pose(); } catch(_) {}
                }
                // Normalize skin weights where available
                try { if (typeof o.normalizeSkinWeights === 'function') o.normalizeSkinWeights(); } catch(_) {}
                o.frustumCulled = false;
              } catch (e) {}
            });
            try { this.mesh.updateMatrixWorld(true); } catch(_) {}
          } catch (e) {}
          try {
            this.sceneGroup.castShadow = true;
            this.sceneGroup.receiveShadow = true;
            if (this.mesh) { this.mesh.castShadow = true; this.mesh.receiveShadow = true; }
          } catch (e) {}
          // Register skinned/mesh parts for projectile hit detection and adjust visual scale/grounding
          try {
            // Add all mesh parts to SceneLoader.enemyMeshes for raycast hit tests
            if (window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes)) {
              this.mesh.traverse(o => {
                if (o.isMesh) {
                  if (this._isActive) {
                    if (!window.sceneLoader.enemyMeshes.includes(o)) window.sceneLoader.enemyMeshes.push(o);
                    o.visible = true;
                  } else {
                    o.visible = false;
                  }
                  // tag for easy lookup
                  o.userData.enemyId = this.id;
                }
              });
            }

            // Scale model so head/eyes sit approximately at camera eye height (1.7)
            const desiredEyeY = 1.7;
            let head = this.mesh.getObjectByName('mixamorig9Head') || this.mesh.getObjectByName('mixamorigHead');
            if (!head && this.mesh.skeleton && Array.isArray(this.mesh.skeleton.bones)) {
              head = this.mesh.skeleton.bones.find(b => /head/i.test(b.name));
            }
            if (head) {
              const p = new THREE.Vector3();
              head.getWorldPosition(p);
              const currentHeadY = p.y;
              if (currentHeadY > 0.01) {
                const currentScale = (this.mesh.scale && this.mesh.scale.x) ? this.mesh.scale.x : 1;
                let scaleFactor = desiredEyeY / currentHeadY;
                // clamp to avoid extreme resizes
                scaleFactor = THREE.MathUtils.clamp(scaleFactor, 0.5, 1.25);
                if (Math.abs(scaleFactor - 1.0) > 0.01) {
                  this.mesh.scale.setScalar(currentScale * scaleFactor);
                  this.mesh.updateMatrixWorld(true);
                }
              }
            }

            // Ground feet: shift mesh so its bbox.min.y equals desired basePosition.y
            try {
              this.mesh.updateMatrixWorld(true);
              const box = new THREE.Box3().setFromObject(this.mesh);
              if (box && isFinite(box.min.y)) {
                const minY = box.min.y;
                const desiredY = (this.basePosition && typeof this.basePosition.y === 'number') ? this.basePosition.y : 0;
                const dy = desiredY - minY;
                if (Math.abs(dy) > 1e-4) {
                  this.mesh.position.y += dy;
                  this.mesh.updateMatrixWorld(true);
                }
              }
            } catch (e) {}
          } catch (e) { console.warn('[Enemy] registration/scale/grounding failed', e); }

          // removed visual debug proxies (capsule/box) — meshes now registered for hit tests above

          // Visual proxy fallback: for skinned meshes that fail to render, add a static
          // MeshBasicMaterial proxy to ensure something visible appears at the same place.
          try {
            this.mesh.traverse(o => {
              if (!o.isSkinnedMesh) return;
              try {
                // If the skinned mesh already has a readable material (texture or vertex colors),
                // skip creating the visual proxy to avoid drawing a flat overlay on top.
                try {
                  const hasTexOrVC = !!(o.material && (o.material.map || o.material.vertexColors || (Array.isArray(o.material) && o.material.some(m => m && (m.map || m.vertexColors)))));
                  if (hasTexOrVC) return;
                } catch (e) {}
                // compute world transform
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                o.getWorldPosition(worldPos);
                o.getWorldQuaternion(worldQuat);
                o.getWorldScale(worldScale);

                const proxyMat = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, wireframe: false });
                const proxyGeom = o.geometry.clone();
                const proxy = new THREE.Mesh(proxyGeom, proxyMat);
                proxy.name = `proxy_${o.name || 'skinned'}_${this.id}`;
                // place proxy in world space by adding to scene and setting world transform
                this.sceneGroup.add(proxy);
                proxy.position.copy(worldPos);
                proxy.quaternion.copy(worldQuat);
                proxy.scale.copy(worldScale.multiplyScalar(this.mesh.scale.x));
                proxy.updateMatrixWorld(true);
              } catch (e) {}
            });
          } catch (e) {}
          // Ensure materials are renderable: replace problematic materials with a simple
          // fallback while preserving existing texture maps where available.
          try {
            this.mesh.traverse(o => {
              if (!o.isMesh) return;
              try {
                // preserve any useful texture maps while ensuring the material supports skinning
                const hasMap = !!(o.material && (o.material.map || (Array.isArray(o.material) && o.material.some(m => m && m.map))));

                const replaceWithStandard = (srcMat, skinned) => {
                  try {
                    const hasVertexColors = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
                    try { console.log(`[Enemy ${this.id}] replaceWithStandard mesh='${o.name}' vertexColors=${hasVertexColors}`); } catch(_) {}
                    const nmParams = {
                      color: (srcMat && srcMat.color) ? srcMat.color : 0xffffff,
                      normalMap: srcMat && srcMat.normalMap ? srcMat.normalMap : null,
                      metalnessMap: srcMat && srcMat.metalnessMap ? srcMat.metalnessMap : null,
                      roughnessMap: srcMat && srcMat.roughnessMap ? srcMat.roughnessMap : null,
                      aoMap: srcMat && srcMat.aoMap ? srcMat.aoMap : null
                    };
                    if (hasVertexColors) {
                      // prefer unlit material for vertex colors so they display reliably
                      const bm = new THREE.MeshBasicMaterial({ vertexColors: true });
                      try { if ('skinning' in bm) bm.skinning = !!skinned; } catch(_) {}
                      bm.side = srcMat && srcMat.side ? srcMat.side : THREE.FrontSide;
                      bm.needsUpdate = true;
                      return bm;
                    } else {
                      nmParams.map = srcMat && srcMat.map ? srcMat.map : null;
                      const nm = new THREE.MeshStandardMaterial(nmParams);
                      try { if ('skinning' in nm) nm.skinning = !!skinned; } catch(_) {}
                      nm.side = srcMat && srcMat.side ? srcMat.side : THREE.FrontSide;
                      nm.transparent = false;
                      nm.needsUpdate = true;
                      return nm;
                    }
                  } catch (e) {
                    return new THREE.MeshStandardMaterial({ color: 0xcccccc });
                  }
                };

                if (Array.isArray(o.material)) {
                  o.material = o.material.map(m => {
                    if (!m) return m;
                    if (m.map) return replaceWithStandard(m, o.isSkinnedMesh);
                    return replaceWithStandard(m, o.isSkinnedMesh);
                  });
                } else {
                  const m = o.material;
                  if (!m || (!hasMap && (m.opacity === 0 || m.transparent))) {
                    o.material = replaceWithStandard(m || {}, o.isSkinnedMesh);
                  } else if (m) {
                    if (o.isSkinnedMesh) {
                      // recreate material to ensure skinning is present and maps preserved
                      const newMat = replaceWithStandard(m, true);
                      o.material = newMat;
                    } else {
                      try { if ('skinning' in m) m.skinning = false; } catch(_) {}
                      m.side = m.side || THREE.FrontSide;
                      m.transparent = false;
                      m.needsUpdate = true;
                    }
                  }
                }

                o.visible = !!this._isActive;
                o.frustumCulled = false;
                o.castShadow = true;
                o.receiveShadow = true;
              } catch (e) {
                console.warn('[Enemy] material traversal error', e);
              }
            });
          } catch (e) { console.warn('[Enemy] material replacement failed', e); }
          // Update stored base scale so smoothing won't revert the model size
          try {
            if (!this._scaleLocked) {
              this.baseScale = this.mesh.scale.clone();
              this._targetScale = this.baseScale.clone();
            }
          } catch (e) {}

          // Final recolor pass: enforce simple cloth/skin colors using world Y thresholds.
          try {
            const COLOR2 = {
              legs: 0x0b3b8c,
              torso: 0x444444,
              feet: 0x8b5a2b,
              flesh: 0xffd7c4
            };
            const box = new THREE.Box3().setFromObject(this.mesh);
            if (box && isFinite(box.min.y) && isFinite(box.max.y)) {
              const minY2 = box.min.y;
              const maxY2 = box.max.y;
              const h2 = Math.max(0.001, maxY2 - minY2);
              const feetT = minY2 + h2 * 0.18;
              const legsT = minY2 + h2 * 0.45;
              const torsoT = minY2 + h2 * 0.65;

              this.mesh.traverse(o => {
                if (!o.isMesh) return;
                try {
                  const name = (o.name || '').toLowerCase();
                  const isHead = /head|face|skull|ceph|mixamorighead/.test(name);
                  const isHand = /hand|thumb|index|middle|ring|pinky/.test(name);

                  let chosen = null;
                  if (isHead || isHand) chosen = COLOR2.flesh;
                  else {
                    let b = null;
                    try { b = new THREE.Box3().setFromObject(o); } catch(_) { b = null; }
                    if (!b) return;
                    const c = new THREE.Vector3(); b.getCenter(c);
                    const cy = c.y;
                    if (cy <= feetT) chosen = COLOR2.feet;
                    else if (cy <= legsT) chosen = COLOR2.legs;
                    else if (cy <= torsoT) chosen = COLOR2.torso;
                    else return;
                  }

                  if (chosen !== null) {
                    // If this mesh already has a texture map, don't overwrite it with recolor.
                    const hasExistingMap = !!(o.material && o.material.map);
                    if (hasExistingMap) return;
                    const hasV = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
                    if (hasV) {
                      try {
                        try { console.log(`[Enemy ${this.id}] finalPass using vertexColors for mesh='${o.name}'`); } catch(_) {}
                        if (o.material) {
                          try { o.material.vertexColors = true; } catch(_) {}
                          o.material.needsUpdate = true;
                        } else {
                          const vm = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.0, roughness: 0.85 });
                          try { if (o.isSkinnedMesh) vm.skinning = true; } catch(_) {}
                          o.material = vm;
                        }
                        // log first vertex color if available
                        try {
                          const ca = o.geometry.attributes.color;
                          if (ca) {
                            const r = ca.getX(0), g = ca.getY(0), b = ca.getZ(0);
                            console.log(`[Enemy ${this.id}] mesh='${o.name}' vertex color[0]=${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)}`);
                          }
                        } catch(_) {}
                        o.castShadow = true; o.receiveShadow = true;
                        try { console.log(`[Enemy ${this.id}] material after finalPass mesh='${o.name}' type=${o.material?.type} vertexColors=${o.material?.vertexColors} map=${!!o.material?.map} visible=${o.visible}`); } catch(_) {}
                      } catch (e) {}
                    } else {
                      const nm = new THREE.MeshStandardMaterial({ color: chosen, metalness: 0.0, roughness: 0.85 });
                      try { if (o.isSkinnedMesh) nm.skinning = true; } catch(_) {}
                      try { nm.emissive = new THREE.Color(chosen); nm.emissiveIntensity = 0.18; } catch(_) {}
                      o.material = nm;
                      o.castShadow = true;
                      o.receiveShadow = true;
                      try { console.log(`[Enemy ${this.id}] material after finalPass mesh='${o.name}' type=${o.material?.type} vertexColors=${o.material?.vertexColors} map=${!!o.material?.map} visible=${o.visible}`); } catch(_) {}
                      o.material.needsUpdate = true;
                    }
                  }
                } catch (e) {}
              });
            }
          } catch (e) { console.warn('Final recolor pass failed', e); }

          // extract bones map if not provided
          this.bones = res.bones || {};
          if (!res.bones) {
            this.bones = {};
            this.mesh.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
          }

          // Equip apparel now that bones map exists
          try {
            const rawApparel = mergedDef.apparel || instanceConfig.apparel || null;
            if (rawApparel && this.bones) {
              // normalize entries and apply model scale so apparel matches model size
              const modelScaleScalar = (this.mesh && this.mesh.scale && this.mesh.scale.x) ? this.mesh.scale.x : 1;
              const mapped = (Array.isArray(rawApparel) ? rawApparel : [rawApparel]).map(e => {
                if (typeof e === 'string') return { name: e, options: { scale: modelScaleScalar } };
                const copy = { name: e.name, options: Object.assign({}, e.options || {}) };
                copy.options.scale = copy.options.scale || modelScaleScalar;
                return copy;
              });
              try { equipApparelList(this.bones, this.sceneGroup, mapped); }
              catch (e) { console.warn('Failed to equip apparel', e); }
            }
          } catch (e) {}

          // adopt mixer: ALWAYS create a new AnimationMixer bound to the model root
          // (avoids mixers created against the original FBX/scene which won't update this.mesh)
          try {
            console.log(`[Enemy ${this.id}] creating AnimationMixer for model root`);
            this.mixer = new THREE.AnimationMixer(this.mesh); // exact constructor call
          } catch (e) {
            console.error(`[Enemy ${this.id}] failed to create AnimationMixer`, e);
            this.mixer = null;
          }
          this._actions = this._actions || {};

          // start with clips embedded in the model (strip position/root tracks to avoid root-motion mismatches)
          (res.clips || []).forEach(clip => {
            try {
              const tracks = (clip.tracks || []).filter(t => !/\.position$/i.test(t.name));
              // normalize track target names to match skeleton (mixamorig -> mixamorig9)
                  const mappedTracks = tracks.map(t => {
                        try {
                          const nt = t.clone ? t.clone() : Object.assign({}, t);
                          const fullname = nt.name || '';
                          const parts = fullname.split('.');
                          let node = parts[0] || '';
                          const rest = parts.slice(1).join('.') || '';
                          try {
                            if (this.mesh && this.mesh.skeleton && Array.isArray(this.mesh.skeleton.bones)) {
                              const bones = this.mesh.skeleton.bones.map(b => b.name || '');
                              // exact or case-insensitive match
                              if (!bones.includes(node)) {
                                const lower = node.toLowerCase();
                                // mixamorig -> mixamorig9 heuristic
                                if (/mixamorig(?!9)/i.test(node)) {
                                  const has9 = bones.some(b => /mixamorig9/i.test(b));
                                  if (has9) node = node.replace(/mixamorig/ig, 'mixamorig9');
                                }
                                if (!bones.includes(node)) {
                                  const found = bones.find(b => (b && b.toLowerCase() === lower) || (b && b.toLowerCase().endsWith(lower)) || (lower && lower.endsWith((b || '').toLowerCase())));
                                  if (found) node = found;
                                }
                              }
                            }
                          } catch (e) {}
                          nt.name = rest ? `${node}.${rest}` : node;
                          return nt;
                        } catch (e) { return t; }
                      });
              const safeClip = new THREE.AnimationClip(clip.name || clip.uuid || 'embedded', clip.duration || -1, mappedTracks);
              const n = (safeClip.name || '').toLowerCase();
              const a = this.mixer.clipAction(safeClip);
              if (n.includes('walk')) { a.loop = THREE.LoopRepeat; this._actions.walk = a; }
              else if (n.includes('run')) { a.loop = THREE.LoopRepeat; this._actions.run = a; }
              else if (n.includes('idle')) { a.loop = THREE.LoopRepeat; this._actions.idle = a; }
              else if (n.includes('aim')) { a.loop = THREE.LoopRepeat; this._actions.aim = a; }
              else if (n.includes('strafe') || n.includes('side')) {
                // map strafe clips; prefer explicit left/right naming
                if (n.includes('left')) { a.loop = THREE.LoopRepeat; this._actions.strafe_left = a; }
                else if (n.includes('right')) { a.loop = THREE.LoopRepeat; this._actions.strafe_right = a; }
                else { a.loop = THREE.LoopRepeat; this._actions.strafe = a; }
              }
              else if (n.includes('shoot') || n.includes('fire')) { a.loop = THREE.LoopOnce; a.clampWhenFinished = true; this._actions.shoot = a; }
            } catch (e) { console.warn('[Enemy] embedded clip mapping failed', e); }
          });

          // If the scene/def provides external animation URLs, load and append them.
          try {
            const animUrls = mergedDef.animationUrls || instanceConfig.animationUrls || null;
            if (animUrls && typeof animUrls === 'object') {
              const keys = Object.keys(animUrls);
              const loads = keys.map(k => loadAnimationClips(animUrls[k]).then(clips => ({ key: k, clips })).catch((err) => ({ key: k, clips: [], err })));
                const results = await Promise.all(loads);
                results.forEach(r => {
                  try { console.log(`[Enemy ${this.id}] loaded external anim key='${r.key}' clips=${(r.clips||[]).map(c=>c.name||c.uuid).join(',')}`); } catch(_) {}
                  (r.clips || []).forEach(clip => {
                    try {
                      // create a safe copy without position/root tracks to avoid root-motion and scaling mismatch
                      const tracks = (clip.tracks || []).filter(t => !/\.position$/i.test(t.name));
                      const mappedTracks = tracks.map(t => {
                        try {
                          const nt = t.clone ? t.clone() : Object.assign({}, t);
                          const fullname = nt.name || '';
                          const parts = fullname.split('.');
                          let node = parts[0] || '';
                          const rest = parts.slice(1).join('.') || '';
                          try {
                            if (this.mesh && this.mesh.skeleton && Array.isArray(this.mesh.skeleton.bones)) {
                              const bones = this.mesh.skeleton.bones.map(b => b.name || '');
                              if (!bones.includes(node)) {
                                const lower = node.toLowerCase();
                                if (/mixamorig(?!9)/i.test(node)) {
                                  const has9 = bones.some(b => /mixamorig9/i.test(b));
                                  if (has9) node = node.replace(/mixamorig/ig, 'mixamorig9');
                                }
                                if (!bones.includes(node)) {
                                  const found = bones.find(b => (b && b.toLowerCase() === lower) || (b && b.toLowerCase().endsWith(lower)) || (lower && lower.endsWith((b || '').toLowerCase())));
                                  if (found) node = found;
                                }
                              }
                            }
                          } catch (e) {}
                          nt.name = rest ? `${node}.${rest}` : node;
                          return nt;
                        } catch (e) { return t; }
                      });
                      const safeClip = new THREE.AnimationClip(clip.name || clip.uuid || r.key, clip.duration || -1, mappedTracks);
                      const clipName = (safeClip.name || '').toLowerCase();
                      const action = this.mixer.clipAction(safeClip);
                      const k = r.key.toLowerCase();
                      let mapped = null;
                      if (k.includes('walk') || clipName.includes('walk')) { action.loop = THREE.LoopRepeat; this._actions.walk = action; mapped = 'walk'; }
                      else if (k.includes('run') || clipName.includes('run')) { action.loop = THREE.LoopRepeat; this._actions.run = action; mapped = 'run'; }
                      else if (k.includes('idle') || clipName.includes('idle')) { action.loop = THREE.LoopRepeat; this._actions.idle = action; mapped = 'idle'; }
                      else if (k.includes('aim') || clipName.includes('aim')) { action.loop = THREE.LoopRepeat; this._actions.aim = action; mapped = 'aim'; }
                      else if (k.includes('strafe') || clipName.includes('strafe') || k.includes('side') || clipName.includes('side')) {
                        if (k.includes('left') || clipName.includes('left')) { action.loop = THREE.LoopRepeat; this._actions.strafe_left = action; mapped = 'strafe_left'; }
                        else if (k.includes('right') || clipName.includes('right')) { action.loop = THREE.LoopRepeat; this._actions.strafe_right = action; mapped = 'strafe_right'; }
                        else { action.loop = THREE.LoopRepeat; this._actions.strafe = action; mapped = 'strafe'; }
                      }
                      else if (k.includes('shoot') || k.includes('fire') || clipName.includes('shoot') || clipName.includes('fire')) { action.loop = THREE.LoopOnce; action.clampWhenFinished = true; this._actions.shoot = action; mapped = 'shoot'; }
                      else { action.loop = THREE.LoopRepeat; this._actions[k] = action; mapped = k; }
                      try {
                        const tracksCount = (safeClip.tracks||[]).length;
                        console.log(`[Enemy ${this.id}] mapped external clip '${safeClip.name||safeClip.uuid}' -> action='${mapped}' tracks=${tracksCount}`);
                        // log a sample from the first track for debugging
                        if (safeClip.tracks && safeClip.tracks.length) {
                          try {
                            const t0 = safeClip.tracks[0];
                            const name = t0.name || t0.path || '(track)';
                            const times = t0.times || [];
                            const values = t0.values || [];
                            const sample = values.slice(0, Math.min(values.length, 6));
                            console.log(`[Enemy ${this.id}] clipSample track='${name}' times=${times.length>0?times[0]:'<none>'} valuesSample=[${sample.join(',')}]`);
                          } catch(_) {}
                        }
                      } catch(_) {}
                    } catch (e) { console.warn('[Enemy] external clip mapping error', e); }
                  });
                  if (r.err) console.warn(`[Enemy ${this.id}] failed loading anim key='${r.key}':`, r.err);
                });
            }
          } catch (e) { console.warn('Failed to load external animationUrls', e); }

          // Post-attachment grounding fix for brute GLB: after clips are mapped and actions created,
          // force a mixer update to apply the pose, then align foot bones (or bbox) to groundY.
          try {
            const isBrute = (mergedDef && mergedDef.modelUrl && /brute\.glb$/i.test(String(mergedDef.modelUrl))) || (mergedDef && mergedDef.displayName === 'Brute') || (instanceConfig && String(instanceConfig.id || '').toLowerCase().startsWith('brute'));
            if (isBrute) {
              try { if (this.mixer) this.mixer.update(0.0001); } catch (e) {}
              try {
                const beforePosY = this.mesh.position.y || 0;
                const groundY = (typeof this._groundY === 'number') ? this._groundY : 0;
                const footY = findFootBonesMinY(this.mesh);
                console.log(`[Enemy ${this.id}] brute-grounding debug BEFORE: mesh.posY=${beforePosY.toFixed(4)} groundY=${groundY} footY=${footY}`);
                if (footY !== null && isFinite(footY)) {
                  const dy = groundY - footY;
                  console.log(`[Enemy ${this.id}] brute-grounding: footY found -> dy=${dy.toFixed(4)}`);
                  if (Math.abs(dy) > 1e-6) {
                    this.mesh.position.y += dy;
                    this.mesh.updateMatrixWorld(true);
                    if (this.basePosition) this.basePosition.y = groundY;
                    console.log(`[Enemy ${this.id}] brute-grounding: applied dy -> new mesh.posY=${this.mesh.position.y.toFixed(4)}`);
                  }
                } else {
                  try {
                    const box = new THREE.Box3().setFromObject(this.mesh);
                    const minY = box && isFinite(box.min.y) ? box.min.y : NaN;
                    console.log(`[Enemy ${this.id}] brute-grounding: footY not found, bbox.minY=${String(minY)}`);
                    if (isFinite(minY)) {
                      const dy2 = groundY - minY;
                      console.log(`[Enemy ${this.id}] brute-grounding: bbox dy=${dy2.toFixed(4)}`);
                      if (Math.abs(dy2) > 1e-6) {
                        this.mesh.position.y += dy2;
                        this.mesh.updateMatrixWorld(true);
                        if (this.basePosition) this.basePosition.y = groundY;
                        console.log(`[Enemy ${this.id}] brute-grounding: applied bbox dy -> new mesh.posY=${this.mesh.position.y.toFixed(4)}`);
                      }
                    }
                  } catch (e) { console.warn(`[Enemy ${this.id}] brute-grounding bbox error`, e); }
                }
              } catch (e) { console.warn(`[Enemy ${this.id}] brute-grounding error`, e); }
            }
          } catch (e) {}

          // If only a single Mixamo clip exists, create distinct walk/idle actions
          // by cloning the clip so we can crossfade between separate actions.
          try {
            const clips = res.clips || [];
            const hasWalk = !!this._actions.walk;
            const hasIdle = !!this._actions.idle;
            if (clips.length && !(hasWalk && hasIdle)) {
              const primary = clips[0];
              // create a walk action if missing
              if (!this._actions.walk) {
                try {
                  const walkClip = primary.clone ? primary.clone() : Object.assign({}, primary);
                  const wa = this.mixer.clipAction(walkClip);
                  wa.loop = THREE.LoopRepeat;
                  wa.timeScale = 1.0;
                  this._actions.walk = wa;
                } catch (e) {}
              }
              // create an idle action if missing (slower timeScale)
              if (!this._actions.idle) {
                try {
                  const idleClip = primary.clone ? primary.clone() : Object.assign({}, primary);
                  const ia = this.mixer.clipAction(idleClip);
                  ia.loop = THREE.LoopRepeat;
                  ia.timeScale = 0.6;
                  this._actions.idle = ia;
                } catch (e) {}
              }
            }
          } catch (e) {}

          // ensure fallback procedural clips exist on the new mixer if missing
          try {
            const fallback = createWalkRunAnimations(this.bones || {});
            if (fallback.walkClip && !this._actions.walk) { const a = this.mixer.clipAction(fallback.walkClip); a.loop = THREE.LoopRepeat; this._actions.walk = a; }
            if (fallback.runClip && !this._actions.run) { const a = this.mixer.clipAction(fallback.runClip); a.loop = THREE.LoopRepeat; this._actions.run = a; }
            if (fallback.idleClip && !this._actions.idle) { const a = this.mixer.clipAction(fallback.idleClip); a.loop = THREE.LoopRepeat; this._actions.idle = a; }
            if (fallback.aimClip && !this._actions.aim) { const a = this.mixer.clipAction(fallback.aimClip); a.loop = THREE.LoopRepeat; this._actions.aim = a; }
            if (fallback.shootClip && !this._actions.shoot) { const a = this.mixer.clipAction(fallback.shootClip); a.loop = THREE.LoopOnce; a.clampWhenFinished = true; this._actions.shoot = a; }
          } catch (e) {}

          // If no action has been activated yet, autoplay the first available action
          try {
            if (!this._currentAction && this._actions) {
              const keys = Object.keys(this._actions || {});
              if (keys.length) {
                const first = this._actions[keys[0]];
                try { first.reset(); first.play(); this._currentAction = first; } catch (_) {}
                console.log(`[Enemy ${this.id}] autoplayed action=${keys[0]}`);
              }
            }
          } catch (e) {}

          // Log mapped actions and explicitly set an initial action based on behavior
          try {
            const mapped = Object.keys(this._actions || {});
            console.log(`[Enemy ${this.id}] mapped actions:`, mapped);
            const preferred = (this.behavior && this.behavior.pattern === 'path') ? 'walk' : 'idle';
            if (this._actions && this._actions[preferred]) {
              try { this._activateAction(preferred, 0.0); console.log(`[Enemy ${this.id}] activated initial action=${preferred}`); } catch(e) { console.warn(e); }
            } else if (mapped.length) {
              try { this._activateAction(mapped[0], 0.0); console.log(`[Enemy ${this.id}] activated fallback action=${mapped[0]}`); } catch(e) {}
            }
          } catch (e) {}

          // reattach weapon mesh to new hand bone if present
          if (this.weaponMesh) {
            try { this.weaponMesh.parent && this.weaponMesh.parent.remove(this.weaponMesh); } catch(_){}
            const handBone = (this.mesh.skeleton && this.mesh.skeleton.bones) ? this.mesh.skeleton.bones.find(b => b.name === 'hand_r') : this.mesh.getObjectByName('hand_r');
            if (handBone) handBone.add(this.weaponMesh); else this.mesh.add(this.weaponMesh);
          }
          // Ensure the loaded model is grounded to the enemy base position to avoid floating/T-poses
          try {
            const groundY = (typeof this._groundY === 'number') ? this._groundY : ((this.basePosition && typeof this.basePosition.y === 'number') ? this.basePosition.y : 0);
            // Force mesh world Y to equal groundY (preserve x/z)
            if (this.mesh) {
              this.mesh.position.y = groundY;
              this.mesh.updateMatrixWorld(true);
            }
            // ensure basePosition reflects groundY
            try { if (!this.basePosition) this.basePosition = this.mesh.position.clone(); this.basePosition.y = groundY; } catch(_){}
          } catch (e) { }
          // Ensure basePosition and related targets are initialized for loaded models
          try {
            if (!this.basePosition) this.basePosition = this.mesh.position.clone();
            if (this.baseRotationY === undefined || this.baseRotationY === null) this.baseRotationY = this.mesh.rotation.y || 0;
            if (!this._targetPosition) this._targetPosition = this.basePosition.clone();
            if (!this._lastMeshPosition) this._lastMeshPosition = this.mesh.position.clone();
            if (!this._lastBasePosition) this._lastBasePosition = this.basePosition.clone();
          } catch (e) {}
        }).catch(e => { console.warn('Failed to load character glTF', e); });
      }

    } else {
      // fallback sprite
      const plane = new THREE.PlaneGeometry(1.2, 1.8);
      const tex = new THREE.TextureLoader().load(mergedDef.sprite);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      this.mesh = new THREE.Mesh(plane, mat);

      // place mesh at given position
      this.mesh.position.copy(this.position);
      try { if (typeof this._groundY === 'number') this.mesh.position.y = this._groundY; } catch (e) {}
      this.basePosition = this.mesh.position.clone(); // used for lerping back
      this.baseRotationY = this.facing;
      this._lastBasePosition = this.basePosition.clone();
    }
// NOW path behavior can safely initialize
if (this.behavior.pattern === "path") {
  this._initPathBehavior(this.behavior.params || {});
}
    // preserve initial scale (respect any previously-locked scale)
    try { if (!this._scaleLocked) this.baseScale = this.mesh.scale.clone(); } catch(e) {}

    this.mesh.rotation.y = this.baseRotationY;
    this.mesh.userData.enemyId = this.id;
    this.mesh.name = `enemy_${this.id}`;

    this.sceneGroup = sceneGroup;
    // Ensure visibility respects inactive state and register meshes only when active
    try {
      this.mesh.visible = !!this._isActive;
      this.mesh.traverse(o => {
        if (o.isMesh) {
          o.frustumCulled = false;
          if (this._isActive && window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes) && !window.sceneLoader.enemyMeshes.includes(o)) {
            window.sceneLoader.enemyMeshes.push(o);
          }
          o.userData.enemyId = this.id;
        }
      });
    } catch (e) {}
    this.sceneGroup.add(this.mesh);

    // track last known mesh/world position for movement detection (useful for patrol/path)
    this._lastMeshPosition = this.mesh.position.clone();

    // animation/pop state variables
    this._lastUpdateMs = performance.now();
    this._isDead = false;
    this._isDying = false; // true while death animation is playing
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

    // crouch bone blending state (0 = standing, 1 = fully crouched)
    this._currentCrouchAlpha = 0;
    this._targetCrouchAlpha = 0;

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
        // Respect explicit active flag: even if behavior would normally make the
        // enemy visible while hidden, keep it invisible until activated.
        this.mesh.visible = !!this._isActive && (this.behavior.pattern !== "popOutFromCover");
      }
  }

  	
	_postSpawnInit() {
  if (this._hasEngagedPlayer) return;
  this._hasEngagedPlayer = true;
  this._playVoice("engage");
  // Auto-start looped voice if defined (e.g., drones)
  try {
    const loopClips = this.voice?.loop;
    if (loopClips && loopClips.length > 0 && window.enemyVoiceManager) {
      window.enemyVoiceManager.request({ enemy: this, type: 'loop', clips: loopClips });
    }
  } catch (e) {}
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
    if (this._isDead || this._isDying) return;
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
    if (this._isDead || this._isDying) return;  // prevent double death

    // mark as dying so AI/firing stops and future damage is ignored
    this._isDying = true;
    this._playRandom(this.deathSounds);
player._playRandomTaunt();
    // Remove from enemyMeshes so raycasting no longer hits it
    try {
      if (this.mesh) {
        this.mesh.traverse(obj => {
          if (obj.isMesh && window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes)) {
            const idx = window.sceneLoader.enemyMeshes.indexOf(obj);
            if (idx >= 0) window.sceneLoader.enemyMeshes.splice(idx, 1);
          }
        });
      }
    } catch (e) {}

    // Trigger death callback (objective check) immediately (keeps existing flow)
    try { if (typeof this.onDeath === "function") this.onDeath(this.id); } catch (e) {}

    // Try to play a mapped death animation if present; otherwise remove immediately
    try {
      if (this._actions) {
        const candidates = ['dying_rifle','dying','death','die'];
        let deathAction = null;
        let deathKey = null;
        for (let k of candidates) {
          if (this._actions[k]) { deathAction = this._actions[k]; deathKey = k; break; }
        }
        // also accept a generic 'death' action present under other keys
        if (!deathAction) {
          for (let k of Object.keys(this._actions || {})) {
            if (/death|die|dying/i.test(k)) { deathAction = this._actions[k]; deathKey = k; break; }
          }
        }

        if (deathAction && this.mixer) {
          try {
            deathAction.loop = THREE.LoopOnce;
            deathAction.clampWhenFinished = true;
            deathAction.reset();
            deathAction.play();

            const self = this;
            const onFinished = (e) => {
              try {
                if (e.action !== deathAction) return;
                try { self.mixer.removeEventListener('finished', onFinished); } catch(_) {}
                // stop any looping voice attached to this enemy
                try { if (window.enemyVoiceManager && typeof window.enemyVoiceManager.stopLoop === 'function') window.enemyVoiceManager.stopLoop(self); } catch(_) {}
                // final cleanup: remove mesh and mark dead
                try { if (self.sceneGroup && self.mesh) self.sceneGroup.remove(self.mesh); } catch(_) {}
                self._isDead = true;
                self._isDying = false;
              } catch (ex) {}
            };

            this.mixer.addEventListener('finished', onFinished);
            // ensure update loop will keep animating while dying (do not set _isDead yet)
            return;
          } catch (e) {
            // fall through to immediate removal on failure
          }
        }
      }
    } catch (e) {}

    // fallback immediate removal
    try { if (this.mesh) this.mesh.visible = false; } catch (_) {}
    try {
      if (this.mesh) {
        this.mesh.traverse(obj => {
          if (obj.isMesh && window.sceneLoader && Array.isArray(window.sceneLoader.enemyMeshes)) {
            const idx = window.sceneLoader.enemyMeshes.indexOf(obj);
            if (idx >= 0) window.sceneLoader.enemyMeshes.splice(idx, 1);
          }
        });
      }
    } catch (e) {}
    try { if (this.sceneGroup && this.mesh) this.sceneGroup.remove(this.mesh); } catch (_) {}
    // Stop any looped voice now that the enemy is being removed immediately
    try { if (window.enemyVoiceManager && typeof window.enemyVoiceManager.stopLoop === 'function') window.enemyVoiceManager.stopLoop(this); } catch(_) {}
    this._isDead = true;
    this._isDying = false;

    console.log("Enemy died:", this.id, "Enemies remaining:", 
      window.sceneLoader.enemies.filter(e => !e._isDead).length
    );
}





update(deltaMs, nowMs, player) {
  if (this._isDead) return;
  if (!this._isActive) return; // inactive enemies do not run AI or interact
  if (!ENEMY_AI_ENABLED) return; // GLOBAL STOP
  this._postSpawnInit();
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
      // Use actual mesh position delta (works for patrol/path where mesh.position is animated)
      const lastMesh = this._lastMeshPosition || this.mesh.position.clone();
      const moved = this.mesh.position.distanceTo(lastMesh) > 0.001;

      // If moving, compute movement vector from mesh positions
          if (moved) {
        const moveVec = this.mesh.position.clone().sub(lastMesh);
        try {
          const toPlayer = (player && player.position) ? player.position.clone().sub(this.mesh.position) : null;
          // If lateral motion dominates and strafe actions are present, let the animation drive pose
          const isLateral = Math.abs(moveVec.x) > Math.abs(moveVec.z);
          const hasStrafe = !!(this._actions && (this._actions.strafe_left || this._actions.strafe_right || this._actions.strafe));
          if (isLateral && hasStrafe) {
            // do not override rotation; keep animator-controlled orientation
          } else {
            // Face the player when moving primarily forward/back, or when no strafe clips available
            if (toPlayer && toPlayer.lengthSq() > 1e-6) {
              this._targetRotationY = Math.atan2(toPlayer.x, toPlayer.z);
            } else if (moveVec.lengthSq() > 1e-6) {
              this._targetRotationY = Math.atan2(moveVec.x, moveVec.z);
            }
          }
        } catch (e) {
          if (moveVec.lengthSq() > 1e-6) this._targetRotationY = Math.atan2(moveVec.x, moveVec.z);
        }
      }

      // toggle actions with smooth crossfade
      try {
        if (this.mixer && this._actions) {
          if (moved) {
            // compute movement vector (world-space) using mesh position delta
            const moveVec = this.mesh.position.clone().sub(lastMesh);
            // If lateral motion dominates, prefer strafe animations when available
            try {
              if (Math.abs(moveVec.x) > Math.abs(moveVec.z) && (this._actions.strafe_left || this._actions.strafe_right || this._actions.strafe)) {
                if (moveVec.x < 0 && this._actions.strafe_left) {
                  this._activateAction('strafe_left', 0.12);
                } else if (moveVec.x > 0 && this._actions.strafe_right) {
                  this._activateAction('strafe_right', 0.12);
                } else if (this._actions.strafe) {
                  this._activateAction('strafe', 0.12);
                } else if (this._actions.walk) {
                  this._activateAction('walk', 0.12);
                }
              } else {
                // choose run vs walk based on weapon rate
                if (this._actions.run && this.weapon && this.weapon.fireRateMs < 300) {
                  this._activateAction('run', 0.12);
                } else if (this._actions.walk) {
                  this._activateAction('walk', 0.12);
                }
              }
            } catch (e) {
              // fallback to previous logic
              if (this._actions.run && this.weapon && this.weapon.fireRateMs < 300) {
                this._activateAction('run', 0.12);
              } else if (this._actions.walk) {
                this._activateAction('walk', 0.12);
              }
            }
          } else {
            // idle when not moving
            if (this._actions.idle) this._activateAction('idle', 0.18);
            else if (this._actions.aim) this._activateAction('aim', 0.18);
          }
        }
      } catch (e) {}
      // Footfall bob: add vertical offset driven by gait phase when moving
      try {
        const movedDist = this.mesh.position.distanceTo(lastMesh);
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

      // update last-tracked positions
      this._lastMeshPosition = this.mesh.position.clone();
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

    // Drone-only per-frame diagnostics to observe Y-axis changes
    try {
      const idStr = String(this.id || '').toLowerCase();
      if (idStr.indexOf('drone') !== -1) {
        try {
          console.log(`[PATH DEBUG ${this.id}] stepIndex=${path.stepIndex} axis=${step.axis} t=${t.toFixed(3)} frameDelta=${frameDelta.toFixed(4)} currentOffset=${path.currentOffset.x.toFixed(3)},${path.currentOffset.y.toFixed(3)},${path.currentOffset.z.toFixed(3)} groundY=${this._groundY}`);
        } catch (e) { console.log('[PATH DEBUG] formatting error', e); }
      }
    } catch (e) {}

    // Apply authoritative position (allow vertical movement if path allows it)
    this.basePosition.copy(path.origin).add(path.currentOffset);
    // If vertical movement is not allowed by the path, snap Y to groundY
    if (!path.allowVertical && typeof this._groundY === 'number') this.basePosition.y = this._groundY;
    this._targetPosition.copy(this.basePosition);
    if (!path.allowVertical && typeof this._groundY === 'number') this._targetPosition.y = this._groundY;

    // Drone-specific check: log resulting base/target Y after application
    try {
      const idStr2 = String(this.id || '').toLowerCase();
      if (idStr2.indexOf('drone') !== -1) {
        console.log(`[PATH DEBUG ${this.id}] AFTER apply baseY=${this.basePosition.y.toFixed(4)} targetY=${this._targetPosition.y.toFixed(4)} originY=${(path.origin && path.origin.y!==undefined)?path.origin.y.toFixed(4):'n/a'}`);
      }
    } catch (e) {}

    if (path.stepElapsedMs >= step.durationMs) {
      this._advancePathStep();
    }
  }
  // Allow path-following enemies to fire periodically. The interval can be set
  // via `behavior.params.fireIntervalMs`; otherwise fall back to `this.firePauseMs`
  // if it's a positive value. This enables flying enemies that follow a path
  // (e.g., Drone) to actively shoot while moving.
  try {
    const nowMs = performance.now();
    const configuredInterval = (this.behavior && this.behavior.params && this.behavior.params.fireIntervalMs) ? Number(this.behavior.params.fireIntervalMs) : (this.firePauseMs > 0 ? this.firePauseMs : null);
    if (configuredInterval) {
      if (!this._lastPathFire) this._lastPathFire = 0;
      if (nowMs - this._lastPathFire >= configuredInterval) {
        this._attemptFire(nowMs);
        this._lastPathFire = nowMs;
      }
    }
  } catch (e) {}
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

  // detect whether any step uses vertical movement
  const allowVertical = steps.some(s => s && String(s.axis || '').toLowerCase() === 'y');

  this._path = {
    active: true,
    loop: params.loop !== false,
    steps,
    stepIndex: 0,
    stepElapsedMs: 0,

    // Path origin is the enemy's starting base position. If vertical movement
    // is expected, preserve the original base Y; otherwise snap origin Y to ground.
    origin: (() => {
      const o = this.basePosition.clone();
      if (!allowVertical && typeof this._groundY === 'number') o.y = this._groundY;
      return o;
    })(),

    // Accumulated offset from origin
    currentOffset: new THREE.Vector3(),
    allowVertical
  };

  // Ensure animation targets exist (Y snapped to ground)
  this._targetPosition = this.basePosition.clone();
  // If path allows vertical movement, preserve the base Y; otherwise snap to ground
  if (!this._path.allowVertical && typeof this._groundY === 'number') this._targetPosition.y = this._groundY;
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

  // Ensure basePosition/targetPosition exist to avoid calling .copy on undefined
  if (!this.basePosition) {
    try { this.basePosition = this.mesh.position.clone(); } catch (e) { this.basePosition = new THREE.Vector3(); }
  }
  if (!this._targetPosition) {
    try { this._targetPosition = this.basePosition.clone(); } catch (e) { this._targetPosition = new THREE.Vector3(); }
  }

  // Ensure base Y is locked to ground truth so distance calculations and movement stay horizontal
  if (typeof this._groundY === 'number') {
    try { this.basePosition.y = this._groundY; } catch (e) {}
    try { this._targetPosition.y = this._groundY; } catch (e) {}
  }

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

  // Direction to player (use flattened player Y to ground to avoid vertical offsets)
  const playerFlat = player.position.clone();
  if (typeof this._groundY === 'number') playerFlat.y = this._groundY;
  const dirToPlayer = this._rushTarget.copy(playerFlat).sub(this.basePosition);

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
    // keep movement strictly horizontal
    moveVector.y = 0;

    // Advance enemy (keep base Y locked to ground)
    this.basePosition.add(moveVector);
    if (typeof this._groundY === 'number') this.basePosition.y = this._groundY;
    this._targetPosition.copy(this.basePosition);
    if (typeof this._groundY === 'number') this._targetPosition.y = this._groundY;
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

      if (this._isDying) return; // prevent firing while death animation plays

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

  // Ensure the enemy is facing the target when firing (standInOpen should look at player)
  try {
    const toPlayer = targetPos.clone().sub(this.mesh.position || new THREE.Vector3());
    if (toPlayer.lengthSq() > 1e-6) {
      this._targetRotationY = Math.atan2(toPlayer.x, toPlayer.z);
    }
  } catch (e) {}

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
    if (this.weaponMuzzle && this._isActive) {
      this.weaponMuzzle.visible = true;
      setTimeout(() => { try { this.weaponMuzzle && (this.weaponMuzzle.visible = false); } catch(_){} }, 80);
    }
  } catch (e) {}

  // Apply weapon recoil impulse (local displacement) and bone recoil
  try {
    this._weaponRecoil = Math.max(this._weaponRecoil || 0, 0.06);
    this._boneRecoil = Math.max(this._boneRecoil || 0, 0.35);
  } catch (e) {}

  // Trigger shoot/aim actions if available (smooth fallback)
  try {
    if (this._actions && this._actions.shoot) {
      const s = this._actions.shoot;
      try { s.reset(); s.play(); } catch(_){}
      const dur = (s._clip && s._clip.duration) ? s._clip.duration * 1000 : 250;
      setTimeout(() => {
        if (this._actions.aim) this._activateAction('aim', 0.12);
        else if (this._actions.idle) this._activateAction('idle', 0.12);
      }, dur);
    } else if (this._actions && this._actions.aim) {
      this._activateAction('aim', 0.08);
    }
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
        if (this._isActive) this.mesh.visible = true; // make visible and transition out only if active
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
    // Low cover: vertical pop -> stand up to base position (don't invert crouch offset)
    this._targetPosition.y = this.basePosition.y;

  }

  // No positional offset accumulation here
  this._targetOffset.set(0, 0, 0);
  // When popped, stand up
  try {
    this._targetScale = this.baseScale ? this.baseScale.clone() : new THREE.Vector3(1,1,1);
  } catch(e) { this._targetScale = new THREE.Vector3(1,1,1); }
  this._targetCrouchAlpha = 0;
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

  // For low cover, lower the mesh so it hides behind low obstacles (crouch)
  if (this.coverType === "low") {
    try {
      const offsetY = (cp.crouchOffsetY !== undefined) ? cp.crouchOffsetY : -1.05;
      this._targetPosition.y = (this.basePosition && typeof this.basePosition.y === 'number') ? (this.basePosition.y + offsetY) : (this._targetPosition.y + offsetY);
    } catch (e) {}
  }

  // Reset offsets cleanly
  this._targetOffset.set(0, 0, 0);
  // When hidden behind cover, crouch / shrink slightly
  try {
    const s = (this.baseScale ? this.baseScale.clone() : new THREE.Vector3(1,1,1));
    this._targetScale = s.multiplyScalar(cp.crouchScale ?? 0.92);
  } catch (e) { this._targetScale = new THREE.Vector3(0.92,0.92,0.92); }
  this._targetCrouchAlpha = 1;
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
    const desiredPos = this._targetPosition.clone();
    // For Y: if the current path allows vertical movement, honor `_targetPosition.y`.
    // Otherwise fall back to the global groundY so ground-based enemies stay clamped.
    let finalY = this._targetPosition.y;
    try {
      if (!this._path || !this._path.allowVertical) {
        finalY = (typeof this._groundY === 'number') ? this._groundY : this._targetPosition.y;
      }
    } catch (e) { finalY = (typeof this._groundY === 'number') ? this._groundY : this._targetPosition.y; }
    desiredPos.y = finalY + (this._targetOffset?.y || 0);
    desiredPos.x += (this._targetOffset?.x || 0);
    desiredPos.z += (this._targetOffset?.z || 0);
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

    // crouch alpha blending (bones)
    try {
      const target = (this._targetCrouchAlpha !== undefined) ? this._targetCrouchAlpha : 0;
      this._currentCrouchAlpha = THREE.MathUtils.lerp(this._currentCrouchAlpha || 0, target, t);
      this._applyBoneCrouch(this._currentCrouchAlpha);
    } catch (e) {}
  }

  dispose() {
    if (this.mesh && this.sceneGroup) {
      this.sceneGroup.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (this.mesh.material.map) this.mesh.material.map.dispose();
      this.mesh.material.dispose();
    }
  }

  // apply additive bone rotations/poses to approximate a crouch
  _applyBoneCrouch(alpha) {
    if (!this.bones || alpha === undefined) return;
    try {
      // alpha: 0 = standing, 1 = fully crouched
      // target additive rotations (radians)
      const spineBend = -0.35 * alpha; // bend forward
      const hipsBend = 0.25 * alpha;   // tilt pelvis
      const upperLegBend = 0.6 * alpha; // bend at hip
      const lowerLegBend = -0.8 * alpha; // knee bend

      const applyIf = (name, fn) => { const b = this.bones[name]; if (b) fn(b); };

      applyIf('spine', b => { b.rotation.x = (this._boneBaseRot['spine'] || 0) + spineBend; });
      applyIf('spine1', b => { b.rotation.x = (this._boneBaseRot['spine1'] || 0) + spineBend * 0.8; });
      applyIf('spine2', b => { b.rotation.x = (this._boneBaseRot['spine2'] || 0) + spineBend * 0.6; });
      applyIf('hips', b => { b.rotation.x = (this._boneBaseRot['hips'] || 0) + hipsBend; });

      applyIf('upper_leg_l', b => { b.rotation.x = (this._boneBaseRot['upper_leg_l'] || 0) + upperLegBend; });
      applyIf('upper_leg_r', b => { b.rotation.x = (this._boneBaseRot['upper_leg_r'] || 0) + upperLegBend; });
      applyIf('lower_leg_l', b => { b.rotation.x = (this._boneBaseRot['lower_leg_l'] || 0) + lowerLegBend; });
      applyIf('lower_leg_r', b => { b.rotation.x = (this._boneBaseRot['lower_leg_r'] || 0) + lowerLegBend; });

      // small neck tuck when crouching
      applyIf('neck', b => { b.rotation.x = (this._boneBaseRot['neck'] || 0) + (0.12 * alpha); });
    } catch (e) {}
  }
}
export function killAllEnemies() {
  ENEMY_INSTANCES.forEach(enemy => {
    if (!enemy._isDead) enemy.die();
  });
}
