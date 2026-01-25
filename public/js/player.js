// js/player.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';

import { WEAPON_DEFS, MELEE_DEFS } from "./weapons.js";
import { AMMO_DEFS } from "./ammo.js";

// Console helper: change equipped melee weapon at runtime
// Usage: window.changeMeleeWeapon('combatKnife')
try {
  window.changeMeleeWeapon = function(id) {
    if (!window.player) {
      console.warn('player not available yet');
      return false;
    }
    if (!MELEE_DEFS[id]) {
      console.warn('unknown melee id:', id);
      return false;
    }
    // prepare player state: stop current swing and clear visuals
    try {
      if (window.player._meleeAnim) window.player._meleeAnim = null;
      if (window.player._meleeWeaponGroup) {
        window.player._meleeWeaponGroup.visible = false;
        while (window.player._meleeWeaponGroup.children.length) window.player._meleeWeaponGroup.remove(window.player._meleeWeaponGroup.children[0]);
      }
    } catch (e) { console.warn('failed to clear previous melee visuals', e); }

    window.player._equippedMeleeId = id;
    const def = MELEE_DEFS[id];
    // apply runtime overrides so other systems can read them directly
    window.player.meleeCooldownMs = def.attackSpeed || window.player.meleeCooldownMs;
    window.player._meleeReach = def.reach;
    window.player._meleeDamage = def.damage;
    window.player._meleeKnockback = def.knockback;
    window.player._meleeAttackSounds = Array.isArray(def.attackSounds) ? def.attackSounds.slice() : [];
    window.player._meleeWeaponPath = def.model || window.player._meleeWeaponPath;
    try { window.player.loadMeleeWeapon(window.player._meleeWeaponPath); } catch (e) { console.warn('loadMeleeWeapon failed', e); }
    console.log('Equipped melee:', id);
    return true;
  };

  window.listMeleeWeapons = function() { return Object.keys(MELEE_DEFS); };
} catch (e) { console.warn('failed to register console melee helpers', e); }

export class Player extends EventTarget {
  constructor({ maxHp = 10000, hp = 10000, camera = null } = {}) {
    super();

    // store the camera passed in (may be null and attached later)
    this.camera = camera;

    this.maxHp = maxHp;
    this.hp = hp;

// Melee state
this._lastMeleeMs = 0;
// Equip default melee from definitions (first defined)
this._equippedMeleeId = Object.keys(MELEE_DEFS)[0] || 'combatKnife';
const _meleeDef = MELEE_DEFS[this._equippedMeleeId] || {};
this.meleeCooldownMs = _meleeDef.attackSpeed || 600;


    // Melee weapon visuals: attach a weapon group to the camera directly
    this._meleeWeaponGroup = new THREE.Group(); // holds the currently loaded melee GLB
    this._meleeWeaponPath = _meleeDef.model || 'assets/models/knife.glb';
    this._meleeAnim = null; // { startMs, durationMs }
    this._meleeWeaponGroup.visible = false;
    // initialize runtime melee overrides from default definition
    this._meleeReach = _meleeDef.reach;
    this._meleeDamage = _meleeDef.damage;
    this._meleeKnockback = _meleeDef.knockback;
    this._meleeAttackSounds = Array.isArray(_meleeDef.attackSounds) ? _meleeDef.attackSounds.slice() : [];
    // attach to camera if available
    try { if (this.camera && this.camera.add) this.camera.add(this._meleeWeaponGroup); } catch(e) {}
    // Load the default melee weapon model now
    try { this.loadMeleeWeapon(this._meleeWeaponPath); } catch(e) { console.warn('load default melee failed', e); }

// In Player constructor
    // Private backing field
    this._position = new THREE.Vector3(0, 1.7, 5); // match camera start
    // Initialize ammo pools per type
    this.ammoPools = {};
    for (const key in AMMO_DEFS) {
      this.ammoPools[key] = AMMO_DEFS[key].startingCount;
    }

    // Instantiate all weapons from WEAPON_DEFS
    this.weapons = Object.keys(WEAPON_DEFS).map(id => {
      const def = WEAPON_DEFS[id];
      const ammoType = def.ammoType;

      // Allocate ammo for clip from ammo pool
      const ammoInClip = Math.min(def.clipSize, this.ammoPools[ammoType] || 0);
      this.ammoPools[ammoType] -= ammoInClip;

      return {
        id,
        ...def,

        ammoInClip,
        totalAmmo: 0, // now handled by ammoPools
        lastShotTime: 0
      };
    });

    // Start with weapon 0
    this.currentWeaponIndex = 0;

    // Recoil state (screen-space pixels). Cumulative per shot; decays each frame.
    // `recoilPx` is the current additional reticle radius added to visuals.
    this.recoilPx = 0;
    // Recovery time (ms) to return toward zero (exponential decay time constant).
    // This is configurable per player and controls how quickly recoil returns to neutral.
    this.recoilRecoveryMs = 1200;

    // helper: add recoil (called when firing)
    this.addRecoil = (px) => {
      this.recoilPx = (this.recoilPx || 0) + (px || 0);
    };

    // helper: per-frame update to decay recoil. Called by game loop.
    this.updateRecoil = (deltaMs) => {
      if (!this.recoilPx || this.recoilPx <= 0) {
        this.recoilPx = 0;
        return;
      }
      const tau = Math.max(1, this.recoilRecoveryMs);
      const factor = Math.exp(-deltaMs / tau);
      this.recoilPx *= factor;
      if (this.recoilPx < 0.01) this.recoilPx = 0;
    };

    // Initialize HUD
    this._emitAmmo();
  }

