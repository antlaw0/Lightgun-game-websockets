import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Create a skinned T-shirt that binds to spine/neck and upper arm bones.
export function createTshirt(boneMap = {}, options = {}) {
  function findBone(map, names) {
    if (!map) return null;
    for (const n of names) {
      if (map[n]) return map[n];
    }
    const keys = Object.keys(map);
    for (const k of keys) for (const n of names) if (k.toLowerCase() === n.toLowerCase()) return map[k];
    return null;
  }

  const spine = findBone(boneMap, ['spine', 'Spine', 'spine1', 'Spine1', 'hips']);
  const neck = findBone(boneMap, ['neck', 'Neck', 'head']);
  const upperArmL = findBone(boneMap, ['upper_arm_l', 'upperarm_l', 'LeftArm', 'left_arm', 'upperArm_L']);
  const upperArmR = findBone(boneMap, ['upper_arm_r', 'upperarm_r', 'RightArm', 'right_arm', 'upperArm_R']);
  const bones = [spine, neck, upperArmL, upperArmR];
  if (!bones[0]) {
    const keys = Object.keys(boneMap);
    if (keys.length === 0) return null;
    bones[0] = boneMap[keys[0]];
  }

  // Torso geometry (skinned)
  const width = options.width || 0.44;
  const height = options.height || 0.6;
  const depth = options.depth || 0.24;
  const torsoGeo = new THREE.BoxGeometry(width, height, depth, 6, 6, 2);
  const pos = torsoGeo.attributes.position;
  const vertexCount = pos.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  const boneArray = bones.filter(b => b);

  function setInf(i, a, wa, b = 0, wb = 0) {
    skinIndices[i * 4 + 0] = a;
    skinWeights[i * 4 + 0] = wa;
    skinIndices[i * 4 + 1] = b;
    skinWeights[i * 4 + 1] = wb;
    skinIndices[i * 4 + 2] = 0; skinWeights[i * 4 + 2] = 0;
    skinIndices[i * 4 + 3] = 0; skinWeights[i * 4 + 3] = 0;
  }

  for (let i = 0; i < vertexCount; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    // default: influenced by spine and neck
    let a = boneArray.indexOf(bones[0]);
    let b = boneArray.indexOf(bones[1]);
    let wa = 0.75, wb = 0.25;
    // influence sleeves by upper arms depending on x sign
    if (Math.abs(x) > 0.18) {
      if (x < 0) { a = boneArray.indexOf(bones[2]); b = boneArray.indexOf(bones[0]); wa = 0.8; wb = 0.2; }
      else { a = boneArray.indexOf(bones[3]); b = boneArray.indexOf(bones[0]); wa = 0.8; wb = 0.2; }
    }
    if (a < 0) a = 0; if (b < 0) b = 0;
    setInf(i, a, wa, b, wb);
  }

  torsoGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  torsoGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  const mat = new THREE.MeshStandardMaterial({ color: options.color ?? 0xff2b2b, metalness: 0.05, roughness: 0.8 });
  try { mat.skinning = true; } catch(_) {}
  const skinned = new THREE.SkinnedMesh(torsoGeo, mat);
  skinned.name = 'skinned_tshirt';

  const usedBones = boneArray.slice();
  try {
    const names = usedBones.map(b => b && b.name);
    console.log('[Apparel TShirt] binding bones:', names);
    if (usedBones.some(b => !b)) console.warn('[Apparel TShirt] some used bones are null/undefined', usedBones);
  } catch (_) {}
  const skeleton = new THREE.Skeleton(usedBones);
  try { skinned.bind(skeleton); } catch (e) { console.warn('tshirt.bind failed', e); }
  skinned.castShadow = true; skinned.receiveShadow = true;
  // Apply small default offset so shirt sits on torso nicely
  if (options.offset) {
    skinned.position.x += options.offset.x || 0;
    skinned.position.y += options.offset.y || 0;
    skinned.position.z += options.offset.z || 0;
  } else {
    skinned.position.y += options.offsetY ?? 0.06;
  }
  if (options.scale) skinned.scale.multiplyScalar(options.scale);
  return skinned;
}
