export function setupSceneRuntime({
  SceneLoader,
  SceneManager,
  scene,
  camera,
  player,
  renderer,
  Level_Warehouse,
  ALL_SCENES,
  fpsState,
  setPlayerStandingHeight,
  logDebug
}) {
  if (window.sceneLoader && typeof window.sceneLoader.destroy === 'function') {
    try {
      window.sceneLoader.destroy();
    } catch (_) {}
  }
  window.sceneLoader = new SceneLoader(scene, camera, player, renderer);

  let currentLevel = Level_Warehouse;
  let currentSceneIndex = 0;

  if (window.sceneManager && typeof window.sceneManager.destroy === 'function') {
    try {
      window.sceneManager.destroy();
    } catch (_) {}
  }
  window.sceneManager = new SceneManager(camera, window.sceneLoader);

  window.loadSceneByName = async function(name) {
    if (!name) {
      console.warn('Usage: loadSceneByName("Scene Name")');
      return;
    }
    if (!window.sceneManager) {
      console.warn('sceneManager not available');
      return;
    }

    const matchName = (s) => s && s.name && s.name.toLowerCase() === name.toLowerCase();

    let target = currentLevel?.scenes?.find(matchName);
    let levelFound = currentLevel;

    if (!target && typeof Level_Warehouse !== 'undefined') {
      target = Level_Warehouse.scenes?.find(matchName);
      if (target) levelFound = Level_Warehouse;
    }

    if (!target && window.ALL_LEVELS && Array.isArray(window.ALL_LEVELS)) {
      for (const lv of window.ALL_LEVELS) {
        target = lv.scenes?.find(matchName);
        if (target) {
          levelFound = lv;
          break;
        }
      }
    }

    if (!target) {
      console.warn(`Scene not found: ${name}`);
      return;
    }

    currentLevel = levelFound;
    currentSceneIndex = currentLevel.scenes.indexOf(target);

    console.log(
      `Loading scene '${target.name}' (index ${currentSceneIndex}) from level '${currentLevel.name || 'unknown'}'`
    );
    await window.sceneManager.loadScene(target);
  };

  (function installScenePicker() {
    if (typeof document === 'undefined') return;

    const overlay = document.createElement('div');
    overlay.id = 'scene-picker-overlay';
    overlay.style.cssText =
      'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:#fff;padding:12px;border-radius:8px;z-index:9999;display:none;min-width:320px;';

    const label = document.createElement('div');
    label.textContent = 'Select scene (Enter to load, Esc to close)';
    label.style.marginBottom = '8px';
    overlay.appendChild(label);

    const sel = document.createElement('select');
    sel.id = 'scene-picker-select';
    sel.style.width = '100%';
    sel.style.fontSize = '14px';
    sel.size = 8;
    overlay.appendChild(sel);

    const hint = document.createElement('div');
    hint.style.marginTop = '8px';
    hint.style.opacity = '0.8';
    hint.textContent = `Scenes: ${ALL_SCENES.length}`;
    overlay.appendChild(hint);

    document.body.appendChild(overlay);

    function populate() {
      sel.innerHTML = '';
      ALL_SCENES.forEach((entry, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = entry.scene.name || entry.id || `Scene ${i}`;
        sel.appendChild(opt);
      });
      hint.textContent = `Scenes: ${ALL_SCENES.length}`;
    }

    function show() {
      populate();
      overlay.style.display = 'block';
      sel.focus();
      if (sel.selectedIndex < 0) sel.selectedIndex = 0;
    }

    function hide() {
      overlay.style.display = 'none';
    }

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code === 'F3') {
          if (overlay.style.display === 'block') hide();
          else show();
          e.preventDefault();
        } else if (e.key === 'Escape') {
          if (overlay.style.display === 'block') {
            hide();
            e.preventDefault();
          }
        } else if (e.key === 'Enter') {
          if (overlay.style.display === 'block' && document.activeElement === sel) {
            const idx = Number(sel.value || sel.selectedIndex || 0);
            const entry = ALL_SCENES[idx];
            if (entry && entry.scene) {
              currentLevel = { name: '(single)', scenes: [entry.scene] };
              currentSceneIndex = 0;
              window.sceneManager.loadScene(entry.scene);
            }
            hide();
            e.preventDefault();
          }
        }
      },
      true
    );

    sel.addEventListener('dblclick', () => {
      const idx = Number(sel.value || sel.selectedIndex || 0);
      const entry = ALL_SCENES[idx];
      if (entry && entry.scene) {
        currentLevel = { name: '(single)', scenes: [entry.scene] };
        currentSceneIndex = 0;
        window.sceneManager.loadScene(entry.scene);
      }
      hide();
    });
  })();

  function loadLevel(level) {
    currentLevel = level;
    currentSceneIndex = 0;
    loadSceneIndex(currentSceneIndex);
  }

  async function loadSceneIndex(index) {
    if (!currentLevel?.scenes) return;
    if (index < 0 || index >= currentLevel.scenes.length) return;

    const sceneObj = currentLevel.scenes[index];
    await window.sceneManager.loadScene(sceneObj);
    logDebug(`Scene complete: ${sceneObj.name}`);
  }

  function nextScene() {
    const next = currentSceneIndex + 1;
    if (next < currentLevel.scenes.length) {
      currentSceneIndex = next;
      loadSceneIndex(currentSceneIndex);
    } else {
      logDebug(`Level ${currentLevel.name} complete.`);
      window.dispatchEvent(new CustomEvent('levelComplete', { detail: { level: currentLevel } }));
    }
  }

  window.addEventListener('sceneLoaded', (e) => {
    logDebug(`sceneLoaded: ${e.detail.scene.name}`);
    setPlayerStandingHeight(camera.position.y);
    fpsState.yaw = camera.rotation.y;
    fpsState.pitch = camera.rotation.x;
  });

  window.addEventListener('enemyDied', (e) => {
    logDebug(`enemyDied: ${e.detail.id}`);
  });

  window.addEventListener('enemyFiredHitPlayer', (e) => {
    const dmg = e.detail.damage || 1;
    if (player && typeof player.takeDamage === 'function') player.takeDamage(dmg);
  });

  return {
    loadLevel,
    nextScene,
    loadSceneIndex
  };
}
