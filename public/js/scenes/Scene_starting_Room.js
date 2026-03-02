import sounds from "../listOfSounds.js";
import { l_shaped_hallway } from "./l_shaped_hallway.js";

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
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes outerWall

const ceilingTexture = {
  horizontalRepeat: 10,
  verticalRepeat: 15,
  map: "assets/textures/rock01/rock01Color.png",
  normalMap: "assets/textures/rock01/rock01Normal.png",
  roughnessMap: "assets/textures/rock01/rock01Roughness.png",
  aoMap: "assets/textures/rock01/rock01AO.png",
  roughness: 0.75,
  metalness: 0.0,
  color: 0xffffff,
  transparent: false,
  opacity: 1.0,
  emissive: 0x000000
}; // closes ceiling

const floorTexture = {
  horizontalRepeat: 10,
  verticalRepeat: 15,
  map: "assets/textures/concrete01/concrete01Color.png",
  normalMap: "assets/textures/concrete01/concrete01Normal.png",
  roughnessMap: "assets/textures/concrete01/concrete01Roughness.png",
  aoMap: "assets/textures/concrete01/concrete01AO.png",
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

  cameraRails: {
    intro: [],

    exit: [
	  
	  // move close to the door; the automated system will handle
      // the final alignment, opening, and walk‑through.
      {
        type: "moveTo",
        position: { x: 26.3, y: 1.7, z: 4.31 },
        duration: 4000
        
      },
	  	{
	type:  "lookAt",
position:  {  x:  28, y:  1.8, z:  4.31 },
duration:  1000,
	triggerNextScene: true
	}

    ]
  },

  
  camera: {
    position: { x: 15.3, y: 1.7, z: 21.68 },
    lookAt: { x: 17.3, y: 3.5, z: 20 },
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
  } // closes intro point light

], // closes lights
  
  environment: {
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
    position: {
        x: 15,
        y: 0,
        z: 3
    },
    scale: {
        x: 8,
        y: 3,
        z: 1
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
        y: 0,
        z: 0
    },
    coverType: "none",
    _convertedToCenter: true,
    size: {
        x: 8,
        y: 10,
        z: 8
    }
},
  {
id:  "forklift",
type:  "prefab",
prefab:  "forklift.glb",
position:  {  x:  3, y:  0, z:  12 },
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
        id: "wall_3_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 27, y: 0, z: 0 },
        size: { x: 1, y: 7, z: 19 },
        
      }, // closes wall_3

      {
        id: "wall_4_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 4, y: 0, z: 18 },
        size: { x: 10, y: 7, z: 1 },
        
      }, // closes wall_4

      {
        id: "wall_5_object",
        type: "object",
        def: "wall",
        material: outerWall,
        position: { x: 15, y: 0, z: 18 },
        size: { x: 12, y: 7, z: 1 },
        
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
        id: "exitDoor_object",
        type: "door",
        def: "wall",
        position: { x: 26.2, y: 0, z: 4 },
        size: { x: 1.2, y: 3, z: 0.2 },
        texture: "assets/textures/door_wood.png",
		rotationY:  90,
		openDirection:  -1,
		openInOut:  1
		        
		
      }, // closes exitDoor
  
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
  }
    ] // closes staticObjects
  }, // closes environment

  enemies: [
  {
      id: "grunt_1",
      type: "Grunt",
      hp: 40,
      // Use a GLB humanoid base mesh instead of FBX
      modelUrl: "assets/models/exo_red.glb",
      // allow automatic auto-scaling based on the GLTF bounding box
      modelScale: null,
      // provide common pistol animations as GLB clips
      animationUrls: {
        walk: "assets/animations/walk_pistol.glb",
        shoot: "assets/animations/stand_pistol.glb"
      },
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
    }
    
  
  ],
  objective: {
    type: "eliminateAllEnemies",
    description: "Eliminate all enemies to complete this scene."
  },
    exitDoorId: "exitDoor_object",
  nextScene: l_shaped_hallway
}; //closes scene_starting_room