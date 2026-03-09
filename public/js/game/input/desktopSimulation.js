export function attachDesktopSimulation({
  logDebug,
  sendDesktopPayload,
  triggerReload,
  getIsFPSMode,
  getIsFiring,
  setIsFiring
}) {
  logDebug('Desktop control simulation ON');

  let lastX = 0;
  let lastY = 0;

  function sendDesktopPayloadLocal(overrides = {}) {
    sendDesktopPayload({
      x: lastX,
      y: lastY,
      alpha: 0,
      beta: 0,
      gamma: 0,
      fire: getIsFiring(),
      reload: false,
      calibrate: false,
      ...overrides
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (getIsFPSMode()) return;
    lastX = (e.clientX / window.innerWidth) * 2 - 1;
    lastY = (e.clientY / window.innerHeight) * 2 - 1;
    sendDesktopPayloadLocal();
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    setIsFiring(true);
    sendDesktopPayloadLocal({ fire: true });
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    setIsFiring(false);
    sendDesktopPayloadLocal({ fire: false });
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    try {
      const reloadSound = new Audio('sounds/reload.ogg');
      reloadSound.currentTime = 0;
      reloadSound.play().catch(() => {});
    } catch (_) {}

    sendDesktopPayloadLocal({ reload: true });
    triggerReload();
  });
}
