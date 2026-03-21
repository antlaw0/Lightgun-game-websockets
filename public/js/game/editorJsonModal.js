export function setupEditorJsonModal({
  THREE,
  cleanStaticObject,
  cleanLightObject,
  authoredToRuntimePosition,
  syncWrapperAuthoredPositionFromMesh
}) {
  function getEditableDefForSelected() {
    const sel = window._editorModalTarget || window.selectedObject;
    if (!sel) return null;
    try {
      const def = cleanStaticObject(sel);
      if (sel.hp !== undefined) def.hp = sel.hp;
      if (sel.coverType) def.coverType = sel.coverType;
      if (sel.type) def.type = sel.type;
      if (sel.type === 'light') return cleanLightObject(sel);
      if (sel.size) def.size = Object.assign({}, sel.size);
      return def;
    } catch (_) {
      return { id: sel.id || null, type: sel.type || null };
    }
  }

  function formatAsJsLiteral(obj, indent = 4, level = 0) {
    const pad = (n) => ' '.repeat(n);
    const cur = pad(level * indent);
    const next = pad((level + 1) * indent);

    if (obj === null) return 'null';
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      const items = obj
        .map((it) => {
          if (typeof it === 'object') return formatAsJsLiteral(it, indent, level + 1);
          return typeof it === 'string' ? JSON.stringify(it) : String(it);
        })
        .map((s) => next + s)
        .join(',\n');
      return '[\n' + items + '\n' + cur + ']';
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '{}';
      const lines = keys.map((k) => {
        const v = obj[k];
        let valStr;
        if (typeof v === 'object') valStr = formatAsJsLiteral(v, indent, level + 1);
        else if (typeof v === 'string') valStr = JSON.stringify(v);
        else valStr = String(v);
        return next + k + ': ' + valStr;
      });
      return '{\n' + lines.join(',\n') + '\n' + cur + '}';
    }

    if (typeof obj === 'string') return JSON.stringify(obj);
    return String(obj);
  }

  function installModalFocusTrap(modal) {
    if (!modal) return;
    if (modal._focusTrapInstalled) return;
    modal._focusTrapInstalled = true;
    modal._focusHandler = function(e) {
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll('button, [href], textarea, input, select, [tabindex]:not([tabindex="-1"])');
      const list = Array.from(focusable).filter((el) => !el.hasAttribute('disabled'));
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', modal._focusHandler);
  }

  function removeModalFocusTrap() {
    const modal = document.getElementById('jsonEditModal');
    if (!modal || !modal._focusTrapInstalled) return;
    document.removeEventListener('keydown', modal._focusHandler);
    modal._focusTrapInstalled = false;
    modal._focusHandler = null;
  }

  function validateEditedDef(obj) {
    const errors = [];
    if (typeof obj !== 'object' || obj === null) {
      errors.push('Top-level JSON must be an object');
      return errors;
    }

    if (obj.position) ['x', 'y', 'z'].forEach((k) => { if (obj.position[k] === undefined || typeof obj.position[k] !== 'number') errors.push(`position.${k} must be a number`); });
    if (obj.rotation) ['x', 'y', 'z'].forEach((k) => { if (obj.rotation[k] === undefined || typeof obj.rotation[k] !== 'number') errors.push(`rotation.${k} must be a number`); });
    if (obj.scale) ['x', 'y', 'z'].forEach((k) => { if (obj.scale[k] === undefined || typeof obj.scale[k] !== 'number') errors.push(`scale.${k} must be a number`); });
    if (obj.size) ['x', 'y', 'z'].forEach((k) => { if (obj.size[k] === undefined || typeof obj.size[k] !== 'number') errors.push(`size.${k} must be a number`); });
    if (obj.hitSounds && !Array.isArray(obj.hitSounds)) errors.push('hitSounds must be an array of sound paths');
    if (obj.texture && typeof obj.texture !== 'string') errors.push('texture must be a string path');
    return errors;
  }

  function closeEditModal() {
    const modal = document.getElementById('jsonEditModal');
    modal.style.display = 'none';
    Array.from(document.body.children).forEach((ch) => {
      if (ch.id !== 'jsonEditModal') ch.removeAttribute('aria-hidden');
    });
    removeModalFocusTrap();
    try {
      if (window._lastFocusedBeforeModal && typeof window._lastFocusedBeforeModal.focus === 'function') {
        window._lastFocusedBeforeModal.focus();
      }
    } catch (_) {}
    window._editorModalOpen = false;
    window._editorModalTarget = null;
  }

  function openEditSelectedJSON() {
    if (!window.engine?.isEditorMode) return;
    const sel = window._editorModalTarget || window.selectedObject;
    if (!sel) {
      alert('No object selected');
      return;
    }

    const modal = document.getElementById('jsonEditModal');
    const ta = document.getElementById('jsonEditInput');
    const title = document.getElementById('jsonEditTitle');
    const errs = document.getElementById('jsonEditErrors');

    window._lastFocusedBeforeModal = document.activeElement;
    Array.from(document.body.children).forEach((ch) => {
      if (ch.id !== 'jsonEditModal') ch.setAttribute('aria-hidden', 'true');
    });
    errs.textContent = '';
    const def = getEditableDefForSelected();
    title.textContent = `Edit Object JSON - ${def.id || '(no-id)'} `;
    try {
      ta.value = formatAsJsLiteral(def, 4);
    } catch (_) {
      ta.value = '{}';
    }
    modal.style.display = 'flex';
    setTimeout(() => {
      try {
        ta.focus();
        ta.setSelectionRange(0, 0);
      } catch (_) {}
    }, 50);

    installModalFocusTrap(modal);
    window._editorModalOpen = true;
    window._editorModalTarget = sel;
  }

  function applyEditedJSON() {
    const ta = document.getElementById('jsonEditInput');
    const errsHost = document.getElementById('jsonEditErrors');
    errsHost.textContent = '';

    let parsed;
    const raw = ta.value;
    try {
      parsed = JSON.parse(raw);
    } catch (e1) {
      try {
        const quoted = raw.replace(/([\{,\n\r\s])([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
        parsed = JSON.parse(quoted);
      } catch (e2) {
        try {
          parsed = Function('"use strict"; return (' + raw + ')')();
        } catch (e3) {
          errsHost.textContent =
            'JSON parse error: ' +
            e1.message +
            ' — fallback parse failed: ' +
            (e2?.message || e3?.message || 'invalid input');
          try {
            if (window.speak) window.speak('JSON parse error', { interrupt: true });
          } catch (_) {}
          return;
        }
      }
    }

    const sel = window._editorModalTarget || window.selectedObject;
    const oldSize = sel && sel.size ? { x: sel.size.x, y: sel.size.y, z: sel.size.z } : null;
    const errors = validateEditedDef(parsed);
    if (errors.length) {
      errsHost.innerHTML = errors.map((s) => `- ${s}`).join('<br>');
      try {
        if (window.speak) window.speak('Errors found, changes not applied', { interrupt: true });
      } catch (_) {}
      return;
    }

    if (!sel) {
      errsHost.textContent = 'No selected object';
      return;
    }

    try {
      sel._sceneDef = parsed;
    } catch (_) {}

    const oldId = sel.id;
    if (parsed.id && parsed.id !== oldId) {
      sel.id = parsed.id;
      const sl = window.sceneLoader;
      try {
        if (sl) {
          if (sl.propsById && oldId && sl.propsById[oldId]) {
            delete sl.propsById[oldId];
            sl.propsById[sel.id] = sel;
          }
          if (sl.enemiesById && oldId && sl.enemiesById[oldId]) {
            delete sl.enemiesById[oldId];
            sl.enemiesById[sel.id] = sel;
          }
        }
      } catch (_) {}
    }

    try {
      if (sel.mesh) {
        let preScaleMinY = null;
        const hasScaleEdit = !!(parsed.size || parsed.scale);
        if (hasScaleEdit) {
          try {
            sel.mesh.updateMatrixWorld(true);
            const beforeBox = new THREE.Box3().setFromObject(sel.mesh);
            if (beforeBox && isFinite(beforeBox.min.y)) preScaleMinY = beforeBox.min.y;
          } catch (_) {}
        }

        if (parsed.position) {
          const runtimePos = authoredToRuntimePosition(sel, parsed.position, parsed) || parsed.position;
          sel.mesh.position.set(runtimePos.x, runtimePos.y, runtimePos.z);
        }
        if (parsed.rotation) sel.mesh.rotation.set(parsed.rotation.x, parsed.rotation.y, parsed.rotation.z);
        if (parsed.size) {
          try {
            const ms = sel.mesh.scale || { x: 1, y: 1, z: 1 };
            if (oldSize && oldSize.x && oldSize.y && oldSize.z) {
              const fx = parsed.size.x / oldSize.x;
              const fy = parsed.size.y / oldSize.y;
              const fz = parsed.size.z / oldSize.z;
              sel.mesh.scale.set((ms.x || 1) * fx, (ms.y || 1) * fy, (ms.z || 1) * fz);
            } else {
              sel.mesh.scale.set(parsed.size.x, parsed.size.y, parsed.size.z);
            }
          } catch (_) {}
          sel.size = parsed.size;
        }
        if (parsed.scale) sel.mesh.scale.set(parsed.scale.x, parsed.scale.y, parsed.scale.z);

        // Preserve floor contact when resizing so a rebuild doesn't leave the mesh floating/sunk.
        if (hasScaleEdit && preScaleMinY !== null) {
          try {
            sel.mesh.updateMatrixWorld(true);
            const afterBox = new THREE.Box3().setFromObject(sel.mesh);
            if (afterBox && isFinite(afterBox.min.y)) {
              const dy = preScaleMinY - afterBox.min.y;
              if (Math.abs(dy) > 1e-6) {
                sel.mesh.position.y += dy;
                sel.mesh.updateMatrixWorld(true);
              }
            }
          } catch (_) {}
        }

        syncWrapperAuthoredPositionFromMesh(sel);
        sel.rotation = { x: sel.mesh.rotation.x, y: sel.mesh.rotation.y, z: sel.mesh.rotation.z };

        if (!sel.mesh.userData) sel.mesh.userData = {};
        if (sel.id) sel.mesh.userData.propId = sel.id;
        if (sel.type || parsed.type) sel.mesh.userData.type = parsed.type ?? sel.type;

        if (parsed.texture && typeof parsed.texture === 'string') {
          try {
            const loader = new THREE.TextureLoader();
            const tex = loader.load(parsed.texture, () => {
              try {
                if (sel.mesh && sel.mesh.material) {
                  sel.mesh.material.map = tex;
                  sel.mesh.material.needsUpdate = true;
                }
              } catch (_) {}
            });
          } catch (e) {
            console.warn('Failed to load texture', e);
          }
        }

        if (parsed.hitSounds && Array.isArray(parsed.hitSounds)) {
          sel.hitSounds = parsed.hitSounds.slice();
        }

        if (parsed.hp !== undefined) sel.hp = parsed.hp;
        if (parsed.maxHp !== undefined) sel.maxHp = parsed.maxHp;
        if (parsed.indestructible !== undefined) sel.indestructible = !!parsed.indestructible;
      } else {
        if (parsed.position) sel.position = parsed.position;
        if (parsed.rotation) sel.rotation = parsed.rotation;
      }

      if (sel.light || (sel.type === 'light' && sel.mesh)) {
        const light = sel.light || (sel.mesh && sel.mesh.children && sel.mesh.children.find((c) => c.isLight));
        const holder = sel.mesh || null;
        if (holder && parsed.position) holder.position.set(parsed.position.x, parsed.position.y, parsed.position.z);
        if (light) {
          if (parsed.color !== undefined) {
            try {
              if (typeof parsed.color === 'number') light.color.setHex(parsed.color);
              else light.color.set(parsed.color);
            } catch (_) {}
          }
          if (parsed.intensity !== undefined) light.intensity = parsed.intensity;
          if (parsed.distance !== undefined) light.distance = parsed.distance;
          if (parsed.decay !== undefined) light.decay = parsed.decay;
          if (parsed.angle !== undefined) light.angle = parsed.angle;
          if (parsed.penumbra !== undefined) light.penumbra = parsed.penumbra;
          if (parsed.castShadow !== undefined) light.castShadow = !!parsed.castShadow;
          if (light.isHemisphereLight) {
            if (parsed.groundColor !== undefined) {
              try {
                if (typeof parsed.groundColor === 'number') light.groundColor.setHex(parsed.groundColor);
                else light.groundColor.set(parsed.groundColor);
              } catch (_) {}
            }
            if (parsed.skyColor !== undefined) {
              try {
                if (typeof parsed.skyColor === 'number') light.color.setHex(parsed.skyColor);
                else light.color.set(parsed.skyColor);
              } catch (_) {}
            }
          }
        }
      }
    } catch (e) {
      errsHost.textContent = 'Failed to apply transforms: ' + e.message;
      return;
    }

    try {
      const sl = window.sceneLoader;
      if (sl && sl.sceneDef && sl.sceneDef.environment && Array.isArray(sl.sceneDef.environment.staticObjects)) {
        const arr = sl.sceneDef.environment.staticObjects;
        const idx = arr.findIndex((o) => (o && o.id && sel.id && o.id === sel.id) || o === sel);
        if (idx >= 0) arr[idx] = JSON.parse(JSON.stringify(parsed));
        else arr.push(JSON.parse(JSON.stringify(parsed)));
      }

      if (sl && sel && (sel.type === 'light' || sel.light) && sl.sceneDef && Array.isArray(sl.sceneDef.lights)) {
        const lids = sl.sceneDef.lights;
        const li = lids.findIndex((l) => l && l.id && sel.id && l.id === sel.id);
        if (li >= 0) lids[li] = JSON.parse(JSON.stringify(parsed));
        else lids.push(JSON.parse(JSON.stringify(parsed)));
      }

      if (sl && Array.isArray(sl.staticObjects)) {
        const idx2 = sl.staticObjects.findIndex((o) => o === sel || (o.id && sel.id && o.id === sel.id));
        if (idx2 >= 0) sl.staticObjects[idx2] = sel;
      }
    } catch (_) {}

    try {
      if (window.speak) window.speak('Changes applied', { interrupt: true });
    } catch (_) {}
    closeEditModal();
  }

  const cancel = document.getElementById('jsonEditCancel');
  const submit = document.getElementById('jsonEditSubmit');
  if (cancel) cancel.addEventListener('click', () => closeEditModal());
  if (submit) submit.addEventListener('click', () => applyEditedJSON());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window._editorModalOpen) closeEditModal();
  });

  return {
    openEditSelectedJSON,
    closeEditModal,
    applyEditedJSON
  };
}