  get currentWeapon() {
    return this.weapons[this.currentWeaponIndex];
  }

  takeDamage(amount) {
    // Ignore damage while editor mode is active
    if (window.engine && window.engine.isEditorMode) return;

    window.hud.shakeCamera(0.3, 0.4);
    this.hp = Math.max(this.hp - amount, 0);
            try {
    const s = new Audio("assets/sfx/player/gethit1.ogg");
    s.currentTime = 0;
    s.play().catch(() => {
        // optional: handle play error here
    });
} catch (e) {
    // optional: handle error
}

			        
	
	this._emitHealth();
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
    this._emitHealth();
  }
  get position() {
    // Assume your player is represented by a camera or some 3D position
    //return window.camera.position.clone(); // or wherever your player "is"
return this._position;	
  }
  getForwardVector() {
    const forward = new THREE.Vector3(0, 0, -1);
    if (this.camera && this.camera.getWorldDirection) {
      this.camera.getWorldDirection(forward);
    } else if (this.mesh) {
        forward.applyQuaternion(this.mesh.quaternion).normalize();
    }
    return forward;
}

meleeAttack() {
    console.log("Melee function triggered");

    const nowMs = performance.now();
    if (nowMs - this._lastMeleeMs < this.meleeCooldownMs) {
        console.log("Melee on cooldown");
        return;
    }

    // Resolve melee definition for currently equipped melee and apply runtime overrides
    const meleeDef = (MELEE_DEFS[this._equippedMeleeId] || {});
    const resolved = Object.assign({}, meleeDef);
    if (this._meleeReach !== undefined) resolved.reach = this._meleeReach;
    if (this._meleeDamage !== undefined) resolved.damage = this._meleeDamage;
    if (this._meleeKnockback !== undefined) resolved.knockback = this._meleeKnockback;
    if (this._meleeAttackSounds !== undefined) resolved.attackSounds = this._meleeAttackSounds;
    // update cooldown from resolved definition
    this.meleeCooldownMs = resolved.attackSpeed || this.meleeCooldownMs;

    // start visual swipe immediately and mark last melee time
    this._lastMeleeMs = nowMs;

    // Play one random attack sound from the resolved attackSounds (if present)
    try {
      const sounds = resolved.attackSounds || meleeDef.attackSounds || [];
      if (sounds.length > 0) {
        const idx = Math.floor(Math.random() * sounds.length);
        const sw = new Audio(sounds[idx]);
        sw.currentTime = 0;
        sw.play().catch(() => {});
      }
    } catch (_) {}

    try { this._startArmSwipe(); } catch (e) { console.warn('startArmSwipe failed', e); }

    // Use camera if available, otherwise player position
    const origin = this.camera?.position?.clone() || this._position.clone();
    const forward = new THREE.Vector3();

    if (this.camera?.getWorldDirection) {
      this.camera.getWorldDirection(forward);
    } else {
        forward.set(0, 0, -1); // default forward if camera missing
    }

    const reach = (resolved.reach !== undefined) ? resolved.reach : 2.2;
    // radius scaled relative to reach to make hitsize reasonable for short weapons
    const radius = Math.max(0.25, reach * 0.64);
    const damage = (resolved.damage !== undefined) ? resolved.damage : 15;
    const knockbackForce = (resolved.knockback !== undefined) ? resolved.knockback : 0.35;

    const hitPos = origin.clone().add(forward.multiplyScalar(reach));

    let hitSomething = false;

    // ✅ Safely get enemies from window
    const enemies = window.ENEMY_INSTANCES || [];
    if (enemies.length === 0) {
        console.log("No enemies available to hit");
    }

    console.log(`Melee origin=${origin.x.toFixed(2)},${origin.y.toFixed(2)},${origin.z.toFixed(2)} hitPos=${hitPos.x.toFixed(2)},${hitPos.y.toFixed(2)},${hitPos.z.toFixed(2)} enemies=${enemies.length}`);
    for (const enemy of enemies) {
      if (!enemy.mesh || enemy._isDead) continue;
      // Use world position to account for parent transforms
      const enemyPos = new THREE.Vector3();
      try {
        enemy.mesh.getWorldPosition(enemyPos);
      } catch (_) {
        enemyPos.copy(enemy.mesh.position || new THREE.Vector3());
      }

      // Compute distance from enemy to the line segment (capsule) from origin->hitPos
      const segVec = hitPos.clone().sub(origin); // vector from origin to hitPos
      const segLenSq = segVec.lengthSq() || 1;
      const toEnemy = enemyPos.clone().sub(origin);
      let t = segVec.dot(toEnemy) / segLenSq; // projection factor along segment
      t = Math.max(0, Math.min(1, t));
      const closest = origin.clone().add(segVec.clone().multiplyScalar(t));

      // 3D distance (for diagnostics)
      const dist3D = enemyPos.distanceTo(closest);
      // Horizontal (XZ) distance: ignore vertical offset so camera/player height doesn't prevent hits
      const dx = enemyPos.x - closest.x;
      const dz = enemyPos.z - closest.z;
      const distXZ = Math.hypot(dx, dz);

      console.log(`  enemy=${enemy.id || enemy.name || 'unknown'} pos=${enemyPos.x.toFixed(2)},${enemyPos.y.toFixed(2)},${enemyPos.z.toFixed(2)} closest=${closest.x.toFixed(2)},${closest.y.toFixed(2)},${closest.z.toFixed(2)} dist3D=${dist3D.toFixed(2)} distXZ=${distXZ.toFixed(2)}`);

      if (distXZ > radius) continue;

      // Apply damage and knockback
      try {
        enemy.takeDamage(damage, "melee");
      } catch (err) {
        console.warn("Error calling takeDamage on enemy:", err);
      }
      const dir = enemyPos.clone().sub(origin).normalize();
      if (!enemy._knockback) enemy._knockback = new THREE.Vector3();
      enemy._knockback.add(dir.multiplyScalar(knockbackForce));
      hitSomething = true;
      console.log(`Hit enemy: ${enemy.name || enemy.id || "unknown"}, horizDist=${distXZ.toFixed(2)}, 3Ddist=${dist3D.toFixed(2)}`);
    }

    if (hitSomething) {
        try {
            const s = new Audio("assets/sfx/melee_hit.ogg");
            s.currentTime = 0;
            s.play().catch(() => {});
        } catch (_) {}
    } else {
        console.log("Melee hit nothing");
    }
}

  

