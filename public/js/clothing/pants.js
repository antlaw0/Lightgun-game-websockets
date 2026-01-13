import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Create a skinned pants mesh that binds to the character's leg and pelvis bones.
export function createPants(boneMap = {}, options = {}) {
  // helper to lookup bone by many common names
  function findBone(map, names) {
    if (!map) return null;
    for (const n of names) {
      if (map[n]) return map[n];
      const alt = n.replace(/\b([lr])$/,'_$1');
      if (map[alt]) return map[alt];
    }
    // try case-insensitive match
    const keys = Object.keys(map);
    for (const k of keys) {
      for (const n of names) if (k.toLowerCase() === n.toLowerCase()) return map[k];
    }
    return null;
  }

  const pelvis = findBone(boneMap, ['pelvis', 'Pelvis', 'hips', 'Hips', 'root', 'Root', 'mixamorig:Hips']);
  // try to pick common bones
  const spine = findBone(boneMap, ['spine', 'Spine', 'spine1', 'Spine1']);
  const upper_leg_l = findBone(boneMap, ['upper_leg_l', 'thigh_l', 'LeftUpLeg', 'left_up_leg', 'leftUpLeg', 'LeftLeg']);
  const lower_leg_l = findBone(boneMap, ['lower_leg_l', 'calf_l', 'LeftLeg', 'left_leg']);
  const upper_leg_r = findBone(boneMap, ['upper_leg_r', 'thigh_r', 'RightUpLeg', 'right_up_leg', 'rightUpLeg', 'RightLeg']);
  const lower_leg_r = findBone(boneMap, ['lower_leg_r', 'calf_r', 'RightLeg', 'right_leg']);

  const bones = [pelvis, spine, upper_leg_l, lower_leg_l, upper_leg_r, lower_leg_r];

  // If no pelvis or leg bones, fallback to using first available bone
  if (!bones[0]) {
    const keys = Object.keys(boneMap);
    if (keys.length === 0) return null;
    const first = boneMap[keys[0]];
    bones[0] = first;
  }

  // Cylinder representing pants (single skinned mesh)
  const height = options.height || 1.4;
  const radius = options.radius || 0.095;
  const geo = new THREE.CylinderGeometry(radius, radius, height, 12, 24, true);

  // Prepare skin attributes
  const pos = geo.attributes.position;
  const vertexCount = pos.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  // Build index map for bones used in the skeleton array we'll create
  const boneArray = bones.map(b => b).filter(b => b);
  const boneIndexMap = {};
  boneArray.forEach((b, i) => { boneIndexMap[b.name || ('bone' + i)] = i; });

  // Helper to write attr
  function setInfluence(i, idxA, wA, idxB = 0, wB = 0) {
    skinIndices[i * 4 + 0] = idxA;
    skinWeights[i * 4 + 0] = wA;
    skinIndices[i * 4 + 1] = idxB;
    skinWeights[i * 4 + 1] = wB;
    skinIndices[i * 4 + 2] = 0;
    skinWeights[i * 4 + 2] = 0;
    skinIndices[i * 4 + 3] = 0;
    skinWeights[i * 4 + 3] = 0;
  }

  for (let i = 0; i < vertexCount; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);

    // Default to pelvis/spine
    let a = 0; // pelvis index in boneArray
    let b = 1; // spine
    let wa = 0.7, wb = 0.3;

    if (y < -0.2) {
      // lower leg region
      if (x < 0) { a = boneArray.indexOf(bones[3]); b = boneArray.indexOf(bones[2]); }
      else { a = boneArray.indexOf(bones[5]); b = boneArray.indexOf(bones[4]); }
      wa = 0.85; wb = 0.15;
    } else if (y < 0.3) {
      // upper leg / thigh
      if (x < 0) { a = boneArray.indexOf(bones[2]); b = boneArray.indexOf(bones[0]); }
      else { a = boneArray.indexOf(bones[4]); b = boneArray.indexOf(bones[0]); }
      wa = 0.8; wb = 0.2;
    }

    // Fallback in case indices are -1
    if (a < 0) a = 0;
    if (b < 0) b = 0;
    setInfluence(i, a, wa, b, wb);
  }

  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  const mat = new THREE.MeshStandardMaterial({ color: options.color ?? 0x333333, metalness: 0.1, roughness: 0.9 });
  // enable skinning flag separately for compatibility
  try { mat.skinning = true; } catch(_) {}
  const skinned = new THREE.SkinnedMesh(geo, mat);
  skinned.name = 'skinned_pants';

  // Build skeleton using available bone objects (must exist in scene hierarchy)
  const usedBones = boneArray.slice();
  // Debug: verify usedBones
  try {
    const names = usedBones.map(b => b && b.name);
    console.log('[Apparel Pants] binding bones:', names);
    if (usedBones.some(b => !b)) console.warn('[Apparel Pants] some used bones are null/undefined', usedBones);
  } catch (_) {}
  const skeleton = new THREE.Skeleton(usedBones);
  // Bind skeleton to skinned mesh. Caller should add skinned to sceneGroup before animations run.
  try { skinned.bind(skeleton); } catch (e) { console.warn('pants.bind failed', e); }
  skinned.castShadow = true; skinned.receiveShadow = true;
  // Apply optional local offsets to better align with model
  if (options.offset) {
    skinned.position.x += options.offset.x || 0;
    skinned.position.y += options.offset.y || 0;
    skinned.position.z += options.offset.z || 0;
  } else {
    // sensible default: lift slightly so waist aligns
    skinned.position.y += options.offsetY ?? 0.02;
  }
  if (options.scale) skinned.scale.multiplyScalar(options.scale);
  return skinned;
}
