export function createControllerRuntime({
  connStatus,
  retXY,
  abc,
  logDebug,
  getRet,
  setRet,
  getViewport,
  getIsFiring,
  setIsFiring,
  getIsFPSMode,
  getPlayer,
  triggerFire,
  triggerReload
}) {
  const WS_URL =
    (location.protocol === 'https:' ? 'wss' : 'ws') +
    '://' +
    window.location.hostname +
    ':8080';
  const ws = new WebSocket(WS_URL);

  function sendDesktopPayload(overrides = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const ret = getRet();
    const { cw, ch } = getViewport();

    const payload = {
      x: (ret.x / cw) * 2 - 1,
      y: (ret.y / ch) * 2 - 1,
      alpha: 0,
      beta: 0,
      gamma: 0,
      fire: getIsFiring(),
      reload: false,
      calibrate: false,
      ...overrides
    };

    ws.send(JSON.stringify({ type: 'controller', payload }));
  }

  function sendWeaponInfo() {
    try {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const w = getPlayer()?.currentWeapon;
      if (!w) return;
      const payload = {
        currentWeapon: {
          id: w.id,
          name: w.name,
          fireSound: w.fireSound,
          reloadSound: w.reloadSound,
          fireMode: w.fireMode
        }
      };
      ws.send(JSON.stringify({ type: 'game', payload }));
      console.log('Sent weapon info to controller', payload);
    } catch (e) {
      console.warn('sendWeaponInfo failed', e);
    }
  }

  ws.onopen = () => {
    if (connStatus) connStatus.textContent = 'WS: connected';
    ws.send(JSON.stringify({ type: 'register', client: 'game' }));
  };

  ws.onclose = () => {
    if (connStatus) connStatus.textContent = 'WS: disconnected';
  };

  ws.onerror = (e) => {
    if (connStatus) connStatus.textContent = 'WS: error';
    console.error(e);
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'registered') {
        logDebug(`WS registered ${msg.client}`);
        return;
      }
      if (msg.type === 'controller') {
        const p = msg.payload;

        if (!getIsFPSMode()) {
          const { cw, ch } = getViewport();
          setRet({
            x: ((p.x + 1) / 2) * cw,
            y: ((p.y + 1) / 2) * ch
          });
        }

        if (retXY) retXY.textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
        if (abc) {
          abc.textContent = `${p.alpha?.toFixed(1) ?? ''}, ${p.beta?.toFixed(1) ?? ''}, ${p.gamma?.toFixed(1) ?? ''}`;
        }

        const pFire = !!p.fire;
        const w = getPlayer()?.currentWeapon;
        if (pFire && !window._lastControllerFire) {
          if (w) w._dryFirePlayed = false;
          if (w && w.fireMode === 'semi-auto') {
            triggerFire();
          } else {
            setIsFiring(true);
          }
        } else if (!pFire && window._lastControllerFire) {
          setIsFiring(false);
        }
        window._lastControllerFire = pFire;

        if (p.reload) triggerReload();
      }
    } catch (e) {
      console.warn('ws message parse failed', e);
    }
  };

  ws.addEventListener('open', () => {
    setTimeout(sendWeaponInfo, 200);
  });

  const playerAtInit = getPlayer();
  if (playerAtInit && playerAtInit.addEventListener) {
    playerAtInit.addEventListener('ammoChanged', sendWeaponInfo);
  }

  return {
    socket: ws,
    sendDesktopPayload,
    sendWeaponInfo
  };
}
