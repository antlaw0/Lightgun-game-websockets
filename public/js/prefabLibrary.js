import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
import { Prop } from "./prop.js";

/*
=====================================================
 DEBUG
=====================================================
*/

const DEBUG_MATERIALS = false;

/*
=====================================================
 TEXTURE LOADING
=====================================================
*/

const textureLoader = new THREE.TextureLoader();

function loadTexture(path, repeatX = 1, repeatY = 1) {
  if (!path) return null;

  const tex = textureLoader.load(
    path,
    () => console.log("Texture loaded"),
    undefined,
    () => console.error("Texture failed")
  );

  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;

  if (repeatX !== 1 || repeatY !== 1) {
    tex.repeat.set(repeatX, repeatY);
  }

  return tex;
}

/*
=====================================================
 MATERIAL CREATION
=====================================================
*/

function createMaterial(
  texturePath,
  color = 0xffffff,
  roughness = 0.5,
  metalness = 0.0,
  repeatX = 1,
  repeatY = 1
) {
  if (DEBUG_MATERIALS) {
    return new THREE.MeshBasicMaterial({ color: 0xff00ff });
  }

  return new THREE.MeshStandardMaterial({
    map: texturePath ? loadTexture(texturePath, repeatX, repeatY) : null,
    color: color ?? 0xffffff,
    roughness,
    metalness,
    transparent: false,
    depthWrite: true
  });
}

/*
=====================================================
 PREFAB DEFINITIONS
=====================================================
*/

export function buildPrefab(type, data = {}) {
  // Procedural prefabs (legacy)
  if (type === "metal_barrel") return buildMetalBarrel(data);
  if (type === "crate") return buildCrate(data);

  // Generic GLB prefab
  // The prefab property is the name of the glb file to be used.
  // All glb props will be located at "assets/models/props"
  const url = `assets/models/props/${type}`;
  return buildGLBPrefab(url, type, data);
}

/*
=====================================================
 METAL BARREL (MULTI-MATERIAL)
=====================================================
*/


export function buildMetalBarrel(data = {}) {
  const radius = data.radius ?? 0.35;
  const height = data.height ?? 1.0;

  //
  // Geometry
  //
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    24,
    1
  );

  //
  // Material
  //
  const matData = data.material ?? {};
  const repeatX = matData.horizontalRepeat ?? 1;
  const repeatY = matData.verticalRepeat ?? 1;

  const loadTex = (path) => loadTexture(path, repeatX, repeatY);

  const material = new THREE.MeshStandardMaterial({
    map: matData.map ? loadTex(matData.map) : null,
    normalMap: matData.normalMap ? loadTex(matData.normalMap) : null,
    roughness: matData.roughness ?? 0.6,
    metalness: matData.metalness ?? 0.8
  });

  //
  // Create Prop (AUTHORITATIVE OBJECT)
  //
  const prop = new Prop({
    id: data.id ?? `barrel_${crypto.randomUUID()}`,
    type: "barrel",

    position: data.position ?? { x: 0, y: 0, z: 0 },
    size: { x: radius * 2, y: height, z: radius * 2 },

    hp: data.hp ?? 12,
    indestructible: false,

    hitSounds: data.hitSounds ?? [],
    deathSounds: data.deathSounds ?? [],

    explosion: data.explosion ?? {
      blastRadius: 3.5,
      maxDamage: 20,
      explosionSounds: []
    },

    material: {}, // handled manually below
    deathAction: "explode"
  });

  //
  // Replace the default box mesh with barrel mesh
  //
  const barrelMesh = new THREE.Mesh(geometry, material);

  barrelMesh.position.set(
    prop.position.x,
    prop.position.y + height / 2,
    prop.position.z
  );

  barrelMesh.castShadow = true;
  barrelMesh.receiveShadow = true;

  //
  // CRITICAL LINK
  //
  barrelMesh.userData.prop = prop;

  prop.mesh = barrelMesh;

  return prop;
}

/*
=====================================================
 CRATE (SINGLE MATERIAL)
=====================================================
*/

function buildCrate(data) {
  const size = data.size ?? { x: 1, y: 1, z: 1 };

  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);

  const matData = data.material ?? {};
  const material = createMaterial(
    matData.map ?? null,
    matData.color ?? 0xffffff,
    matData.roughness ?? 0.75,
    matData.metalness ?? 0.0,
    matData.horizontalRepeat ?? 1,
    matData.verticalRepeat ?? 1
  );

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Wrap in Prop
  const crateProp = new Prop({
    id: data.id ?? "crate_" + Math.random(),
    type: "crate",
    position: data.position,
    rotation: data.rotation,
    size,
    hp: data.hp ?? 8,
    maxHp: data.hp ?? 8,
    explosion: data.explosion,
    material: data.material,
    hitSounds: data.hitSounds,
    deathSounds: data.deathSounds,
    deathAction: data.deathAction ?? "break"
  });

  crateProp.mesh = mesh;
  mesh.userData.prop = crateProp;

  return crateProp;
}

/*
=====================================================
 GLB PREFABS
=====================================================
*/

const gltfLoader = new GLTFLoader();

function buildGLBPrefab(url, type, data) {
  const prop = new Prop({
    id: data.id ?? `${type}_${crypto.randomUUID()}`,
    type: type,
    position: data.position ?? { x: 0, y: 0, z: 0 },
    size: data.size ?? { x: 1, y: 1, z: 1 },
    hp: data.hp ?? 100,
    indestructible: data.indestructible ?? true,
    hitSounds: data.hitSounds ?? [],
    deathSounds: data.deathSounds ?? [],
    material: data.material
  });

  const group = new THREE.Group();
  group.position.set(prop.position.x, prop.position.y, prop.position.z);
  
  group.userData.prop = prop;
  prop.mesh = group;

  gltfLoader.load(url, (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.prop = prop;
        child.userData.propId = prop.id;
        child.userData.solid = true;
        if (window.sceneLoader && window.sceneLoader.propMeshes) {
          window.sceneLoader.propMeshes.push(child);
        }
      }
    });
    group.add(model);
  }, undefined, (err) => console.error(`Failed to load prefab ${type}:`, err));

  return prop;
}
