export const Scene_W1_2 = {
  name: "World 1-2 – L Hallway",

  camera: {
    position: { x: 0, y: 1.7, z: 1.5 },
    lookAt: { x: 0, y: 1.7, z: -2 },
    fov: 60,
    near: 0.1,
    far: 100
  }, // end camera

  cameraRails: {
    intro: [
      {
        type: "doorOpen",
        doorId: "door_entrance",
        duration: 600
      },
      {
        type: "moveTo",
        position: { x: 0, y: 1.7, z: -1.2 },
        duration: 900
      }
    ],
    exit: []
  }, // end cameraRails

  lights: [
    {
      type: "ambient",
      color: 0xffffff,
      intensity: 0.9
    },
    {
      type: "spot",
      color: 0xffffff,
      intensity: 1.3,
      position: { x: 0, y: 2.8, z: -3 },
      target: { x: 0, y: 1.5, z: -5 },
      angle: Math.PI / 2,
      penumbra: 0.6,
      decay: 0.6,
      distance: 16
    },
    {
      type: "spot",
      color: 0xffffff,
      intensity: 1.3,
      position: { x: 4, y: 2.8, z: -6 },
      target: { x: 6, y: 1.5, z: -6 },
      angle: Math.PI / 2,
      penumbra: 0.6,
      decay: 0.6,
      distance: 16
    }
  ], // end lights

  environment: {
    staticObjects: [
      /* =========================
         ENTRANCE LEG WALLS (–Z)
         ========================= */

      {
        id: "wall_entrance_left",
        type: "wall",
        hp: 200,
        maxHp: 200,
        position: { x: -1.5, y: 0, z: -3 },
        size: { x: 0.2, y: 2.5, z: 6 },
        coverType: "full",
        indestructible: true,
        material: { map: "assets/props/brick_wall.png", color: 0xffffff, roughness: 0.95, metalness: 0.0 }
      },

      {
        id: "wall_entrance_right",
        type: "wall",
        hp: 200,
        maxHp: 200,
        position: { x: 1.5, y: 0, z: -3 },
        size: { x: 0.2, y: 2.5, z: 6 },
        coverType: "full",
        indestructible: true,
        material: { map: "assets/props/brick_wall.png", color: 0xffffff, roughness: 0.95, metalness: 0.0 }
      },

      /* =========================
         TURN LEG WALLS (+X)
         ========================= */

      {
        id: "wall_turn_top",
        type: "wall",
        hp: 200,
        maxHp: 200,
        position: { x: 3, y: 0, z: -7.5 },
        size: { x: 6, y: 2.5, z: 0.2 },
        coverType: "full",
        indestructible: true,
        material: { map: "assets/props/brick_wall.png", color: 0xffffff, roughness: 0.95, metalness: 0.0 }
      },

      {
        id: "wall_turn_bottom",
        type: "wall",
        hp: 200,
        maxHp: 200,
        position: { x: 3, y: 0, z: -4.5 },
        size: { x: 6, y: 2.5, z: 0.2 },
        coverType: "full",
        indestructible: true,
        material: { map: "assets/props/brick_wall.png", color: 0xffffff, roughness: 0.95, metalness: 0.0 }
      },

      /* =========================
         DOORS
         ========================= */

      {
        id: "door_entrance",
        type: "door",
        position: { x: 0, y: 0, z: 0 },
        width: 1.2,
        height: 2.2,
        depth: 0.2
      },

      {
        id: "door_exit",
        type: "door",
        position: { x: 6, y: 0, z: -6 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        width: 1.2,
        height: 2.2,
        depth: 0.2
      }
    ]
  }, // end environment

  enemies: [
    /* E1 – Sniper at far end */
    {
      id: "sniper_w1_2",
      type: "Grunt",
      displayName: "Sniper Grunt",
      hp: 90,
      modelUrl: "assets/models/exo_red.fbx",
      position: { x: 5.2, y: 0, z: -6 },
      facing: -Math.PI / 2,
      behavior: { pattern: "standInOpen", params: { fireIntervalMs: 1200 } }
    },

    /* E2 – SWAT enemy reused EXACTLY */
    {
      id: "swat_w1_2",
      type: "Grunt",
      displayName: "Grunt Soldier",
      hp: 100,
      modelUrl: "assets/models/swatguy.fbx",
      animationUrls: {
        shoot: "assets/animations/swatguy_firing_rifle.fbx",
        dying_rifle: "assets/animations/swatguy_dying.fbx",
        dying: "assets/animations/swatguy_dying.fbx"
      },
      position: { x: 2, y: 0, z: -5 },
      groundY: 0.85,
      facing: 0,
      behavior: { pattern: "standInOpen", params: { fireIntervalMs: 900 } }
    }
  ], // end enemies

  objective: {
    type: "eliminateAllEnemies",
    description: "Clear the hallway."
  },

  nextScene: "scene_w1_3"
};
