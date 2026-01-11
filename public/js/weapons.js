// weapons.js
// Centralized weapon definitions for player and enemies.

// Standardized weapon schema:
// name, fireSound, reloadSound, reloadTime, fireMode, rateOfFire, accuracy,
// damage, projectilesPerShot, projectileType, ammoType, explosive, explosionRadius,
// explosionDamage, weaponIcon, clipSize, totalAmmo

function baseWeapon(def) {
  return {
    name: def.name,
    fireSound: def.fireSound,
    reloadSound: def.reloadSound,
    reloadTime: def.reloadTime,

    fireMode: def.fireMode,
    rateOfFire: def.rateOfFire,
    accuracy: def.accuracy,

    // Projectile/spread metadata (passed through so runtime can read them)
    projectileSpread: def.projectileSpread ?? 0, // degrees (full cone angle)
    projectileSpeed: def.projectileSpeed ?? 50,
    projectileSize: def.projectileSize ?? 0.02,
    projectileLifetime: def.projectileLifetime ?? 2.0,

    // recoil: screen-space pixels added to reticle per shot (visual), and used
    // to influence actual accuracy while firing. Default 0.
    recoil: def.recoil ?? 0,

    damage: def.damage,
    projectilesPerShot: def.projectilesPerShot,

    projectileType: def.projectileType,
    ammoType: def.ammoType,

    explosive: def.explosive || false,
    explosionRadius: def.explosionRadius || 0,
    explosionDamage: def.explosionDamage || 0,
explosionSounds:  def.explosionSounds,
    weaponIcon: def.weaponIcon,
    clipSize: def.clipSize,
    totalAmmo: def.totalAmmo
  };
}

export const WEAPON_DEFS = {

  pistol: baseWeapon({
    name: "Pistol",
    fireSound: "assets/sfx/weapons/pistol_fire.ogg",
    reloadSound: "assets/sfx/weapons/pistol_reload.ogg",
    reloadTime: 1200,

    fireMode: "semi-auto",
    rateOfFire: 250,
    accuracy: 0.1,
    recoil: 20,
    projectileSpread:  0,
    damage: 20,
    projectilesPerShot: 1,

    projectileType: "bullet",
    ammoType: "9mm",

    explosive: false,

    weaponIcon: "assets/images/weapons/pistol.png",
    clipSize: 12,
    totalAmmo: 60
  }),

  shotgun: baseWeapon({
    name: "Shotgun",
    fireSound: "assets/sfx/weapons/shotgun_fire.ogg",
    reloadSound: "assets/sfx/shotgun_reload.ogg",
    reloadTime: 2000,

    fireMode: "semi-auto",
    rateOfFire: 700,
    accuracy: 0.6,
    recoil: 48,
    projectileSpread:  12,

    damage: 40,
    projectilesPerShot: 8,

    projectileType: "bullet",
    ammoType: "shotgun_shells",

    explosive: false,

    weaponIcon: "assets/images/weapons/shotgun.png",
    clipSize: 6,
    totalAmmo: 36
  }),

  assaultRifle: baseWeapon({
    name: "Assault Rifle",
    fireSound: "assets/sfx/weapons/assault_fire.ogg",
    reloadSound: "assets/sfx/assault_reload.ogg",
    reloadTime: 1800,

    fireMode: "auto",
    rateOfFire: 100,
    accuracy: 0.5,
    recoil: 22,
    projectileSpread:  0,

    damage: 15,
    projectilesPerShot: 1,

    projectileType: "bullet",
    ammoType: "5.56mm",

    explosive: false,

    weaponIcon: "assets/images/weapons/assault_rifle.png",
    clipSize: 30,
    totalAmmo: 120
  }),

  rocketLauncher: baseWeapon({
    name: "Rocket Launcher",
    fireSound: "assets/sfx/weapons/rocket_fire.ogg",
    reloadSound: "assets/sfx/rocket_reload.ogg",
    reloadTime: 2500,

    fireMode: "semi-auto",
    rateOfFire: 1200,
    accuracy: 0.95,
    recoil: 80,
    projectileSpread:  0,

    damage: 100,
    projectilesPerShot: 1,

    projectileType: "rocket",
    ammoType: "rockets",

    explosive: true,
    explosionRadius: 6,
    explosionDamage: 150,
explosionSounds:  ["assets/sfx/explosions/explosion_1A.ogg", "assets/sfx/explosions/explosion_1B.ogg"],
    weaponIcon: "assets/images/weapons/rocket_launcher.png",
    clipSize: 1,
    totalAmmo: 5
  }),

  sniperRifle: baseWeapon({
    name: "Sniper Rifle",
    fireSound: "assets/sfx/weapons/sniper_fire.ogg",
    reloadSound: "assets/sfx/weapons/sniper_reload.ogg",
    reloadTime: 2200,

    fireMode: "semi-auto",
    rateOfFire: 1000,
    accuracy: 0.995,
    recoil: 160,
    projectileSpread:  0,

    damage: 80,
    projectilesPerShot: 1,

    projectileType: "bullet",
    ammoType: ".308",

    explosive: false,

    weaponIcon: "assets/images/weapons/sniper_rifle.png",
    clipSize: 5,
    totalAmmo: 25
  })
};

// Easy accessor
export function getWeapon(id) {
  return WEAPON_DEFS[id] || null;
}
