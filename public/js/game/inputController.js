export function attachInputController({
  canvas,
  camera,
  fpsState,
  ret,
  getViewportSize,
  getIsFPSMode,
  setIsFPSMode,
  setIsFiring,
  sendDesktopPayload,
  getPlayer,
  getEnemyVoiceManager,
  triggerReload,
  logDebug,
  camSpeed,
  camRotSpeed
}) {
  const listeners = [];
  const fullscreenRoot = document.documentElement;
  const state = {
    ducking: false,
    zoomed: false,
    lastReloadPressMs: 0
  };
  const RELOAD_COOLDOWN_MS = 500;

  function add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  function getCurrentFullscreenElement() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  function requestFullscreenCompat(element) {
    const fn =
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.msRequestFullscreen;
    if (!fn) return Promise.reject(new Error('Fullscreen API unavailable'));
    try {
      const maybePromise = fn.call(element);
      return maybePromise && typeof maybePromise.then === 'function'
        ? maybePromise
        : Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function exitFullscreenCompat() {
    const fn =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen;
    if (!fn) return Promise.reject(new Error('Fullscreen exit unavailable'));
    try {
      const maybePromise = fn.call(document);
      return maybePromise && typeof maybePromise.then === 'function'
        ? maybePromise
        : Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  }

  function ensureFullscreen() {
    if (getCurrentFullscreenElement()) return Promise.resolve();
    return requestFullscreenCompat(fullscreenRoot).catch(() => Promise.resolve());
  }

  function toggleFullscreen() {
    if (getCurrentFullscreenElement()) {
      return exitFullscreenCompat().catch(() => Promise.resolve());
    }
    return requestFullscreenCompat(fullscreenRoot).catch(() => Promise.resolve());
  }

  // Attempt fullscreen by default; browsers may require a user gesture.
  ensureFullscreen();

  add(window, 'pointerdown', () => {
    ensureFullscreen();
  }, { once: true, passive: true });

  add(window, 'keydown', (e) => {
    if (e.code !== 'F11') return;
    e.preventDefault();
    toggleFullscreen();
  });

  add(
    window,
    'pointerdown',
    () => {
      const vm = getEnemyVoiceManager ? getEnemyVoiceManager() : null;
      if (vm?.listener?.context?.state !== 'running') {
        vm?.listener?.context?.resume?.();
        console.log('[AUDIO] AudioContext resumed');
      }
    },
    { once: true }
  );

  add(window, 'wheel', (e) => {
    const direction = e.deltaY > 0 ? 1 : -1;
    const p = getPlayer ? getPlayer() : null;
    if (p && typeof p.cycleWeapon === 'function') p.cycleWeapon(direction);
  });

  add(window, 'keydown', (e) => {
    if (e.code !== 'Tab') return;
    e.preventDefault();

    const nextMode = !getIsFPSMode();
    setIsFPSMode(nextMode);

    if (nextMode) {
      const { cw, ch } = getViewportSize();
      ret.x = cw / 2;
      ret.y = ch / 2;
      try { canvas.requestPointerLock(); } catch (_) {}
      document.body.style.cursor = 'none';
      fpsState.yaw = camera.rotation.y;
      fpsState.pitch = camera.rotation.x;
    } else {
      try { if (document.exitPointerLock) document.exitPointerLock(); } catch (_) {}
      document.body.style.cursor = 'auto';
    }
  });

  add(document, 'pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && getIsFPSMode()) {
      setIsFPSMode(false);
      document.body.style.cursor = 'auto';
    }
  });

  add(document, 'mousemove', (e) => {
    if (!getIsFPSMode()) return;
    if (document.pointerLockElement !== canvas) return;
    fpsState.yaw -= e.movementX * fpsState.mouseSensitivity;
    fpsState.pitch -= e.movementY * fpsState.mouseSensitivity;

    const maxPitch = Math.PI / 2 - 0.01;
    fpsState.pitch = Math.max(-maxPitch, Math.min(maxPitch, fpsState.pitch));
    camera.rotation.set(fpsState.pitch, fpsState.yaw, 0, 'YXZ');
  });

  add(document, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if (e.code === 'KeyX') {
      if (getIsFPSMode()) camera.position.y = 1.7;
      return;
    }
    if (!getIsFPSMode()) return;

    switch (e.code) {
      case 'KeyW': fpsState.keys.w = true; break;
      case 'KeyS': fpsState.keys.s = true; break;
      case 'KeyA': fpsState.keys.a = true; break;
      case 'KeyD': fpsState.keys.d = true; break;
      case 'KeyQ': fpsState.keys.q = true; break;
      case 'KeyZ': fpsState.keys.z = true; break;
    }
  });

  add(document, 'keyup', (e) => {
    if (!getIsFPSMode()) return;
    switch (e.code) {
      case 'KeyW': fpsState.keys.w = false; break;
      case 'KeyS': fpsState.keys.s = false; break;
      case 'KeyA': fpsState.keys.a = false; break;
      case 'KeyD': fpsState.keys.d = false; break;
      case 'KeyQ': fpsState.keys.q = false; break;
      case 'KeyZ': fpsState.keys.z = false; break;
    }
  });

  add(window, 'mousedown', (e) => {
    if (e.button !== 0) return;
    setIsFiring(true);
    const p = getPlayer ? getPlayer() : null;
    if (p?.currentWeapon) p.currentWeapon._dryFirePlayed = false;
    sendDesktopPayload({ fire: true });
  });

  add(window, 'mouseup', (e) => {
    if (e.button !== 0) return;
    setIsFiring(false);
    sendDesktopPayload({ fire: false });
  });

  add(window, 'mouseleave', () => {
    setIsFiring(false);
    sendDesktopPayload({ fire: false });
  });

  add(document, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if ((e.key || '').toLowerCase() !== 'r') return;

    const now = performance.now();
    if (now - state.lastReloadPressMs < RELOAD_COOLDOWN_MS) return;

    const w = getPlayer?.()?.currentWeapon;
    if (!w || w.isReloading) return;

    if (w.ammoInClip < w.clipSize) {
      state.lastReloadPressMs = now;
      triggerReload();
    } else {
      logDebug('Reload ignored: clip full.');
    }
  });

  add(document, 'keydown', (e) => {
    if (window._editorModalOpen) return;
    if (e.key === 'Shift') state.ducking = true;
    if (!getIsFPSMode() && (e.key === 'z' || e.key === 'Z')) state.zoomed = true;
  });

  add(document, 'keyup', (e) => {
    if (window._editorModalOpen) return;
    if (e.key === 'Shift') state.ducking = false;
    if (!getIsFPSMode() && (e.key === 'z' || e.key === 'Z')) state.zoomed = false;
  });

  add(document, 'keydown', (e) => {
    if (getIsFPSMode()) return;
    switch ((e.key || '').toLowerCase()) {
      case 'w':
        camera.position.z -= camSpeed;
        break;
      case 's':
        camera.position.z += camSpeed;
        break;
      case 'a':
        camera.position.x -= camSpeed;
        break;
      case 'd':
        camera.position.x += camSpeed;
        break;
      case 'q':
        camera.position.y -= camSpeed;
        break;
      case 'e':
        camera.position.y += camSpeed;
        break;
      case 'arrowleft':
        camera.rotation.y += camRotSpeed;
        break;
      case 'arrowright':
        camera.rotation.y -= camRotSpeed;
        break;
      case 'arrowup':
        camera.rotation.x += camRotSpeed;
        break;
      case 'arrowdown':
        camera.rotation.x -= camRotSpeed;
        break;
    }
  });

  return {
    state,
    detach() {
      while (listeners.length) {
        const off = listeners.pop();
        try { off(); } catch (_) {}
      }
    }
  };
}
