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
    return new THREE.NumberKeyframeTrack(`${bone.name}.rotation[x]`, times, values);
  }

  // Upper leg swing (hip)
  // left and right opposite phase
  const t1 = [0, 0.5, 1.0];
  const valsUL = [0.6, -0.6, 0.6];
  const valsUR = [-0.6, 0.6, -0.6];
  const valsULrun = [1.1, -1.1, 1.1];
  const valsURrun = [-1.1, 1.1, -1.1];
  const tr = rotXTrack('upper_leg_l', t1, valsUL);
  if (tr) tracksWalk.push(tr);
  const tr2 = rotXTrack('upper_leg_r', t1, valsUR);
  if (tr2) tracksWalk.push(tr2);
  const tr3 = rotXTrack('upper_leg_l', t1, valsULrun);
  if (tr3) tracksRun.push(tr3);
  const tr4 = rotXTrack('upper_leg_r', t1, valsURrun);
  if (tr4) tracksRun.push(tr4);

  // Knee (lower leg) bends when leg is swinging forward (mid-step)
  const t2 = [0, 0.25, 0.5, 0.75, 1.0];
  const valsLL = [0.0, 0.8, 0.0, 0.8, 0.0];
  const valsLR = [0.8, 0.0, 0.8, 0.0, 0.8];
  const valsLLrun = [0.0, 1.6, 0.0, 1.6, 0.0];
  const valsLRrun = [1.6, 0.0, 1.6, 0.0, 1.6];
  const tr5 = rotXTrack('lower_leg_l', t2, valsLL);
  if (tr5) tracksWalk.push(tr5);
  const tr6 = rotXTrack('lower_leg_r', t2, valsLR);
  if (tr6) tracksWalk.push(tr6);
  const tr7 = rotXTrack('lower_leg_l', t2, valsLLrun);
  if (tr7) tracksRun.push(tr7);
  const tr8 = rotXTrack('lower_leg_r', t2, valsLRrun);
  if (tr8) tracksRun.push(tr8);

  // Arms swing opposite to legs
  if (bones['upper_arm_l']) {
    const ta = rotXTrack('upper_arm_l', [0,0.5,1.0], [-0.5,0.5,-0.5]);
    if (ta) tracksWalk.push(ta);
    const ta2 = rotXTrack('upper_arm_l', [0,0.5,1.0], [-1.1,1.1,-1.1]);
    if (ta2) tracksRun.push(ta2);
  }
  if (bones['upper_arm_r']) {
    const tb = rotXTrack('upper_arm_r', [0,0.5,1.0], [0.5,-0.5,0.5]);
    if (tb) tracksWalk.push(tb);
    const tb2 = rotXTrack('upper_arm_r', [0,0.5,1.0], [1.1,-1.1,1.1]);
    if (tb2) tracksRun.push(tb2);
  }

  // Pelvis bob (small vertical translation on pelvis bone to simulate footfall)
  if (bones['pelvis']) {
    // times: hit at mid-step (0.5)
    tracksWalk.push(new THREE.VectorKeyframeTrack(`${bones['pelvis'].name}.position`, [0, 0.5, 1.0], [0, 0, 0, 0, -0.04, 0, 0, 0, 0]));
    tracksRun.push(new THREE.VectorKeyframeTrack(`${bones['pelvis'].name}.position`, [0, 0.5, 1.0], [0, 0, 0, 0, -0.08, 0, 0, 0, 0]));
  }

  const walkClip = new THREE.AnimationClip('walk', walkDuration, tracksWalk);
  const runClip = new THREE.AnimationClip('run', runDuration, tracksRun);

  // Idle (breathing / subtle sway)
  let idleClip = null;
  if (bones['pelvis']) {
    const idleTracks = [];
    idleTracks.push(new THREE.VectorKeyframeTrack(`${bones['pelvis'].name}.position`, [0, 0.5, 1.0], [0, 0, 0, 0, -0.01, 0, 0, 0, 0]));
    if (bones['upper_arm_l']) {
      const i1 = rotXTrack('upper_arm_l', [0,0.5,1.0], [-0.05,0.05,-0.05]);
      if (i1) idleTracks.push(i1);
    }
    if (bones['upper_arm_r']) {
      const i2 = rotXTrack('upper_arm_r', [0,0.5,1.0], [0.05,-0.05,0.05]);
      if (i2) idleTracks.push(i2);
    }
    idleClip = new THREE.AnimationClip('idle', 1.2, idleTracks);
  }

  // Aim (held pose) - simple shoulder/neck rotation for fallback
  let aimClip = null;
  if (bones['upper_arm_r']) {
    const aimTracks = [];
    const a1 = rotXTrack('upper_arm_r', [0,1.0], [-0.6,-0.6]);
    if (a1) aimTracks.push(a1);
    if (bones['neck']) {
      const a2 = rotXTrack('neck', [0,1.0], [0.12,0.12]);
      if (a2) aimTracks.push(a2);
    }
    aimClip = new THREE.AnimationClip('aim', 1.0, aimTracks);
  }

  // Shoot (quick recoil snap) - short single-shot clip
  let shootClip = null;
  if (bones['upper_arm_r']) {
    const shootTracks = [];
    // quick backward jerk then return
    const s1 = rotXTrack('upper_arm_r', [0,0.08,0.18], [-0.2,-0.6,-0.25]);
    if (s1) shootTracks.push(s1);
    if (bones['lower_arm_r']) {
      const s2 = rotXTrack('lower_arm_r', [0,0.08,0.18], [0,0.4,0]);
      if (s2) shootTracks.push(s2);
    }
    shootClip = new THREE.AnimationClip('shoot', 0.25, shootTracks);
  }

  return { walkClip, runClip, idleClip, aimClip, shootClip };
}
