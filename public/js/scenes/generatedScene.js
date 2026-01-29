export const Scene_Exported = {
  name: "Exported Scene 2026-01-29T16:12:48.350Z",
  camera: {
    position: {
      x: 17.617030829439827,
      y: 1.7,
      z: 6.09119949132203
    },
    lookAt: {
      x: 9.286842193463658,
      y: 1.242196796596021,
      z: 0.5777274893974216
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
    }
  ],
  environment: {
    staticObjects: [
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
          y: 8,
          z: 15
        },
        hp: 9999,
		indestructible:  true,
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
