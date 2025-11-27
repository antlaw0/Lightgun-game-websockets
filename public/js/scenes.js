// js/scenes.js
// Export levels/scenes data. Positions are simple {x,y,z} in world units.
// Sound paths are relative to your assets folder (e.g. "assets/sfx/grunt/hit1.ogg").

export const LEVELS = {
  Warehouse: {
    meta: {
      description: "Warehouse level - clear each scene to progress",
      author: "You",
    },
    scenes: [
      {
        // Scene 0: ground floor with crates and a catwalk enemy
        name: "Warehouse - Ground 1",
        environment: {
          // simple groups you can use to add static meshes
          staticObjects: [
            { type: "crate", position: { x: -2, y: 0, z: -6 } },
            { type: "crate", position: { x: 1, y: 0, z: -5 } },
            { type: "catwalk", position: { x: 0, y: 2.5, z: -8 } }
          ]
        },
        enemies: [
          {
            id: "gruntA",
            type: "Grunt",
            position: { x: -2, y: 0.5, z: -6 },
            // cover object index references staticObjects array (optional)
            coverIndex: 0,
            facing: 0, // angle in radians, optional
            behavior: { pattern: "popOutFromCover", params: { popDurationMs: 800, hideDurationMs: 1200 } }
          },
          {
            id: "gruntB",
            type: "Grunt",
            position: { x: 1, y: 0.5, z: -5 },
            coverIndex: 1,
            behavior: { pattern: "popOutFromCover", params: { popDurationMs: 700, hideDurationMs: 1400 } }
          },
          {
            id: "gruntC",
            type: "Grunt",
            position: { x: 0, y: 2.7, z: -8 },
            // this one is on the catwalk: no cover
            behavior: { pattern: "standInOpen", params: { fireIntervalMs: 1200 } }
          }
        ],
        objective: {
          type: "eliminateAllEnemies",
          description: "Eliminate all enemies to progress."
        }
      },

      // You can add more scenes here...
    ]
  }
};

// Reusable enemy type definitions. These can be in this file or their own file.
export const ENEMY_DEFS = {
  Grunt: {
    displayName: "Grunt Soldier",
    sprite: "assets/sprites/grunt.png",
    hp: 3,
    // default weapon object
    weapon: {
      name: "Pistol",
      fireSound: "assets/sfx/grunt/pistol_fire.ogg",
      fireRateMs: 600, // minimum time between shots
      damage: 1,
      clipSize: 6,
      reloadTimeMs: 1600,
      reloadSound: "assets/sfx/grunt/reload.ogg",
      ammoReserve: 36
    },
    // arrays of sound files; random pick on hit/death
    hitSounds: [
      "assets/sfx/grunt/hit1.ogg",
      "assets/sfx/grunt/hit2.ogg",
      "assets/sfx/grunt/hit3.ogg"
    ],
    deathSounds: [
      "assets/sfx/grunt/death1.ogg",
      "assets/sfx/grunt/death2.ogg"
    ],
    // simple AI tuning parameters
    accuracy: 0.65, // 0..1 - used when deciding if a shot hits (you can replace with raycast)
    reactionTimeMs: 350
  }
};
