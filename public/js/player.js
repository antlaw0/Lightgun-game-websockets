// js/player.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';

import { WEAPON_DEFS } from "./weapons.js";
import { AMMO_DEFS } from "./ammo.js";

export class Player extends EventTarget {
  constructor({ maxHp = 10000, hp = 10000, camera = null } = {}) {
    super();

    // store the camera passed in (may be null and attached later)
    this.camera = camera;

    this.maxHp = maxHp;
    this.hp = hp;

// Melee state
this._lastMeleeMs = 0;
this.meleeCooldownMs = 600;


    // Arm model (visual melee) - create a simple placeholder immediately
    this._armGroup = new THREE.Group(); // Group attached to camera (placeholder until GLB loads)
    this._armVisible = false;
    this._meleeAnim = null; // { startMs, durationMs }
    this._armLoaded = false;
    this._meleeWeaponGroup = null; // group that will hold the current melee weapon
    this._meleeWeaponPath = null; // path of weapon to load (knife.glb etc.)
    // Track whether we've retried attaching the arm to the camera once
    this._armAttachRetried = false;
    // placeholder mesh so player can see swipe before GLB finishes loading
    try {
      const geom = new THREE.BoxGeometry(0.35, 0.12, 0.6);
      const mat = new THREE.MeshBasicMaterial({ color: 0xDD9966 });
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.transparent = true;
      mat.side = THREE.DoubleSide;
      const box = new THREE.Mesh(geom, mat);
      box.renderOrder = 9999;
      box.frustumCulled = false;
      box.position.set(0, -0.05, 0);
      this._armGroup.add(box);
      this._armGroup.visible = false;
      this._armGroup.renderOrder = 9999;
      console.log('Arm placeholder created');
      // attach immediately if camera exists
      if (this.camera && this.camera.add) {
        try { this._attachArmToCamera(); } catch(_){ }
      }
    } catch (e) {
      console.warn('arm placeholder creation failed', e);
    }
    // Attempt to load full arm model (will replace placeholder when ready)
    try { this._loadArmModel(); } catch (e) { console.warn('arm load failed', e); }
    // default melee weapon (can be changed later)
    this._meleeWeaponPath = 'assets/models/knife.glb';

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

  // start visual swipe immediately and mark last melee time
  this._lastMeleeMs = nowMs;
          try {
            const sw = new Audio("assets/sfx/swing_medium.ogg");
            sw.currentTime = 0;
            sw.play().catch(() => {});
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

    const reach = 2.2;
    const radius = 1.4;
    const damage = 15;
    const knockbackForce = 0.35;

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

  // Load the arm GLB and prepare group to attach to camera
  // ----------------- ARM LOADING & SWIPE -----------------
_loadArmModel() {
    const loader = new GLTFLoader();
    loader.load('assets/models/playerArm.glb',
        (gltf) => {
                console.log('GLB loaded, scene children:', gltf.scene.children.length);
			try {
                const arm = gltf.scene;
// Normalize Sketchfab scale
arm.scale.setScalar(0.015);

                // ensure all meshes render in front and are transparent
                arm.traverse((c) => {
                    if (c.isMesh) {
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
                    }
                });

                // Normalize model scale and center so it fits in camera frustum predictably
                try {
                  const box = new THREE.Box3().setFromObject(arm);
                  const size = new THREE.Vector3();
                  box.getSize(size);
                  const maxDim = Math.max(size.x, size.y, size.z) || 1;
                  const desiredMax = 0.6; // target max dimension in meters
                  const scaleFactor = desiredMax / maxDim;
                  arm.scale.multiplyScalar(scaleFactor);
                  // Recompute box after scaling and recenter to origin
                  box.setFromObject(arm);
                  const center = new THREE.Vector3();
                  box.getCenter(center);
                  arm.position.sub(center);
                  // apply a small offset so arm sits slightly down/forward in camera space
                  arm.position.add(new THREE.Vector3(0, -0.05, 0));
                  arm.rotation.set(-0.35, 0, 0);
                  try { const newBox = new THREE.Box3().setFromObject(arm); const newSize = new THREE.Vector3(); newBox.getSize(newSize); console.log('ARM normalize sizeBefore=', size.toArray(), 'scaleFactor=', scaleFactor, 'sizeAfter=', newSize.toArray()); } catch(e){}
                } catch (e) {
                  console.warn('ARM normalization failed', e);
                  arm.position.set(0, -0.05, 0);
                  arm.rotation.set(-0.35, 0, 0);
                  arm.scale.set(1.05, 1.05, 1.05);
                }

                // Adjust local pivot so the shoulder sits at the group's origin.
                try {
                  let postBox = new THREE.Box3().setFromObject(arm);
                  const postSize = new THREE.Vector3();
                  postBox.getSize(postSize);

                  // If model's major axis is Z (depth) instead of X (width), rotate model to align it along X
                  if (postSize.z > postSize.x * 1.1) {
                    arm.rotateY(-Math.PI / 2);
                    // recompute box after rotation
                    postBox = new THREE.Box3().setFromObject(arm);
                    postBox.getSize(postSize);
                    console.log('ARM rotated to align major axis: new size=', postSize.toArray());
                  }

                  // Choose hand side by which side extends further from center
                  const center = new THREE.Vector3(); postBox.getCenter(center);
                  const distMin = Math.abs(center.x - postBox.min.x);
                  const distMax = Math.abs(postBox.max.x - center.x);
                  // Hand is on side with larger distance; shoulder is opposite side (pivot)
                  let pivotX;
                  if (distMin > distMax) {
                    // hand at min.x, shoulder at max.x
                    pivotX = postBox.max.x;
                  } else {
                    // hand at max.x, shoulder at min.x
                    pivotX = postBox.min.x;
                  }

                  // Shift arm so pivot (shoulder) is at x=0 in local space
                  arm.position.x -= pivotX;
                  console.log('ARM pivot adjusted chosen pivotX=', pivotX, 'new arm position=', arm.position.toArray(), 'postSize=', postSize.toArray());
                } catch (e) { console.warn('ARM pivot adjustment failed', e); }

                // Remove placeholder and add real arm
                if (this._armGroup) {
                    while (this._armGroup.children.length) this._armGroup.remove(this._armGroup.children[0]);
                    this._armGroup.add(arm);
                } else {
                    this._armGroup = new THREE.Group();
                    this._armGroup.add(arm);
                }

                this._armGroup.visible = false; // hide until melee starts
                this._armLoaded = true;

                console.log('playerArm.glb loaded');

                try {
                  const box = new THREE.Box3().setFromObject(arm);
                  const size = new THREE.Vector3();
                  box.getSize(size);
                  const center = new THREE.Vector3();
                  box.getCenter(center);
                  console.log('ARM BOUNDS', JSON.stringify({ min: box.min.toArray(), max: box.max.toArray(), size: size.toArray(), center: center.toArray() }));
                } catch (e) { console.warn('ARM bounds compute failed', e); }

                // attach to camera if ready
                if (this.camera && this.camera.add) {
                  this._attachArmToCamera();
                }

                // If a melee weapon is queued, attempt to load/attach it now
                if (this._meleeWeaponPath) {
                  try { this.loadMeleeWeapon(this._meleeWeaponPath); } catch(e) { console.warn('queued melee attach failed', e); }
                }

            } catch (e) {
                console.warn('Arm model setup failed', e);
            }
        },
        undefined,
        (err) => console.warn('Failed to load arm GLB', err)
    );
}

// Attach the arm to the camera properly at shoulder height
_attachArmToCamera() {
    if (!this._armGroup || !this.camera) return;

    const cam = this.camera;
    if (!this._armGroup.parent) cam.add(this._armGroup);

    // Reset transforms
    this._armGroup.position.set(0, -0.2, -0.6); // shoulder-level near camera
    this._armGroup.rotation.set(0, 0, 0);
    this._armGroup.scale.set(1, 1, 1);

    // Ensure all meshes are visible in front of scene
    this._armGroup.traverse(c => {
        if (c.isMesh && c.material) {
            c.material.depthTest = false;
            c.material.depthWrite = false;
            c.material.transparent = true;
            c.material.side = THREE.DoubleSide;
            c.renderOrder = 9999;
            c.frustumCulled = false;
        }
    });

    this._armGroup.visible = false; // only show on melee
    console.log('Arm attached to camera at', this._armGroup.position.toArray());
}

// Start a smooth shoulder swing from left to right
_startArmSwipe() {
    if (!this._armGroup) return;
    this._armGroup.visible = true;

    const now = performance.now();
    const durationMs = 600; // swing duration
    const shoulderHeight = -0.2; // camera-local Y
    const shoulderZ = -0.6; // camera-local Z
    const shoulderX = 0.4; // right shoulder start

    // Start and end positions/rotations for smooth swing
    this._meleeAnim = {
        startMs: now,
        durationMs,
        from: { x: shoulderX, y: shoulderHeight, z: shoulderZ, rotX: -0.2, rotY: 0, rotZ: -Math.PI / 3 }, // raised behind
        to:   { x: -shoulderX, y: shoulderHeight, z: shoulderZ, rotX: -0.15, rotY: 0, rotZ: Math.PI / 3 }  // swing across
    };

    // ensure arm is attached
    if (!this._armGroup.parent) this._attachArmToCamera();

    // Set initial transform
    const f = this._meleeAnim.from;
    this._armGroup.position.set(f.x, f.y, f.z);
    this._armGroup.rotation.set(f.rotX, f.rotY, f.rotZ);
}

// Update arm each frame
updateArm(deltaMs) {
    if (!this._armGroup || !this._meleeAnim) return;

    const t = (performance.now() - this._meleeAnim.startMs) / this._meleeAnim.durationMs;
    if (t >= 1) {
        this._armGroup.visible = false;
        this._meleeAnim = null;
        if (this._hudHidden) {
            this._hudHidden.forEach(h => { h.el.style.visibility = h.originalVisibility || ''; });
            this._hudHidden = null;
        }
        return;
    }

    // Smooth swing with half-sine easing
    const ease = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
    const f = this._meleeAnim.from;
    const to = this._meleeAnim.to;

    this._armGroup.position.set(
        f.x + (to.x - f.x) * ease,
        f.y + (to.y - f.y) * ease,
        f.z + (to.z - f.z) * ease
    );
    this._armGroup.rotation.set(
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

