// Phone/controller side. Captures deviceorientation and sends normalized x/y via WebSocket.
// Buttons: enable orientation (iOS permission), calibrate, fire, reload
// Debug div shows sent values, ws status, and diagnostic numbers.

(() => {
  console.log('controller.js starting');

  const showDebug = false; // enable debug output
  const enableBtn = document.getElementById('enableBtn');
  const calBtn = document.getElementById('calBtn');
  const fireBtn = document.getElementById('fireBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const debug = document.getElementById('debug');

  
  let reloadSound = new Audio('sounds/reload.ogg');
  let lastOrientation = { alpha:0, beta:0, gamma:0 };
  let curX = 0, curY = 0;

  // Choose ws:// for HTTP or wss:// for HTTPS
  const WS_URL =
  (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
  window.location.host;

  console.log('Controller WS URL:', WS_URL);

  let ws = null;
  function connectWS() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      appendDebug('WS connected');
      console.log('controller ws open');
      try { ws.send(JSON.stringify({ type: 'register', client: 'controller' })); } catch (e) {}
    };
    ws.onclose = () => { appendDebug('WS closed'); console.log('controller ws closed'); };
    ws.onerror = (e) => { appendDebug('WS error'); console.error('controller ws error', e); };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        console.log('controller got ws message', msg);
        if (msg.type === 'game' && msg.payload && msg.payload.currentWeapon) {
          const cw = msg.payload.currentWeapon;
          try {
            if (cw.fireSound) fireSound = new Audio(cw.fireSound);
            if (cw.reloadSound) reloadSound = new Audio(cw.reloadSound);
            console.log('Controller updated weapon sounds', cw.fireSound, cw.reloadSound);
          } catch (e) { console.warn('Failed to set controller sounds', e); }
        }
      } catch (e) {
        console.warn('controller ws onmessage parse', e);
      }
    };
  }
  connectWS();

  function appendDebug(s) {
    if (!showDebug) return;
    const ts = new Date().toLocaleTimeString();
    debug.textContent = `${ts} - ${s}\n\n` + debug.textContent;
    debug.textContent = debug.textContent.split('\n').slice(0,200).join('\n');
  }

  // Orientation state
  let baseline = { alpha: 0, beta: 0, gamma: 0, set: false };
  let lastSend = { x:0, y:0, fire:false, reload:false, calibrate:false, alpha:null, beta:null, gamma:null };

  // Tuning constants
  const NORMALIZE_DEG = 30;
  const DEADZONE = 0.005;
  const SEND_THRESHOLD = 0.002;

  function normalizeAndClamp(val) {
    const n = val / NORMALIZE_DEG;
    if (n > 1) return 1;
    if (n < -1) return -1;
    return n;
  }

  function handleOrientationEvent(ev) {
    if (!ev || !baseline.set) return;

    const alpha = ev.alpha ?? 0;
    const beta  = ev.beta  ?? 0;
    const gamma = ev.gamma ?? 0;

    const dBeta = beta - baseline.beta;
    const dGamma = gamma - baseline.gamma;

    let nx = normalizeAndClamp(dGamma);
    let ny = normalizeAndClamp(-dBeta);

    if (Math.abs(nx) < DEADZONE) nx = 0;
    if (Math.abs(ny) < DEADZONE) ny = 0;

    appendDebug(`raw a=${alpha.toFixed(1)} b=${beta.toFixed(1)} g=${gamma.toFixed(1)} | nx=${nx.toFixed(3)} ny=${ny.toFixed(3)}`);

    const payload = {
      x: nx,
      y: ny,
      fire: lastSend.fire,
      reload: lastSend.reload,
      calibrate: false,
      alpha, beta, gamma
    };

    const changed = (
      Math.abs(payload.x - (lastSend.x || 0)) > SEND_THRESHOLD ||
      Math.abs(payload.y - (lastSend.y || 0)) > SEND_THRESHOLD ||
      payload.fire !== lastSend.fire ||
      payload.reload !== lastSend.reload
    );

    // update cached orientation/position
    curX = nx; curY = ny;
    lastOrientation = { alpha, beta, gamma };

    if (changed && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'controller', payload }));
      lastSend = { ...payload };
      // reset fire/reload pulses after sending
      lastSend.fire = false;
      lastSend.reload = false;
      console.log('controller sent', payload);
    }
  }

  function sendControllerNow(overrides = {}) {
    const payload = {
      x: curX,
      y: curY,
      fire: false,
      reload: false,
      calibrate: false,
      alpha: lastOrientation.alpha,
      beta: lastOrientation.beta,
      gamma: lastOrientation.gamma,
      ...overrides
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'controller', payload }));
      console.log('controller immediate sent', payload);
    }
  }

  // Enable orientation button
  enableBtn.addEventListener('click', async () => {
    appendDebug('Requesting orientation permission...');
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const resp = await DeviceOrientationEvent.requestPermission();
        console.log('DeviceOrientation permission response', resp);
        if (resp !== 'granted') {
          appendDebug('DeviceOrientation permission denied');
          return;
        }
      }
      window.addEventListener('deviceorientation', handleOrientationEvent, true);
      appendDebug('DeviceOrientation listener attached');
    } catch (e) {
      console.error('Error enabling DeviceOrientation', e);
      appendDebug('Error enabling DeviceOrientation: ' + e?.message);
    }
  });

  // Calibration
  calBtn.addEventListener('click', () => {
    appendDebug('Calibrating orientation...');
    const samples = [];
    const maxSamples = 20;

    function capture(ev) {
      if (!ev) return;
      samples.push({ alpha: ev.alpha ?? 0, beta: ev.beta ?? 0, gamma: ev.gamma ?? 0 });
      if (samples.length >= maxSamples) finish();
    }

    function finish() {
      window.removeEventListener('deviceorientation', capture, true);
      if (samples.length === 0) { appendDebug('Calibration failed'); return; }

      const sum = samples.reduce((acc, s) => {
        acc.alpha += s.alpha; acc.beta += s.beta; acc.gamma += s.gamma; return acc;
      }, { alpha:0, beta:0, gamma:0 });

        baseline.alpha = sum.alpha / samples.length;
        baseline.beta  = sum.beta  / samples.length;
        baseline.gamma = sum.gamma / samples.length;
        baseline.set = true;

      appendDebug(`Calibration complete: a=${baseline.alpha.toFixed(1)} b=${baseline.beta.toFixed(1)} g=${baseline.gamma.toFixed(1)}`);

      if (ws && ws.readyState === WebSocket.OPEN) {
        sendControllerNow({ x:0, y:0, fire:false, reload:false, calibrate:true, alpha:baseline.alpha, beta:baseline.beta, gamma:baseline.gamma });
      }
    }

    samples.length = 0;
    window.addEventListener('deviceorientation', capture, true);
    setTimeout(finish, 500); // ensure enough samples even on slow devices
  });

  // Fire button
  // Fire button: start firing on touchstart, stop on touchend