  // Load and attach a melee weapon GLB (knife, crowbar, etc.)
  loadMeleeWeapon(path) {
    this._meleeWeaponPath = path;
    if (!path) return;

    // token to ignore stale async loads
    this._meleeLoadToken = (this._meleeLoadToken || 0) + 1;
    const loadToken = this._meleeLoadToken;

    // ensure group exists and clear previous
    if (!this._meleeWeaponGroup) this._meleeWeaponGroup = new THREE.Group();
    while (this._meleeWeaponGroup.children.length) this._meleeWeaponGroup.remove(this._meleeWeaponGroup.children[0]);

    console.log('Loading melee weapon GLB:', path, 'token=', loadToken);

    const loader = new GLTFLoader();
    const onLoad = (gltf) => {
      if (loadToken !== this._meleeLoadToken) { console.log('Stale melee GLB load ignored:', path, 'token=', loadToken); return; }
      console.log('melee GLB loaded, scene children:', (gltf && gltf.scene && gltf.scene.children ? gltf.scene.children.length : 0), 'token=', loadToken);
      const weapon = gltf.scene;

      try {
        // bounds
        try {
          const box0 = new THREE.Box3().setFromObject(weapon);
          const size0 = new THREE.Vector3(); box0.getSize(size0);
          const center0 = new THREE.Vector3(); box0.getCenter(center0);
          console.log('  loaded weapon bounds size=', size0.toArray(), 'center=', center0.toArray());
        } catch(e) { console.warn('  bounds compute failed', e); }

        // normalize scale/position
        try {
          const box = new THREE.Box3().setFromObject(weapon);
          const size = new THREE.Vector3(); box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const desiredMax = 0.35;
          const scaleFactor = desiredMax / maxDim;
          weapon.scale.multiplyScalar(scaleFactor);
          box.setFromObject(weapon);
          const center = new THREE.Vector3(); box.getCenter(center);
          weapon.position.sub(center);
        } catch (e) { console.warn('Weapon normalization failed', e); }

        // default hold offset and rotation
        weapon.position.add(new THREE.Vector3(0.12, -0.18, 0.08));
        weapon.rotation.set(-0.45, 0, Math.PI / 8);

        // ensure meshes render in front
        weapon.traverse(c => {
          if (c.isMesh) {
            try {
              c.castShadow = false;
              c.receiveShadow = false;
              c.frustumCulled = false;
              if (c.material) {
                c.material.depthTest = false;
                c.material.depthWrite = false;
                c.material.transparent = true;
                c.material.side = THREE.DoubleSide;
              }
              c.renderOrder = 9999;
            } catch(_) {}
          }
        });

        // attach
        this._meleeWeaponGroup.add(weapon);
        if (!this._meleeWeaponGroup.parent && this.camera && this.camera.add) this.camera.add(this._meleeWeaponGroup);
        this._meleeWeaponGroup.visible = true;

        // per-weapon tweaks
        try {
          const pname = (path || '').toLowerCase();
          if (pname.includes('knife')) {
            weapon.scale.multiplyScalar(1.8);
            weapon.position.add(new THREE.Vector3(0.06, -0.06, 0.04));
            weapon.rotation.set(-0.7, 0, Math.PI / 5);
          }
          if (pname.includes('crowbar')) {
            weapon.scale.multiplyScalar(1.4);
            weapon.position.add(new THREE.Vector3(0.02, -0.10, 0.00));
            weapon.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
          }
        } catch(e) { console.warn('per-weapon tweak failed', e); }

        // final visibility flags
        try {
          this._meleeWeaponGroup.traverse(c => {
            if (c.isMesh && c.material) {
              c.material.depthTest = false;
              c.material.depthWrite = false;
              c.material.transparent = true;
            }
            if (c.isMesh) c.renderOrder = 9999;
            c.frustumCulled = false;
            c.visible = true;
          });
          this._meleeWeaponGroup.visible = true;
        } catch (e) { console.warn('Weapon visibility flags failed', e); }

      } catch (e) {
        console.warn('melee GLTF onLoad handler failed', e);
      }
    };

    const onError = (err) => { console.error('melee GLB load error for', path, 'token=', loadToken, err); };

    loader.load(path, onLoad, undefined, onError);
  } // end loadMeleeWeapon

// Start a smooth weapon swing across camera-local space
_startArmSwipe() {
  if (!this._meleeWeaponGroup) return;
  this._meleeWeaponGroup.visible = true;

  try {
    const hasWeapon = (this._meleeWeaponGroup && this._meleeWeaponGroup.children.length > 0);
    console.log('startArmSwipe: hasWeapon=', hasWeapon, 'children=', this._meleeWeaponGroup.children.length, 'visible=', this._meleeWeaponGroup.visible, 'parent=', !!this._meleeWeaponGroup.parent, 'meleePath=', this._meleeWeaponPath);
  } catch (e) { console.warn('startArmSwipe diag failed', e); }

  const now = performance.now();
  // Dramatic arc for handheld weapons
  // Visual swing should be slightly shorter than cooldown
const durationMs = Math.max(
  300,
  (this.meleeCooldownMs || 600) * 0.85
);

  const shoulderHeight = -0.12; // camera-local Y (slightly up for dramatic arc)
  const hasWeapon = (this._meleeWeaponGroup && this._meleeWeaponGroup.children.length > 0);
  const shoulderZ = hasWeapon ? -0.25 : -0.6; // bring forward when weapon present
  const shoulderX = hasWeapon ? 1.2 : 0.7; // wider arc when weapon present

  // Bigger rotations when weapon present for a dramatic arc
  const fromRotZ = hasWeapon ? -Math.PI * 0.9 : -Math.PI / 3;
  const toRotZ = hasWeapon ? Math.PI * 0.9 : Math.PI / 3;
  const fromRotX = hasWeapon ? -1.2 : -0.6;
  const toRotX = hasWeapon ? -0.2 : -0.15;

  this._meleeAnim = {
    startMs: now,
    durationMs,
    from: { x: shoulderX, y: shoulderHeight, z: shoulderZ, rotX: fromRotX, rotY: 0, rotZ: fromRotZ },
    to:   { x: -shoulderX, y: shoulderHeight, z: shoulderZ, rotX: toRotX, rotY: 0, rotZ: toRotZ }
  };

  // Ensure weapon group is attached to camera
  try { if (!this._meleeWeaponGroup.parent && this.camera && this.camera.add) this.camera.add(this._meleeWeaponGroup); } catch(e) {}

  // Set initial transform on the weapon group
  const f = this._meleeAnim.from;
  this._meleeWeaponGroup.position.set(f.x, f.y, f.z);
  this._meleeWeaponGroup.rotation.set(f.rotX, f.rotY, f.rotZ);
}

// Update weapon swing each frame (called by game loop as updateArm)
updateArm(deltaMs) {
  if (!this._meleeWeaponGroup || !this._meleeAnim) return;

  const t = (performance.now() - this._meleeAnim.startMs) / this._meleeAnim.durationMs;
  if (t >= 1) {
    this._meleeWeaponGroup.visible = false;
    this._meleeAnim = null;
    if (this._hudHidden) {
      this._hudHidden.forEach(h => { h.el.style.visibility = h.originalVisibility || ''; });
      this._hudHidden = null;
    }
    return;
  }

  // Smooth swing with half-sine easing
  const ease = 1 - Math.cos(t * Math.PI * 0.5);

  try {
    const step = Math.floor(t * 8);
    if (!this._meleeAnim._lastStep || this._meleeAnim._lastStep !== step) {
      this._meleeAnim._lastStep = step;
      console.log('updateArm: t=', t.toFixed(3), 'step=', step, 'ease=', ease.toFixed(3), 'visible=', this._meleeWeaponGroup.visible, 'children=', this._meleeWeaponGroup.children.length);
    }
  } catch (e) { /* ignore */ }


  
  const f = this._meleeAnim.from;
  const to = this._meleeAnim.to;

  this._meleeWeaponGroup.position.set(
    f.x + (to.x - f.x) * ease,
    f.y + (to.y - f.y) * ease,
    f.z + (to.z - f.z) * ease
  );
  this._meleeWeaponGroup.rotation.set(
    f.rotX + (to.rotX - f.rotX) * ease,
    f.rotY + (to.rotY - f.rotY) * ease,
    f.rotZ + (to.rotZ - f.rotZ) * ease
  );
}
  
