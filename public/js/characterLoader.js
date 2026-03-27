// js/characterLoader.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
import { configureGltfLoaderForKtx2 } from './textureSupport.js';
import { trackLoad } from './game/loadingTracker.js';

const gltfLoader = new GLTFLoader();
configureGltfLoaderForKtx2(gltfLoader);

// Standard camera/eye height used as the reference for humanoid scaling
export const CAMERA_HEIGHT = 1.7;

function isReferenceNodeName(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  return n.includes('node_marker') || n.includes('__node_marker__');
}

function isReferenceNodeObject(obj) {
  if (!obj) return false;
  if (obj.userData && obj.userData.isReferenceNode === true) return true;
  return isReferenceNodeName(obj.name);
}

/**
 * Compute a mesh-only bounding box (ignores bones/helpers).
 * @param {THREE.Object3D} root - The model root to measure
 * @returns {THREE.Box3|null} - The bounding box or null if no meshes found
 */
export function computeMeshBoundingBox(root) {
  // Collect per-mesh bounding boxes and ignore outliers so that a single helper
  // or malformed mesh doesn't dominate the measurement. We compute a median
  // mesh height and exclude boxes far larger than the median.
  const perBoxes = [];
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o.isMesh || o.isSkinnedMesh) {
      if (isReferenceNodeObject(o)) return;
      if (!o.geometry) return;
      try {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const geomBB = o.geometry.boundingBox.clone();
        geomBB.applyMatrix4(o.matrixWorld);
        if (!isFinite(geomBB.min.y) || !isFinite(geomBB.max.y)) return;
        const size = new THREE.Vector3(); geomBB.getSize(size);
        if (!isFinite(size.y) || size.y <= 1e-8) return;
        perBoxes.push({ box: geomBB, height: size.y });
      } catch (e) { /* skip problematic geometry */ }
    }
  });

  if (perBoxes.length === 0) return null;

  // Compute median height
  const heights = perBoxes.map(b => b.height).sort((a, b) => a - b);
  const mid = Math.floor(heights.length / 2);
  const median = (heights.length % 2 === 1) ? heights[mid] : ((heights[mid - 1] + heights[mid]) / 2);

  // Allow boxes up to a multiplier of the median (reject extreme outliers)
  const maxAllowed = Math.max(median * 4, median + 0.01);
  const filtered = perBoxes.filter(p => p.height <= maxAllowed && p.height < 1000);

  const useBoxes = (filtered.length > 0) ? filtered.map(p => p.box) : perBoxes.map(p => p.box);

  const resultBox = useBoxes.reduce((acc, b) => (acc.union(b), acc), new THREE.Box3());
  return resultBox;
}

/**
 * Find the lowest Y position of foot bones in world space.
 * @param {THREE.Object3D} root - The model root containing skeleton
 * @returns {number|null} - The minimum foot Y position or null if no foot bones found
 */
export function findFootBonesMinY(root) {
  let skinned = null;
  root.traverse(o => { if (!skinned && o.isSkinnedMesh) skinned = o; });

  if (!skinned || !skinned.skeleton || !Array.isArray(skinned.skeleton.bones)) {
    return null;
  }

  // Common foot/leg bone name patterns across different rigging conventions
  const footBonePattern = /foot|toe|ankle|heel|ball|toebase|calf|shin|knee|thigh|leg|mixamorig.*foot/i;
  let footBones = skinned.skeleton.bones.filter(b => footBonePattern.test(b.name));

  // If no clear foot-named bones, fall back to taking the lowest bone in world space
  // but exclude obvious head/neck/spine bones so we don't pick a head as 'foot'.
  if (footBones.length === 0) {
    const excludeHead = /head|neck|spine|chest|jaw|eye|teeth|tooth|eye/i;
    const candidates = skinned.skeleton.bones.filter(b => !excludeHead.test(b.name));
    footBones = candidates.length ? candidates : skinned.skeleton.bones.slice();
  }

  const footYs = [];
  footBones.forEach(b => {
    try {
      const worldPos = new THREE.Vector3();
      b.getWorldPosition(worldPos);
      if (isFinite(worldPos.y)) footYs.push(worldPos.y);
    } catch (e) { /* skip */ }
  });

  return footYs.length > 0 ? Math.min(...footYs) : null;
}

