export const Scene_Exported = {
  name: "Exported Scene 2026-01-29T21:58:12.737Z",
  camera: {
    position: {
      x: 10.081632502148038,
      y: 1.7,
      z: -13.230328203864918
    },
    lookAt: {
      x: 7.40538772236261,
      y: -1.4057351754766134,
      z: -4.109356605483606
    },
    fov: 60,
    near: 0.1,
    far: 200
  },
  lights: [
    {
      type: "point",
      color: 8388736,
      intensity: 1.5,
      position: {
        x: 13.614789285961391,
        y: 3.086222470043686,
        z: 3.3607287045914815
      },
      distance: 50,
      decay: 2,
      id: "light_1112"
    },
    {
      type: "directional",
      color: 8388736,
      intensity: 0,
      position: {
        x: 0,
        y: 5,
        z: 0
      },
      target: {
        x: 0,
        y: 1.4,
        z: -6
      },
      castShadow: true,
      id: "light_1115"
    },
    {
      type: "point",
      color: 255,
      intensity: 1.5,
      position: {
        x: 13.614789285961391,
        y: 3.086222470043686,
        z: 3.3607287045914815
      },
      distance: 50,
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
      id: "light_01",
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
      type: "ambient",
      color: 16777215,
      intensity: 0.6
    },
    {
      type: "directional",
      color: 255,
      intensity: 0,
      position: {
        x: 0,
        y: 5,
        z: 0
      },
      target: {
        x: 0,
        y: 1.4,
        z: -6
      },
      castShadow: true,
      shadow: {
        mapSize: {
          width: 2048,
          height: 2048
        },
        camera: {
          left: -10,
          right: 10,
          top: 10,
          bottom: -10,
          near: 0.5,
          far: 50
        }
      }
    }
  ],
  environment: {
    staticObjects: [
      {
        id: "wall_02",
        type: "wall",
        position: {
          x: 5.877711007445899,
          y: 1.7443093390743718,
          z: 8.590165999332452
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 1,
          y: 12,
          z: 6
        },
        hp: 9999,
        indestructible: true,
        coverType: "none"
      },
      {
        id: "wall_01",
        type: "wall",
        position: {
          x: 1.0933984755269983,
          y: 0,
          z: -1.4422746394057793
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 20,
          y: 12,
          z: 1
        },
        hp: 9999,
        indestructible: true,
        coverType: "full"
      },
      {
        id: "floor_01",
        type: "floor",
        position: {
          x: 0,
          y: 0,
          z: 0
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        size: {
          x: 50,
          y: 0.1,
          z: 50
        },
        hp: 999,
        coverType: "none"
      }
    ]
  },
  enemies: []
};
