// js/enemies/listOfEnemies.js
// Centralized reusable enemy base definitions
// Scene instances should reference these via { def: "name", ...overrides }

import voices from "./listOfVoices.js";

const grunt_pistol_def = {
  type: "Grunt",
  displayName: "Grunt",
  aimYawOffset: -Math.PI / 2,
      
  hp: 40,
//modelScalePercent:  150,
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
    pain: voices.grunt.pain,
    death: voices.grunt.death,
    taunt: voices.grunt.taunt,
    engage: voices.grunt.engage
  }, // end voice

  hitSounds: voices.grunt.hitSounds,

  deathSounds: voices.grunt.deathSounds
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

  }, // end drone_basic

  // -------------------------------------------------
  // Stationary auto-turret enemy
  // -------------------------------------------------
  autoturret_tripod: {
    type: "AutoTurret",
    displayName: "Auto Turret",
    hp: 80,

    active: true,
	
	 explodeOnDeath: true,
 explosionRadius: 5,
 explosionDamage: 80,
 explosionSounds: [ "assets/sfx/explosions/explosion_1A.ogg" ],
	


    compositeModel: {
      baseUrl: "assets/models/tripod.glb",
      topUrl: "assets/models/turret.glb",
      topScalePercent: 30,   // controls turret-top size
      bottomScalePercent: 70 // controls tripod/base size
                             // values are percentages of the auto-normalised camera height
    },

    weapon: "assaultRifle",
    firePauseMs: 0,
    accuracy: 0.85,

    behavior: {
      pattern: "standInOpen",
      params: {
        burstCount: 3,
        burstShotIntervalMs: 100,
        burstCooldownMs: 1000
      }
    },

    voice: {
      loop: [
        "assets/sfx/turret/active.ogg"
      ]
    }

  }, // end autoturret_tripod

  swat_rifle_standing_open: {
    type: "Grunt",
    displayName: "Grunt Soldier",
    hp: 40,
    // Use your provided SWAT model and shooting + dying animations
    modelUrl: "assets/models/swatguy.glb",
    animationUrls: {
      shoot: "assets/animations/swatguy_firing_rifle.glb",
      dying_rifle: "assets/animations/swatguy_dying.glb",
      dying: "assets/animations/swatguy_dying.glb"
    },
	  voice: {
    pain: voices.soldier.pain,
    death: voices.soldier.death,
    taunt: voices.soldier.taunt,
    engage: voices.soldier.engage
  }, // end voice

  hitSounds: voices.soldier.hitSounds,

  deathSounds: voices.soldier.deathSounds,
    
    // set an explicit groundY so the loader aligns the model's feet to this height
    groundY: 0.85,
    facing: 0,
    behavior: { pattern: "standInOpen", params: { fireIntervalMs: 900 } 
	}
  } // end swat_rifle_standing_open


}; // end ENEMY_DEFS
