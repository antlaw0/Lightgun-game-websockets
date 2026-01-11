import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export function createMannequin() {
  // Create bones
  const bones = {};

  function b(name) {
    const bone = new THREE.Bone();
    bone.name = name;
    bones[name] = bone;
    return bone;
  }

  const root = b('root');
  const pelvis = b('pelvis');
  const spine = b('spine');
  const neck = b('neck');
  const head = b('head');

  const upperArmL = b('upper_arm_l');
  const lowerArmL = b('lower_arm_l');
  const handL = b('hand_l');

  const upperArmR = b('upper_arm_r');
  const lowerArmR = b('lower_arm_r');
  const handR = b('hand_r');

  const upperLegL = b('upper_leg_l');
  const lowerLegL = b('lower_leg_l');
  const footL = b('foot_l');

  const upperLegR = b('upper_leg_r');
  const lowerLegR = b('lower_leg_r');
  const footR = b('foot_r');

  const shoulderR = b('shoulder_r');
  const backMount = b('back_mount');

  // Build simple hierarchy
  root.add(pelvis);
  pelvis.position.y = 0;
  pelvis.add(spine);
  spine.position.y = 0.45;
  spine.add(neck);
  neck.position.y = 0.22;
  neck.add(head);
  head.position.y = 0.16;

  // Left arm
  spine.add(upperArmL);
  upperArmL.position.set(-0.28, 0.3, 0);
  upperArmL.add(lowerArmL);
  lowerArmL.position.y = -0.26;
  lowerArmL.add(handL);
  handL.position.y = -0.22;

  // Right arm
  spine.add(upperArmR);
  upperArmR.position.set(0.28, 0.3, 0);
  upperArmR.add(lowerArmR);
  lowerArmR.position.y = -0.26;
  lowerArmR.add(handR);
  handR.position.y = -0.22;

  // Attach shoulder and back mount to spine
  spine.add(shoulderR);
  shoulderR.position.set(0.2, 0.3, -0.08);
  spine.add(backMount);
  backMount.position.set(0, 0.2, -0.12);

  // Left leg
  pelvis.add(upperLegL);
  upperLegL.position.set(-0.12, -0.18, 0);
  upperLegL.add(lowerLegL);
  lowerLegL.position.y = -0.36;
  lowerLegL.add(footL);
  footL.position.y = -0.16;

  // Right leg
  pelvis.add(upperLegR);
  upperLegR.position.set(0.12, -0.18, 0);
  upperLegR.add(lowerLegR);
  lowerLegR.position.y = -0.36;
  lowerLegR.add(footR);
  footR.position.y = -0.16;

  const skeletonBones = Object.values(bones);

  // Create a simple skinned torso (cylinder) + attach limb placeholders to bones
  const torsoGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.9, 8, 1, false);
  // Provide minimal skin indices/weights so skeleton can bind
  const position = torsoGeo.attributes.position;
  const vertexCount = position.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let i = 0; i < vertexCount; i++) {
    // make pelvis (index 1) and spine (index 2) influence torso
    skinIndices[i * 4 + 0] = skeletonBones.indexOf(pelvis);
    skinWeights[i * 4 + 0] = 0.5;
    skinIndices[i * 4 + 1] = skeletonBones.indexOf(spine);
    skinWeights[i * 4 + 1] = 0.5;
  }

  torsoGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  torsoGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  // Colors per request: blue legs, red feet, orange torso, yellow arms, white head
  const COLOR = {
    torso: 0xff8c2b, // orange
    leg: 0x2b66ff, // blue
    foot: 0xff3333, // red
    arm: 0xffd24d, // yellow
    head: 0xffffff // white
  };

  const mat = new THREE.MeshStandardMaterial({ color: COLOR.torso, skinning: true, flatShading: true });
  const skinnedMesh = new THREE.SkinnedMesh(torsoGeo, mat);
  skinnedMesh.name = 'mannequin_skin';

  // Create skeleton and bind
  const skeleton = new THREE.Skeleton(skeletonBones);
  skinnedMesh.add(root);
  skinnedMesh.bind(skeleton);

  // Attach limb meshes to bones (cylinders for limbs, sphere for head)
  function limbCylinder(radiusTop, radiusBottom, height, color) {
    const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8, 1);
    const m = new THREE.MeshStandardMaterial({ color, flatShading: true });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: COLOR.head, flatShading: true }));
  head.add(headMesh);
  headMesh.position.set(0, 0.08, 0);

  const upperArmLMesh = limbCylinder(0.06, 0.06, 0.34, COLOR.arm);
  upperArmL.add(upperArmLMesh);
  upperArmLMesh.rotation.z = Math.PI / 2;
  upperArmLMesh.position.set(0, -0.17, 0);

  const lowerArmLMesh = limbCylinder(0.05, 0.05, 0.32, COLOR.arm);
  lowerArmL.add(lowerArmLMesh);
  lowerArmLMesh.rotation.z = Math.PI / 2;
  lowerArmLMesh.position.set(0, -0.16, 0);

  const handLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.14), new THREE.MeshStandardMaterial({ color: COLOR.head }));
  handL.add(handLMesh);
  handLMesh.position.set(0, -0.06, 0.06);

  const upperArmRMesh = limbCylinder(0.06, 0.06, 0.34, COLOR.arm);
  upperArmR.add(upperArmRMesh);
  upperArmRMesh.rotation.z = Math.PI / 2;
  upperArmRMesh.position.set(0, -0.17, 0);

  const lowerArmRMesh = limbCylinder(0.05, 0.05, 0.32, COLOR.arm);
  lowerArmR.add(lowerArmRMesh);
  lowerArmRMesh.rotation.z = Math.PI / 2;
  lowerArmRMesh.position.set(0, -0.16, 0);

  const handRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.14), new THREE.MeshStandardMaterial({ color: COLOR.head }));
  handR.add(handRMesh);
  handRMesh.position.set(0, -0.06, 0.06);

  const upperLegLMesh = limbCylinder(0.08, 0.08, 0.4, COLOR.leg);
  upperLegL.add(upperLegLMesh);
  upperLegLMesh.position.set(0, -0.2, 0);

  const lowerLegLMesh = limbCylinder(0.07, 0.07, 0.4, COLOR.leg);
  lowerLegL.add(lowerLegLMesh);
  lowerLegLMesh.position.set(0, -0.2, 0);

  const upperLegRMesh = limbCylinder(0.08, 0.08, 0.4, COLOR.leg);
  upperLegR.add(upperLegRMesh);
  upperLegRMesh.position.set(0, -0.2, 0);

  const lowerLegRMesh = limbCylinder(0.07, 0.07, 0.4, COLOR.leg);
  lowerLegR.add(lowerLegRMesh);
  lowerLegRMesh.position.set(0, -0.2, 0);

  // feet (red)
  const footLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: COLOR.foot }));
  footL.add(footLMesh);
  footLMesh.position.set(0, -0.02, 0.06);

  const footRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: COLOR.foot }));
  footR.add(footRMesh);
  footRMesh.position.set(0, -0.02, 0.06);

  // Return a simple API
  return {
    skinnedMesh,
    skeleton,
    bones
  };
}
