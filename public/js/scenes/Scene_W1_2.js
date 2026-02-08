import sounds from "../listOfSounds.js";

export const Scene_W1_2 = {
  name: "map_L_hallway",

  camera: {
    position: { x: 1.8, y: 1.84, z: 15.57 },
    lookAt: { x: 15, y: 3.5, z: 15 },
    fov: 60,
    near: 0.1,
    far: 200
  },

  lights: [
    {
      type: "point",
      color: 16777215,
      intensity: 5,
      position: { x: 1, y: 6.5, z: 2 },
      distance: 15,
      decay: 2,
      castShadow: true,
      shadow: {
        mapSize: { width: 2048, height: 2048 },
        camera: { near: 0.5, far: 15 },
        bias: -0.0001
      },
      id: "point_light_L_bend"
    },

    {
      type: "point",
      color: 16777215,
      intensity: 0,
      position: { x: 16, y: 6.5, z: 29 },
      distance: 25,
      decay: 2,
      castShadow: true,
      shadow: {
        mapSize: { width: 1024, height: 1024 },
        camera: { near: 0.5, far: 30 },
        bias: -0.0001
      },
      id: "point_light_start_door"
    },

    {
      type: "point",
      color: 16777215,
      intensity: 0,
      position: { x: 3, y: 6.5, z: 17 },
      distance: 25,
      decay: 2,
      castShadow: true,
      shadow: {
        mapSize: { width: 1024, height: 1024 },
        camera: { near: 0.5, far: 30 },
        bias: -0.0001
      },
      id: "point_light_exit_door"
    },

    {
      type: "ambient",
      color: 16777215,
      intensity: 0.25
    }
  ],

  environment: {
    staticObjects: [
      {
        id: "floor_01",
        type: "floor",
        position: { x: 15, y: 0, z: 15 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 30, y: 0.1, z: 30 },
        hp: 999,
        indestructible: true,
        hitSounds: sounds.ric,
        texture: "assets/textures/warehouse_floor.png",
        coverType: "none"
      },

      {
        id: "ceiling_01",
        type: "floor",
        position: { x: 15, y: 14.05, z: 15 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 30, y: 0.1, z: 30 },
        hp: 999,
        indestructible: true,
        hitSounds: sounds.ric,
        texture: "assets/textures/warehouse_ceiling.png",
        coverType: "none"
      },

      ...[
        { name: "wall_righte_vertical", x: 13, z: 19, w: 1, h: 10, height: 7 },
        { name: "wall_righte_vertical_2", x: 19, z: 14, w: 1, h: 15, height: 7 },
        { name: "wall_left_2_horizontal", x: 4, z: 19, w: 9, h: 1, height: 7 },
        { name: "wall_right_2_horizontal", x: 3, z: 13, w: 17, h: 1, height: 7 },
        { name: "wall_end_piecee_vertical", x: 3, z: 18, w: 1, h: 2, height: 7 },
        { name: "wall_piece_end_2e_vertical", x: 3, z: 14, w: 1, h: 3, height: 7 },
        { name: "wall_beginning_piece_1e_horizontal", x: 13, z: 29, w: 3, h: 1, height: 7 },
        { name: "wall_beginning_right_horizontal", x: 17, z: 29, w: 3, h: 1, height: 7 }
      ].map((w, idx) => {
        const isHorizontal = w.name.includes("horizontal");
        return {
          id: w.name || `wall_${idx}`,
          type: "wall",
          position: {
            x: w.x + (isHorizontal ? w.w / 2 : 0.5),
            y: w.height / 2,
            z: w.z + (isHorizontal ? 0.5 : w.h / 2)
          },
          rotation: { x: 0, y: 0, z: 0 },
          size: {
            x: isHorizontal ? w.w : 1,
            y: w.height,
            z: isHorizontal ? 1 : w.h
          },
          hp: 9999,
          indestructible: true,
          hitSounds: sounds.ric,
          coverType: "full"
        };
      }),

      ...[
        {
          id: "exit_door",
          x: 3,
          z: 17,
          width: 1.2,
          height: 2.2,
          depth: 0.15
        },
        {
          id: "door_01",
          x: 1.65,
          z: 14.74,
          width: 1.2,
          height: 2.2,
          depth: 0.15
        }
      ].map((d) => ({
        id: d.id,
        type: "door",
        position: {
          x: d.x,
          y: d.height / 2,
          z: d.z
        },
        rotation: { x: 0, y: 0, z: 0 },
        size: {
          x: d.width,
          y: d.height,
          z: d.depth
        },
        hp: 1
      }))
    ]
  },

  enemies: []
};
