// AUTO-GENERATED FILE
// Generated from 2D Scene Mapper
// DO NOT EDIT BY HAND

export const Scene__Exported = {
  name: "map1",
  background: {
    texture: "assets/backgrounds/black_bg.png",
    width: 0,
    height: 0,
    position: { x: 0, y: 0, z: 0 }
  },

  // Large flat area, no enclosure
  room: {
    width: 50,
    height: 20,
    depth: 50
  },

  camera: {
    position: { x: 15, y: 10, z: 0 },
    lookAt: { x: 15, y: 3.5, z: 15 },
    fov: 60,
    near: 0.1,
    far: 200
  },

  lights: [
    {
      type: "ambient",
      color: 0xFFFFFF,
      intensity: 0.8
    },
    {
      id: "light_point_1_object",
      type: "point",
      color: 16777215,
      intensity: 1.5,
      position: { x: 16, y: 6.5, z: 23 },
      distance: 50,
      decay: 2,
      castShadow: true,
      shadow: {
        mapSize: { width: 1024, height: 1024 },
        camera: { near: 0.5, far: 50 },
        bias: -0.0001
      }
    },
	  {
    type: "hemisphere",
    skyColor: 0xFFFFFF,
    groundColor: 0x555555,
    intensity: 0.5
  },
    {
      id: "light_point_2_object",
      type: "point",
      color: 16777215,
      intensity: 1.5,
      position: { x: 10, y: 6.5, z: 16 },
      distance: 50,
      decay: 2,
      castShadow: true,
      shadow: {
        mapSize: { width: 1024, height: 1024 },
        camera: { near: 0.5, far: 50 },
        bias: -0.0001
      }
    }
  ],

  environment: {
    staticObjects: [
  {
    id: "wall_left_vertical_wall",
    type: "wall",
    position: {
      x: 13,
      y: 0,
      z: 19
    },
    size: {
      x: 1,
      y: 7,
      z: 10
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  },
  {
    id: "wall_righte_vertical_wall",
    type: "wall",
    position: {
      x: 19,
      y: 0,
      z: 14
    },
    size: {
      x: 1,
      y: 7,
      z: 15
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  },
  {
    id: "wall_left_2_horizontal_wall",
    type: "wall",
    position: {
      x: 4,
      y: 0,
      z: 19
    },
    size: {
      x: 9,
      y: 3,
      z: 1
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  },
  {
    id: "wall_right_2_horizontal_wall",
    type: "wall",
    position: {
      x: 3,
      y: 0,
      z: 13
    },
    size: {
      x: 17,
      y: 3,
      z: 1
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  },
  {
    id: "wall_end_piecee_vertical_wall",
    type: "wall",
    position: {
      x: 3,
      y: 0,
      z: 18
    },
    size: {
      x: 1,
      y: 3,
      z: 2
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  },
  {
    id: "wall_piece_end_2e_vertical_wall",
    type: "wall",
    position: {
      x: 3,
      y: 0,
      z: 14
    },
    size: {
      x: 1,
      y: 3,
      z: 3
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  },
  {
    id: "exit_door_object",
    type: "object",
    position: {
      x: 3,
      y: 0,
      z: 17
    },
    size: {
      x: 1,
      y: 1,
      z: 1
    },
    texture: "default"
  },
  {
    id: "wall_beginning_piece_1e_horizontal_wall",
    type: "wall",
    position: {
      x: 13,
      y: 0,
      z: 29
    },
    size: {
      x: 3,
      y: 7,
      z: 1
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  },
  {
    id: "wall_beginning_right_horizontal_wall",
    type: "wall",
    position: {
      x: 17,
      y: 0,
      z: 29
    },
    size: {
      x: 3,
      y: 7,
      z: 1
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  },
  {
    id: "starting_door_object",
    type: "object",
    position: {
      x: 16,
      y: 0,
      z: 29
    },
    size: {
      x: 1,
      y: 5,
      z: 1
    },
    texture: "assets/textures/metal_door.png"
  },
  {
    id: "cameraStart_object",
    type: "object",
    position: {
      x: 16,
      y: 0,
      z: 30
    },
    size: {
      x: 1,
      y: 1,
      z: 1
    },
    texture: "default"
  },
  {
    id: "floor_1_tile",
    type: "tile",
    layer: "floor",
    position: {
      x: 4,
      y: 0,
      z: 24
    },
    size: {
      x: 2,
      y: 1,
      z: 2
    },
    texture: "/assets/textures/yellow.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
  {
    id: "ceiling_1_tile",
    type: "tile",
    layer: "ceiling",
    position: {
      x: 5,
      y: 6,
      z: 26
    },
    size: {
      x: 1,
      y: 1,
      z: 1
    },
    texture: "/assets/textures/yellow.png",
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
