export const Scene_Exported = {
  "name": "Exported Scene 2026-01-25T16:12:41.769Z",
  "camera": {
    "position": {
      "x": 0.4847129258521049,
      "y": 1.7,
      "z": -4.898913216097025
    },
    "lookAt": {
      "x": 5.316957006562139,
      "y": -0.19656371491219815,
      "z": 3.6481601555151126
    },
    "fov": 60,
    "near": 0.1,
    "far": 200
  },
  "lights": [
    {
      "type": "ambient",
      "color": 16777215,
      "intensity": 0.6
    },
    {
      "type": "ambient",
      "color": 16777215,
      "intensity": 0.6
    },
    {
      "type": "ambient",
      "color": 16777215,
      "intensity": 0.6
    },
    {
      "type": "ambient",
      "color": 16777215,
      "intensity": 0.6
    }
  ],
  "environment": {
    "staticObjects": [
      {
        "id": "wall_01",
        "type": "wall",
        "position": {
          "x": 1.0933984755269983,
          "y": 0,
          "z": -1.5422746394057794
        },
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "size": {
          "x": 6,
          "y": 3,
          "z": 0.5
        },
        "hp": 9999,
		"indestructible":  true,
		"hitSounds": [
    "assets/sfx/props/metalHit1.ogg",
    "assets/sfx/props/metalHit2.ogg"
  ],
        "coverType": "full"
      },
      {
        "id": "floor_01",
        "type": "floor",
        "position": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "rotation": {
          "x": 0,
          "y": 0,
          "z": 0
        },
        "size": {
          "x": 50,
          "y": 0.1,
          "z": 50
        },
        "hp": 999,
		indestructible:  true,
        "coverType": "none"
      }
    ]
  },
  "enemies": []
};
