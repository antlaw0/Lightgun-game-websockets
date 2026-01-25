export const Scene_Exported = {
  "name": "Exported Scene 2026-01-25T03:57:32.520Z",
  "camera": {
    "position": {
      "x": 8.503184973841519,
      "y": 1.7,
      "z": -6.393623743113195
    },
    "lookAt": {
      "x": 6.361659483153034,
      "y": 1.9753812250884986,
      "z": 3.3704959690574947
    },
    "fov": 60,
    "near": 0.1,
    "far": 200
  },
  "lights": [
    {
      "type": "ambient",
      "color": 16777215,
      "intensity": 0.4
    },
    {
      "type": "directional",
      "color": 16777215,
      "intensity": 1.6,
      "position": {
        "x": 5,
        "y": 10,
        "z": 5
      },
      "target": {
        "x": 0,
        "y": 1.4,
        "z": -6
      },
      "castShadow": true,
      "shadow": {
        "mapSize": {
          "width": 2048,
          "height": 2048
        },
        "camera": {
          "left": -10,
          "right": 10,
          "top": 10,
          "bottom": -10,
          "near": 0.5,
          "far": 50
        }
      }
    },
    {
      "type": "ambient",
      "color": 16777215,
      "intensity": 0.4
    },
    {
      "type": "directional",
      "color": 16777215,
      "intensity": 1.6,
      "position": {
        "x": 5,
        "y": 10,
        "z": 5
      },
      "target": {
        "x": 0,
        "y": 1.4,
        "z": -6
      },
      "castShadow": true
    },
    {
      "type": "point",
      "color": 16777215,
      "intensity": 1,
      "position": {
        "x": 4.563199999999983,
        "y": 1.6001247661122155,
        "z": 1.2692953222443129
      },
      "distance": 0,
      "decay": 2
    },
    {
      "type": "point",
      "color": 16777215,
      "intensity": 1,
      "position": {
        "x": 8.074879875703822,
        "y": 1.7550762450176998,
        "z": -4.440799800679057
      },
      "distance": 0,
      "decay": 2
    }
  ],
  "environment": {
    "staticObjects": [
      {
        "id": "door_01",
        "type": "door",
        "position": {
          "x": 4.563199999999983,
          "y": 1.6001247661122155,
          "z": -3.99750467775569
        },
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "size": {
          "x": 1.2,
          "y": 2.2,
          "z": 0.15
        },
        "hp": 1
      },
      {
        "id": "light_01",
        "type": "light",
        "position": {
          "x": 4.563199999999983,
          "y": 1.6001247661122155,
          "z": 1.2692953222443129
        },
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        }
      },
      {
        "id": "crate_01",
        "type": "crate",
        "position": {
          "x": 3.081909052009399,
          "y": 1.3863828926979829,
          "z": 0.5329302519551415
        },
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "size": {
          "x": 1,
          "y": 1,
          "z": 1
        },
        "hp": 10
      },
      {
        "id": "crate_02",
        "type": "crate",
        "position": {
          "x": 19.40443982811381,
          "y": 1.2880530766677858,
          "z": -3.991327034149631
        },
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "size": {
          "x": 1,
          "y": 1,
          "z": 1
        },
        "hp": 10
      },
      {
        "id": "light_02",
        "type": "light",
        "position": {
          "x": 8.074879875703822,
          "y": 1.7550762450176998,
          "z": -4.440799800679057
        },
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        }
      },
      {
        "id": "crate_test",
        "type": "crate",
        "position": {
          "x": 0,
          "y": 0.5,
          "z": -5
        },
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "size": {
          "x": 1,
          "y": 1,
          "z": 1
        },
        "hp": 100,
        "coverType": "low"
      }
    ]
  },
  "enemies": [
    {
      "id": "grunt_test",
      "type": "Grunt",
      "displayName": "Grunt Soldier",
      "hp": 80,
      "modelUrl": "assets/models/exo_red.fbx",
      "position": {
        "x": 0,
        "y": 0,
        "z": -6
      },
      "facing": 0,
      "coverObject": "crate_test",
      "coverType": "low",
      "behavior": {
        "pattern": "popOutFromCover",
        "params": {
          "coverType": "low",
          "popDurationMs": 300,
          "hideDurationMs": 1200,
          "firingDurationMs": 900,
          "crouchOffsetY": -2.5,
          "crouchScale": 0.85
        }
      }
    },
    {
      "id": "swat_test",
      "type": "Grunt",
      "displayName": "Grunt Soldier",
      "hp": 100,
      "modelUrl": "assets/models/swatguy.fbx",
      "animationUrls": {
        "shoot": "assets/animations/swatguy_firing_rifle.fbx",
        "dying_rifle": "assets/animations/swatguy_dying.fbx",
        "dying": "assets/animations/swatguy_dying.fbx"
      },
      "position": {
        "x": 2,
        "y": 0,
        "z": -6
      },
      "groundY": 0.85,
      "facing": 0,
      "behavior": {
        "pattern": "standInOpen",
        "params": {
          "fireIntervalMs": 900
        }
      }
    }
  ]
};
