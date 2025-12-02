// js/hud.js
export const HUD = {
  init(player) {
    this.player = player;

    // DOM references
    this.healthFill = document.querySelector('.hud-health .health-fill');
    this.healthText = document.querySelector('.hud-health .health-text');
    this.ammoCount = document.querySelector('.ammo-count');
    this.totalAmmo = document.querySelector('.total-ammo');

    // Listen for updates from player
    player.addEventListener('healthChanged', e => this.updateHealth(e.detail.hp, e.detail.maxHp));
    player.addEventListener('ammoChanged', e => this.updateAmmo(e.detail.ammoInClip, e.detail.totalAmmo));

    // Initialize display
    this.updateHealth(player.hp, player.maxHp);
    const w = player.currentWeapon;
    this.updateAmmo(w.ammoInClip, w.totalAmmo);
  },

  updateHealth(hp, maxHp) {
    const pct = (hp / maxHp) * 100;
    this.healthFill.style.width = pct + '%';

    // Color thresholds
    if (pct > 25) this.healthFill.className = 'health-fill hp-green';
    else if (pct > 10) this.healthFill.className = 'health-fill hp-yellow';
    else this.healthFill.className = 'health-fill hp-red';

    this.healthText.textContent = `${hp} / ${maxHp}`;
  },

  updateAmmo(ammoInClip, totalAmmo) {
    this.ammoCount.textContent = `${ammoInClip} / ${this.player.currentWeapon.clipSize}`;
    this.totalAmmo.textContent = totalAmmo;
  }
};
