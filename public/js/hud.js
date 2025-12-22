// js/hud.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export const HUD = {
  init(player, camera) {
    this.player = player;
    this.camera = camera;

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

    // Listen for updates from player
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

    // Initialize display
    this.updateHealth(player.hp, player.maxHp);
    const w = player.currentWeapon;
    this.updateAmmo(w.ammoInClip, w.totalAmmo, w.clipSize, w.name, w.id, w.ammoType);
  },

  update(delta) {
    if (this.cameraDebugEnabled && this.camera) {
      this.updateCameraDebug();
    }
  },

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
  }
};
