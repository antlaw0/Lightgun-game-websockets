// js/scenes/scene_w1_1.js
import { Scene_W1_2 } from "./scene_w1_2.js";

export const Scene_W1_1 = {
  name: "Warehouse - Scene 1",

  background: {
    texture: "assets/backgrounds/black_bg.png",
    width: 0,
    height: 0,
    position: { x: 0, y: 0, z: 0 }
  },

  room: {
    width: 20,
    height: 8,
    depth: 30
  },

  cameraRails: {
    intro: [],

    exit: [
      {
        type: "rotate",
        rotation: { y: -90 },
        duration: 3000
      },
      {
        type: "moveTo",
        position: { x: 8.5, y: 1.7, z: -8.5 },
        duration: 8000,
        triggerNextScene: true
      }
    ]
  },

  camera: {
    position: { x: 0, y: 1.7, z: 0 },
    lookAt: { x: 0, y: 1.4, z: -6 },
    fov: 60,
    near: 0.1,
    far: 100
  },

  lights: [
    { type: "ambient", color: 0x8899aa, intensity: 0.4 },
    {
      type: "spot",
      color: 0xffffff,
      intensity: 3,
      distance: 28,
      angle: Math.PI / 5,
      penumbra: 0.0,
      decay: 2,
      position: { x: 0, y: 7.8, z: 0 },
      target: { x: 0, y: 0, z: 0 },
      castShadow: true,
      shadow: {
        mapSize: { width: 4096, height: 4096 },
        bias: -0.00008,
        near: 1,
        far: 30
      }
    }
  ],

  roomTextures: {
    floor: "assets/textures/warehouse_floor.png",
    ceiling: "assets/textures/warehouse_ceiling.png",
    wall: "assets/textures/warehouse_wall.png",
    backWall: "assets/textures/warehouse_back.png"
  },

  environment: {
    staticObjects: [
      {
        id: "explosiveBarrel1",
        type: "glb",
        file: "/assets/models/explosive_barrel.glb",
        position: { x: 0, y: 0, z: 2 },
        scale: { x: 1, y: 1, z: 1 },
        rotation: { x: 0, y: 0, z: 0 },
        coverType: "low",
        material: {
          map: "assets/textures/barrel_diffuse.png",
          roughness: 0.6,
          metalness: 0.5
        }
      },

      {
        id: "exitDoor",
        type: "door",
        object3D: null,
        position: { x: 8.5, y: 0, z: -8.5 },
        targetRotation: { y: -Math.PI / 2 },
        duration: 2
      },

      {
        id: "crateA",
        type: "crate",
        position: { x: 2, y: 0.5, z: -6 },
        size: { x: 1, y: 1, z: 1 },
        hp: 8,
        maxHp: 8,
        coverType: "low",
        material: {
          map: "assets/props/crate.png",
          color: 0xffffff,
          roughness: 0.75,
          metalness: 0.0
        },
        hitSounds: ["assets/sfx/props/crate_hit1.ogg"],
        deathSounds: ["assets/sfx/props/crate_break.ogg"],
        deathAction: "break"
      },

      {
        id: "crateB",
        type: "crate",
        position: { x: 4, y: 0.5, z: -6 },
        size: { x: 1, y: 1, z: 1 },
        hp: 8,
        maxHp: 8,
        coverType: "low",
        material: {
          map: "assets/props/crate.png",
          color: 0xffffff,
          roughness: 0.75,
          metalness: 0.0
        },
        hitSounds: ["assets/sfx/props/crate_hit1.ogg"],
        deathSounds: ["assets/sfx/props/crate_break.ogg"],
        deathAction: "break"
      },

      {
        id: "wall1",
        type: "wall",
        hp: 200,
        maxHp: 200,
        position: { x: -4.5, y: 0, z: -6 },
        size: { x: 4, y: 2.5, z: 0.2 },
        coverType: "full",
        indestructible: true,
        material: {
          map: "assets/props/brick_wall.png",
          color: 0xffff00,
          roughness: 0.95,
          metalness: 0.0
        },
        hitSounds: ["sounds/ric1.ogg"]
      },

      {
        id: "catwalk",
        type: "catwalk",
        position: { x: 0, y: 3, z: -8 },
        size: { x: 12, y: 0.2, z: 1 },
        hp: 9999,
        maxHp: 9999,
        material: {
          color: 0x777777,
          roughness: 0.25,
          metalness: 0.9
        },
        hitSounds: [],
        deathSounds: [],
        deathAction: "none"
      }
    ]
  },

  transitionObjects: [
    {
      id: "exitDoor",
      object3D: null,
      targetRotation: { y: -Math.PI / 2 },
      duration: 2
    }
  ],

  enemies: [
    {
      id: "gruntA",
      type: "Grunt",
      hp: 40,
      position: { x: 2, y: 0.9, z: -7 },
      behavior: { pattern: "popOutFromCover", params: { coverType: "low" } },
      coverObject: "crateA",
      firePauseMs: 50,
      weapon: "pistol",
      hitSounds: ["assets/sfx/grunt/hit1.ogg", "assets/sfx/grunt/hit2.ogg"],
      deathSounds: ["assets/sfx/grunt/death1.ogg", "assets/sfx/grunt/death2.ogg"],
      sprite: "assets/sprites/grunt.png"
    },

    {
      id: "gruntB",
      type: "Grunt",
      hp: 40,
      position: { x: 4, y: 0.9, z: -7 },
      behavior: { pattern: "popOutFromCover", params: { coverType: "low" } },
      coverObject: "crateB",
      firePauseMs: 50,
      weapon: "pistol",
      hitSounds: ["assets/sfx/grunt/hit1.ogg", "assets/sfx/grunt/hit2.ogg"],
      deathSounds: ["assets/sfx/grunt/death1.ogg", "assets/sfx/grunt/death2.ogg"],
      sprite: "assets/sprites/grunt.png"
    },

    {
      id: "gruntD",
      type: "Grunt",
      hp: 40,
      position: { x: -1.9, y: 0.9, z: -6 },
      behavior: { pattern: "popOutFromCover", params: { coverType: "full" } },
      coverObject: "wall1",
      firePauseMs: 50,
      weapon: "assaultRifle",
      hitSounds: ["assets/sfx/grunt/hit1.ogg", "assets/sfx/grunt/hit2.ogg"],
      deathSounds: ["assets/sfx/grunt/death1.ogg", "assets/sfx/grunt/death2.ogg"],
      sprite: "assets/sprites/grunt.png"
    },

    {
      id: "gruntC",
      type: "Grunt",
      hp: 40,
      position: { x: 0, y: 3.9, z: -8 },
      behavior: { pattern: "standInOpen" },
      firePauseMs: 3000,
      weapon: "sniperRifle",
      hitSounds: ["assets/sfx/grunt/hit1.ogg", "assets/sfx/grunt/hit2.ogg"],
      deathSounds: ["assets/sfx/grunt/death1.ogg", "assets/sfx/grunt/death2.ogg"],
      sprite: "assets/sprites/grunt.png"
    },

    {
      id: "gruntE",
      type: "Grunt",
      hp: 40,
      position: { x: 0, y: 0.9, z: 3 },
      behavior: {
        pattern: "path",
        params: {
          loop: true,
          steps: [
            { type: "move", axis: "x", distance: -3, durationMs: 3000 },
            { type: "pause", durationMs: 500 },
            { type: "move", axis: "z", distance: 2, durationMs: 2000 },
            { type: "pause", durationMs: 500 },
            { type: "move", axis: "x", distance: 6, durationMs: 6000 },
            { type: "pause", durationMs: 500 },
            { type: "move", axis: "z", distance: -2, durationMs: 2000 },
            { type: "pause", durationMs: 500 },
            { type: "move", axis: "x", distance: -3, durationMs: 3000 }
          ]
        }
      },
      firePauseMs: 800,
      weapon: "pistol",
      hitSounds: ["assets/sfx/grunt/hit1.ogg", "assets/sfx/grunt/hit2.ogg"],
      deathSounds: ["assets/sfx/grunt/death1.ogg", "assets/sfx/grunt/death2.ogg"],
      sprite: "assets/sprites/grunt.png"
    }
  ],

  objective: {
    type: "eliminateAllEnemies",
    description: "Eliminate all enemies to complete this scene."
  },

  nextScene: Scene_W1_2
};