    set position(v) {
    // copy the vector so _position stays updated
    this._position.copy(v);
  }
  
  // Cycle weapons forward/backward
  cycleWeapon(direction = 1) {
    if (!this.weapons || this.weapons.length === 0) return;

    this.currentWeaponIndex = (this.currentWeaponIndex + direction + this.weapons.length) % this.weapons.length;
    this._emitAmmo();
try {
            const switchSound = new Audio("assets/sfx/weapons/switch_weapon.ogg");
            switchSound.currentTime = 0;
            switchSound.play().catch(() => {});
        } catch (_) {}

        
    //console.log(`Switched to weapon: ${this.currentWeapon.name}`);
  }

  useAmmo(amount = 1) {
    const weapon = this.currentWeapon;
    if (!weapon) return false;

    if (weapon.ammoInClip >= amount) {
      weapon.ammoInClip -= amount;
      this._emitAmmo();
      return true;
    }
    return false;
  }

  reload() {
    const weapon = this.currentWeapon;
    if (!weapon) return;

    const ammoType = weapon.ammoType;
    const pool = this.ammoPools[ammoType] || 0;

    const needed = weapon.clipSize - weapon.ammoInClip;
    const toLoad = Math.min(needed, pool);

    if (toLoad <= 0) return; // nothing to reload

    weapon.ammoInClip += toLoad;
    this.ammoPools[ammoType] -= toLoad;

    this._emitAmmo();
  }