let fireInterval = null;
const FIRE_RATE_MS = 1; // adjust to desired RPM

fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (fireInterval) return; // already firing
    triggerFire(); // immediate first shot
    fireInterval = setInterval(triggerFire, FIRE_RATE_MS);
});

fireBtn.addEventListener('touchend', stopFiring);
fireBtn.addEventListener('touchcancel', stopFiring);
fireBtn.addEventListener('touchleave', stopFiring);

function stopFiring() {
    if (fireInterval) {
        clearInterval(fireInterval);
        fireInterval = null;
    }
}

function triggerFire() {
    lastSend.fire = true;
    sendControllerNow({ fire: true });

    // optional: play sound each shot
    try {    let fireSound = new Audio('sounds/fire.ogg');
; fireSound.play().catch(()=>{}); } catch(_) {}

    // reset fire after sending
    lastSend.fire = false;
}
  
  // Support mouse for debugging in browser
  fireBtn.addEventListener('mousedown', (e) => { e.preventDefault(); try { fireSound.currentTime = 0; fireSound.play().catch(()=>{}); } catch(_){}; lastSend.fire = true; sendControllerNow({ fire:true }); });
  fireBtn.addEventListener('mouseup', (e) => { e.preventDefault(); lastSend.fire = false; sendControllerNow({ fire:false }); });

  // Reload button
  reloadBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    try { reloadSound.currentTime = 0; reloadSound.play().catch(()=>{}); } catch(_){}
    lastSend.reload = true;
    sendControllerNow({ reload: true });
    // send a quick reset so UI doesn't remain in reloaded state
    setTimeout(() => sendControllerNow({ reload: false }), 50);
  });

  reloadBtn.addEventListener('mousedown', (e) => { e.preventDefault(); try { reloadSound.currentTime = 0; reloadSound.play().catch(()=>{}); } catch(_){}; sendControllerNow({ reload:true }); setTimeout(()=>sendControllerNow({ reload:false }), 50); });

  appendDebug('Controller script loaded. Click "Enable Orientation" to start.');
})();