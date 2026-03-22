import sounds from "../listOfSounds.js";
import { l_shaped_hallway } from "./l_shaped_hallway.js";
// =====================================================
// OUTER WALL MATERIAL (module scope)
// =====================================================
const outerWall = {
  horizontalRepeat: 1,
  verticalRepeat: 1,
  baseColorMap: "assets/textures/bricks01/basecolor.ktx2",
  normalMap: "assets/textures/bricks01/normal.ktx2",
  ormMap: "assets/textures/bricks01/orm.ktx2",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes outerWall

const ceilingTexture = {
  horizontalRepeat: 1,
  verticalRepeat: 1,
  baseColorMap: "assets/textures/rock01/basecolor.ktx2",
  normalMap: "assets/textures/rock01/normal.ktx2",
  ormMap: "assets/textures/rock01/orm.ktx2",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes ceiling

const floorTexture = {
  horizontalRepeat: 1,
  verticalRepeat: 1,
  baseColorMap: "assets/textures/concrete01/basecolor.ktx2",
  normalMap: "assets/textures/concrete01/normal.ktx2",
  ormMap: "assets/textures/concrete01/orm.ktx2",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes ceiling



// =====================================================
// SCENE DEFINITION
// =====================================================
export const Scene_starting_Room = {
  name: "startingRoom",

  // duration (ms) used by the automated door transition; controls how long
  // the door takes to open and how quickly the camera moves through it.
  transitionDuration: 3000,
  // hinge direction: +1 means hinge on left and door swings to the right
  // when facing it (outward). -1 would reverse the rotation.
  doorOpenDirection: -1,

  cameraRails: [
  {
	type:  "pause",
duration:  1000	
  },
    {
      type: "moveTo",
      position: { x: 14.53, y: 1.70, z: 18.94 },
      duration: 1200
    },
    {
      type: "openDoor",
      doorId: "door1"
    },
    {
      type: "activateEnemyGroup",
      groupId: 1
    },
    {
      type: "moveTo",
      position: { x: 14.80, y: 1.70, z: 14.17 },
      duration: 2000
    },
    {
      type: "stop",
      continueWhen: "allEnemiesDead"
    },
	    {
      type: "lookAt",
position: { x: 26.52, y: 1.70, z: 2.64 },
      duration: 200
    },

    {
      type: "moveTo",
      position: { x: 26.52, y: 1.70, z: 2.64 },
      duration: 3600
    },
	{
type:  "lookAt",
position:  {  x: 28, y: 1.7, z: 2.64 },
duration:  500
},
    {
      type: "openDoor",
      doorId: "door2"
    },
	    {
      type: "activateEnemyGroup",
      groupId: 2
    },

    {
      type: "moveTo",
      position: { x: 28, y: 1.70, z: 2.57 },
      duration: 360
    },
	    {
      type: "stop",
      continueWhen: "allEnemiesDead"
    },

	    {
      type: "lookAt",
      position: { x: 36.09, y: 1.70, z: -4.94 },
      duration: 800
    },

    {
      type: "moveTo",
      position: { x: 36.09, y: 1.70, z: -4.94 },
      duration: 2400
    },
    {
      type: "pause",
      duration: 200,
      triggerNextScene: true
    }
  ],

  
  camera: {
    position: { x: 15.3, y: 1.7, z: 21.68 },
    lookAt: { x: 15.3, y: 1.7, z: 20 },
    fov: 60,
    near: 0.1,
    far: 200
  }, // closes camera
lights: [

  // =====================================================
  // BASE DARKNESS (very low ambient)
  // =====================================================
  {
    id:  "ambient",
	type: "ambient",
    color: 0xffffff,
    intensity: 0.4
  }, // closes ambient base


  // =====================================================
  // WAREHOUSE OVERHEAD STRIP LIGHTS (MAIN ROOM)
  // =====================================================
  {
    id:  "rectArea1",
	type: "rectArea",
    color: 0xe6e6e6,
    intensity: 20,
    position: { x: 8, y: 6.8, z: 8 },
    size: { x: 6, y: 1, z: 1 }
  }, // closes strip light 1

  {
    id:  "rectArea2",
	type: "rectArea",
    color: 0xe6e6e6,
    intensity: 20,
    position: { x: 20, y: 6.8, z: 8 },
    size: { x: 6, y: 1, z: 1 }
  }, // closes strip light 2

{
    id:  "rectArea3",
	type: "rectArea",
    color: 0xe6e6e6,
    intensity: 20,
    position: { x: 8, y: 6.8, z: 17 },
    size: { x: 6, y: 1, z: 1 }
  }, // closes strip light 1

  {
    id:  "rectArea4",
	type: "rectArea",
    color: 0xe6e6e6,
    intensity: 20,
    position: { x: 20, y: 6.8, z: 17 },
    size: { x: 6, y: 1, z: 1 }
  }, // closes strip light 2

  // =====================================================
  // SOFT FILL LIGHT (VERY FAINT GLOBAL TOP LIGHT)
  // =====================================================
  {
    id:  "hemisphere",
	type: "hemisphere",
    skyColor: 0x606060,
groundColor: 0x303030,
intensity: 1.2,
    position: { x: 0, y: 15, z: 0 }
  }, // closes hemisphere fill

{
  id: "fillDirectional",
  type: "directional",
  color: 0xffffff,
  intensity: 0.4,
  position: { x: 0, y: 15, z: 0 },
  target: { x: 10, y: 0, z: 10 },
  castShadow: false
}, // closes fillDirectional
  // =====================================================
  // SHADOW CASTER FOR DEPTH
  // =====================================================
  {
    id:  "mainRoomDirectional",
	type: "directional",
    color: 0xffffff,
    intensity: 0.35,
    position: { x: 10, y: 10, z: 5 },
    target: { x: 15, y: 0, z: 8 },
    castShadow: true,
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      camera: {
        left: -20,
        right: 20,
        top: 20,
        bottom: -20,
        near: 1,
        far: 50
      } // closes shadow.camera
    } // closes shadow
  }, // closes directional shadow


  // =====================================================
  // INTRO ROOM LIGHT (slightly warmer and closer)
  // =====================================================
  {
    id:  "introRoomPoint",
	type: "point",
    color: 0xfff1c2,
    intensity: 2,
    distance: 10,
    decay: 2,
    position: { x: 14.5, y: 6.5, z: 21 }
  }, // closes intro point light
{
    type: "point",
    color: 16777215,
    intensity: 1.5,
    position: {
        x: 31,
        y: 2.9767222803837043,
        z: 2.416479299134121
    },
    distance: 10,
    decay: 2,
    castShadow: true,
    shadow: {
        mapSize: {
            width: 1024,
            height: 1024
        },
        camera: {
            near: 0.5,
            far: 50
        },
        bias: -0.0001
    },
    id: "zone2_firstPointLight",
    rotation: {
        x: 0,
        y: 0,
        z: 0
    },
    size: {
        x: 1,
        y: 1,
        z: 1
    }
  },
  {
    id: "zone2_room_light_left",
    type: "point",
    color: 0xf2f0e6,
    intensity: 1.35,
    distance: 14,
    decay: 2,
    position: { x: 32.5, y: 3.2, z: -11 },
    castShadow: true,
    shadow: {
      mapSize: {
        width: 1024,
        height: 1024
      },
      camera: {
        near: 0.5,
        far: 50
      },
      bias: -0.0001
    }
  },
  {
    id: "zone2_room_light_right",
    type: "point",
    color: 0xf2f0e6,
    intensity: 1.35,
    distance: 14,
    decay: 2,
    position: { x: 39.5, y: 3.2, z: -11 },
    castShadow: true,
    shadow: {
      mapSize: {
        width: 1024,
        height: 1024
      },
      camera: {
        near: 0.5,
        far: 50
      },
      bias: -0.0001
    }
}
], // closes lights
  
  environment: {
    hdri: {
      file: "assets/textures/HDRI/IndoorEnvironmentHDRI005_1K_HDR.exr",
      background: false,
      environmentIntensity: 1.0,
      backgroundIntensity: 1.0,
      backgroundBlurriness: 0.0
    },
    staticObjects: [
	      {
        id: "crate_01",
        type: "crate",
        position: {
          x: 11.883029736852674,
          y: 0.732152794253579,
          z: 9.927079158278612
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 1,
          y: 1,
          z: 1
        },
        hp: 10
      },

	
{
    id: "walkway",
    type: "prefab",
    prefab: "metalwalkway.glb",
  alignToFloor: true,
    position: {
        x: 10,
        y: 0,
        z: 1
    },
    scale: {
        x: 4,
        y: 3,
        z: 4
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    hitSounds: [
        "assets/sfx/ricMetal1.ogg",
        "assets/sfx/ricMetal2.ogg",
        "assets/sfx/ricMetal3.ogg",
        "assets/sfx/ricMetal4.ogg",
        "assets/sfx/ricMetal5.ogg"
    ],
    rotation: {
        x: 0,
        y: 90,
        z: 0
    },
    coverType: "none",
    size: {
        x: 8,
        y: 3,
        z: 1
    }
}, 
 {
id:  "forklift",
type:  "prefab",
prefab:  "forklift.glb",
position:  {  x:  7, y:  0, z:  12 },
scale:  {  x:  2, y:  2, z:  2  },
hp:  9999,
maxHp: 9999,
indestructible:  true,
hitSounds:  sounds.ricMetal
  },

      {
        id: "wall_1_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 3, y: 0, z: 0 },
        size: { x: 1, y: 7, z: 19 },
        
      }, // closes wall_1

      {
        id: "wall_2_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 4, y: 0, z: 0 },
        size: { x: 23, y: 7, z: 1 },
        
      }, // closes wall_2

      
	  {
        id: "wall_3_leftSideExitDoor",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 27, y: 0, z: 0 },
        size: { x: 1, y: 2.2, z: 1.9 },
        
      }, // closes wall_3
	  
	  {
        id: "wall_3_rightSideExitDoor",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 27, y: 0, z: 3.1 },
        size: { x: 1, y: 2.2, z: 15 },
        
      }, // closes wall_3
{
        id: "wall_3aboveexitDoor",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 27, y: 2.2, z: 0 },
        size: { x: 1, y: 4.8, z: 19 },
        
      }, // closes wall_3

      {
        id: "wall_4_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 4, y: 0, z: 18 },
        size: { x: 10, y: 2.2, z: 1 },
        
      }, // closes wall_4

      {
        id: "wall_5_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 15, y: 0, z: 18 },
        size: { x: 12, y: 2.2, z: 1 },
        
      }, // closes wall_5

      {
        id: "introWall1_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 12, y: 0, z: 19 },
        size: { x: 1, y: 7, z: 4 },
        
      }, // closes introWall1

      {
        id: "introWall2_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 16, y: 0, z: 19 },
        size: { x: 1, y: 7, z: 4 },
        
      }, // closes introWall2

      {
        id: "introWall3_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 12, y: 0, z: 23 },
        size: { x: 5, y: 7, z: 1 },
        
      }, // closes introWall3
	  {
		def:  "wall",
		id:  "wall_above_intro_door",
type:  "wall",
position: { x: 4, y: 2.2, z: 18 },
        size: { x: 23, y: 4.8, z: 1 },
        		material:  outerWall
	  },
	  
	  	  {
    id: "door1",
    type: "door",
	model: "assets/models/props/door1.glb",
    position: { x: 14.5, y: 0, z: 18 },
        rotation: {
        x: 0,
        y: 0,
        z: 0
    },
    size: {
        x: 1.2,
        y: 2.2,
        z: 0.15
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
	texture:  "assets/textures/door_wood.png",
    modelRotation: {
        x: 0,
        y: 0,
        z: 0
    },
    modelPivotOffset: {
        x: 0,
        y: 0,
        z: 0.6
    },
    scale: 1,
    openDirection: 1,
    openInOut: 1,
    openDuration: 800,
    openSound: "assets/sfx/props/door1.ogg"
},
  
  


	  {
    id: "door2",
    type: "door",
    model: "assets/models/props/door1.glb",
    position: {
        x: 27,
        y: 0,
        z: 2
    },
    rotation: {
        x: 0,
        y: 0,
        z: 0
    },
    size: {
        x: 1.2,
        y: 2.2,
        z: 0.15
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
	texture:  "assets/textures/door_wood.png",
    modelRotation: {
        x: 0,
        y: Math.PI/2,
        z: 0
    },
    modelPivotOffset: {
        x: 0,
        y: 0,
        z: 0.6
    },
    scale: 1,
    openDirection: 1,
    openInOut: 1,
    openDuration: 800,
    openSound: "assets/sfx/props/door1.ogg"
},
  
  
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
    material:  floorTexture,
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
	material:  ceilingTexture,
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
	material:  ceilingTexture,
    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
    {
        def:  "wall",
		id: "wall_01_zone2",
        type: "wall",
        position: {
          x: 28,
          y: 0,
          z: 0
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 6,
          y: 3,
          z: 0.2
        },
        hp: 9999,
		material:  outerWall
      },
      {
        def:  "wall",
		id: "wall_02_zone2",
        type: "wall",
        position: {
          x: 28,
          y: 0,
          z: 5
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 10,
          y: 3,
          z: 0.2
        },
        hp: 9999,
		material:  outerWall
      },
      {
    def:  "tile",
	id: "floor_zone2",
    type: "tile",
    position: {
        x: 31,
        y: 0,
        z: 3
    },
    rotation: {
        x: 0,
        y: 0,
        z: 0
    },
    size: {
        x: 6,
        y: 0.2,
        z: 5
    },
    hp: 9999,
    material:  floorTexture,
    _convertedToCenter: true,
    coverType: "none"
},
{
    def:  "tile",
	id: "ceiling_zone2",
    type: "tile",
    position: {
        x: 31,
        y: 3,
        z: 3
    },
    rotation: {
        x: 0,
        y: 0,
        z: 0
    },
    size: {
        x: 6,
        y: 0.2,
        z: 5
    },
    hp: 9999,
    material:  ceilingTexture,
    _convertedToCenter: true,
    coverType: "none"
},
{
        def:  "wall",
		id: "wall_secondl_zone2",
        type: "wall",
        position: {
          x: 34,
          y: 0,
          z: -3
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 0.2,
          y: 3,
          z: 6
        },
        _convertedToCenter: true,
		material:  outerWall,
        hp: 9999
      },
      {
        def:  "wall",
		id: "wall_second_l_outer_zone2",
        type: "wall",
        position: {
          x: 38,
          y: 0,
          z: 0
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 0.2,
          y: 3,
          z: 10
        },
        _convertedToCenter: true,
		material:  outerWall,
        hp: 9999
      },
      {
        def:  "tile",
		id: "floor_second_l_zone2",
        type: "tile",
        position: {
          x: 36,
          y: 0,
          z: -1
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 4,
          y: 0.2,
          z: 12
        },
        _convertedToCenter: true,
		material:  floorTexture,
        hp: 9999
      },
	  {
        def: "tile",
		id: "ceiling_second_l_zone2",
        type: "tile",
        position: {
          x: 36,
          y: 3,
          z: -1
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 4,
          y: 0.2,
          z: 12
        },
        _convertedToCenter: true,
		material:  floorTexture,
        hp: 9999
      },
      {
        def: "wall",
		id: "room_wall_back_zone2",
        type: "wall",
        position: {
          x: 36,
          y: 0,
          z: -15
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 15,
          y: 4,
          z: 0.2
        },
        _convertedToCenter: true,
		material: outerWall,
        hp: 9999
      },
      {
        def: "wall",
		id: "room_wall_left_zone2",
        type: "wall",
        position: {
          x: 28.5,
          y: 0,
          z: -11
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 0.2,
          y: 4,
          z: 8
        },
        _convertedToCenter: true,
		material: outerWall,
        hp: 9999
      },
      {
        def: "wall",
		id: "room_wall_right_zone2",
        type: "wall",
        position: {
          x: 43.5,
          y: 0,
          z: -11
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 0.2,
          y: 4,
          z: 8
        },
        _convertedToCenter: true,
		material: outerWall,
        hp: 9999
      },
      {
        def: "wall",
		id: "room_wall_front_left_zone2",
        type: "wall",
        position: {
          x: 31.95,
          y: 0,
          z: -7
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 6.9,
          y: 4,
          z: 0.2
        },
        _convertedToCenter: true,
		material: outerWall,
        hp: 9999
      },
      {
        def: "wall",
		id: "room_wall_front_right_zone2",
        type: "wall",
        position: {
          x: 40.05,
          y: 0,
          z: -7
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 6.9,
          y: 4,
          z: 0.2
        },
        _convertedToCenter: true,
		material: outerWall,
        hp: 9999
      },
      {
        id: "door3",
        type: "door",
		model: "assets/models/props/door1.glb",
        position: {
          x: 36,
          y: 0,
          z: -7
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 1.2,
          y: 2.2,
          z: 0.15
        },
        hp: 9999,
        maxHp: 9999,
        indestructible: true,
		texture: "assets/textures/door_wood.png",
        modelRotation: {
          x: 0,
          y: 0,
          z: 0
        },
        modelPivotOffset: {
          x: 0,
          y: 0,
          z: 0.6
        },
        scale: 1,
        openDirection: 1,
        openInOut: 1,
        openDuration: 800,
        openSound: "assets/sfx/props/door1.ogg"
      },
      {
        def: "wall",
		id: "room_wall_above_door_zone2",
        type: "wall",
        position: {
          x: 36,
          y: 2.2,
          z: -7
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 1.2,
          y: 1.8,
          z: 0.2
        },
        _convertedToCenter: true,
		material: outerWall,
        hp: 9999
      },
      {
        def: "wall",
		id: "room_ceiling_gap_fill_zone2",
        type: "wall",
        position: {
          x: 36,
          y: 3,
          z: -6.9
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 4,
          y: 1,
          z: 0.2
        },
        _convertedToCenter: true,
		material: outerWall,
        hp: 9999
      },
      {
        def: "tile",
		id: "floor_room_zone2",
        type: "tile",
        position: {
          x: 36,
          y: 0,
          z: -11
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 15,
          y: 0.2,
          z: 8
        },
        _convertedToCenter: true,
		material: floorTexture,
        hp: 9999,
        coverType: "none"
      },
      {
        def: "tile",
		id: "ceiling_room_zone2",
        type: "tile",
        position: {
          x: 36,
          y: 4,
          z: -11
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 15,
          y: 0.2,
          z: 8
        },
        _convertedToCenter: true,
		material: ceilingTexture,
        hp: 9999,
        coverType: "none"
      }
      
      
	] // closes staticObjects
  }, // closes environment

  enemies: [
  
  {
	def:  "melee_brute",
id:  "brute_1",
active:  false,
groupId:  1,
position:  {  x:  17, y:  0, z:  9 }	
  }, //end of melee brute 1
  {
	id:  "grunt_on_walkway",
  def:  "grunt_pistol",
	position:  {  x:  13,  y:  3.9,  z:  1 },
  usePositionYAsGround: true,
	groupId:  1,
	active:  false,
  behavior: {
    pattern: "standInOpen",
    params: {
    fireIntervalMs: 900
    },
    stance: "wideGun"
  },
  },
  {
      def:  "grunt_pistol",
	  id: "grunt_1",
  	  active:  false,
  	  groupId: 1,
      type: "Grunt",
      hp: 40,
      // Use a GLB humanoid base mesh instead of FBX
      modelUrl: "assets/models/exo_red.glb",
      aimYawOffset: -Math.PI / 2,
      // allow automatic auto-scaling based on the GLTF bounding box
      modelScale: null,
      // provide common pistol animations as GLB clips
      animationUrls: {
        walk: "assets/animations/walk_pistol.glb",
        shoot: "assets/animations/stand_pistol.glb"
      },
      position: { x: 10, y: 0.9, z: 3 },
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
      sprite: "assets/sprites/grunt.png"
  }, // end of grunt 1
	
    
  {
def:  "grunt_pistol",
      id: "grunt_2",
	  active: false,
  	  groupId: 1,
      type: "Grunt",
      hp: 40,
      // Use a GLB humanoid base mesh instead of FBX
      modelUrl: "assets/models/exo_red.glb",
      aimYawOffset: -Math.PI / 2,
      // allow automatic auto-scaling based on the GLTF bounding box
      modelScale: null,
      // provide common pistol animations as GLB clips
      animationUrls: {
        walk: "assets/animations/walk_pistol.glb",
        shoot: "assets/animations/stand_pistol.glb"
      },
      position: { x: 15, y: 0.9, z: 5 },
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
      sprite: "assets/sprites/grunt.png"
    },//end of grunt 2
    {
	def:  "autoturret_tripod",
id:  "autoturret_1",
active:  false,
groupId:  2,
position:  { x:  35, y:  0.1,  z:  1.85  },
  }

  ], //end of enemies
  objective: {
    type: "eliminateAllEnemies",
    description: "Eliminate all enemies to complete this scene."
  },
    exitDoorId: "exitDoor_object",
  nextScene: l_shaped_hallway
}; //closes scene_starting_room