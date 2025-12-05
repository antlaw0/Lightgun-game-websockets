// js/Scene_W1_1.js
export const Scene_W1_1 = {
  name: "Warehouse - Scene 1",
  background: {
    texture: "assets/backgrounds/warehouse_bg.png",
    width: 40,     // world units
    height: 20, // 20 / (16/9)
    position: { x: 0, y: 0, z: 0 } // behind everything
  },

  environment: {
    staticObjects: [
      {
        id: "crateA",
        type: "crate",
        position: { x: -2, y: 0.5, z: -2 },
        size: { x: 1, y: 1, z: 1 },
        texture: "assets/props/crate.png",
        hp: 8,
        maxHp: 8,
		coverType: "low",
        hitSounds: ["assets/sfx/props/crate_hit1.ogg"],
        deathSounds: ["assets/sfx/props/crate_break.ogg"],
        deathAction: "break"
      },
      {
        id: "crateB",
        type: "crate",
        position: { x: 1, y: 0.5, z: -2 },
        size: { x: 1, y: 1, z: 1 },
        texture: "assets/props/crate.png",
        hp: 8,
        maxHp: 8,
		coverType: "low",
        hitSounds: ["assets/sfx/props/crate_hit1.ogg"],
        deathSounds: ["assets/sfx/props/crate_break.ogg"],
        deathAction: "break"
      },
      {
        id: "catwalk",
        type: "catwalk",
        position: { x: 0, y: 2.7, z: -8 },
        size: { x: 4, y: 0.2, z: 1 },
        texture: null,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [],
        deathSounds: [],
        deathAction: "none"
      }
    ]
  },

  enemies: [
    {
      id: "gruntA",
      type: "Grunt",
      hp: 3,
      position: { x: -2, y: 0.9, z: -2 },
      behavior: { pattern: "popOutFromCover", params: { coverType: "low" } },
      coverObject: "crateA",
      pattern: "popOutShootThenHide",
      weapon: {
        type: "pistol",
        damage: 1,
        fireSound: "assets/sfx/grunt/pistol_fire.ogg",
        hitSound: ["assets/sfx/grunt/hit1.ogg"],
        deathSound: ["assets/sfx/grunt/death1.ogg"],
        reloadSound: "assets/sfx/grunt/reload.ogg",
        clipSize: 6,
        reloadTime: 1400
      },
      sprite: "assets/sprites/grunt.png"
    },
    {
      id: "gruntB",
      type: "Grunt",
      hp: 3,
      position: { x: 1, y: 0.9, z: -2 },
      behavior: { pattern: "popOutFromCover", params: { coverType: "low" } },
      
      coverObject: "crateB",
      pattern: "popOutShootThenHide",
      weapon: {
        type: "pistol",
        damage: 1,
        fireSound: "assets/sfx/grunt/pistol_fire.ogg",
        hitSound: ["assets/sfx/grunt/hit1.ogg"],
        deathSound: ["assets/sfx/grunt/death1.ogg"],
        reloadSound: "assets/sfx/grunt/reload.ogg",
        clipSize: 6,
        reloadTime: 1400
      },
      sprite: "assets/sprites/grunt.png"
    },
    {
      id: "gruntC",
      type: "Grunt",
      hp: 3,
      position: { x: 0, y: 2.7, z: -8 },
      behavior: "standInOpen",
      coverObject: null,
      pattern: "standInOpen",
      weapon: {
        type: "pistol",
        damage: 1,
        fireSound: "assets/sfx/grunt/pistol_fire.ogg",
        hitSound: ["assets/sfx/grunt/hit1.ogg"],
        deathSound: ["assets/sfx/grunt/death1.ogg"],
        reloadSound: "assets/sfx/grunt/reload.ogg",
        clipSize: 6,
        reloadTime: 1400
      },
      sprite: "assets/sprites/grunt.png"
    }
  ],

  objective: {
    type: "eliminateAllEnemies",
    description: "Eliminate all enemies to complete this scene."
  }
};
