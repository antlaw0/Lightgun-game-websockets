import sounds from "../listOfSounds.js";

const mainWall = {
  horizontalRepeat: 25,
  verticalRepeat: 16,
  map: "assets/textures/bricks01/bricks01Color.png",
  normalMap: "assets/textures/bricks01/bricks01Normal.png",
  roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
  aoMap: "assets/textures/bricks01/bricks01AO.png",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes outerWall

export const Scene__Exported = {
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
    def:  "wall",
	id: "left_wall_1_object",
    type: "wall",
    position: {
      x: 9,
      y: 0,
      z: 5
    },
    size: {
      x: 1,
      y: 3,
      z: 14
    },
    texture: "default",
	material:  mainWall
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
    def:  "tile",
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
      y: 0.2,
      z: 4
    },
    texture: "assets/textures/blue.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
  {
    def:  "tile",
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
      y: 0.2,
      z: 15
    },
    texture: "assets/textures/blue.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
    {
    def:  "tile",
	id: "topCeiling_tile",
    type: "tile",
    layer: "ceiling",
    position: {
      x: 2,
      y: 3,
      z: 1
    },
    size: {
      x: 13,
      y: 0.2,
      z: 4
    },
    texture: "assets/textures/blue.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
    {
    def:  "tile",
	id: "lowerCeiling_tile",
    type: "tile",
    layer: "ceiling",
    position: {
      x: 10,
      y: 3,
      z: 5
    },
    size: {
      x: 5,
      y: 0.2,
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
