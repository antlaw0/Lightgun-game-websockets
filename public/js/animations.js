import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export function createWalkRunAnimations(bones) {
  // Improved procedural walk/run with knee bend and pelvis bob
  const walkDuration = 1.0; // seconds
  const runDuration = 0.5;

  const tracksWalk = [];
  const tracksRun = [];

  // helper: rotation track on X axis only (forward/back)
  function rotXTrack(boneName, times, values) {
    const bone = bones[boneName];
    if (!bone) return null;
    // values should be array of numbers representing rotation.x at each time
    return new THREE.NumberKeyframeTrack(`${bone.name}.rotation`, times, values);
  }

  // Upper leg swing (hip)
  // left and right opposite phase
  tracksWalk.push(new THREE.NumberKeyframeTrack(`${bones['upper_leg_l'].name}.rotation`, [0, 0.5, 1.0], [0.6, -0.6, 0.6]));
  tracksWalk.push(new THREE.NumberKeyframeTrack(`${bones['upper_leg_r'].name}.rotation`, [0, 0.5, 1.0], [-0.6, 0.6, -0.6]));

  tracksRun.push(new THREE.NumberKeyframeTrack(`${bones['upper_leg_l'].name}.rotation`, [0, 0.5, 1.0], [1.1, -1.1, 1.1]));
  tracksRun.push(new THREE.NumberKeyframeTrack(`${bones['upper_leg_r'].name}.rotation`, [0, 0.5, 1.0], [-1.1, 1.1, -1.1]));

  // Knee (lower leg) bends when leg is swinging forward (mid-step)
  tracksWalk.push(new THREE.NumberKeyframeTrack(`${bones['lower_leg_l'].name}.rotation`, [0, 0.25, 0.5, 0.75, 1.0], [0.0, 0.8, 0.0, 0.8, 0.0]));
  tracksWalk.push(new THREE.NumberKeyframeTrack(`${bones['lower_leg_r'].name}.rotation`, [0, 0.25, 0.5, 0.75, 1.0], [0.8, 0.0, 0.8, 0.0, 0.8]));

  tracksRun.push(new THREE.NumberKeyframeTrack(`${bones['lower_leg_l'].name}.rotation`, [0, 0.25, 0.5, 0.75, 1.0], [0.0, 1.6, 0.0, 1.6, 0.0]));
  tracksRun.push(new THREE.NumberKeyframeTrack(`${bones['lower_leg_r'].name}.rotation`, [0, 0.25, 0.5, 0.75, 1.0], [1.6, 0.0, 1.6, 0.0, 1.6]));

  // Arms swing opposite to legs
  if (bones['upper_arm_l']) {
    tracksWalk.push(new THREE.NumberKeyframeTrack(`${bones['upper_arm_l'].name}.rotation`, [0, 0.5, 1.0], [-0.5, 0.5, -0.5]));
    tracksRun.push(new THREE.NumberKeyframeTrack(`${bones['upper_arm_l'].name}.rotation`, [0, 0.5, 1.0], [-1.1, 1.1, -1.1]));
  }
  if (bones['upper_arm_r']) {
    tracksWalk.push(new THREE.NumberKeyframeTrack(`${bones['upper_arm_r'].name}.rotation`, [0, 0.5, 1.0], [0.5, -0.5, 0.5]));
    tracksRun.push(new THREE.NumberKeyframeTrack(`${bones['upper_arm_r'].name}.rotation`, [0, 0.5, 1.0], [1.1, -1.1, 1.1]));
  }

  // Pelvis bob (small vertical translation on pelvis bone to simulate footfall)
  if (bones['pelvis']) {
    // times: hit at mid-step (0.5)
    tracksWalk.push(new THREE.VectorKeyframeTrack(`${bones['pelvis'].name}.position`, [0, 0.5, 1.0], [0, 0, 0, 0, -0.04, 0, 0, 0, 0]));
    tracksRun.push(new THREE.VectorKeyframeTrack(`${bones['pelvis'].name}.position`, [0, 0.5, 1.0], [0, 0, 0, 0, -0.08, 0, 0, 0, 0]));
  }

  const walkClip = new THREE.AnimationClip('walk', walkDuration, tracksWalk);
  const runClip = new THREE.AnimationClip('run', runDuration, tracksRun);

  return { walkClip, runClip };
}