  switchWeapon(index) {
    if (index < 0 || index >= this.weapons.length) return;
    this.currentWeaponIndex = index;
    this._emitAmmo();
  }
  
 
  _emitHealth() {
    this.dispatchEvent(
      new CustomEvent("healthChanged", {
        detail: {
          hp: this.hp,
          maxHp: this.maxHp
        }
      })
    );
  }


// called in enemy.js death event
_playRandomTaunt() {
    // Initialize persistent state once
    if (this._tauntCooldownActive === undefined) {
        this._tauntCooldownActive = false; // tracks cooldown state // initialized once
    } // end cooldown init check

    const playProbabilityPercent = 80; // percent chance to play
    const cooldownMs = 5000; // cooldown duration in milliseconds

    const audioPaths = [
        "assets/sfx/player/taunt1.ogg",
        "assets/sfx/player/taunt2.ogg",
        "assets/sfx/player/taunt3.ogg",
        "assets/sfx/player/dumbass1.ogg",
        "assets/sfx/player/dumbass2.ogg"
    ]; // end audioPaths

    if (this._tauntCooldownActive) {
        return; // cooldown active, do nothing // prevents playback
    } // end cooldown check

    const roll = Math.random() * 100; // random roll between 0 and 100

    if (roll > playProbabilityPercent) {
        return; // probability failed, do nothing // no playback
    } // end probability check

    const randomIndex = Math.floor(Math.random() * audioPaths.length);
    const audio = new Audio(audioPaths[randomIndex]);

    audio.play().catch(() => {
        // playback failed (gesture restriction or load error)
    }); // end audio play

    this._tauntCooldownActive = true; // activate cooldown lock

    setTimeout(() => {
        this._tauntCooldownActive = false; // cooldown expired, unlock playback
    }, cooldownMs); // end setTimeout
} // end _playRandomTaunt

  _emitAmmo() {
    const weapon = this.currentWeapon;
    const ammoType = weapon.ammoType;
    const pool = this.ammoPools[ammoType] || 0;

    this.dispatchEvent(
      new CustomEvent("ammoChanged", {
        detail: {
          id: weapon.id,
          name: weapon.name,
          ammoInClip: weapon.ammoInClip,
          totalAmmo: pool, // total ammo is now shared pool
          clipSize: weapon.clipSize
        }
      })
    );
  }
}

