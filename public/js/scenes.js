// js/scenes.js
// Export levels/scenes data. Positions are simple {x,y,z} in world units.

export const LEVELS = {
  Warehouse: {
    meta: {
      description: "Warehouse level - clear each scene to progress",
      author: "You"
    },

    scenes: [
      {
        // Scene 0: ground floor with crates and a catwalk enemy
        name: "Warehouse - Ground 1",

        environment: {
          staticObjects: [
            // --------------------------
            // Existing low-cover crates
            // --------------------------
            { type: "crate", position: { x: -2, y: 0, z: -6 }, coverType: "low" },
            { type: "crate", position: { x: 1, y: 0, z: -5 },  coverType: "low" },

            // --------------------------
            // Catwalk (not cover)
            // --------------------------
            { type: "catwalk", position: { x: 0, y: 2.5, z: -8 } },

            // ------------------------------------------------------
            // FULL COVER WALLS (NEW)
            // These use parametric dimensions + textures
            // ------------------------------------------------------

            {
              type: "wall",
              coverType: "full",
              position: { x: 5, y: 1, z: -10 },
              rotation: { y: 0 },
              size: { width: 6, height: 2, depth: 0.5 },
              texture: "assets/textures/concrete_wall.jpg"
            },

            {
              type: "wall",
              coverType: "full",
              position: { x: -3, y: 1, z: -15 },
              rotation: { y: Math.PI * 0.25 },
              size: { width: 4, height: 2, depth: 1 },
              texture: "assets/textures/brick_wall.jpg"
            }

            // Add more walls/cover objects freely...
          ]
        },

        // ------------------------------------------------------
        // Enemies
        // ------------------------------------------------------
        enemies: [
          {
            id: "gruntA",
            type: "Grunt",
            position: { x: -2, y: 0.5, z: -6 },
            // covers crate at index 0
            coverIndex: 0,
            facing: 0,
            behavior: {
              pattern: "popOutFromCover",
              params: { popDurationMs: 800, hideDurationMs: 1200 }
            }
          },

          {
            id: "gruntB",
            type: "Grunt",
            position: { x: 1, y: 0.5, z: -5 },
            coverIndex: 1,
            behavior: {
              pattern: "popOutFromCover",
              params: { popDurationMs: 700, hideDurationMs: 1400 }
            }
          },

          // This enemy is standing in the open on the catwalk
          {
            id: "gruntC",
            type: "Grunt",
            position: { x: 0, y: 2.7, z: -8 },
            behavior: { pattern: "standInOpen", params: { fireIntervalMs: 1200 } }
          }

          // You can add enemies referencing the new wall cover indices too:
          // e.g. coverIndex: 3 or 4 (depending on where the walls appear in the staticObjects array)
        ],

        objective: {
          type: "eliminateAllEnemies",
          description: "Eliminate all enemies to progress."
        }
      }

      // Additional scenes can be added here...
    ]
  }
};

// ---------------------------------------------------------------------------
// Reusable enemy type definitions.
// ---------------------------------------------------------------------------

export const ENEMY_DEFS = {
  Grunt: {
    displayName: "Grunt Soldier",
    sprite: "assets/sprites/grunt.png",
    hp: 40,
    // Optional: specify a 3D model and external animation files.
    // Place model and animations under `public/assets/...` and set these paths.
    modelUrl: "assets/models/model.fbx",
    animationUrls: {
      // using your uploaded pistol animations
      walk: "assets/animations/walk_pistol.fbx",
      shoot: "assets/animations/stand_pistol.fbx"
    },

    weapon: {
      name: "Pistol",
      fireSound: "assets/sfx/grunt/pistol_fire.ogg",
      fireRateMs: 600,
      damage: 1,
      clipSize: 6,
      reloadTimeMs: 1600,
      reloadSound: "assets/sfx/grunt/reload.ogg",
      ammoReserve: 36
    },

    hitSounds: [
      "assets/sfx/grunt/hit1.ogg",
      "assets/sfx/grunt/hit2.ogg",
      "assets/sfx/grunt/hit3.ogg"
    ],

    deathSounds: [
      "assets/sfx/grunt/death1.ogg",
      "assets/sfx/grunt/death2.ogg"
    ],

    accuracy: 0.65,
    reactionTimeMs: 350
  }
};
