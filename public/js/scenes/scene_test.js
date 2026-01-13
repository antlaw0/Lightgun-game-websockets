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
      intensity: 0.8
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
    staticObjects: []
  },

  enemies: [
    {
      id: "grunt_1",
      type: "Grunt",
      hp: 40,
      // Quick model (falls back to procedural mannequin if unreachable)
      modelUrl: "assets/models/model.fbx",
      // allow automatic auto-scaling based on the GLTF bounding box
      modelScale: null,
      position: { x: -3, y: 0.9, z: -6 },
      behavior: {
        pattern: "path",
        params: {
          loop: true,
          steps: [
            { type: "move", axis: "x", distance: 6, durationMs: 3000 },
            { type: "pause", durationMs: 800 },
            { type: "move", axis: "x", distance: -6, durationMs: 3000 },
            { type: "pause", durationMs: 800 }
          ]
        }
      },
      firePauseMs: 800,
      weapon: "pistol",
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
      },
      hitSounds: [
        "assets/sfx/grunt/hit1.ogg",
        "assets/sfx/grunt/hit2.ogg"
      ],
      deathSounds: [
        "assets/sfx/grunt/death1.ogg",
        "assets/sfx/grunt/death2.ogg"
      ]
      ,
      // apparel temporarily disabled (using colorization instead)
      // apparel: ["pants","tshirt"]
    },
    {
      id: "grunt_shooter",
      type: "Grunt",
      hp: 40,
      modelUrl: "assets/models/model.fbx",
      modelScale: null,
      position: { x: 2.5, y: 0.9, z: -6 },
      behavior: {
        pattern: "standInOpen",
        params: { fireIntervalMs: 900 },
        stance: 'wideGun'
      },
      firePauseMs: 900,
      weapon: "pistol",
      sprite: "assets/sprites/grunt.png",
      voice: {
        pain: ["assets/sfx/grunt/pain1.ogg"],
        death: ["assets/sfx/grunt/death1.ogg"],
        engage: ["assets/sfx/grunt/engage1.ogg"]
      },
      hitSounds: ["assets/sfx/grunt/hit1.ogg"],
      deathSounds: ["assets/sfx/grunt/death1.ogg"]
      ,
      // apparel temporarily disabled (using colorization instead)
      // apparel: ["pants","tshirt"]
    }
  ],

  objective: {
    type: "eliminateAllEnemies",
    description: "Eliminate all test targets."
  },

  nextScene: null
};
