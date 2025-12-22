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
    width: 40,
    height: 8,
    depth: 40
  },

  camera: {
    position: { x: 0, y: 1.7, z: 6 },
    lookAt: { x: 0, y: 1.4, z: -6 },
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

  roomTextures: {
    floor: "assets/textures/warehouse_floor.png",
    ceiling: "assets/textures/warehouse_ceiling.png",
    wall: "assets/textures/warehouse_wall.png",
    backWall: "assets/textures/warehouse_wall.png"
  },

  environment: {
    staticObjects: [
      // ===== FIRST LEG (-Z) =====

      {
        id: "hall1_leftWall",
        type: "wall",
        indestructible: true,
        position: { x: -2, y: 1.25, z: -6 },
        size: { x: 0.2, y: 2.5, z: 16 },
        material: {
          map: "assets/props/brick_wall.png",
          roughness: 0.95,
          metalness: 0.0
        },
        hitSounds: ["sounds/ric1.ogg"]
      },
      {
        id: "hall1_rightWall",
        type: "wall",
        indestructible: true,
        position: { x: 2, y: 1.25, z: -6 },
        size: { x: 0.2, y: 2.5, z: 16 },
        material: {
          map: "assets/props/brick_wall.png",
          roughness: 0.95,
          metalness: 0.0
        },
        hitSounds: ["sounds/ric1.ogg"]
      },

      // ===== CORNER BLOCKER (forces turn) =====

      {
        id: "cornerBlock",
        type: "wall",
        indestructible: true,
        position: { x: 0, y: 1.25, z: -14 },
        size: { x: 4, y: 2.5, z: 0.4 },
        material: {
          map: "assets/props/brick_wall.png",
          roughness: 0.95,
          metalness: 0.0
        },
        hitSounds: ["sounds/ric1.ogg"]
      },

      // ===== SECOND LEG (+X) =====

      {
        id: "hall2_backWall",
        type: "wall",
        indestructible: true,
        position: { x: 8, y: 1.25, z: -16 },
        size: { x: 16, y: 2.5, z: 0.2 },
        material: {
          map: "assets/props/brick_wall.png",
          roughness: 0.95,
          metalness: 0.0
        },
        hitSounds: ["sounds/ric1.ogg"]
      },
      {
        id: "hall2_frontWall",
        type: "wall",
        indestructible: true,
        position: { x: 8, y: 1.25, z: -12 },
        size: { x: 16, y: 2.5, z: 0.2 },
        material: {
          map: "assets/props/brick_wall.png",
          roughness: 0.95,
          metalness: 0.0
        },
        hitSounds: ["sounds/ric1.ogg"]
      }
    ]
  },

  enemies: [],

  objective: {
    type: "reachEnd",
    description: "Traverse the L-shaped hallway to verify movement, collision, lighting, and audio."
  },

  nextScene: null
};