/**
 * Find the highest Y position of head/neck bones in world space.
 * @param {THREE.Object3D} root
 * @returns {number|null}
 */
export function findHeadBonesMaxY(root) {
  let skinned = null;
  root.traverse(o => { if (!skinned && o.isSkinnedMesh) skinned = o; });
  if (!skinned || !skinned.skeleton || !Array.isArray(skinned.skeleton.bones)) return null;

  const headPattern = /head|neck|head_top|head_end|mixamorig.*head/i;
  let headBones = skinned.skeleton.bones.filter(b => headPattern.test(b.name));
  if (headBones.length === 0) headBones = skinned.skeleton.bones.slice();

  const ys = [];
  headBones.forEach(b => {
    try {
      const p = new THREE.Vector3(); b.getWorldPosition(p); if (isFinite(p.y)) ys.push(p.y);
    } catch (e) {}
  });
  return ys.length ? Math.max(...ys) : null;
}

/**
 * Compute the minimum Y of skinned vertices after bone transforms.
 * Samples up to `maxSamples` vertices per skinned mesh for performance.
 * @param {THREE.Object3D} root
 * @param {number} [maxSamples=500]
 * @returns {number|null} world-space minY or null if no skinned mesh found
 */
export function computeSkinnedMeshesMinY(root, maxSamples = 500) {
  let found = false;
  let globalMinY = Infinity;
  const temp = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    found = true;
    const posAttr = o.geometry.attributes.position;
    const count = posAttr.count || Math.floor(posAttr.array.length / 3);
    if (count <= 0) return;
    const step = Math.max(1, Math.floor(count / maxSamples));
    for (let i = 0; i < count; i += step) {
      try {
        // boneTransform writes the skinned vertex into temp
        o.boneTransform(i, temp);
        // convert to world space
        o.localToWorld(temp);
        if (isFinite(temp.y) && temp.y < globalMinY) globalMinY = temp.y;
      } catch (e) {
        // ignore per-vertex failures
      }
    }
  });
  return found && isFinite(globalMinY) ? globalMinY : null;
}

/**
 * Compute approximate min and max Y of skinned vertices in world space.
 * Returns null if no skinned mesh found.
 * @param {THREE.Object3D} root
 * @param {number} [maxSamples=500]
 * @returns {{minY:number,maxY:number}|null}
 */
export function computeSkinnedMeshesMinMaxY(root, maxSamples = 500) {
  let found = false;
  let globalMinY = Infinity;
  let globalMaxY = -Infinity;
  const temp = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
    found = true;
    const posAttr = o.geometry.attributes.position;
    const count = posAttr.count || Math.floor(posAttr.array.length / 3);
    if (count <= 0) return;
    const step = Math.max(1, Math.floor(count / maxSamples));
    for (let i = 0; i < count; i += step) {
      try {
        o.boneTransform(i, temp);
        o.localToWorld(temp);
        if (isFinite(temp.y)) {
          if (temp.y < globalMinY) globalMinY = temp.y;
          if (temp.y > globalMaxY) globalMaxY = temp.y;
        }
      } catch (e) {}
    }
  });
  if (!found) return null;
  if (!isFinite(globalMinY) || !isFinite(globalMaxY)) return null;
  return { minY: globalMinY, maxY: globalMaxY };
}

/**
 * Normalize and ground a model so it has the correct scale and its feet are on the ground.
 * This is the single source of truth for model scaling and grounding.
 *
 * @param {THREE.Object3D} model - The model to normalize
 * @param {Object} options - Configuration options
 * @param {number} [options.targetHeight=1.7] - Desired model height in world units
 * @param {number} [options.groundY=0] - Y position for the ground plane
 * @param {number|null} [options.explicitScale=null] - If provided, use this exact scale
 * @param {number|null} [options.scalePercent=null] - If provided, scale as percentage of auto-calculated scale
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Object} - Info about the normalization: { finalScale, finalHeight, groundOffset }
 */
