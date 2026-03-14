// js/enemies/listOfEnemies.js
// Centralized reusable enemy base definitions
// Scene instances should reference these via { def: "name", ...overrides }

const grunt_pistol_def = {
  type: "Grunt",
  displayName: "Grunt",
  aimYawOffset: -Math.PI / 2,
      
  hp: 40,

  modelUrl: "assets/models/exo_red.glb",
  modelScale: null,

  animationUrls: {
    walk: "assets/animations/walk_pistol.glb",
    shoot: "assets/animations/stand_pistol.glb"
  }, // end animationUrls

  weapon: "pistol",
  firePauseMs: 800,

  sprite: "assets/sprites/grunt.png",

  voice: {
    pain: [
      "assets/sfx/grunt/pain1.ogg",
      "assets/sfx/grunt/pain2.ogg"
    ],
    death: [
      "assets/sfx/grunt/death1.ogg",
      "assets/sfx/grunt/death2.ogg"
    ],
    taunt: [
      "assets/sfx/grunt/taunt1.ogg",
      "assets/sfx/grunt/taunt2.ogg"
    ],
    engage: [
      "assets/sfx/grunt/engage1.ogg"
    ]
  }, // end voice

  hitSounds: [
    "assets/sfx/grunt/hit1.ogg",
    "assets/sfx/grunt/hit2.ogg"
  ],

  deathSounds: [
    "assets/sfx/grunt/death1.ogg",
    "assets/sfx/grunt/death2.ogg"
  ]
};

export const ENEMY_DEFS = {

  // -------------------------------------------------
  // Standard pistol grunt (walking or basic shooter)
  // -------------------------------------------------
  grunt_pistol: grunt_pistol_def,
  
  // Alias for legacy scenes using type: "Grunt"
  Grunt: grunt_pistol_def,



  // -------------------------------------------------
  // Stationary / open-fire grunt variant
  // -------------------------------------------------
  grunt_stationary: {
    def: "grunt_pistol",

    behavior: {
      pattern: "standInOpen",
      params: {
        fireIntervalMs: 900
      },
      stance: "wideGun"
    }, // end behavior

    firePauseMs: 900

  }, // end grunt_stationary



  // -------------------------------------------------
  // Melee brute / rushing enemy
  // -------------------------------------------------
  melee_brute: {
    type: "Grunt",
    displayName: "Brute",
    hp: 60,

    modelUrl: "assets/models/brute.glb",

    animationUrls: {
      walk: "assets/animations/brute_walk.glb"
    }, // end animationUrls

    behavior: {
      pattern: "meleeRush",
      params: {
        approachSpeed: 0.9,
        meleeRange: 1.6,
        sideOffset: 0.2,
        attackCooldownMs: 900
      }
    }, // end behavior

    sprite: "assets/sprites/grunt.png",

    hitSounds: [
      "assets/sfx/grunt/hit1.ogg",
      "assets/sfx/grunt/hit2.ogg"
    ],

    deathSounds: [
      "assets/sfx/grunt/death1.ogg",
      "assets/sfx/grunt/death2.ogg"
    ]

  }, // end melee_brute



  // -------------------------------------------------
  // Flying drone enemy
  // -------------------------------------------------
  drone_basic: {
    type: "Drone",
    displayName: "Drone",
    hp: 30,

    active: true,

    modelUrl: "assets/models/drone.glb",
    modelScale: 0.3,

    weapon: "laser_pistol",
    firePauseMs: 900,

    voice: {
      loop: [
        "assets/sfx/drone/drone_loop.ogg"
      ],
      pain: [
        "assets/sfx/drone/drone_pain1.ogg"
      ],
      taunt: [
        "assets/sfx/drone/drone_taunt1.ogg"
      ]
    }, // end voice

    hitSounds: [
      "assets/sfx/drone/drone_hit1.ogg",
      "assets/sfx/drone/drone_hit2.ogg"
    ],

    deathSounds: [
      "assets/sfx/drone/drone_die1.ogg",
      "assets/sfx/drone/drone_die2.ogg"
    ]

  } // end drone_basic

}; // end ENEMY_DEFS
