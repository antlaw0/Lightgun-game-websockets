
// AUTO-GENERATED FILE
// Generated from 2D Scene Mapper
// DO NOT EDIT BY HAND

export const Scene_test = {
  name: "test",

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
    id: "wall_object",
    type: "object",
    position: {
      x: 7,
      y: 0.5,
      z: 9
    },
    size: {
      x: 3,
      y: 7,
      z: 1
    },
    texture: "default"
  },
  {
    id: "ceiling_tile",
    type: "tile",
    layer: "ceiling",
    position: {
      x: 4,
      y: 7,
      z: 4
    },
    size: {
      x: 2,
      y: 1,
      z: 2
    },
    texture: "assets/textures/yellow.png",
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
