import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export const ENEMY_INSTANCES = [];
import { ENEMY_DEFS } from "./scenes.js";
//
// Weapon class
//
export class Weapon {
  constructor(def) {
    this.name = def.name || "weapon";
    this.fireSound = def.fireSound || null;
    this.fireRateMs = def.fireRateMs || 500;
    this.damage = def.damage || 1;
    this.clipSize = def.clipSize || 6;
    this.reloadTimeMs = def.reloadTimeMs || 1500;
    this.reloadSound = def.reloadSound || null;
    this.ammoInClip = this.clipSize;
    this.ammoReserve = def.ammoReserve || 0;
    this.lastFireTimestamp = -Infinity;
    this.isReloading = false;
  }

  canFire(nowMs) {
    if (this.isReloading) return false;
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

    if (this.reloadSound) {
      const s = new Audio(this.reloadSound);
      s.currentTime = 0;
      s.play().catch(() => {});
    }

    setTimeout(() => {
      const needed = this.clipSize - this.ammoInClip;
      const taken = Math.min(needed, this.ammoReserve);
      this.ammoInClip += taken;
      this.ammoReserve -= taken;
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
    this.id = instanceConfig.id || `enemy_${Date.now()}`;
    this.type = def.displayName || "Enemy";
    this.hp = def.hp || 1;
    this.maxHp = this.hp;
    this.weapon = new Weapon(def.weapon || {});
    this.hitSounds = def.hitSounds || [];
    this.deathSounds = def.deathSounds || [];
    this.accuracy = def.accuracy || 0.5;
    this.reactionTimeMs = def.reactionTimeMs || 300;

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
    this.behavior = instanceConfig.behavior || (def.behavior ? def.behavior : { pattern: "standInOpen", params: {} });

    // Allow explicit coverType via instanceConfig or behavior.params
    this.coverType = instanceConfig.coverType || (this.behavior.params && this.behavior.params.coverType) || def.coverType || null;
    // fallback inference: if coverIndex present assume low cover
    if (!this.coverType && this.coverIndex !== null) this.coverType = "low";

    //
    // Mesh (single-sprite)
    //
    const plane = new THREE.PlaneGeometry(1.2, 1.8);
    const tex = new THREE.TextureLoader().load(def.sprite);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    this.mesh = new THREE.Mesh(plane, mat);

    // place mesh at given position
    this.mesh.position.copy(this.position);
    this.basePosition = this.mesh.position.clone(); // used for lerping back
    this.baseRotationY = this.facing;

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

  _randInterval(min, max) {
    // return a random ms interval between min and max
    return min + Math.floor(Math.random() * Math.max(0, (max - min)));
  }

  _playRandom(arr) {
    if (!arr || arr.length === 0) return;
    const s = new Audio(arr[Math.floor(Math.random() * arr.length)]);
    s.currentTime = 0;
    s.play().catch(() => {});
  }

  //
  // Generic damage entrypoint (used by projectiles, bullets, explosions)
  // Accepts optional damageType
  //
  takeDamage(amount, damageType = "normal") {
    if (this._isDead) return;
    console.log("current HP:  "+this.hp+", damage dealt is "+amount)
	this.hp -= amount;

    this._playRandom(this.hitSounds);

    if (this.hp <= 0) this.die();
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
  if (this._isDead) return;
  this._isDead = true;

  // Play death sounds
  this._playRandom(this.deathSounds);

  // Hide and remove mesh from scene
  if (this.mesh) {
    this.mesh.visible = false;

    if (this.sceneGroup && this.mesh.parent) {
      this.sceneGroup.remove(this.mesh);
    }

    // Dispose of geometry/material to free memory
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) {
      if (this.mesh.material.map) this.mesh.material.map.dispose();
      this.mesh.material.dispose();
    }
  }

  // Remove from global enemy array
  const idx = ENEMY_INSTANCES.indexOf(this);
  if (idx !== -1) ENEMY_INSTANCES.splice(idx, 1);

  // Remove from sceneLoader.enemies if it exists
  if (window.sceneLoader && Array.isArray(window.sceneLoader.enemies)) {
    const sceneIdx = window.sceneLoader.enemies.indexOf(this);
    if (sceneIdx !== -1) window.sceneLoader.enemies.splice(sceneIdx, 1);
  }

  // Dispatch event for any other game logic
  window.dispatchEvent(new CustomEvent("enemyDied", {
    detail: { id: this.id }
  }));
}

update(deltaMs, nowMs, player) {
    if (this._isDead) return;

    const pattern = this.behavior.pattern;
    const p = this.behavior.params || {};

    if (pattern === "popOutFromCover") {
      this._updatePopOut(deltaMs, nowMs, p);
    } else if (pattern === "patrol") {
      this._updatePatrol(deltaMs, nowMs, p);
    } else {
      this._updateStand(deltaMs, nowMs, p);
    }

    // always apply smoothing interpolation to the mesh transform toward target offset/rotation/scale
    this._applyAnimationSmoothing(deltaMs);
  }

  //
  // Fire projectile using SceneLoader callback
  //
  _attemptFire(nowMs) {
  if (!this.weapon.canFire(nowMs) || !this.player || !this.fireCallback) return;

  const muzzle = this.mesh.position.clone();
  muzzle.y += 0.9;

  const targetPos =
    this.player.mesh?.position.clone() || new THREE.Vector3(0, 1.7, 0);

  // HARD BLOCK: do not fire if wall is between muzzle and player
  if (!this._hasClearShot(muzzle, targetPos)) {
    return;
  }

  // Fire is now physically valid
  this.weapon.recordFire(nowMs);

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
    const interval = params.fireIntervalMs || 1200;
    if (!this._lastStandFire) this._lastStandFire = 0;
    if (nowMs - this._lastStandFire > interval) {
      this._attemptFire(nowMs);
      this._lastStandFire = nowMs;
    }
  }

  _updatePatrol(deltaMs, nowMs, params) {
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
