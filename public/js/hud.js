import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export const HUD = {
  // -------------------------------------------------
  // Camera/head bob state
  // -------------------------------------------------
  _headBobEnabled: true,
  _headBobTime: 0,
  _headBobSpeed: 12,
  _headBobIntensity: 1,

  _activeShakes: [],
  _shakeTime: 0,
  _cameraBasePosition: null,
  _cameraBaseRotation: null,


// Head bob triggered by footsteps
_headBobStepOffset: 0,     // vertical offset for this frame
_headBobStepDuration: 0.1, // seconds duration of each bob
_headBobStepTime: 0,       // timer for active bob

  init(player, camera) {
    this.player = player;
    this.camera = camera;

    this._cameraBasePosition = camera.position.clone();
    this._cameraBaseRotation = camera.rotation.clone();

    // DOM references
    this.healthFill = document.querySelector('.hud-health .health-fill');
    this.healthText = document.querySelector('.hud-health .health-text');
    this.ammoCount = document.querySelector('.ammo-count');
    this.totalAmmo = document.querySelector('.total-ammo');
    this.weaponNameEl = document.querySelector('.weapon-name');
    this.weaponImgEl = document.querySelector('.weapon-img');
    this.ammoTypeEl = document.querySelector('.ammo-type');

    // Camera debug HUD
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

    // Player events
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

    // Initial HUD state
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
  },
triggerHeadBob() {
        if (!this._headBobEnabled) return;
	//console.log("headbob triggered")
	this._headBobStepTime = 0;           // reset bob timer
    this._headBobStepOffset = this._headBobIntensity; // max bob amplitude
},

  // =================================================
  // HEAD BOB API
  // =================================================
  setHeadBob(active, speed = 6, intensity = 0.05) {
    this._headBobEnabled = active;
    this._headBobSpeed = speed;
    this._headBobIntensity = intensity;
    if (!active) this._headBobTime = 0;
  },

  // =================================================
  // CAMERA SHAKE
  // =================================================
  shakeCamera(intensity = 0.1, duration = 0.3) {
    this._activeShakes.push({
      intensity,
      duration,
      time: duration,
      direction: null
    });
  },

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
  },

  // =================================================
  // FRAME UPDATE
  // =================================================
  update(delta) {
    this._updateCameraShake(delta);

    if (this.cameraDebugEnabled && this.camera) {
      this.updateCameraDebug();
    }
  },

// hud.js
_getCameraOffset(delta = 1/60) {
    let offset = new THREE.Vector3();

    // Footstep head bob
    if (this._headBobStepTime < this._headBobStepDuration) {
        const t = this._headBobStepTime / this._headBobStepDuration;
        const fade = 1 - t;
        offset.y += this._headBobStepOffset * fade;

        // advance the timer
        this._headBobStepTime += delta;
    }

    // Camera shakes
    this._activeShakes.forEach(s => {
        const p = s.time / s.duration;
        const falloff = p * p;
        let localOffset = new THREE.Vector3(
            Math.sin(this._shakeTime * 40) * s.intensity * falloff,
            Math.sin(this._shakeTime * 53) * s.intensity * falloff,
            0
        );
        if (s.direction) localOffset.addScaledVector(s.direction, s.intensity * 0.6);
        offset.add(localOffset);

        s.time -= delta; 
    });

    return offset;
},
  
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

      const localOffset = new THREE.Vector3(n1 * strength, n2 * strength, 0);
      if (s.direction) localOffset.addScaledVector(s.direction, strength * 0.6);

      totalOffset.add(localOffset);

      rotX += n2 * strength * 0.15;
      rotY += n1 * strength * 0.15;
    }

    // Apply footstep head bob
if (this._headBobStepTime < this._headBobStepDuration) {
    this._headBobStepTime += delta;
    const t = this._headBobStepTime / this._headBobStepDuration;
    const fade = 1 - t; // bob fades out
    totalOffset.y += this._headBobStepOffset * fade;
}

    // Apply to camera
    this.camera.position.add(totalOffset);
    this.camera.rotation.x += rotX;
    this.camera.rotation.y += rotY;
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
  },

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
  },

  updateCameraDebug() {
    const pos = this.camera.position;
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    const rotX = THREE.MathUtils.radToDeg(euler.x);
    const rotY = THREE.MathUtils.radToDeg(euler.y);
    const rotZ = THREE.MathUtils.radToDeg(euler.z);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();

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
  }
};
