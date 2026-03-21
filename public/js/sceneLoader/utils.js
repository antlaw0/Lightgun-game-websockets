import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Phase 1 scaffold: utility helpers extracted from sceneLoader.js in later phases.

export function ensureUv2ForAo(mesh) {
  const geometry = mesh?.geometry;
  if (!geometry || !geometry.attributes || geometry.attributes.uv2 || !geometry.attributes.uv) return;
  geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));
}

export function meshHasAoMap(material) {
  if (!material) return false;
  if (Array.isArray(material)) return material.some((m) => !!m?.aoMap);
  return !!material.aoMap;
}

export function cloneDef(def) {
  if (!def || typeof def !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(def));
  } catch (e) {
    return { ...def };
  }
}

export function toRadiansIfNeeded(value) {
  const n = Number(value ?? 0);
  return Math.abs(n) > (Math.PI * 2 + 0.0001) ? THREE.MathUtils.degToRad(n) : n;
}

export function isReferenceNodeName(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  return n.includes('node_marker') || n.includes('__node_marker__');
}

export function isReferenceNodeObject(obj) {
  if (!obj) return false;
  if (obj.userData && obj.userData.isReferenceNode === true) return true;
  return isReferenceNodeName(obj.name);
}
