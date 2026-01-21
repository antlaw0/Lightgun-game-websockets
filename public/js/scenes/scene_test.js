// js/scenes/scene_test_range.js

export const scene_test = {
  name: "Weapon Test Range",

  background: {
    texture: "assets/backgrounds/black_bg.png",
    width: 0,
    height: 0,
    position: { x: 0, y: 0, z: 0 }
  },

  // Large flat area, no enclosure
  room: {
    width: 50,
    height: 0,   // no ceiling
    depth: 50
  },

  cameraRails: {
    intro: [],
    exit: []
  },

  camera: {
    position: { x: 0, y: 1.7, z: 0 },
    lookAt: { x: 0, y: 1.4, z: -6 },
    fov: 60,
    near: 0.1,
    far: 200
  },

  // Simple, neutral lighting
  lights: [
    {
      type: "ambient",
      color: 0xffffff,
      intensity: 0.4
    }
    ,
    {
      type: "directional",
      color: 0xffffff,
      intensity: 1.6,
      position: { x: 5, y: 10, z: 5 },
      target: { x: 0, y: 1.4, z: -6 },
      castShadow: true,
      shadow: {
        mapSize: { width: 2048, height: 2048 },
        camera: { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 50 }
      }
    }
  ],

  // Only a floor texture, everything else intentionally absent
  roomTextures: {
    floor: "assets/textures/warehouse_floor.png",
    ceiling: null,
    wall: null,
    backWall: null
  },

  environment: {
    staticObjects: [
      {
        id: "crate_test",
        type: "crate",
        position: { x: 0, y: 0.5, z: -5 },
        size: { x: 1, y: 1, z: 1 },
        hp: 100,
        maxHp: 100,
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
      }
    ]
  },

  enemies: [
    {
      id: "grunt_test",
      type: "Grunt",
      displayName: "Grunt Soldier",
	  hp:  80,
      modelUrl: "assets/models/exo_red.fbx",
      // sit slightly behind the crate so crate is between camera and enemy
      position: { x: 0, y: 0, z: -6 },
      facing: 0,
      coverObject: "crate_test",
      coverType: "low",
      // increase crouch depth so model can hide behind 0.5m crate
      behavior: { pattern: "popOutFromCover", params: { coverType: "low", popDurationMs: 300, hideDurationMs: 1200, firingDurationMs: 900, crouchOffsetY: -2.5, crouchScale: 0.85 } }
    }
  ],

  objective: {
    type: "eliminateAllEnemies",
    description: "Eliminate all test targets."
  },

  nextScene: null
};
