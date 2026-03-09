export function attachEditorInputController({
  setEditorMode,
  logDebug,
  spawnEditorObject,
  showLightPicker,
  selectObjectFromCenter,
  openEditSelectedJSON,
  clearHighlight,
  snapVector3ToEditorGrid,
  syncWrapperAuthoredPositionFromMesh,
  getAuthoredPositionForObject
}) {
  const listeners = [];

  function add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  add(window, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if (e.code === 'F2') {
      setEditorMode(!window.engine.isEditorMode);
      logDebug(`Editor mode: ${window.engine.isEditorMode ? 'ON' : 'OFF'}`);
    }
  });

  add(window, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if (!window.engine?.isEditorMode) return;
    if (e.code === 'Digit1') {
      e.preventDefault();
      spawnEditorObject('wall');
    } else if (e.code === 'Digit2') {
      e.preventDefault();
      spawnEditorObject('door');
    } else if (e.code === 'Digit3') {
      e.preventDefault();
      showLightPicker();
    } else if (e.code === 'Digit4') {
      e.preventDefault();
      spawnEditorObject('crate');
    }
  });

  add(window, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if (!window.engine?.isEditorMode) return;
    if (e.code === 'KeyG') {
      e.preventDefault();
      const g = (window.engine.editorGrid = window.engine.editorGrid || {
        sizes: [0, 1, 0.5, 0.25],
        index: 0,
        size: 0
      });
      g.index = (g.index + 1) % g.sizes.length;
      g.size = g.sizes[g.index];
      try {
        window.updateEditorGrid();
      } catch (_) {}
      logDebug(`Editor grid: ${g.size === 0 ? 'OFF' : g.size}`);
    }
  });

  add(window, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if (!window.engine?.isEditorMode) return;
    if (e.code === 'KeyE') {
      e.preventDefault();
      selectObjectFromCenter();
    }
  });

  add(window, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if (!window.engine?.isEditorMode) return;
    if (e.code === 'KeyT') {
      e.preventDefault();
      console.log('KeyT pressed - attempting to open JSON editor');
      openEditSelectedJSON();
    }
  });

  add(window, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if (!window.engine?.isEditorMode) return;
    if (!window.selectedObject) return;

    let baseStep = 0.1;
    try {
      const gs = window.engine?.editorGrid?.size;
      if (gs && gs > 0) baseStep = gs;
    } catch (_) {}

    let step = baseStep;
    if (e.shiftKey) step = baseStep / 10;
    else if (e.ctrlKey) step = baseStep / 100;

    const obj = window.selectedObject;
    const mesh = obj.mesh;
    if (!mesh) return;

    let moved = false;

    switch (e.code) {
      case 'ArrowUp':
        mesh.position.z -= step;
        moved = true;
        e.preventDefault();
        break;
      case 'ArrowDown':
        mesh.position.z += step;
        moved = true;
        e.preventDefault();
        break;
      case 'ArrowLeft':
        mesh.position.x -= step;
        moved = true;
        e.preventDefault();
        break;
      case 'ArrowRight':
        mesh.position.x += step;
        moved = true;
        e.preventDefault();
        break;
      case 'PageUp':
        mesh.position.y += step;
        moved = true;
        e.preventDefault();
        break;
      case 'PageDown':
        mesh.position.y -= step;
        moved = true;
        e.preventDefault();
        break;
      case 'KeyR':
        mesh.rotation.y += Math.PI / 2;
        moved = true;
        e.preventDefault();
        break;
      case 'Delete':
      case 'Backspace':
        try {
          if (mesh.parent) mesh.parent.remove(mesh);

          const sl = window.sceneLoader;
          if (sl) {
            const pidx = sl.props.findIndex((p) => p === obj || p.id === obj.id);
            if (pidx >= 0) {
              const p = sl.props.splice(pidx, 1)[0];
              if (p.id) delete sl.propsById[p.id];
            }

            const sidx = sl.staticObjects.findIndex((s) => s === obj || s.id === obj.id);
            if (sidx >= 0) sl.staticObjects.splice(sidx, 1);

            try {
              if (sl.sceneDef && sl.sceneDef.environment && Array.isArray(sl.sceneDef.environment.staticObjects)) {
                const aidx = sl.sceneDef.environment.staticObjects.findIndex(
                  (s) => s && ((s.id && obj.id && s.id === obj.id) || s === obj)
                );
                if (aidx >= 0) sl.sceneDef.environment.staticObjects.splice(aidx, 1);
              }
              if (obj.light && sl.sceneDef && Array.isArray(sl.sceneDef.lights)) {
                const lidx = sl.sceneDef.lights.findIndex((l) => l && l.id && obj.id && l.id === obj.id);
                if (lidx >= 0) sl.sceneDef.lights.splice(lidx, 1);
              }
            } catch (_) {}

            if (obj.light) {
              const li = sl.sceneLights.indexOf(obj.light);
              if (li >= 0) sl.sceneLights.splice(li, 1);
            }
          }

          clearHighlight(window.selectedObject);
          window.selectedObject = null;
          logDebug('Editor: object deleted');
        } catch (err) {
          console.warn('Delete failed', err);
        }
        e.preventDefault();
        return;
    }

    if (moved) {
      try {
        if (window.engine?.editorGrid?.size) snapVector3ToEditorGrid(mesh.position);
      } catch (_) {}

      try {
        syncWrapperAuthoredPositionFromMesh(obj);
        if (obj.rotation) {
          obj.rotation.x = mesh.rotation.x;
          obj.rotation.y = mesh.rotation.y;
          obj.rotation.z = mesh.rotation.z;
        } else {
          obj.rotation = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
        }
        if (obj.size && mesh.geometry && mesh.geometry.parameters) {
          const p = mesh.geometry.parameters;
          if (p.width !== undefined) obj.size.x = p.width * mesh.scale.x;
          if (p.height !== undefined) obj.size.y = p.height * mesh.scale.y;
          if (p.depth !== undefined) obj.size.z = p.depth * mesh.scale.z;
        }
        if (obj._editorHighlight) obj._editorHighlight.update();
        const authoredPos = getAuthoredPositionForObject(obj) || mesh.position;
        logDebug(
          `Editor: moved/rotated ${obj.id || '(no-id)'} -> ${authoredPos.x.toFixed(3)},${authoredPos.y.toFixed(3)},${authoredPos.z.toFixed(3)}`
        );
      } catch (e2) {
        console.warn('sync after move failed', e2);
      }
      e.preventDefault();
    }
  });

  return {
    detach() {
      while (listeners.length) {
        const off = listeners.pop();
        try {
          off();
        } catch (_) {}
      }
    }
  };
}
