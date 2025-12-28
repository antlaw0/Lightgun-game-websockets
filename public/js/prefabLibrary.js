console.log("prefabLibrary loaded as module");

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

/*
=====================================================
 HIT SOUND DEFINITIONS (BY MATERIAL TYPE)
=====================================================
*/
export const HIT_SOUNDS = {
  cardboard: [
    "assets/audio/hits/cardboard_1.wav",
    "assets/audio/hits/cardboard_2.wav"
  ],
  metal: [
    "assets/audio/hits/metal_1.wav",
    "assets/audio/hits/metal_2.wav"
  ],
  wood: [
    "assets/audio/hits/wood_1.wav",
    "assets/audio/hits/wood_2.wav"
  ],
  flesh: [
    "assets/audio/hits/flesh_1.wav",
    "assets/audio/hits/flesh_2.wav"
  ]
};

export function getRandomHitSound(materialType) {
  const list = HIT_SOUNDS[materialType];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

/*
=====================================================
 MATERIAL FACTORY
=====================================================
*/

const textureLoader = new THREE.TextureLoader();

function loadTexture(path) {
  const tex = textureLoader.load(
    path,
    (loadedTex) => {
      loadedTex.colorSpace = THREE.SRGBColorSpace;
      console.log("Texture loaded:", path);
    },
    undefined,
    (err) => {
      console.error("Failed to load texture:", path, err);
    }
  );

  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;

  return tex;
}
const DEBUG_MATERIALS = false;

function createMaterial(
  texturePath,
  color = 0xffffff,
  roughness = 0.5,
  metalness = 0.0
) {
  if (DEBUG_MATERIALS) {
    return new THREE.MeshBasicMaterial({ color: 0xff00ff });
  }

  return new THREE.MeshStandardMaterial({
    map: texturePath ? loadTexture(texturePath) : null,
    color,
    roughness,
    metalness
  });
}

/*
=====================================================
 PREFAB HELPERS
=====================================================
*/
function tagHitMesh(mesh, options) {
  mesh.userData.isHitMesh = true;
  mesh.userData.materialType = options.materialType;
  mesh.userData.damageMultiplier = options.damageMultiplier ?? 1.0;
}

/*
=====================================================
 CARDBOARD CUTOUT
=====================================================
*/
export function createCardboardCutout(materials = {}) {
  const group = new THREE.Group();
  group.name = "CardboardCutout";

  const coarseGeo = new THREE.BoxGeometry(1.2, 2.0, 0.4);
  const coarseMat = new THREE.MeshBasicMaterial({ visible: false });
  const coarseHitbox = new THREE.Mesh(coarseGeo, coarseMat);
  coarseHitbox.userData.isCoarseHitbox = true;
  coarseHitbox.userData.prefab = group;
  group.add(coarseHitbox);

  const geometry = new THREE.BoxGeometry(1, 1.8, 0.2);
  const mats = [
    createMaterial("assets/props/metal_barrel_side.png"),
    createMaterial("assets/props/metal_barrel_top.png"),
    createMaterial("assets/props/metal_barrel_bottom.png")
  ];

  const fineMesh = new THREE.Mesh(geometry, mats);
  fineMesh.position.y = 0.9;
  tagHitMesh(fineMesh, { materialType: "cardboard" });
  group.add(fineMesh);

  return group;
}

/*
=====================================================
 METAL BARREL
=====================================================
*/
export function createMetalBarrel(materials = {}) {
  const group = new THREE.Group();
  group.name = "MetalBarrel";

  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 24, 1);

// Cylinder material order:
// 0 = side, 1 = top, 2 = bottom
const mats = [
  createMaterial(
    materials.side ?? materials.map ?? "assets/props/metal_barrel_side.png",
    0xffffff,
    materials.roughness ?? 0.2,
    materials.metalness ?? 0.0
  ),
  createMaterial(
    materials.top ?? "assets/props/metal_barrel_top.png",
    0xffffff,
    materials.roughness ?? 0.45,
    materials.metalness ?? 0.9
  ),
  createMaterial(
    materials.bottom ?? "assets/props/metal_barrel_bottom.png",
    0xffffff,
    materials.roughness ?? 0.45,
    materials.metalness ?? 0.9
  )
];

  const barrel = new THREE.Mesh(geo, mats);
  barrel.castShadow = true;
  barrel.receiveShadow = true;

  tagHitMesh(barrel, {
    materialType: "metal",
    damageMultiplier: 0.8
  });

  group.add(barrel);
  return group;
}

/*
=====================================================
 BUILD PREFAB
=====================================================
*/
export function buildPrefab(name, materials = {}) {
  switch (name) {
    case "metal_barrel":
    case "barrel":
      return createMetalBarrel(materials);
    case "cardboard":
      return createCardboardCutout(materials);
    default:
      throw new Error(`Unknown prefab: ${name}`);
  }
}
