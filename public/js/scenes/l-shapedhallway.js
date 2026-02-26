
// AUTO-GENERATED FILE
// Generated from 2D Scene Mapper
// DO NOT EDIT BY HAND

export const Scene_L-shaped_hallway1 = {
  name: "L-shaped_hallway1",

  camera: {
    position: { x: 15, y: 10, z: 50 },
    lookAt: { x: 15, y: 3.5, z: 15 },
    fov: 60,
    near: 0.1,
    far: 200
  },

  lights: [],

  environment: {
    staticObjects: [
  {
    id: "left_wall_1_object",
    type: "object",
    position: {
      x: 9,
      y: 0,
      z: 5
    },
    size: {
      x: 1,
      y: 1,
      z: 14
    },
    texture: "default"
  },
  {
    id: "right_wall_1_object",
    type: "object",
    position: {
      x: 15,
      y: 0,
      z: 0
    },
    size: {
      x: 1,
      y: 1,
      z: 19
    },
    texture: "default"
  },
  {
    id: "intro_left_wall_object",
    type: "object",
    position: {
      x: 9,
      y: 0,
      z: 19
    },
    size: {
      x: 3,
      y: 1,
      z: 1
    },
    texture: "default"
  },
  {
    id: "intro_right_wall_object",
    type: "object",
    position: {
      x: 13,
      y: 0,
      z: 19
    },
    size: {
      x: 3,
      y: 1,
      z: 1
    },
    texture: "default"
  },
  {
    id: "secondLegLowerWall_object",
    type: "object",
    position: {
      x: 1,
      y: 0,
      z: 5
    },
    size: {
      x: 8,
      y: 1,
      z: 1
    },
    texture: "default"
  },
  {
    id: "topWall_object",
    type: "object",
    position: {
      x: 1,
      y: 0,
      z: 0
    },
    size: {
      x: 14,
      y: 1,
      z: 1
    },
    texture: "default"
  },
  {
    id: "endWall_object",
    type: "object",
    position: {
      x: 1,
      y: 0,
      z: 1
    },
    size: {
      x: 1,
      y: 1,
      z: 4
    },
    texture: "default"
  },
  {
    id: "topFloor_tile",
    type: "tile",
    layer: "floor",
    position: {
      x: 2,
      y: 0,
      z: 1
    },
    size: {
      x: 13,
      y: 1,
      z: 4
    },
    texture: "assets/textures/blue.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
  {
    id: "lowerFloor_tile",
    type: "tile",
    layer: "floor",
    position: {
      x: 10,
      y: 0,
      z: 5
    },
    size: {
      x: 5,
      y: 1,
      z: 15
    },
    texture: "assets/textures/blue.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  }
]
  },

  enemies: [],
  objective: null,
  nextScene: null
};
