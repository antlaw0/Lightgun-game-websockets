// AUTO-GENERATED FILE
// Generated from 2D Scene Mapper
// DO NOT EDIT BY HAND


// =====================================================
// OUTER WALL MATERIAL (module scope)
// =====================================================
const outerWall = {
  horizontalRepeat: 25,
  verticalRepeat: 16,
  map: "assets/textures/bricks01/bricks01Color.png",
  normalMap: "assets/textures/bricks01/bricks01Normal.png",
  roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
  aoMap: "assets/textures/bricks01/bricks01AO.png",
  roughness: 1.0,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes outerWall


// =====================================================
// SCENE DEFINITION
// =====================================================
export const Scene_starting_Room = {
  name: "startingRoom",

  camera: {
    position: { x: 15.3, y: 1.7, z: 21.68 },
    lookAt: { x: 17.3, y: 3.5, z: 20 },
    fov: 60,
    near: 0.1,
    far: 200
  }, // closes camera

  lights: [
    {
      type: "ambient",
      color: 0x0000FF,
      intensity: 0.3
    }, // closes ambient

    {
      type: "hemisphere",
      skyColor: 16777215,
      groundColor: 4473924,
      intensity: 0.6,
      id: "light_hemisphere",
      position: { x: 0, y: 15, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      color: 16777215
    }, // closes hemisphere

    {
      type: "directional",
      color: 0xffffff,
      intensity: 0.2,
      position: { x: 0, y: 10, z: 0 },
      target: { x: 0, y: 1.4, z: -6 },
      castShadow: true,
      shadow: {
        mapSize: { width: 2048, height: 2048 },
        camera: {
          left: -10,
          right: 10,
          top: 10,
          bottom: -10,
          near: 0.5,
          far: 50
        } // closes shadow.camera
      } // closes shadow
    } // closes directional
  ], // closes lights

  environment: {
    staticObjects: [

      {
        id: "wall_1_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 3, y: 0, z: 0 },
        size: { x: 1, y: 7, z: 19 },
        texture: "default"
      }, // closes wall_1

      {
        id: "wall_2_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 4, y: 0, z: 0 },
        size: { x: 23, y: 7, z: 1 },
        texture: "default"
      }, // closes wall_2

      {
        id: "wall_3_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 27, y: 0, z: 0 },
        size: { x: 1, y: 7, z: 19 },
        texture: "default"
      }, // closes wall_3

      {
        id: "wall_4_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 4, y: 0, z: 18 },
        size: { x: 10, y: 7, z: 1 },
        texture: "default"
      }, // closes wall_4

      {
        id: "wall_5_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 15, y: 0, z: 18 },
        size: { x: 12, y: 7, z: 1 },
        texture: "default"
      }, // closes wall_5

      {
        id: "introWall1_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 12, y: 0, z: 19 },
        size: { x: 1, y: 7, z: 4 },
        texture: "default"
      }, // closes introWall1

      {
        id: "introWall2_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 16, y: 0, z: 19 },
        size: { x: 1, y: 7, z: 4 },
        texture: "default"
      }, // closes introWall2

      {
        id: "introWall3_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 12, y: 0, z: 23 },
        size: { x: 5, y: 7, z: 1 },
        texture: "default"
      }, // closes introWall3
	  {
		def:  "wall",
		id:  "wall_above_intro_door",
type:  "wall",
position: { x: 14, y: 3, z: 18 },
        size: { x: 1, y: 4, z: 1 },
        		material:  outerWall
	  },
      {
        id: "introDoor_object",
        type: "door",
        def: "wall",
        position: { x: 14, y: 0, z: 18 },
        size: { x: 1, y: 3, z: 0.2 },
        texture: "assets/textures/door_wood.png"
      }, // closes introDoor
  {
    def:  "tile",
	id: "floor_1_tile",
    type: "tile",
    layer: "floor",
    position: {
      x: 3,
      y: 0,
      z: 1
    },
    size: {
      x: 25,
      y: 0.2,
      z: 17
    },
    texture: "assets/textures/blue.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
  {
    def:  "tile",
	id: "floor_intro_area_tile",
    type: "tile",
    layer: "floor",
    position: {
      x: 13,
      y: 0,
      z: 18
    },
    size: {
      x: 3,
      y: 0.2,
      z: 5
    },
    texture: "assets/textures/warehouse_floor.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
  {
    def:  "tile",
	id: "ceiling_1_tile",
    type: "tile",
    layer: "ceiling",
    position: {
      x: 3,
      y: 7,
      z: 0
    },
    size: {
      x: 25,
      y: 0.2,
      z: 19
    },
    texture: "assets/textures/warehouse_ceiling.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
  {
    def:  "tile",
	id: "ceiling_2_tile",
    type: "tile",
    layer: "ceiling",
    position: {
      x: 13,
      y: 7,
      z: 19
    },
    size: {
      x: 4,
      y: 0.2,
      z: 4
    },
    texture: "assets/textures/yellow.png",
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  }
    ] // closes staticObjects
  }, // closes environment

  enemies: [],
  objective: null,
  nextScene: null

}; // closes Scene_starting_Room