export const Scene_Exported = {
  name: "Exported Scene 2026-02-24T18:42:12.115Z",
  camera: {
    position: {
      x: 15.3,
      y: 1.7,
      z: 21.68
    },
    lookAt: {
      x: 21.604914578758738,
      y: 7.374423120882861,
      z: 16.383871753842662
    },
    fov: 60,
    near: 0.1,
    far: 200
  },
  lights: [
    {
      type: "rectArea",
      color: 15132390,
      intensity: 6,
      position: {
        x: 8,
        y: 6.8,
        z: 8
      },
      size: {
        x: 6,
        y: 1
      },
      lookAt: {
        x: 8,
        y: 6.8,
        z: 9
      },
      id: "rectArea1"
    },
    {
      type: "rectArea",
      color: 15132390,
      intensity: 6,
      position: {
        x: 20,
        y: 6.8,
        z: 8
      },
      size: {
        x: 6,
        y: 1
      },
      lookAt: {
        x: 20,
        y: 6.8,
        z: 9
      },
      id: "rectArea2"
    },
    {
      type: "hemisphere",
      skyColor: 4210752,
      groundColor: 2105376,
      intensity: 0.25,
      position: {
        x: 0,
        y: 15,
        z: 0
      },
      id: "hemisphere",
      color: 4210752
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 0.35,
      position: {
        x: 10,
        y: 10,
        z: 5
      },
      target: {
        x: 15,
        y: 0,
        z: 8
      },
      castShadow: true,
      id: "mainRoomDirectional"
    },
    {
      type: "point",
      color: 16773570,
      intensity: 2,
      position: {
        x: 14.5,
        y: 6.5,
        z: 21
      },
      distance: 10,
      decay: 2,
      id: "introRoomPoint"
    },
    {
      id: "ambient",
      type: "ambient",
      color: 1710618,
      intensity: 0.3
    }
  ],
  environment: {
    staticObjects: [
      {
        id: "crate_01",
        type: "crate",
        position: {
          x: 12.383029736852674,
          y: 0.732152794253579,
          z: 10.427079158278612
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
        hp: 10,
        _convertedToCenter: true,
        coverType: "none"
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
          x: 64,
          y: 30,
          z: 8
        }
      },
      {
        id: "forklift",
        type: "prefab",
        prefab: "forklift.glb",
        position: {
          x: 3,
          y: 0,
          z: 12
        },
        scale: {
          x: 2,
          y: 2,
          z: 2
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
        size: {
          x: 2,
          y: 2,
          z: 2
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "default",
        id: "wall_1_object",
        type: "object",
        def: "wall",
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        position: {
          x: 3.5,
          y: 0,
          z: 9.5
        },
        size: {
          x: 1,
          y: 7,
          z: 19
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "default",
        id: "wall_2_object",
        type: "object",
        def: "wall",
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        position: {
          x: 15.5,
          y: 0,
          z: 0.5
        },
        size: {
          x: 23,
          y: 7,
          z: 1
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "default",
        id: "wall_3_object",
        type: "object",
        def: "wall",
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        position: {
          x: 27.5,
          y: 0,
          z: 9.5
        },
        size: {
          x: 1,
          y: 7,
          z: 19
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "default",
        id: "wall_4_object",
        type: "object",
        def: "wall",
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        position: {
          x: 9,
          y: 0,
          z: 18.5
        },
        size: {
          x: 10,
          y: 7,
          z: 1
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "default",
        id: "wall_5_object",
        type: "object",
        def: "wall",
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        position: {
          x: 21,
          y: 0,
          z: 18.5
        },
        size: {
          x: 12,
          y: 7,
          z: 1
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "default",
        id: "introWall1_object",
        type: "object",
        def: "wall",
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        position: {
          x: 12.5,
          y: 0,
          z: 21
        },
        size: {
          x: 1,
          y: 7,
          z: 4
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "default",
        id: "introWall2_object",
        type: "object",
        def: "wall",
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        position: {
          x: 16.5,
          y: 0,
          z: 21
        },
        size: {
          x: 1,
          y: 7,
          z: 4
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "default",
        id: "introWall3_object",
        type: "object",
        def: "wall",
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        position: {
          x: 14.5,
          y: 0,
          z: 23.5
        },
        size: {
          x: 5,
          y: 7,
          z: 1
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "assets/textures/blue.png",
        def: "wall",
        id: "wall_above_intro_door",
        type: "wall",
        position: {
          x: 14.5,
          y: 3,
          z: 18.5
        },
        size: {
          x: 1,
          y: 4,
          z: 1
        },
        material: {
          horizontalRepeat: 25,
          verticalRepeat: 16,
          map: "assets/textures/bricks01/bricks01Color.png",
          normalMap: "assets/textures/bricks01/bricks01Normal.png",
          roughnessMap: "assets/textures/bricks01/bricks01Roughness.png",
          aoMap: "assets/textures/bricks01/bricks01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        indestructible: true,
        hp: 9999,
        maxHp: 9999,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        texture: "assets/textures/door_wood.png",
        id: "introDoor_object",
        type: "door",
        def: "wall",
        position: {
          x: 14.5,
          y: 1.5,
          z: 18.1
        },
        size: {
          x: 1,
          y: 3,
          z: 0.2
        },
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        }
      },
      {
        hp: 9999,
        maxHp: 9999,
        indestructible: true,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        def: "tile",
        id: "floor_1_tile",
        type: "tile",
        layer: "floor",
        position: {
          x: 15.5,
          y: 0,
          z: 9.5
        },
        size: {
          x: 25,
          y: 0.2,
          z: 17
        },
        material: {
          horizontalRepeat: 10,
          verticalRepeat: 15,
          map: "assets/textures/concrete01/concrete01Color.png",
          normalMap: "assets/textures/concrete01/concrete01Normal.png",
          roughnessMap: "assets/textures/concrete01/concrete01Roughness.png",
          aoMap: "assets/textures/concrete01/concrete01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        notes: "",
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        hp: 9999,
        maxHp: 9999,
        indestructible: true,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        def: "tile",
        id: "floor_intro_area_tile",
        type: "tile",
        layer: "floor",
        position: {
          x: 14.5,
          y: 0,
          z: 20.5
        },
        size: {
          x: 3,
          y: 0.2,
          z: 5
        },
        texture: "assets/textures/warehouse_floor.png",
        notes: "",
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        hp: 9999,
        maxHp: 9999,
        indestructible: true,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        def: "tile",
        id: "ceiling_1_tile",
        type: "tile",
        layer: "ceiling",
        position: {
          x: 15.5,
          y: 7,
          z: 9.5
        },
        size: {
          x: 25,
          y: 0.2,
          z: 19
        },
        texture: "assets/textures/warehouse_ceiling.png",
        material: {
          horizontalRepeat: 10,
          verticalRepeat: 15,
          map: "assets/textures/rock01/rock01Color.png",
          normalMap: "assets/textures/rock01/rock01Normal.png",
          roughnessMap: "assets/textures/rock01/rock01Roughness.png",
          aoMap: "assets/textures/rock01/rock01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        notes: "",
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      },
      {
        hp: 9999,
        maxHp: 9999,
        indestructible: true,
        hitSounds: [
          "assets/sfx/ric1.ogg",
          "assets/sfx/ric2.ogg",
          "assets/sfx/ric3.ogg",
          "assets/sfx/ric4.ogg",
          "assets/sfx/ric5.ogg"
        ],
        def: "tile",
        id: "ceiling_2_tile",
        type: "tile",
        layer: "ceiling",
        position: {
          x: 15,
          y: 7,
          z: 21
        },
        size: {
          x: 4,
          y: 0.2,
          z: 4
        },
        texture: "assets/textures/yellow.png",
        material: {
          horizontalRepeat: 10,
          verticalRepeat: 15,
          map: "assets/textures/rock01/rock01Color.png",
          normalMap: "assets/textures/rock01/rock01Normal.png",
          roughnessMap: "assets/textures/rock01/rock01Roughness.png",
          aoMap: "assets/textures/rock01/rock01AO.png",
          roughness: 1,
          metalness: 0,
          color: 16777215,
          transparent: false,
          opacity: 1,
          emissive: 0
        },
        notes: "",
        _convertedToCenter: true,
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        coverType: "none"
      }
    ]
  },
  enemies: []
};
