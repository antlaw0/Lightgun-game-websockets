// js/scenes/scene_test_hallway_L.js
export const Scene_W1_2 = {
  name: "Test Scene - L Shaped Hallway",

  background: {
    texture: "assets/backgrounds/black_bg.png",
    width: 0,
    height: 0,
    position: { x: 0, y: 0, z: 0 }
  },

  // Overall bounding room, larger than the hallway itself
  room: {
  width: 10,
  height: 5,
  depth: 12,
  center: { x: 0, y: 0, z: 0 }
},


  camera: {
    position: { x: 0, y: 1.7, z: 8 },
    lookAt: { x: 0, y: 1.4, z: 0 },
    fov: 60,
    near: 0.1,
    far: 120
  },

  lights: [
    {
      type: "ambient",
      color: 0x8899aa,
      intensity: 0.35
    },
    {
      // Light for first hallway leg (-Z)
      type: "spot",
      color: 0xffffff,
      intensity: 2.5,
      distance: 30,
      angle: Math.PI / 6,
      penumbra: 0.15,
      decay: 2,
      position: { x: 0, y: 7.5, z: 2 },
      target: { x: 0, y: 0, z: -10 },
      castShadow: true,
      shadow: {
        mapSize: { width: 2048, height: 2048 },
        bias: -0.00008,
        near: 1,
        far: 40
      }
    },
    {
      // Light for second hallway leg (+X)
      type: "spot",
      color: 0xffffff,
      intensity: 2.5,
      distance: 30,
      angle: Math.PI / 6,
      penumbra: 0.15,
      decay: 2,
      position: { x: 6, y: 7.5, z: -14 },
      target: { x: 14, y: 0, z: -14 },
      castShadow: true,
      shadow: {
        mapSize: { width: 2048, height: 2048 },
        bias: -0.00008,
        near: 1,
        far: 40
      }
    }
  ],

enemies: [
  
  {
      id: "gruntC",
      type: "Grunt",
      hp: 40,
      position: { x: 1, y: 0.9, z: 0 },
	  
      behavior: { pattern: "standInOpen" },
      firePauseMs: 3000,
      weapon: "sniperRifle",
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
      hitSounds: ["assets/sfx/grunt/hit1.ogg", "assets/sfx/grunt/hit2.ogg"],
      deathSounds: ["assets/sfx/grunt/death1.ogg", "assets/sfx/grunt/death2.ogg"],
      sprite: "assets/sprites/grunt.png"
    },

  {
    id: "MeleegruntA",
    type: "Grunt",
    hp: 40,
    position: { x: 1, y: 0.9, z: 2 },
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

    behavior: {
      pattern: "meleeRush",
      params: {
        approachSpeed: 2.2,
        meleeRange: 1.5,
        sideOffset: 1.1,
        attackCooldownMs: 700
      }
    }, // end behavior

    hitSounds: [
      "assets/sfx/grunt/hit1.ogg",
      "assets/sfx/grunt/hit2.ogg"
    ],

    deathSounds: [
      "assets/sfx/grunt/death1.ogg",
      "assets/sfx/grunt/death2.ogg"
    ],

    sprite: "assets/sprites/grunt.png"
  }
], 

  
  roomTextures: {
    floor: "assets/textures/warehouse_floor.png",
    ceiling: "assets/textures/warehouse_ceiling.png",
    wall: "assets/textures/warehouse_wall.png",
    backWall: "assets/textures/warehouse_wall.png"
  },

  environment: {
    staticObjects: []

      },

  

  objective: {
    type: "reachEnd",
    description: "Traverse the L-shaped hallway to verify movement, collision, lighting, and audio."
  },

  nextScene: null
};
