// js/hud.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export const HUD = {
  init(player, camera) {
    this.player = player;
    this.camera = camera;

    // -------------------------------------------------
    // Camera shake system (advanced)
    // -------------------------------------------------
    this._activeShakes = [];
    this._shakeTime = 0;

    this._cameraBasePosition = camera.position.clone();
    this._cameraBaseRotation = camera.rotation.clone();

    // -------------------------------------------------
    // DOM references
    // -------------------------------------------------
    this.healthFill = document.querySelector('.hud-health .health-fill');
    this.healthText = document.querySelector('.hud-health .health-text');
    this.ammoCount = document.querySelector('.ammo-count');
    this.totalAmmo = document.querySelector('.total-ammo');
    this.weaponNameEl = document.querySelector('.weapon-name');
    this.weaponImgEl = document.querySelector('.weapon-img');
    this.ammoTypeEl = document.querySelector('.ammo-type');

    // -------------------------------------------------
    // Camera debug HUD
    // -------------------------------------------------
    this.cameraDebugEl = document.createElement('div');
    this.cameraDebugEl.className = 'hud-camera-debug';
    this.cameraDebugEl.style.display = 'none';
    document.body.appendChild(this.cameraDebugEl);

    this.cameraDebugEnabled = false;

    window.addEventListener('keydown', e => {
      if (e.key === 'F3') {
        this.cameraDebugEnabled = !this.cameraDebugEnabled;
        this.cameraDebugEl.style.display = this.cameraDebugEnabled ? 'block' : 'none';
      }
    });

    // -------------------------------------------------
    // Muzzle flash (screen-space) overlay
    // -------------------------------------------------
    this._muzzleFlashEl = document.createElement('div');
    this._muzzleFlashEl.className = 'muzzle-flash-overlay';
    Object.assign(this._muzzleFlashEl.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      mixBlendMode: 'screen',
      transition: 'opacity 0s linear',
      opacity: '0',
      zIndex: '9999'
    });
    document.body.appendChild(this._muzzleFlashEl);

    // Configurable defaults
    this.muzzleFlash = {
      color: 'rgba(250,248,240,', // warm very-light gray base (alpha appended at runtime)
      defaultOpacity: 0.08,
      framesFull: 1, // fully visible frames
      framesFade: 2, // fade out frames
      totalFrames: 3
    };
    this._muzzleFlashFramesRemaining = 0; // frame-based counter

    // -------------------------------------------------
    // Reticle kick state (screen-space, DOM transform)
    // -------------------------------------------------
    this._reticleKick = {
      framesRemaining: 0,
      totalFrames: 6,
      offset: { x: 0, y: 0 },
      magnitudePx: 6
    };

    // -------------------------------------------------
    // Camera micro-recoil state (rotation velocity)
    // -------------------------------------------------
    this._recoil = {
      rotVel: new THREE.Vector3(0, 0, 0),
      // damping chosen to return under ~100ms
      damping: 40
    };

    // -------------------------------------------------
    // Player event listeners
    // -------------------------------------------------
    player.addEventListener('healthChanged', e => {
      this.updateHealth(e.detail.hp, e.detail.maxHp);
    });

    player.addEventListener('ammoChanged', e => {
      const d = e.detail;
      this.updateAmmo(
        d.ammoInClip,
        d.totalAmmo,
        d.clipSize,
        d.name,
        d.id,
        d.ammoType
      );
    });

    // -------------------------------------------------
    // Initial HUD state
    // -------------------------------------------------
    this.updateHealth(player.hp, player.maxHp);

    const w = player.currentWeapon;
    this.updateAmmo(
      w.ammoInClip,
      w.totalAmmo,
      w.clipSize,
      w.name,
      w.id,
      w.ammoType
    );
  }, // end init()

  // =================================================
  // PUBLIC CAMERA SHAKE APIS
  // =================================================

  // Generic shake (weapon fire, damage)
  shakeCamera(intensity = 0.1, duration = 0.3) {
    this._activeShakes.push({
      intensity,
      duration,
      time: duration,
      direction: null
    });
  }, // end shakeCamera()

  // Explosion-style shake with distance falloff
  shakeCameraAt(worldPos, maxIntensity = 0.5, radius = 10) {
    if (!this.camera) return;

    const camPos = this.camera.position;
    const distance = camPos.distanceTo(worldPos);

    if (distance > radius) return;

    const t = 1 - distance / radius;
    const intensity = maxIntensity * (t * t); // quadratic falloff

    const dir = camPos.clone().sub(worldPos).normalize();

    this._activeShakes.push({
      intensity,
      duration: 0.5,
      time: 0.5,
      direction: dir
    });
  }, // end shakeCameraAt()

  // =================================================
  // FRAME UPDATE
  // =================================================
  update(delta) {
    // update camera recoil + shakes and HUD visuals (frame-based)
    this._updateCameraRecoil(delta);
    this._updateCameraShake(delta);
    this._updateMuzzleFlashFrame();
    this._updateReticleKick();

    if (this.cameraDebugEnabled && this.camera) {
      this.updateCameraDebug();
    }
  }, // end update()

  // =================================================
  // CAMERA SHAKE CORE
  // =================================================
  _updateCameraShake(delta) {
  if (!this.camera) return;

  this._shakeTime += delta;

  let totalOffset = new THREE.Vector3();
  let rotX = 0;
  let rotY = 0;

  for (let i = this._activeShakes.length - 1; i >= 0; i--) {
    const s = this._activeShakes[i];
    s.time -= delta;

    if (s.time <= 0) {
      this._activeShakes.splice(i, 1);
      continue;
    }

    const p = s.time / s.duration;
    const falloff = p * p;

    const n1 = Math.sin(this._shakeTime * 40 + i * 10);
    const n2 = Math.sin(this._shakeTime * 53 + i * 20);

    const strength = s.intensity * falloff;

    const localOffset = new THREE.Vector3(
      n1 * strength,
      n2 * strength,
      0
    );

    if (s.direction) {
      localOffset.addScaledVector(s.direction, strength * 0.6);
    }

    totalOffset.add(localOffset);

    rotX += n2 * strength * 0.15;
    rotY += n1 * strength * 0.15;
  }

  // Apply as delta so it stacks with camera systems
  this.camera.position.add(totalOffset);
  this.camera.rotation.x += rotX;
  this.camera.rotation.y += rotY;
  }, // end _updateCameraShake(),

  // -------------------------------------------------
  // Camera micro-recoil integration
  // -------------------------------------------------
  _updateCameraRecoil(delta) {
    if (!this.camera) return;
    // integrate rotation velocity
    const rv = this._recoil.rotVel;
    // apply as small rotation deltas
    this.camera.rotation.x += rv.x;
    this.camera.rotation.y += rv.y;

    // damping (exponential)
    const damp = Math.exp(-this._recoil.damping * delta);
    rv.multiplyScalar(damp);
  },

  // -------------------------------------------------
  // Muzzle flash frame-based update
  // -------------------------------------------------
  _updateMuzzleFlashFrame() {
    if (this._muzzleFlashFramesRemaining <= 0) {
      if (this._muzzleFlashEl.style.opacity !== '0') this._muzzleFlashEl.style.opacity = '0';
      return;
    }

    // Decrement once per animation frame (called from requestAnimationFrame loop)
    const remaining = this._muzzleFlashFramesRemaining;
    this._muzzleFlashFramesRemaining = Math.max(0, remaining - 1);

    const t = this._muzzleFlashFramesRemaining;
    const total = this.muzzleFlash.totalFrames;

    // If at first frame (just fired) show full default opacity
    if (t >= total - this.muzzleFlash.framesFull) {
      this._muzzleFlashEl.style.opacity = String(this.muzzleFlash.defaultOpacity);
    } else {
      // fade fraction across fade frames
      const fadeIndex = t; // 0..framesFade
      const fadeFrac = (fadeIndex) / Math.max(1, this.muzzleFlash.framesFade);
      this._muzzleFlashEl.style.opacity = String(this.muzzleFlash.defaultOpacity * fadeFrac);
    }
  },

  // -------------------------------------------------
  // Reticle kick update (applies CSS transform to reticle element)
  // -------------------------------------------------
  _updateReticleKick() {
    if (!document) return;
    const el = document.getElementById('reticle');
    if (!el) return;

    if (this._reticleKick.framesRemaining <= 0) {
      el.style.transform = '';
      return;
    }

    const r = this._reticleKick;
    // compute progress 0..1 (1 at start)
    const progress = r.framesRemaining / r.totalFrames;
    // ease out
    const ease = Math.sqrt(progress);

    const ox = r.offset.x * ease;
    const oy = r.offset.y * ease;
    el.style.transform = `translate(${ox}px, ${oy}px)`;

    r.framesRemaining = Math.max(0, r.framesRemaining - 1);
  },

  // -------------------------------------------------
  // Public hook: call this from the single firing entrypoint
  // -------------------------------------------------
  onWeaponFire({ retX = null, retY = null, weapon = null, isAuto = false } = {}) {
    // Throttle muzzle flash for automatic weapons
    if (isAuto && weapon) {
      weapon._autoFlashCounter = (weapon._autoFlashCounter || 0) + 1;
      const everyN = weapon._muzzleFlashEvery || 3; // default every-3rd shot
      if ((weapon._autoFlashCounter % everyN) === 0) {
        // trigger flash
      } else {
        // don't flash this shot
        // still apply small reticle kick & micro recoil per shot
        this._triggerReticleKick();
        this._applyCameraRecoil( (weapon._recoilPx || 1) );
        return;
      }
    }

    // trigger muzzle flash overlay centered on given reticle coords (or center)
    const cx = retX ?? (window.innerWidth / 2);
    const cy = retY ?? (window.innerHeight / 2);
    const alpha = this.muzzleFlash.defaultOpacity;
    this._muzzleFlashEl.style.background = `radial-gradient(circle at ${cx}px ${cy}px, ${this.muzzleFlash.color}${alpha}) 0%, rgba(0,0,0,0) 45%)`;
    this._muzzleFlashFramesRemaining = this.muzzleFlash.totalFrames;

    // reticle kick
    this._triggerReticleKick();

    // camera micro recoil (1-3 px suggested magnitude)
    const px = (weapon && weapon._recoilPx) || 2;
    this._applyCameraRecoil(px);
  },

  _triggerReticleKick() {
    const r = this._reticleKick;
    r.framesRemaining = r.totalFrames;
    const angle = (Math.random() - 0.5) * 2 * 0.6; // lateral randomness factor
    // upward impulse (negative y because DOM y grows downward)
    r.offset.x = Math.round((Math.random() - 0.5) * r.magnitudePx * 0.6);
    r.offset.y = Math.round(-Math.abs(r.magnitudePx) * (0.6 + Math.random() * 0.6));
  },

  _applyCameraRecoil(px) {
    if (!this.camera) return;
    // convert approximate pixel offset to camera angle (radians)
    const fovDeg = this.camera.fov || 60;
    const ang = (px / window.innerHeight) * fovDeg * (Math.PI / 180);
    // primary vertical impulse (pitch)
    const v = this._recoil.rotVel;
    v.x -= ang; // pitch up
    // slight random yaw
    v.y += (Math.random() - 0.5) * ang * 0.3;
  },

