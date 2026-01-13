// js/characterLoader.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/FBXLoader.js';

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();

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

  return new Promise((resolve, reject) => {
    const isFBX = /\.fbx$/i.test(url);

    const onError = err => { console.error(`❌ Failed to load model: ${url}`, err); reject(err); };

    if (isFBX) {
      fbxLoader.load(url, fbx => {
        try {
          console.log(`✅ FBX loaded successfully: ${url}`);
          handleLoaded({ scene: fbx, animations: Array.isArray(fbx.animations) ? fbx.animations : [] });
        } catch (e) { onError(e); }
      }, undefined, onError);
    } else {
      gltfLoader.load(url, gltf => {
        try {
          console.log(`✅ GLB loaded successfully: ${url}`);
          handleLoaded(gltf);
        } catch (e) { onError(e); }
      }, undefined, onError);
    }

    function handleLoaded(gltf) {
      try {
        const model = (gltf.scene) ? gltf.scene : new THREE.Group();

        // Apply uniform scale if explicitly provided, otherwise auto-scale to targetHeight
        try {
          const desiredHeight = params.targetHeight ?? 1.7;
          if (typeof params.scale === 'number' && isFinite(params.scale)) {
            model.scale.setScalar(params.scale);
            console.log(`[characterLoader] applied explicit scale=${params.scale}`);
          } else {
            model.scale.setScalar(1);
            model.updateMatrixWorld(true);
            let box = null;
            try { box = new THREE.Box3().setFromObject(model); } catch (e) { box = null; }
            if (box && isFinite(box.min.y) && isFinite(box.max.y)) {
              const size = new THREE.Vector3(); box.getSize(size);
              const height = size.y > 0.0001 ? size.y : null;
              if (height) {
                const autoScale = desiredHeight / height;
                const final = THREE.MathUtils.clamp(autoScale, 0.0001, 10);
                model.scale.setScalar(final);
                console.log(`[characterLoader] auto-scaled model: nativeHeight=${height.toFixed(3)} -> scale=${final.toFixed(6)}`);
              } else {
                console.warn('[characterLoader] could not determine model height for auto-scaling; leaving scale=1');
              }
            } else {
              console.warn('[characterLoader] bounding box invalid for auto-scaling; leaving scale=1');
            }
          }
        } catch (e) { console.warn('[characterLoader] scale apply failed', e); }

        // Ground the model so its lowest Y sits at world Y=0 (feet on ground)
        try {
          model.updateMatrixWorld(true);
          const bb = new THREE.Box3().setFromObject(model);
          if (bb && isFinite(bb.min.y)) {
            const offsetY = bb.min.y;
            if (Math.abs(offsetY) > 1e-5) {
              model.position.y -= offsetY;
              model.updateMatrixWorld(true);
              console.log(`[characterLoader] grounded model by ${offsetY.toFixed(6)} units`);
            }
          }
        } catch (e) { /* non-fatal */ }

        // Prepare bones map and ensure materials/textures support skinning and correct encoding.
        const bones = {};
        model.traverse(o => {
          if (o.isBone) bones[o.name] = o;

          if (o.isMesh || o.isSkinnedMesh) {
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

              try { console.log('[characterLoader] bones:', Object.keys(bones)); } catch (e) {}
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
                console.log(`[characterLoader] mesh='${o.name}' mat[${idx}] type=${m.type} map=${!!m.map} mapImage=${m.map?.image ? (m.map.image.width+'x'+m.map.image.height) : 'null'}`);
              });
            } catch (e) {}

            o.castShadow = true;
            o.receiveShadow = true;
            o.visible = true;
            o.frustumCulled = false;
          }
        });

        // Extract animation clips if present
          const clips = (gltf.animations && gltf.animations.length) ? gltf.animations.slice() : [];
          try {
            clips.forEach(c => {
              try {
                const names = (c.tracks || []).map(t => t.name || t.path || '(unknown)');
                console.log(`[characterLoader] clip='${c.name || c.uuid}' trackCount=${names.length} trackNames=${JSON.stringify(names)}`);
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
              console.log(`[characterLoader] track target='${nodeName}' foundByGet=${foundByGet} foundInSkeleton=${foundInSkeleton}`);
            });
          } catch (e) {}

        // Create an AnimationMixer for this model and prepare actions map
        const mixer = new THREE.AnimationMixer(model);
        const actions = {};
        clips.forEach(clip => {
          try {
            const action = mixer.clipAction(clip);
            action.enabled = true;
            actions[clip.name || clip.uuid] = action;
          } catch (e) { console.warn('[characterLoader] failed to create action for clip', clip.name, e); }
        });

        try { console.log('[characterLoader] clips:', clips.map(c => c.name || c.uuid)); } catch (e) {}

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

        resolve({ model, clips, bones, mixer, actions, playClip, playAllSequential, stopAll, update });
      } catch (e) { reject(e); }
    }
  });
}

/**
 * Load animation clips from a model/animation file (FBX or GLTF).
 * Returns an array of AnimationClip objects (may be empty).
 */
export function loadAnimationClips(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve([]);
    const isFBX = /\.fbx$/i.test(url);
    const onError = (e) => { console.warn('[characterLoader] loadAnimationClips failed', url, e); resolve([]); };

    if (isFBX) {
      fbxLoader.load(url, fbx => {
        try { resolve(Array.isArray(fbx.animations) ? fbx.animations.slice() : []); }
        catch (e) { onError(e); }
      }, undefined, onError);
    } else {
      gltfLoader.load(url, gltf => {
        try { resolve(Array.isArray(gltf.animations) ? gltf.animations.slice() : []); }
        catch (e) { onError(e); }
      }, undefined, onError);
    }
  });
}
