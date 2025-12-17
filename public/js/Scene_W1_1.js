export const Scene_W1_1 = {
  name: "Warehouse - Scene 1",
  background: {
    texture: "assets/backgrounds/black_bg.png",
    width: 0,
    height: 0,
    position: { x: 0, y: 0, z: 0 }
  },

  room: {
    width: 20,
    height: 8,
    depth: 30
  },

  lights: [
    { type: "ambient", color: 0x8899aa, intensity: 0.4 },
    {
      type: "spot",
      color: 0xffffff,
      intensity: 3,
      distance: 28,
      angle: Math.PI / 5,
      penumbra: 0.0,
      decay: 2,
      position: { x: 0, y: 7.8, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      castShadow: true,
      shadow: { mapSize: { width: 4096, height: 4096 }, bias: -0.00008, near: 1, far: 30 }
    }
  ],

  roomTextures: {
    floor: "assets/textures/warehouse_floor.png",
    ceiling: "assets/textures/warehouse_ceiling.png",
    wall: "assets/textures/warehouse_wall.png",
    backWall: "assets/textures/warehouse_back.png"
  },

environment: {
  staticObjects: [
    // Crates for low cover (WOOD)
    {
      id: "crateA",
      type: "crate",
      position: { x: 0, y: 0.5, z: -6 },
      size: { x: 1, y: 1, z: 1 },
      hp: 8,
      maxHp: 8,
      coverType: "low",
      material: {
        map: "assets/props/crate.png",
        color: 0xffffff,
        roughness: 0.75,
        metalness: 0.0
      },
      hitSounds: ["assets/sfx/props/crate_hit1.ogg"],
      deathSounds: ["assets/sfx/props/crate_break.ogg"],
      deathAction: "break"
    },
    {
      id: "crateB",
      type: "crate",
      position: { x: 4, y: 0.5, z: -6 },
      size: { x: 1, y: 1, z: 1 },
      hp: 8,
      maxHp: 8,
      coverType: "low",
      material: {
        map: "assets/props/crate.png",
        color: 0xffffff,
        roughness: 0.75,
        metalness: 0.0
      },
      hitSounds: ["assets/sfx/props/crate_hit1.ogg"],
      deathSounds: ["assets/sfx/props/crate_break.ogg"],
      deathAction: "break"
    },

    // Full wall along left (ROUGH CEMENT)
    {
      id: "wall1",
      type: "wall",
      hp: 200,
      maxHp: 200,
      position: { x: -2.5, y: 0, z: -6 },
      size: { x: 6, y: 2.5, z: 0.2 },
      rotation: { x: 0, y: 0, z: 0 },
      coverType: "full",
      indestructible: true,
      material: {
        map: "assets/props/yellow.png",
        color: 0xffff00,   
        roughness: 0.95,
        metalness: 0.0
      },
      hitSounds: ["sounds/ric1.ogg"]
    },

    // Catwalk (METAL)
    {
      id: "catwalk",
      type: "catwalk",
      position: { x: 0, y: 2.7, z: -8 },
      size: { x: 4, y: 0.2, z: 1 },
      hp: 9999,
      maxHp: 9999,
      material: {
        color: 0x777777,
        roughness: 0.25,
        metalness: 0.9
      },
      hitSounds: [],
      deathSounds: [],
      deathAction: "none"
    }
  ]
},

  enemies: [
    // Enemies behind crates
    {
      id: "gruntA",
      type: "Grunt",
      hp: 40,
      position: { x: 0, y: 0.9, z: -7 },
      behavior: { pattern: "popOutFromCover", params: { coverType: "low" } },
      coverObject: "crateA",
      pattern: "popOutShootThenHide",
      weapon: { type: "pistol", damage: 1, fireSound: "assets/sfx/grunt/pistol_fire.ogg", hitSound: ["assets/sfx/grunt/hit1.ogg"], deathSound: ["assets/sfx/grunt/death1.ogg"], reloadSound: "assets/sfx/grunt/reload.ogg", clipSize: 6, reloadTime: 1400 },
      sprite: "assets/sprites/grunt.png"
    },
    {
      id: "gruntB",
      type: "Grunt",
      hp: 40,
      position: { x: 4, y: 0.9, z: -7 }, // behind crateB
      behavior: { pattern: "popOutFromCover", params: { coverType: "low" } },
      coverObject: "crateB",
      pattern: "popOutShootThenHide",
      weapon: { type: "pistol", damage: 1, fireSound: "assets/sfx/grunt/pistol_fire.ogg", hitSound: ["assets/sfx/grunt/hit1.ogg"], deathSound: ["assets/sfx/grunt/death1.ogg"], reloadSound: "assets/sfx/grunt/reload.ogg", clipSize: 6, reloadTime: 1400 },
      sprite: "assets/sprites/grunt.png"
    },
    // Enemy behind full wall
    {
      id: "gruntD",
      type: "Grunt",
      hp: 40,
      position: { x: -1.9, y: 0.9, z: -6 }, // directly behind wall1
      behavior: { pattern: "popOutFromCover", params: { coverType: "full" } },
      coverObject: "wall1",
      pattern: "popOutShootThenHide",
      weapon: { type: "rifle", damage: 2, fireSound: "assets/sfx/grunt/rifle_fire.ogg", hitSound: ["assets/sfx/grunt/hit1.ogg"], deathSound: ["assets/sfx/grunt/death1.ogg"], reloadSound: "assets/sfx/grunt/reload.ogg", clipSize: 5, reloadTime: 2000 },
      sprite: "assets/sprites/grunt.png"
    },
    // Enemy on catwalk, standing in open
    {
      id: "gruntC",
      type: "Grunt",
      hp: 40,
      position: { x: 0, y: 2.7, z: -8 },
      behavior: "standInOpen",
      coverObject: null,
      pattern: "standInOpen",
      weapon: { type: "pistol", damage: 1, fireSound: "assets/sfx/grunt/pistol_fire.ogg", hitSound: ["assets/sfx/grunt/hit1.ogg"], deathSound: ["assets/sfx/grunt/death1.ogg"], reloadSound: "assets/sfx/grunt/reload.ogg", clipSize: 6, reloadTime: 1400 },
      sprite: "assets/sprites/grunt.png"
    }
  ],

  objective: {
    type: "eliminateAllEnemies",
    description: "Eliminate all enemies to complete this scene."
  }
};
