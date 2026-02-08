// tools/sceneAdaptor.js

import fs from "fs";
import path from "path";

/* ============================
   CONFIG
============================ */

const INPUT_MAP_PATH = "./map1.json";      // Input JSON map
const OUTPUT_SCENE_PATH = "./map1.js";     // Output JS scene
const OUTPUT_PROPERTIES_TXT = false;       // true = generate property reference TXT
const OUTPUT_PROPERTIES_PATH = "./object_properties.txt";

/* ============================
   HELPERS
============================ */

function isDoor(item) {
  if (!item.name) return false;
  if (item.name.toLowerCase().includes("door")) return true;
  if (item.color === "magenta") return true;
  if (item.notes && item.notes.toLowerCase().includes("door")) return true;
  return false;
}

// Adapt functions define the JS-ready structure
function adaptWall(item, index) {
  return {
    id: item.name || `wall_${index}`,
    type: "wall",
    position: { x: item.x || 0, y: item.height/2 || 0, z: item.y || 0 },
    size: { x: item.w || 1, y: item.height || 1, z: item.h || 1 },
    hp: 9999,
    maxHp: 9999,
    indestructible: true,
    coverType: "full"
  };
}

function adaptDoor(item) {
  return {
    id: item.name,
    type: "door",
    position: { x: item.x || 0, y: 0, z: item.y || 0 },
    rotationY: 0,
    targetRotation: { y: -Math.PI / 2 },
    duration: 2,
    texture: "wood",
    openSound: "door_open"
  };
}

function adaptLight(item) {
  return {
    id: item.name,
    type: "point",        // point light
    color: 0xffffff,
    intensity: 1.5,
    position: { x: item.x || 0, y: 6.5, z: item.y || 0 },
    distance: 50,
    decay: 2,
    castShadow: true,
    shadow: {
      mapSize: { width: 1024, height: 1024 },
      camera: { near: 0.5, far: 50 },
      bias: -0.0001
    }
  };
}

function adaptGenericObject(item) {
  return {
    id: item.name || "object",
    type: "object",
    position: { x: item.x || 0, y: 0, z: item.y || 0 },
    size: { x: 1, y: 1, z: 1 },
    texture: "default"
  };
}

/* ============================
   UTILITY: Convert object to JS literal string
============================ */

function toJS(obj, indent = 2) {
  const spacing = ' '.repeat(indent);
  if (obj === null) return 'null';
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const inner = obj.map(o => toJS(o, indent + 2)).join(',\n' + spacing + '  ');
    return `[\n${spacing}  ${inner}\n${spacing}]`;
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
      .map(([k, v]) => `${k}: ${toJS(v, indent + 2)}`)
      .join(',\n' + spacing);
    return `{\n${spacing}${entries}\n${spacing.slice(0,-2)}}`;
  }
  if (typeof obj === 'string') return `"${obj}"`;
  return String(obj);
}

/* ============================
   MAIN
============================ */

if (OUTPUT_PROPERTIES_TXT) {
  // Generate a reference of object kinds + properties
  const objectTypes = {
    wall: Object.keys(adaptWall({x:0,y:0,w:1,h:1,height:1,color:"gray"}, 0)),
    door: Object.keys(adaptDoor({name:"door_placeholder"})),
    pointLight: Object.keys(adaptLight({name:"light_placeholder"})),
    object: Object.keys(adaptGenericObject({name:"obj_placeholder"}))
  };

  let lines = "Available kinds:\n";
  lines += Object.keys(objectTypes).map(k => `- ${k}`).join("\n") + "\n\n";

  for (const kind in objectTypes) {
    lines += `Properties for kind "${kind}":\n`;
    lines += objectTypes[kind].map(p => `- ${p}`).join("\n") + "\n\n";
  }

  fs.writeFileSync(OUTPUT_PROPERTIES_PATH, lines, "utf-8");
  console.log("Object property reference generated at:", OUTPUT_PROPERTIES_PATH);

} else {
  const raw = fs.readFileSync(INPUT_MAP_PATH, 'utf-8');
  const map2D = JSON.parse(raw);

  const staticObjects = [];
  const lights = [];

  map2D.items.forEach((item, index) => {
    if (item.type === "wall") {
      staticObjects.push(adaptWall(item, index));
      return;
    }
    if (item.type === "object") {
      if (item.color === "yellow") {
        lights.push(adaptLight(item));
        return;
      }
      if (isDoor(item)) {
        staticObjects.push(adaptDoor(item));
        return;
      }
      staticObjects.push(adaptGenericObject(item));
    }
  });

  const output = `
// AUTO-GENERATED FILE
// Generated from ${path.basename(INPUT_MAP_PATH)}
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

  fs.writeFileSync(OUTPUT_SCENE_PATH, output, 'utf-8');
  console.log("Scene generated:");
  console.log("  Input :", INPUT_MAP_PATH);
  console.log("  Output:", OUTPUT_SCENE_PATH);
}