export function normalizeAndGroundModel(model, options = {}) {
  const {
    targetHeight = CAMERA_HEIGHT,
    groundY = 0,
    explicitScale = null,
    scalePercent = null,
    debug = false
  } = options;

  const log = debug ? console.log.bind(console) : () => {};

  // Step 1: Reset to unit scale to measure native dimensions
  model.scale.setScalar(1);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);

  // Step 2: Measure native bounding box
  let box = computeMeshBoundingBox(model);
  if (!box || !isFinite(box.min.y) || !isFinite(box.max.y)) {
    log('[normalizeAndGroundModel] Could not compute valid bounding box');
    // continue, we'll try bone-based measurement and fallbacks
    box = null;
  }

  // Prefer skeleton-based height if available (headY - footY)
  let nativeHeight = null;
  try {
    const footY = findFootBonesMinY(model);
    const headY = findHeadBonesMaxY(model);
    if (isFinite(footY) && isFinite(headY) && headY - footY > 1e-4) {
      nativeHeight = headY - footY;
      log(`[normalizeAndGroundModel] Using bone-based native height: ${nativeHeight.toFixed(4)} (headY=${headY.toFixed(4)} footY=${footY.toFixed(4)})`);
    } else {
      // bone-based measurement failed or inverted (head below foot). Try skinned vertex sampling
      try {
        const sk = computeSkinnedMeshesMinMaxY(model, 800);
        if (sk && isFinite(sk.maxY) && isFinite(sk.minY) && (sk.maxY - sk.minY) > 1e-4) {
          nativeHeight = sk.maxY - sk.minY;
          // set box to a simple box based on sampled extents so downstream code has a bounding box
          box = new THREE.Box3(new THREE.Vector3(-1e3, sk.minY, -1e3), new THREE.Vector3(1e3, sk.maxY, 1e3));
          log(`[normalizeAndGroundModel] Using skinned-vertex native height: ${nativeHeight.toFixed(4)} (minY=${sk.minY.toFixed(4)} maxY=${sk.maxY.toFixed(4)})`);
        }
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }

  // If no bone-based measurement, fall back to mesh bounding box
  if (nativeHeight === null) {
    if (!box) {
      log('[normalizeAndGroundModel] No valid bounding box or bones available to measure height');
      return { finalScale: 1, finalHeight: null, groundOffset: 0 };
    }
    const nativeSize = new THREE.Vector3();
    box.getSize(nativeSize);
    nativeHeight = nativeSize.y;
  }

  log(`[normalizeAndGroundModel] Native height: ${nativeHeight.toFixed(4)}`);

  if (nativeHeight < 0.0001) {
    log('[normalizeAndGroundModel] Model has zero/tiny height, cannot scale');
    return { finalScale: 1, finalHeight: nativeHeight, groundOffset: 0 };
  }

  // Step 3: Calculate final scale
  let finalScale;
  const autoScale = targetHeight / nativeHeight;

  if (explicitScale !== null && isFinite(explicitScale)) {
    finalScale = explicitScale;
    log(`[normalizeAndGroundModel] Using explicit scale: ${finalScale}`);
  } else if (scalePercent !== null && isFinite(scalePercent)) {
    finalScale = autoScale * (scalePercent / 100);
    log(`[normalizeAndGroundModel] Using ${scalePercent}% of auto scale: ${finalScale}`);
  } else {
    finalScale = autoScale;
    log(`[normalizeAndGroundModel] Using auto scale: ${finalScale}`);
  }

  // Clamp to reasonable range
  finalScale = THREE.MathUtils.clamp(finalScale, 0.0001, 100);

  // Step 4: Apply uniform scale
  model.scale.setScalar(finalScale);
  model.updateMatrixWorld(true);

  // Step 5: Recalculate bounding box after scaling
  box = computeMeshBoundingBox(model);
  if (!box || !isFinite(box.min.y)) {
    log('[normalizeAndGroundModel] Could not recompute bounding box after scaling');
    return { finalScale, finalHeight: nativeHeight * finalScale, groundOffset: 0 };
  }

  const scaledSize = new THREE.Vector3();
  box.getSize(scaledSize);

  // Detailed per-mesh debug output to diagnose misaligned parts
  if (debug) {
    try {
      console.log('[normalizeAndGroundModel] Post-scale bounding box:', box.min.toArray(), box.max.toArray(), 'size=', scaledSize.toArray());
      model.traverse(o => {
        if (o.isMesh || o.isSkinnedMesh) {
          if (isReferenceNodeObject(o)) return;
          try {
            const b = new THREE.Box3().setFromObject(o);
            const s = new THREE.Vector3(); b.getSize(s);
            const c = new THREE.Vector3(); b.getCenter(c);
            console.log(`[normalizeAndGroundModel] mesh='${o.name || o.type}' minY=${b.min.y.toFixed(4)} maxY=${b.max.y.toFixed(4)} sizeY=${s.y.toFixed(4)} centerY=${c.y.toFixed(4)}`);
          } catch (e) { console.log('[normalizeAndGroundModel] mesh bbox failed for', o.name, e); }
        }
      });

      // log foot/hip/head bone positions if present
      try {
        const footY = findFootBonesMinY(model);
        console.log('[normalizeAndGroundModel] footMinY (raw) =', footY);
      } catch (e) {}
      try {
        let head = null;
        model.traverse(n => { if (!head && /head/i.test(n.name || '')) head = n; });
        if (head) { const p = new THREE.Vector3(); head.getWorldPosition(p); console.log('[normalizeAndGroundModel] head worldY =', p.y.toFixed(4)); }
      } catch (e) {}
      try {
        let hip = null;
        model.traverse(n => { if (!hip && /hip|pelvis|root/i.test(n.name || '')) hip = n; });
        if (hip) { const p = new THREE.Vector3(); hip.getWorldPosition(p); console.log('[normalizeAndGroundModel] hip worldY =', p.y.toFixed(4)); }
      } catch (e) {}
    } catch (e) { console.log('[normalizeAndGroundModel] debug traversal failed', e); }
  }

  // Step 6: Ground the model - prefer foot bones, fall back to bounding box
  let groundOffset = 0;
  let footMinY = findFootBonesMinY(model);
  // If no foot bones or bone positions look wrong, try a skinned-vertex sample fallback
  if ((footMinY === null || !isFinite(footMinY)) && typeof computeSkinnedMeshesMinMaxY === 'function') {
    try {
      const sk = computeSkinnedMeshesMinMaxY(model, 800);
      if (sk && isFinite(sk.minY)) {
        log(`[normalizeAndGroundModel] Using skinned-vertex minY fallback: ${sk.minY.toFixed(4)}`);
        footMinY = sk.minY;
        // if we didn't have a bounding box, create a small one around sampled extents
        if (!box) box = new THREE.Box3(new THREE.Vector3(-1e3, sk.minY, -1e3), new THREE.Vector3(1e3, sk.maxY || (sk.minY + 1), 1e3));
      }
    } catch (e) { /* ignore fallback errors */ }
  }

  if (footMinY !== null && isFinite(footMinY)) {
    groundOffset = groundY - footMinY;
    log(`[normalizeAndGroundModel] Grounding via foot bones/skinned-vertex, offset: ${groundOffset.toFixed(4)}`);
  } else {
    // Attempt to find a more reliable 'lower half' mesh minY (exclude head/eyes/tooth meshes)
    try {
      const centerY = (box.min.y + box.max.y) / 2;
      const excludeHead = /head|neck|eye|teeth|tooth|jaw/i;
      const meshMinYs = [];
      model.traverse(o => {
        if (o.isMesh || o.isSkinnedMesh) {
          if (isReferenceNodeObject(o)) return;
          try {
            const b = new THREE.Box3().setFromObject(o);
            if (!isFinite(b.min.y)) return;
            if (excludeHead.test(o.name || '')) return;
            if (b.min.y <= centerY) meshMinYs.push(b.min.y);
          } catch (e) {}
        }
      });
      if (meshMinYs.length) {
        const candidate = Math.min(...meshMinYs);
        groundOffset = groundY - candidate;
        log(`[normalizeAndGroundModel] Grounding via mesh-minY fallback, offset: ${groundOffset.toFixed(4)} (candidate=${candidate.toFixed(4)})`);
      } else {
        groundOffset = groundY - box.min.y;
        log(`[normalizeAndGroundModel] Grounding via bounding box, offset: ${groundOffset.toFixed(4)}`);
      }
    } catch (e) {
      groundOffset = groundY - box.min.y;
      log(`[normalizeAndGroundModel] Grounding via bounding box (error in mesh fallback), offset: ${groundOffset.toFixed(4)}`);
    }
  }

  // Apply grounding offset
  if (isFinite(groundOffset) && Math.abs(groundOffset) < 1000) {
    model.position.y += groundOffset;
    model.updateMatrixWorld(true);
  }

  log(`[normalizeAndGroundModel] Final: scale=${finalScale.toFixed(6)}, height=${scaledSize.y.toFixed(4)}, groundOffset=${groundOffset.toFixed(4)}`);

  return {
    finalScale,
    finalHeight: scaledSize.y,
    groundOffset
  };
}

/**
 * Load a character model (GLTF/GLB or FBX).
 * Accepts either a string `url` or an options object `{ url, scale, color }`.
 * Returns an object { model, clips, bones, mixer, actions, playClip, playAllSequential, stopAll, update }.
 */
export async function loadCharacter(opts) {
  const params = (typeof opts === 'string') ? { url: opts } : (opts || {});
  const url = params.url;
  const autoPlay = params.autoPlay !== undefined ? !!params.autoPlay : true;

  if (!url) return Promise.reject(new Error('characterLoader.loadCharacter: missing url'));

  const MODEL_DEBUG = /drone\.glb$|brute\.glb$/i.test(String(url)) || !!params.debug;
  try { if (MODEL_DEBUG) console.log(`[characterLoader] loadCharacter called for url='${url}' autoPlay=${autoPlay}`); } catch(e) {}

  const _charLoadPromise = new Promise((resolve, reject) => {
    const onError = err => { console.error(`❌ Failed to load model: ${url}`, err); reject(err); };

    gltfLoader.load(url, gltf => {
      try {
        if (MODEL_DEBUG) console.log(`✅ GLB loaded successfully: ${url}`);
        handleLoaded(gltf);
      } catch (e) { onError(e); }
    }, undefined, onError);

    function handleLoaded(gltf) {
      try {
        const model = (gltf.scene) ? gltf.scene : new THREE.Group();
        if (MODEL_DEBUG) {
          try {
            // Extra instrumentation for problematic models (brute/drone)
            try {
              const skSample = typeof computeSkinnedMeshesMinMaxY === 'function' ? computeSkinnedMeshesMinMaxY(model, 800) : null;
              if (skSample) console.log('[characterLoader] SKINNED sample min/maxY =', skSample.minY.toFixed(4), skSample.maxY.toFixed(4));
              else console.log('[characterLoader] SKINNED sample = null');
            } catch (e) { console.log('[characterLoader] skinned sample error', e); }
            try {
              const bb = computeMeshBoundingBox(model);
              if (bb) console.log('[characterLoader] pre-normalize meshBox minY,maxY =', bb.min.y.toFixed(4), bb.max.y.toFixed(4));
              else console.log('[characterLoader] pre-normalize meshBox = null');
            } catch (e) { console.log('[characterLoader] pre-normalize bbox error', e); }
          } catch (e) { console.log('[characterLoader] MODEL_DEBUG instrumentation failed', e); }
          try {
            const pj = gltf.parser && gltf.parser.json ? gltf.parser.json : null;
            try { console.log('[characterLoader] gltf.json.materials =', pj && pj.materials ? JSON.stringify(pj.materials, null, 2) : null); } catch(e){ console.log('[characterLoader] gltf.json.materials (raw) =', pj && pj.materials ? pj.materials : null); }
            try { console.log('[characterLoader] gltf.json.textures =', pj && pj.textures ? JSON.stringify(pj.textures, null, 2) : null); } catch(e){ console.log('[characterLoader] gltf.json.textures (raw) =', pj && pj.textures ? pj.textures : null); }
            try { console.log('[characterLoader] gltf.json.images =', pj && pj.images ? JSON.stringify(pj.images, null, 2) : null); } catch(e){ console.log('[characterLoader] gltf.json.images (raw) =', pj && pj.images ? pj.images : null); }
          } catch (e) { console.log('[characterLoader] failed to log gltf.json materials/textures/images', e); }
        }

        // Ensure skeletons are at their bind/rest pose before measuring bounding boxes.
        try {
          model.traverse(o => {
            if (o.isSkinnedMesh && o.skeleton) {
              try { o.skeleton.pose(); } catch (e) { /* ignore */ }
            }
          });
        } catch (e) {}

        // Use the centralized normalizeAndGroundModel for consistent scaling and grounding
        // This ensures all models are properly scaled to target height and have feet on ground
        try {
          const normResult = normalizeAndGroundModel(model, {
            targetHeight: params.targetHeight ?? CAMERA_HEIGHT,
            groundY: params.groundY ?? 0,
            explicitScale: (typeof params.scale === 'number' && isFinite(params.scale)) ? params.scale : null,
            scalePercent: params.scalePercent ?? null,
            debug: MODEL_DEBUG
          });
          if (MODEL_DEBUG) {
            console.log(`[characterLoader] normalized model: scale=${normResult.finalScale?.toFixed(6)}, height=${normResult.finalHeight?.toFixed(4)}, groundOffset=${normResult.groundOffset?.toFixed(4)}`);
          }
        } catch (e) { console.warn('[characterLoader] normalizeAndGroundModel failed', e); }

        // Prepare bones map and ensure materials/textures support skinning and correct encoding.
        const bones = {};
        model.traverse(o => {
          if (o.isBone) bones[o.name] = o;

          if (o.isMesh || o.isSkinnedMesh) {
            if (isReferenceNodeObject(o)) {
              try {
                o.userData = Object.assign({}, o.userData || {}, { isReferenceNode: true });
                o.visible = false;
                o.castShadow = false;
                o.receiveShadow = false;
                o.frustumCulled = true;
                o.raycast = () => {};
              } catch (e) {}
              return;
            }
            const handleMaterial = mat => {
              if (!mat) return;
              if (mat.isMaterial && !mat._clonedForCharacterLoader) {
                mat = mat.clone();
                mat._clonedForCharacterLoader = true;
              }
              if (o.isSkinnedMesh) mat.skinning = true;
              const maps = ['map', 'aoMap', 'emissiveMap', 'lightMap'];
              maps.forEach(k => {
                if (mat[k]) {
                  try {
                    if ('colorSpace' in mat[k]) mat[k].colorSpace = THREE.SRGBColorSpace;
                    else mat[k].encoding = THREE.sRGBEncoding;
                  } catch (e) {}
                }
              });

              try { if (MODEL_DEBUG) console.log('[characterLoader] bones:', Object.keys(bones)); } catch (e) {}
              if (mat.alphaTest > 0 || mat.opacity < 1) mat.transparent = true;
              if (!mat.side) mat.side = THREE.DoubleSide;
              mat.needsUpdate = true;
              return mat;
            };

            try {
              if (Array.isArray(o.material)) {
                o.material = o.material.map(m => handleMaterial(m) || m);
              } else {
                o.material = handleMaterial(o.material) || o.material;
              }
            } catch (e) { console.warn('[characterLoader] material handling failed', e); }

            try {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach((m, idx) => {
                if (!m) return;
                    if (MODEL_DEBUG) {
                      try {
                        const mapPresent = !!m.map;
                        const mapImg = m.map?.image ? (m.map.image.width+'x'+m.map.image.height) : 'null';
                        const colorHex = (m.color && typeof m.color.getHexString === 'function') ? ('#'+m.color.getHexString()) : String(m.color || 'n/a');
                        const emissiveHex = (m.emissive && typeof m.emissive.getHexString === 'function') ? ('#'+m.emissive.getHexString()) : String(m.emissive || 'n/a');
                        console.log(`[characterLoader] mesh='${o.name}' mat[${idx}] type=${m.type} map=${mapPresent} mapImage=${mapImg} color=${colorHex} emissive=${emissiveHex} metalness=${m.metalness} roughness=${m.roughness} vertexColors=${!!m.vertexColors}`);
                      } catch(e) { console.log('[characterLoader] material log error', e); }
                    }
              });
            } catch (e) {}

            o.castShadow = true;
            o.receiveShadow = true;
            o.visible = true;
            o.frustumCulled = false;
          }
        });

        // Ensure any SkinnedMesh objects are properly bound to their skeletons so
        // AnimationMixer PropertyBindings targeting bones resolve correctly.
        try {
          model.traverse(o => {
            if (o.isSkinnedMesh && o.skeleton) {
              try {
                // If bind matrix not present, provide a safe default
                const bindMat = o.bindMatrix || new THREE.Matrix4();
                try { o.bind(o.skeleton, bindMat); } catch (e) { /* ignore binding failures */ }
              } catch (e) { /* ignore per-object failures */ }
            }
          });
        } catch (e) { /* ignore */ }

        // Extract animation clips if present
          const rawClips = (gltf.animations && gltf.animations.length) ? gltf.animations.slice() : [];
          // Sanitize clips: remove any scale tracks to avoid animation-driven scaling
          const clips = rawClips.map(c => {
            try {
              const filtered = (c.tracks || []).filter(t => {
                const tn = String(t.name || t.path || '');
                return !/\.scale(\b|$)/i.test(tn);
              });
              return new THREE.AnimationClip(c.name || c.uuid, c.duration || -1, filtered);
            } catch (e) { return c; }
          });

          try {
            clips.forEach(c => {
              try {
                const names = (c.tracks || []).map(t => t.name || t.path || '(unknown)');
                if (MODEL_DEBUG) console.log(`[characterLoader] clip='${c.name || c.uuid}' trackCount=${names.length} trackNames=${JSON.stringify(names)}`);
              } catch (e) {}
            });
          } catch (e) {}

          // Check whether track target nodes actually exist on the model or in any skeletons
          try {
            const referenced = new Set();
            clips.forEach(c => {
              (c.tracks || []).forEach(t => {
                const tn = (t.name || t.path || '').split('.')[0];
                if (tn) referenced.add(tn);
              });
            });
            referenced.forEach(nodeName => {
              const foundByGet = !!model.getObjectByName(nodeName);
              let foundInSkeleton = false;
              model.traverse(o => {
                if (o.isSkinnedMesh && o.skeleton && Array.isArray(o.skeleton.bones)) {
                  if (o.skeleton.bones.find(b => b && b.name === nodeName)) foundInSkeleton = true;
                }
              });
              if (MODEL_DEBUG) console.log(`[characterLoader] track target='${nodeName}' foundByGet=${foundByGet} foundInSkeleton=${foundInSkeleton}`);
            });
          } catch (e) {}

        // Create an AnimationMixer for this model and prepare actions map
        const mixer = new THREE.AnimationMixer(model);
        const actions = {};
        clips.forEach(clip => {
          try {
            const action = mixer.clipAction(clip);
            action.enabled = true;
            action.clampWhenFinished = true;
            try { action.setEffectiveWeight(1.0); } catch (e) {}
            actions[clip.name || clip.uuid] = action;
          } catch (e) { console.warn('[characterLoader] failed to create action for clip', clip.name, e); }
        });

        try { if (MODEL_DEBUG) console.log('[characterLoader] clips:', clips.map(c => c.name || c.uuid)); } catch (e) {}

        if (autoPlay && clips.length) {
          try {
            const first = clips[0];
            const firstAction = actions[first.name || first.uuid];
            if (firstAction) {
              firstAction.reset();
              firstAction.setLoop(THREE.LoopRepeat, Infinity);
              firstAction.play();
            }
          } catch (e) { console.warn('[characterLoader] autoplay failed', e); }
        }

        // After actions are created and possibly played, sample the mixer once (time=0)
        // and recompute grounding to correct offsets introduced by animation root transforms.
        try {
          mixer.update(0);
          // Recompute foot-based grounding now that bones have been posed by the mixer
          let postFootY = findFootBonesMinY(model);
          if ((postFootY === null || !isFinite(postFootY)) && typeof computeSkinnedMeshesMinMaxY === 'function') {
            try {
              const sk = computeSkinnedMeshesMinMaxY(model, 1000);
              if (sk && isFinite(sk.minY)) {
                if (MODEL_DEBUG) console.log(`[characterLoader] post-mixer skinned-vertex minY = ${sk.minY.toFixed(4)}`);
                postFootY = sk.minY;
              }
            } catch (e) { /* ignore */ }
          }

          if (isFinite(postFootY) && postFootY !== null) {
            const desiredGround = params.groundY ?? 0;
            const delta = desiredGround - postFootY;
            if (isFinite(delta) && Math.abs(delta) < 1000) {
              model.position.y += delta;
              model.updateMatrixWorld(true);
              if (MODEL_DEBUG) console.log(`[characterLoader] post-animation grounding adjusted by ${delta.toFixed(4)}`);
            }
          } else if (MODEL_DEBUG) {
            console.log('[characterLoader] post-animation grounding: no foot bones or skinned-vertex fallback found');
          }

          // Optional: dump per-mesh minY for debugging problematic models
          if (MODEL_DEBUG) {
            try {
              model.traverse(o => {
                if (o.isMesh || o.isSkinnedMesh) {
                  try {
                    const b = new THREE.Box3().setFromObject(o);
                    if (isFinite(b.min.y) && isFinite(b.max.y)) {
                      console.log(`[characterLoader] mesh='${o.name || o.type}' minY=${b.min.y.toFixed(4)} maxY=${b.max.y.toFixed(4)} sizeY=${(b.max.y-b.min.y).toFixed(4)}`);
                    }
                  } catch (e) {}
                }
              });
            } catch (e) {}
          }
        } catch (e) { if (MODEL_DEBUG) console.warn('[characterLoader] post-mixer grounding failed', e); }

        const playClip = (id, loop = THREE.LoopRepeat) => {
          let action = null;
          if (typeof id === 'number') {
            const clip = clips[id]; if (!clip) return null; action = actions[clip.name || clip.uuid];
          } else {
            action = actions[id] || actions[clips.find(c => c.name === id)?.name];
          }
          if (!action) return null; action.reset(); action.setLoop(loop, Infinity); action.play(); return action;
        };

        const stopAll = () => { Object.values(actions).forEach(a => { try { a.stop(); } catch (e) {} }); };

        const playAllSequential = (crossfade = 0.25) => {
          if (!clips.length) return;
          let idx = 0;
          const playNext = prevAction => {
            if (prevAction) prevAction.crossFadeTo(actions[clips[idx].name || clips[idx].uuid], crossfade, false);
            const clip = clips[idx]; const action = actions[clip.name || clip.uuid];
            if (!action) { idx++; if (idx < clips.length) playNext(null); return; }
            action.reset(); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
            const onFinished = e => { mixer.removeEventListener('finished', onFinished); idx++; if (idx < clips.length) playNext(action); };
            mixer.addEventListener('finished', onFinished);
          };
          playNext(null);
        };

        const update = delta => { try { mixer.update(delta); } catch (e) {} };

        // DEBUG: Check for any unexpected sphere geometries in the model
        try {
          const spheres = [];
          model.traverse(obj => {
            if (obj.isMesh && obj.geometry && obj.geometry.type === 'SphereGeometry') {
              spheres.push({
                name: obj.name,
                visible: obj.visible,
                scale: obj.scale.clone(),
                position: obj.position.clone(),
                params: obj.geometry.parameters
              });
            }
          });
          if (spheres.length > 0) {
            console.warn(`[characterLoader] Found ${spheres.length} SphereGeometry in loaded model: ${url}`);
            spheres.forEach((s, idx) => {
              console.warn(`  [${idx}] name='${s.name}' visible=${s.visible} scale=(${s.scale.x.toFixed(3)}, ${s.scale.y.toFixed(3)}, ${s.scale.z.toFixed(3)})`, s.params);
            });
          }
        } catch (e) {}

        resolve({ model, clips, bones, mixer, actions, playClip, playAllSequential, stopAll, update });
      } catch (e) { reject(e); }
    }
  });
  trackLoad(_charLoadPromise);
  return _charLoadPromise;
}

/**
 * Load animation clips from a model/animation file (FBX or GLTF).
 * Returns an array of AnimationClip objects (may be empty).
 */
export function loadAnimationClips(url) {
  const _animLoadPromise = new Promise((resolve, reject) => {
    if (!url) return resolve([]);
    const onError = (e) => { console.warn('[characterLoader] loadAnimationClips failed', url, e); resolve([]); };

    gltfLoader.load(url, gltf => {
      try { resolve(Array.isArray(gltf.animations) ? gltf.animations.slice() : []); }
      catch (e) { onError(e); }
    }, undefined, onError);
  });
  trackLoad(_animLoadPromise);
  return _animLoadPromise;
}

// Debug helper: call from browser console to quickly load and inspect a model
if (typeof window !== 'undefined') {
  window.__charLoaderTest = async function(url) {
    try {
      console.log('[__charLoaderTest] loading', url);
      const res = await loadCharacter({ url, debug: true, autoPlay: false, groundY: 0 });
      console.log('[__charLoaderTest] result:', {
        model: res.model,
        clips: res.clips.map(c => c.name || c.uuid),
        bones: Object.keys(res.bones || {}),
      });
      // sample mixer a bit to ensure poses applied
      try { res.mixer.update(0); } catch (e) {}
      return res;
    } catch (e) { console.error('[__charLoaderTest] failed', e); throw e; }
  };
}
