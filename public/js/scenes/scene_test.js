import sounds from "../listOfSounds.js";

// js/scenes/scene_test_range.js

export const scene_test = {
  name: "Weapon Test Range",

  cameraRails: {
    intro: [],
    exit: []
  },

  camera: {
    position: { x: 8, y: 1.7, z: 12 },
    lookAt: { x: 0, y: 1.4, z: -6 },
    fov: 60,
    near: 0.1,
    far: 200
  },

  // Simple, neutral lighting
  lights: [
    {
      type: "ambient",
      color: 0x0000FF,
      intensity: 0.3
    },
    ,{
    type: "hemisphere",
    skyColor: 16777215,
    groundColor: 4473924,
    intensity: 0.6,
    id: "light_hemisphere",
    position: {
        x: 0,
        y: 15,
        z: 0
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
    color: 16777215
},
    {
      type: "directional",
      color: 0xffffff,
      intensity: 3.6,
      position: { x: 0, y: 10, z: 0 },
      target: { x: 0, y: 1.4, z: -6 },
      castShadow: true,
      shadow: {
        mapSize: { width: 2048, height: 2048 },
        camera: { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 50 }
      }
    },
	
  ],


  environment: {
    staticObjects: [
{
    id: "walkway",
    type: "metalwalkway.glb",
    prefab: "metalwalkway.glb",
    position: {
        x: 14.39999999999997,
        y: 0,
        z: 12
    },
    scale: {
        x: 4,
        y: 5,
        z: 4
    },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
	hitSounds:  sounds.ricMetal,
    rotation: {
        x: 0,
        y: 0,
        z: 0
    },
    coverType: "none",
    size: {
        x: 2,
        y: 2,
        z: 2
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
	id:  "crateA",
type:  "prefab",
prefab:  "woodenCrate01.glb",
position:  {  x:  0, y:  0, z:  0  },
scale:  {  x:  1, y:  1, z:  1 }	
  },
  {
    id: "door_01",
    type: "door",
    position: {
        x: 1,
        y: 0,
        z: 18
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
    openSound: "assets/sfx/door1.ogg"
},
  
  {
    def:  "wall",
	id: "wall_1_object",
    type: "wall",
    position: {
      x: 0,
      y: 0,
      z: 0
    },
    size: {
      x: 25,
      y: 10,
      z: 1
    },
    texture: "assets/textures/blue.png"
  },
  
  {
    def:  "tile",
	id: "floor_1_tile",
    type: "tile",
    layer: "floor",
    position: {
      x: 0,
      y: 0,
      z: 0
    },
    size: {
      x: 25,
      y: 0.5,
      z: 16
    },
    
	material: {
  horizontalRepeat:  25,
  verticalRepeat:  16,
  map: "assets/textures/pavingstone.png",                  // base color / albedo
  normalMap: "assets/textures/pavingstoneNormal.png",  // normal map for bumps
  roughnessMap: "assets/textures/pavingstoneRoughness.png", // roughness map
  aoMap: "assets/textures/pavingstoneAO.png",          // ambient occlusion
  roughness: 1.0,       // base roughness, multiplied by roughnessMap
  metalness: 0.0,       // stone is not metallic
  color: 0xffffff,      // optional tint
  transparent: false,   // only true if you have alpha
  opacity: 1.0,         // ignored unless transparent=true
  emissive: 0x000000    // cobblestone does not emit light
},

    notes: "",
    hp: 9999,
    maxHp: 9999,
    indestructible: true
  },
  {
    def:  "wall",
	id: "wall_1_object",
    type: "object",
    position: {
      x: 25,
      y: 0,
      z: 15
    },
    size: {
      x: 2,
      y: 4,
      z: 2
    },
    texture: "assets/textures/blue.png"
  },
  {
    def:  "wall",
	id: "wall_2_object",
    type: "object",
    position: {
      x: 17,
      y: 0,
      z: 13
    },
    size: {
      x: 1,
      y: 3,
      z: 1
    },
		material: {
  horizontalRepeat:  1,
  verticalRepeat:  2,
  map: "assets/textures/metal01/metal01Color.png",                  // base color / albedo
  normalMap: "assets/textures/metal01/metal01Normal.png",  // normal map for bumps
  roughnessMap: "assets/textures/metal01/metal01Roughness.png", // roughness map
  //aoMap: "assets/textures/metal01/metal01AO.png",          // ambient occlusion
  roughness: 0.0,       // base roughness, multiplied by roughnessMap
  metalness: 1.0,       
  color: 0xffffff,      // optional tint
  transparent: false,   // only true if you have alpha
  opacity: 1.0,         // ignored unless transparent=true
  emissive: 0x000000    // cobblestone does not emit light
},

    texture: "assets/textures/blue.png"
	
  }
]
  },

  enemies: [
  {
	def:  "grunt_pistol",
id: "grunt_testing_defs",
position:  	{x:  -2, y:  0,  z:  -6},
active:  false
  },
	
	{
      id: "grunt_test",
      type: "Grunt",
      displayName: "Grunt Soldier",
	  hp:  80,
	  active: false,
      modelUrl: "assets/models/exo_red.glb",
      // sit slightly behind the crate so crate is between camera and enemy
      position: { x: 0, y: 0, z: -6 },
      facing: 0,
      coverObject: "crate_test",
      coverType: "low",
      // increase crouch depth so model can hide behind 0.5m crate
      behavior: { pattern: "popOutFromCover", params: { coverType: "low", popDurationMs: 300, hideDurationMs: 1200, firingDurationMs: 900, crouchOffsetY: -2.5, crouchScale: 0.85 } }
    }
    ,
    {
      id: "swat_test",
      type: "Grunt",
      displayName: "Grunt Soldier",
      hp: 100,
      // Use your provided SWAT model and shooting + dying animations
      modelUrl: "assets/models/swatguy.glb",
      animationUrls: {
        shoot: "assets/animations/swatguy_firing_rifle.glb",
        dying_rifle: "assets/animations/swatguy_dying.glb",
        dying: "assets/animations/swatguy_dying.glb"
      },
      // standing in the open and firing at intervals
      active:  false,
	  position: { x: 2, y: 0, z: -6 },
      // set an explicit groundY so the loader aligns the model's feet to this height
      groundY: 0.85,
      facing: 0,
      behavior: { pattern: "standInOpen", params: { fireIntervalMs: 900 } }
    }
  ],

  objective: {
    type: "eliminateAllEnemies",
    description: "Eliminate all test targets."
  },

  nextScene: null
};
