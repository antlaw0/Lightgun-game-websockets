import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";

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

function loadTexture(path) {
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
  metalness = 0.0
) {
  if (DEBUG_MATERIALS) {
    return new THREE.MeshBasicMaterial({ color: 0xff00ff });
  }

  return new THREE.MeshStandardMaterial({
    map: texturePath ? loadTexture(texturePath) : null,
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
  switch (type) {
    case "metal_barrel":
      return buildMetalBarrel(data);

    case "crate":
      return buildCrate(data);

    default:
      console.warn("Unknown prefab type:", type);
      return null;
  }
}

/*
=====================================================
 METAL BARREL (MULTI-MATERIAL)
=====================================================
*/

function buildMetalBarrel(data) {
  const radiusTop = 0.45;
  const radiusBottom = 0.45;
  const height = 0.9;
  const radialSegments = 24;

  const geometry = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    1,
    false
  );

  const mat = data.material ?? {};

  const color = mat.color ?? 0xffffff;
  const roughness = mat.roughness ?? 0.6;
  const metalness = mat.metalness ?? 0.0;

  const sideMat = createMaterial(
    mat.side ?? mat.map ?? null,
    color,
    roughness,
    metalness
  );

  const topMat = createMaterial(
    mat.top ?? mat.map ?? null,
    color,
    roughness,
    metalness
  );

  const bottomMat = createMaterial(
    mat.bottom ?? mat.map ?? null,
    color,
    roughness,
    metalness
  );

  const mesh = new THREE.Mesh(geometry, [
    sideMat,    // index 0: cylinder side
    topMat,     // index 1: top cap
    bottomMat   // index 2: bottom cap
  ]);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  console.log("Metal barrel material:", data.material);
    // Apply rotation if specified in prefab data
    if (data.rotation) {
        mesh.rotation.set(
            data.rotation.x ?? 0,
            data.rotation.y ?? 0,
            data.rotation.z ?? 0
        );
    }
  return mesh;

}

/*
=====================================================
 CRATE (SINGLE MATERIAL)
=====================================================
*/

function buildCrate(data) {
  const size = data.size ?? { x: 1, y: 1, z: 1 };

  const geometry = new THREE.BoxGeometry(
    size.x,
    size.y,
    size.z
  );

  const matData = data.material ?? {};

  const material = createMaterial(
    matData.map ?? null,
    matData.color ?? 0xffffff,
    matData.roughness ?? 0.75,
    matData.metalness ?? 0.0
  );

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