// =================================================
  // HUD DISPLAY
  // =================================================
  updateHealth(hp, maxHp) {
    const pct = (hp / maxHp) * 100;
    this.healthFill.style.width = pct + '%';

    if (pct > 25) this.healthFill.className = 'health-fill hp-green';
    else if (pct > 10) this.healthFill.className = 'health-fill hp-yellow';
    else this.healthFill.className = 'health-fill hp-red';

    this.healthText.textContent = `${hp} / ${maxHp}`;
  }, // end updateHealth()

  updateAmmo(ammoInClip, totalAmmo, clipSize, weaponName, weaponId, ammoType) {
    this.ammoCount.textContent = `${ammoInClip} / ${clipSize}`;
    this.totalAmmo.textContent = totalAmmo;

    if (this.weaponNameEl) this.weaponNameEl.textContent = weaponName;

    if (this.weaponImgEl) {
      this.weaponImgEl.src = `/assets/images/weapons/${weaponId}.png`;
      this.weaponImgEl.alt = weaponName;
    }

    if (this.ammoTypeEl) {
      this.ammoTypeEl.textContent = ammoType ? `Ammo: ${ammoType}` : '';
    }
  }, // end updateAmmo()

  // =================================================
  // CAMERA DEBUG
  // =================================================
  updateCameraDebug() {
    const pos = this.camera.position;

    const euler = new THREE.Euler().setFromQuaternion(
      this.camera.quaternion,
      'YXZ'
    );

    const rotX = THREE.MathUtils.radToDeg(euler.x);
    const rotY = THREE.MathUtils.radToDeg(euler.y);
    const rotZ = THREE.MathUtils.radToDeg(euler.z);

    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion)
      .normalize();

    this.cameraDebugEl.textContent =
`CAMERA DEBUG
Position:
  X: ${pos.x.toFixed(2)}
  Y: ${pos.y.toFixed(2)}
  Z: ${pos.z.toFixed(2)}

Rotation (deg):
  Pitch X: ${rotX.toFixed(1)}
  Yaw   Y: ${rotY.toFixed(1)}
  Roll  Z: ${rotZ.toFixed(1)}

Forward:
  X: ${forward.x.toFixed(2)}
  Y: ${forward.y.toFixed(2)}
  Z: ${forward.z.toFixed(2)}
`;
  } // end updateCameraDebug()
}; // end HUD
