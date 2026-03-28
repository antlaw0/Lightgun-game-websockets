import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/utils/BufferGeometryUtils.js';

// Diagnostic logging helper (browser-based, routes to global appendDiagnostic)
function appendDiagnostic(event, details, self) {
  console.log('[DIAGNOSTIC][staticBatching] appendDiagnostic called:', event, details, self);
  if (typeof window !== 'undefined' && typeof window.appendDiagnostic === 'function') {
    window.appendDiagnostic(event, details, self);
  } else {
    console.warn('[DIAGNOSTIC][staticBatching] window.appendDiagnostic not available');
  }
}

function isShellType(wrapper) {
  const rawType = String(wrapper?._sceneDef?.type || wrapper?.type || wrapper?.mesh?.userData?.type || '').toLowerCase();
  const rawId = String(wrapper?.id || wrapper?._sceneDef?.id || '').toLowerCase();
  if (rawType === 'wall' || rawType === 'floor' || rawType === 'ceiling') return rawType;
  if (rawId.includes('wall')) return 'wall';
  if (rawId.includes('floor') || rawId.includes('tile')) return 'floor';
  if (rawId.includes('ceiling')) return 'ceiling';
  return null;
}

function collectMergeableMeshes(wrapper) {
  const meshes = [];
  if (!wrapper?.mesh) return meshes;
  wrapper.mesh.updateMatrixWorld(true);
  wrapper.mesh.traverse((node) => {
    if (!node?.isMesh) return;
    if (!node.geometry || !node.material) return;
    if (Array.isArray(node.material)) return;
    if (node.isSkinnedMesh) return;
    meshes.push(node);
  });
  return meshes;
}

function removeMergedRoomMeshes(self) {
  if (!Array.isArray(self.roomMeshes) || !self.roomMeshes.length) return;
  self.roomMeshes = self.roomMeshes.filter((mesh) => {
    if (!mesh?.userData?.isMergedStaticShell) return true;
    try {
      self.scene.remove(mesh);
      mesh.geometry?.dispose?.();
    } catch (e) {}
    return false;
  });
}

function ensureShellMergeState(self) {
  if (!self._staticShellMergeState) {
    self._staticShellMergeState = {
      merged: false,
      sourceMeshes: []
    };
  }
  return self._staticShellMergeState;
}

export function setStaticShellMerged(self, shouldMerge) {
  const state = ensureShellMergeState(self);

  if (!shouldMerge) {
    if (!state.merged) return;

    appendDiagnostic('UNMERGE_START', 'Unmerging static shell', self);
    removeMergedRoomMeshes(self);

    for (const mesh of state.sourceMeshes) {
      if (!mesh) continue;
      mesh.visible = true;
      if (Array.isArray(self.propMeshes) && !self.propMeshes.includes(mesh)) self.propMeshes.push(mesh);
    }

    // Ensure root wrappers become visible again for editor operations.
    for (const wrapper of (self.props || [])) {
      const shellType = isShellType(wrapper);
      if (!shellType || !wrapper?.mesh) continue;
      wrapper.mesh.visible = true;
    }

    state.sourceMeshes = [];
    state.merged = false;
    appendDiagnostic('UNMERGE_DONE', 'Unmerged static shell complete', self);
    console.log('[StaticBatch] unmerged static shell for editor/runtime toggle.');
    return;
  }

  const perf = self?.sceneDef?.performance || {};
  const enabled = perf.mergeStaticShell !== false && window.__DISABLE_STATIC_SHELL_MERGE !== true;
  if (!enabled) return;
  if (window.engine?.isEditorMode) return;
  if (state.merged) return;

  appendDiagnostic('MERGE_START', 'Merging static shell', self);
  removeMergedRoomMeshes(self);

  const groups = new Map();
  const sourceMeshes = new Set();

  for (const wrapper of (self.props || [])) {
    const shellType = isShellType(wrapper);
    if (!shellType) continue;
    const meshes = collectMergeableMeshes(wrapper);
    if (!meshes.length) continue;

    for (const mesh of meshes) {
      const key = `${shellType}|${mesh.material.uuid}`;
      if (!groups.has(key)) {
        groups.set(key, {
          shellType,
          material: mesh.material,
          geometries: []
        });
      }
      const entry = groups.get(key);
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      entry.geometries.push(g);
      sourceMeshes.add(mesh);
    }
  }

  let mergedCount = 0;
  for (const entry of groups.values()) {
    if (!entry.geometries.length) continue;
    const mergedGeometry = mergeGeometries(entry.geometries, false);
    if (!mergedGeometry) continue;

    const merged = new THREE.Mesh(mergedGeometry, entry.material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    merged.userData = Object.assign({}, merged.userData || {}, {
      type: 'room',
      roomPart: entry.shellType,
      isMergedStaticShell: true
    });

    self.scene.add(merged);
    self.roomMeshes.push(merged);
    mergedCount++;
  }

  if (!mergedCount) {
    appendDiagnostic('MERGE_ABORT', 'No meshes merged', self);
    return;
  }

  // Keep gameplay wrappers but remove source render meshes from draw/raycast lists.
  for (const wrapper of (self.props || [])) {
    if (!wrapper?.mesh) continue;
    let hasMergedSource = false;
    wrapper.mesh.traverse((node) => {
      if (sourceMeshes.has(node)) {
        hasMergedSource = true;
        node.visible = false;
      }
    });
    if (hasMergedSource) wrapper.mesh.visible = false;
  }

  self.propMeshes = (self.propMeshes || []).filter((mesh) => !sourceMeshes.has(mesh));
  state.sourceMeshes = Array.from(sourceMeshes);
  state.merged = true;
  appendDiagnostic('MERGE_DONE', `Merged static shell into ${mergedCount} room mesh(es)`, self);
  console.log(`[StaticBatch] merged static shell into ${mergedCount} room mesh(es).`);
}

export function buildMergedStaticShell(self) {
  return setStaticShellMerged(self, true);
}

export function unmergeStaticShell(self) {
  return setStaticShellMerged(self, false);
}