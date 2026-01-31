import sounds from "../listOfSounds.js";

export const Scene_W1_2 = {
  name: "map_L_hallway",
  camera: {
    position: { x: 15, y: 10, z: 50 },
    lookAt: { x: 15, y: 3.5, z: 15 },
    fov: 60,
    near: 0.1,
    far: 200
  },
  lights: [
  // Point light 1 near end of hallway
  {
    type: "point",
    color: 16777215,
    intensity: 1.5,
    position: { x: 16, y: 6.5, z: 23 }, // just below wall top
    distance: 50,
    decay: 2,
    castShadow: true,
    shadow: {
      mapSize: { width: 1024, height: 1024 },
      camera: { near: 0.5, far: 50 },
      bias: -0.0001
    },
    id: "light_point_1e"
  },

  // Point light 2 near start of hallway
  {
    type: "point",
    color: 16777215,
    intensity: 1.5,
    position: { x: 10, y: 6.5, z: 16 },
    distance: 50,
    decay: 2,
    castShadow: true,
    shadow: {
      mapSize: { width: 1024, height: 1024 },
      camera: { near: 0.5, far: 50 },
      bias: -0.0001
    },
    id: "light_point_2e"
  },

  // Directional light simulating overhead light
  {
    type: "directional",
    id: "directional_1",
    color: 0xffffff,
    intensity: 1.2, // slightly less intense than points
    position: { x: 15, y: 20, z: 15 }, // high above hallway
    target: { x: 15, y: 0, z: 15 },   // pointing down to center
    castShadow: true,
    shadow: {
      mapSize: { width: 4096, height: 4096 },
      camera: {
        left: -15,
        right: 15,
        top: 15,
        bottom: -15,
        near: 1,
        far: 50
      }
    }
  },

  // Ambient fill
  {
    type: "ambient",
    color: 16777215,
    intensity: 0.6
  }
],
environment: {
    staticObjects: [
      // Floor
      {
        id: "floor_01",
        type: "floor",
        position: { x: 15, y: 0, z: 15 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 30, y: 0.1, z: 30 },
        hp: 999,
        indestructible: true,
        hitSounds: sounds.ric,
		texture:  "assets/textures/warehouse_floor.png",
        coverType: "none"
      },
      // Ceiling
      {
        id: "ceiling_01",
        type: "floor",
        position: { x: 15, y: 14.05, z: 15 },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 30, y: 0.1, z: 30 },
        hp: 999,
		texture:  "assets/textures/warehouse_ceiling.png",
        indestructible: true,
        hitSounds: sounds.ric,
        coverType: "none"
      },
      // Walls
      ...[
        {
          name: "wall_righte_vertical",
          x: 13,
          z: 19,
          w: 1,
          h: 10,
          height: 7
        },
        {
          name: "wall_righte_vertical_2",
          x: 19,
          z: 14,
          w: 1,
          h: 15,
          height: 7
        },
        {
          name: "wall_left_2_horizontal",
          x: 4,
          z: 19,
          w: 9,
          h: 1,
          height: 7
        },
        {
          name: "wall_right_2_horizontal",
          x: 3,
          z: 13,
          w: 17,
          h: 1,
          height: 7
        },
        {
          name: "wall_end_piecee_vertical",
          x: 3,
          z: 18,
          w: 1,
          h: 2,
          height: 7
        },
        {
          name: "wall_piece_end_2e_vertical",
          x: 3,
          z: 14,
          w: 1,
          h: 3,
          height: 7
        },
        {
          name: "wall_beginning_piece_1e_horizontal",
          x: 13,
          z: 29,
          w: 3,
          h: 1,
          height: 7
        },
        {
          name: "wall_beginning_right_horizontal",
          x: 17,
          z: 29,
          w: 3,
          h: 1,
          height: 7
        },
        {
          name: "",
          x: 0,
          z: 0,
          w: 1,
          h: 1,
          height: 3
        }
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
      // Objects (doors)
      ...[
        {
          name: "exit_door",
          x: 3,
          z: 17,
          shape: "square",
          color: "magenta",
          notes: "exit door end of L hallway"
        },
        {
          name: "starting_door",
          x: 16,
          z: 29,
          shape: "square",
          color: "magenta",
          notes: "door at beginning of scene"
        }
      ].map((o) => ({
        id: o.name,
        type: "object",
        position: { x: o.x, y: 0, z: o.z },
        rotation: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        color: o.color,
        shape: o.shape,
        notes: o.notes,
        hp: 1,
        indestructible: false,
        hitSounds: sounds.ric,
        coverType: "none"
      }))
    ]
  },
  enemies: []
};
