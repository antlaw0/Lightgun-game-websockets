import sounds from "../listOfSounds.js";
import { materials } from "../listOfMaterials.js";


export const l_shaped_hallway = {
  name: "L-shaped_hallway1",

  camera: {
    position: { x: 12, y: 1.7, z: 26 },
    lookAt: { x: 12, y: 1.7, z: 15 },
    fov: 60,
    near: 0.1,
    far: 200
  },

  introDoorId: "introDoor_object",

  lights: [
  {
    id: "ambient_fill",
    type: "ambient",
    color: 0xffffff,
    intensity: 0.35
  }, // closes ambient_fill

  {
    id: "hallway_key_light_top",
    type: "point",
    color: 0xe6f2ff,        // slightly cool fluorescent tone
    intensity: 0.7,
    distance: 40,
    decay: 2,
    position: { x: 8, y: 2.8, z: 2 },
    castShadow: true
  }, // closes hallway_key_light_top

  {
    id: "hallway_key_light_lower",
    type: "point",
    color: 0xe6f2ff,
    intensity: 1.4,
    distance: 50,
    decay: 2,
    position: { x: 12, y: 2.8, z: 12 },
    castShadow: true
  }, // closes hallway_key_light_lower

  {
    id: "corner_accent",
    type: "spot",
    color: 0xffffff,
    intensity: 1.2,
    distance: 30,
    angle: 0.6,
    penumbra: 0.4,
    position: { x: 9, y: 2.9, z: 5 },
    target: { x: 6, y: 0, z: 5 },
    castShadow: true
  } // closes corner_accent
],

  environment: {
    staticObjects: [
  
  {
        id: "introDoor_object",
        type: "door",
        def: "wall",
                position: { x: 12, y: 0, z: 20 }, // center X along corridor width
        size: { x: 2, y: 2.2, z: 0.2 },
        rotationY: 180,
        openDirection:  1,
		openInOut:  1,
        texture: "assets/textures/door_wood.png"
      }, // closes introDoor
	  
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
    
	material:  materials.bricks01
  
  },
  {
    id: "right_wall_1_object",
    type: "wall",
    position: {
      x: 15,
      y: 0,
      z: 0
    },
    size: {
      x: 1,
      y: 3,
      z: 19
    },
	material:  materials.bricks01
	},
    
  {
    def:  "wall",
	id: "intro_left_wall_object",
    type: "wall",
        position: { x: 9, y: 0, z: 20 }, // flush with door's left side
        size: { x: 2.7, y: 3, z: 1 },   // wide enough to reach corridor edge
	material:  materials.bricks01
	},
    
  {
    def:  "wall",
	id: "intro_right_wall_object",
    type: "wall",
            position: { x: 14.3, y: 0, z: 20 }, // flush with door's right side
        size: { x: 2.7, y: 3, z: 1 },
	material:  materials.bricks01
	},
    
  {
    def:  "wall",
	id: "secondLegLowerWall_object",
    type: "wall",
    position: {
      x: 1,
      y: 0,
      z: 5
    },
    size: {
      x: 8,
      y: 3,
      z: 1
    },
	material:  materials.bricks01
	},
    
  {
    def:  "wall",
	id: "topWall_object",
    type: "wall",
    position: {
      x: 1,
      y: 0,
      z: 0
    },
    size: {
      x: 14,
      y: 3,
      z: 1
    },
	material:  materials.bricks01
	},
    
  {
    def:  "wall",
	id: "endWall_object",
    type: "object",
    position: {
      x: 1,
      y: 0,
      z: 1
    },
    size: {
      x: 1,
      y: 3,
      z: 4
    },
    material:  materials.bricks01
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
    material:  materials.concrete01,
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
    material:  materials.concrete01,
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
    material:  materials.concrete01,
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
    material:  materials.concrete01,
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
