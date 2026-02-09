/* tools/sceneAdaptorCore.js */
/* PURE MODULE — NO fs, NO path */

export function generateSceneJS(map2D) {

  /* ================= HELPERS ================= */

  function isDoor(item) {
    if (!item.name) return false;
    const n = item.name.toLowerCase();
    if (n.includes("door")) return true;
    if (item.notes && item.notes.toLowerCase().includes("door")) return true;
    if (item.color === "magenta") return true;
    return false;
  } /* closes isDoor */

  function isPointLight(item) {
    return item.properties?.type === "point";
  } /* closes isPointLight */

  function mergePosition(base, override) {
    if (!override) return base;
    return {
      x: override.x ?? base.x,
      y: override.y ?? base.y,
      z: override.z ?? base.z
    };
  } /* closes mergePosition */

  /* ================= ADAPTERS ================= */

  function adaptWall(item, index) {
    const p = item.properties || {};

    const height = p.height ?? 3;

    const basePosition = {
      x: item.position.x,
      y: item.position.y ?? 0,
      z: item.position.z
    };

    const position = mergePosition(basePosition, p.position);

    const size = {
      x: p.size?.x ?? item.size.x,
      y: height,
      z: p.size?.z ?? item.size.z
    };

    return {
      id: item.id || `wall_${index}`,
      type: "wall",
      position,
      size,
      hp: 9999,
      maxHp: 9999,
      indestructible: true,
      coverType: "full"
    };
  } /* closes adaptWall */

  function adaptDoor(item) {
    const p = item.properties || {};

    const position = mergePosition(
      { x: item.position.x, y: item.position.y ?? 0, z: item.position.z },
      p.position
    );

    return {
      id: item.id,
      type: "door",
      position,
      rotationY: 0,
      targetRotation: { y: -Math.PI / 2 },
      duration: 2,
      texture: p.texture || "wood",
      openSound: "door_open"
    };
  } /* closes adaptDoor */

  function adaptGenericObject(item) {
    const p = item.properties || {};

    const height = p.height ?? 1;

    const basePosition = {
      x: item.position.x,
      y: item.position.y ?? 0,
      z: item.position.z
    };

    const position = mergePosition(basePosition, p.position);

    const size = {
      x: p.size?.x ?? item.size?.x ?? 1,
      y: height,
      z: p.size?.z ?? item.size?.z ?? 1
    };

    return {
      id: item.id || "object",
      type: "object",
      position,
      size,
      texture: p.texture || "default"
    };
  } /* closes adaptGenericObject */

  function adaptLight(item) {
    const p = item.properties || {};

    // Lights don't have size; position is used directly
    const basePosition = {
      x: item.position.x,
      y: p.height ?? (item.position.y ?? 5),
      z: item.position.z
    };

    const position = mergePosition(basePosition, p.position);

    return {
      id: item.id,
      type: "point",
      color: p.color ?? 0xffffff,
      intensity: p.intensity ?? 1,
      position,
      distance: p.distance ?? 50,
      decay: p.decay ?? 2,
      castShadow: !!p.castShadow,
      shadow: p.shadow || undefined
    };
  } /* closes adaptLight */

  function adaptTile(item, index) {
    const p = item.properties || {};

    const tileHeight = p.height ?? 1;

    const basePosition = {
      x: item.position.x,
      y: item.position.y ?? 0,
      z: item.position.z
    };

    const position = mergePosition(basePosition, p.position);

    const size = {
      x: p.size?.x ?? item.size?.x ?? 1,
      y: p.size?.y ?? item.size?.y ?? tileHeight,
      z: p.size?.z ?? item.size?.z ?? 1
    };

    return {
      id: item.id || `tile_${index}`,
      type: "tile",
      layer: item.layer || "middle",
      position,
      size,
      texture: item.texture || p.texture || "default",
      notes: item.notes || "",
      hp: 9999,
      maxHp: 9999,
      indestructible: true
    };
  } /* closes adaptTile */

  /* ================= SERIALIZER ================= */

  function toJS(obj, indent = 2) {
    const pad = " ".repeat(indent);

    if (obj === null || obj === undefined) return "null";

    if (Array.isArray(obj)) {
      if (!obj.length) return "[]";
      return `[\n${pad}${obj.map(o => toJS(o, indent + 2)).join(",\n" + pad)}\n${pad.slice(2)}]`;
    }

    if (typeof obj === "object") {
      return `{\n${pad}${Object.entries(obj)
        .map(([k, v]) => `${k}: ${toJS(v, indent + 2)}`)
        .join(",\n" + pad)}\n${pad.slice(2)}}`;
    }

    if (typeof obj === "string") return `"${obj}"`;
    return String(obj);
  } /* closes toJS */

  /* ================= MAIN PASS ================= */

  const staticObjects = [];
  const lights = [];

  map2D.items.forEach((item, index) => {

    if (isPointLight(item)) {
      lights.push(adaptLight(item));
      return;
    }

    if (item.type === "tile") {
      staticObjects.push(adaptTile(item, index));
      return;
    }

    if (item.type === "wall") {
      staticObjects.push(adaptWall(item, index));
      return;
    }

    if (item.type === "object") {

      if (isDoor(item)) {
        staticObjects.push(adaptDoor(item));
        return;
      }

      staticObjects.push(adaptGenericObject(item));
    }
  });

  /* ================= OUTPUT ================= */

  return `
// AUTO-GENERATED FILE
// Generated from 2D Scene Mapper
// DO NOT EDIT BY HAND

export const Scene_${map2D.mapName} = {
  name: "${map2D.mapName}",

  camera: {
    position: { x: 15, y: 10, z: 50 },
    lookAt: { x: 15, y: 3.5, z: 15 },
    fov: 60,
    near: 0.1,
    far: 200
  },

  lights: ${toJS(lights, 2)},

  environment: {
    staticObjects: ${toJS(staticObjects, 2)}
  },

  enemies: [],
  objective: null,
  nextScene: null
};
`;
} /* closes generateSceneJS */
