export const Scene_Exported = {
  name: "Exported Scene 2026-01-29T17:41:14.175Z",
  camera: {
    position: {
      x: 10.853424529145162,
      y: 1.7,
      z: 5.087871725614355
    },
    lookAt: {
      x: 2.324776285471234,
      y: 1.9715314455213624,
      z: 10.302124290438075
    },
    fov: 60,
    near: 0.1,
    far: 200
  },
  lights: [
    {
      type: "ambient",
      color: 16777215,
      intensity: 0.6
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 1.6,
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
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 1.6,
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
      castShadow: true
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 1.6,
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
      castShadow: true
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 1.6,
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
      castShadow: true
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 1.6,
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
      castShadow: true
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 1.6,
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
      castShadow: true
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 1.6,
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
      castShadow: true
    },
    {
      type: "directional",
      color: 16777215,
      intensity: 1.6,
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
      castShadow: true
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
		indestructible:  true
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
