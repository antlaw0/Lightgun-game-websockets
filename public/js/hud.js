// js/hud.js
export const HUD = {
  init(player) {
    this.player = player;

    // DOM references
    this.healthFill = document.querySelector('.hud-health .health-fill');
    this.healthText = document.querySelector('.hud-health .health-text');
    this.ammoCount = document.querySelector('.ammo-count');
    this.totalAmmo = document.querySelector('.total-ammo');
    this.weaponNameEl = document.querySelector('.weapon-name');
    this.weaponImgEl = document.querySelector('.weapon-img');
    this.ammoTypeEl = document.querySelector('.ammo-type'); // new

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
        d.ammoType // new
      );
    });

    // Initialize display
    this.updateHealth(player.hp, player.maxHp);
    const w = player.currentWeapon;
    this.updateAmmo(w.ammoInClip, w.totalAmmo, w.clipSize, w.name, w.id, w.ammoType);
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

    if (this.ammoTypeEl) this.ammoTypeEl.textContent = ammoType ? `Ammo: ${ammoType}` : '';
  }
};
