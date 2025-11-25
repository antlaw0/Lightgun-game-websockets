// public/js/controller.js
// Phone/controller side. Captures deviceorientation and sends normalized x/y via WebSocket.
// Buttons: enable orientation (iOS permission), calibrate, fire, reload
// Debug div shows sent values, ws status and diagnostic numbers.

(() => {
  console.log('controller.js starting');

  const enableBtn = document.getElementById('enableBtn');
  const calBtn = document.getElementById('calBtn');
  const fireBtn = document.getElementById('fireBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const debug = document.getElementById('debug');

  const WS_URL = `wss://${window.location.hostname}:8080`;
  console.log('controller ws url', WS_URL);

  let ws = null;
  function connectWS() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      appendDebug('WS connected');
      console.log('controller ws open');
      try { ws.send(JSON.stringify({ type: 'register', client: 'controller' })); } catch (e) {}
    };
    ws.onclose = () => {
      appendDebug('WS closed');
      console.log('controller ws closed');
    };
    ws.onerror = (e) => {
      appendDebug('WS error');
      console.error('controller ws error', e);
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        console.log('controller got ws message', msg);
      } catch (e) {
        console.warn('controller ws onmessage parse', e);
      }
    };
  }
  connectWS();

  function appendDebug(s) {
    const ts = new Date().toLocaleTimeString();
    debug.textContent = `${ts} - ${s}\n\n` + debug.textContent;
    debug.textContent = debug.textContent.split('\n').slice(0,200).join('\n');
  }

  // Orientation capture state
  let baseline = { alpha: 0, beta: 0, gamma: 0, set: false };
  // lastSend keeps the last payload we consider "sent"
  let lastSend = { x:0, y:0, fire:false, reload:false, calibrate:false, alpha:null, beta:null, gamma:null };

  // Tuning constants (change to taste)
  // NORMALIZE_DEG: degrees that map to 1. Smaller -> more sensitive. Try 25-45.
  const NORMALIZE_DEG = 30; // was 90 (too conservative)
  // deadzone: absolute nx/ny smaller than this become 0 to avoid jitter
  const DEADZONE = 0.005;   // was 0.01
  // sendThreshold: minimum change in x or y to send a new packet
  const SEND_THRESHOLD = 0.002; // was 0.005

  function normalizeAndClamp(val) {
    const n = val / NORMALIZE_DEG;
    if (n > 1) return 1;
    if (n < -1) return -1;
    return n;
  }

  function handleOrientationEvent(ev) {
    if (!ev) return;
    const alpha = ev.alpha ?? 0;
    const beta = ev.beta ?? 0;
    const gamma = ev.gamma ?? 0;

    if (!baseline.set) {
      // auto-baseline on first event so phone starts centered where you hold it
      baseline.alpha = alpha;
      baseline.beta = beta;
      baseline.gamma = gamma;
      baseline.set = true;
      appendDebug(`Baseline auto-set a=${baseline.alpha.toFixed(1)} b=${baseline.beta.toFixed(1)} g=${baseline.gamma.toFixed(1)}`);
      console.log('Baseline auto-set', baseline);
    }

    // deltas from baseline
    const dBeta = beta - baseline.beta;
    const dGamma = gamma - baseline.gamma;

    // Mapping decisions:
    // - tilt phone UP should move reticle UP => invert beta delta
    // - gamma (left/right tilt) maps to x
    let nx = normalizeAndClamp(dGamma);
    let ny = normalizeAndClamp(-dBeta);

    // Deadzone
    if (Math.abs(nx) < DEADZONE) nx = 0;
    if (Math.abs(ny) < DEADZONE) ny = 0;

    // Diagnostic debug (shows raw numbers so you can see why x/y are zero)
    appendDebug(`raw a=${alpha.toFixed(1)} b=${beta.toFixed(1)} g=${gamma.toFixed(1)} | dB=${dBeta.toFixed(2)} dG=${dGamma.toFixed(2)} | nx=${nx.toFixed(3)} ny=${ny.toFixed(3)}`);

    // Prepare payload
    const payload = {
      x: nx,
      y: ny,
      fire: lastSend.fire,
      reload: lastSend.reload,
      calibrate: false,
      alpha,
      beta,
      gamma
    };

    // Check if we should send (sends when x or y changed enough, or buttons changed)
    const changed = (
      Math.abs(payload.x - (lastSend.x || 0)) > SEND_THRESHOLD ||
      Math.abs(payload.y - (lastSend.y || 0)) > SEND_THRESHOLD ||
      payload.fire !== lastSend.fire ||
      payload.reload !== lastSend.reload
    );

    if (changed && ws && ws.readyState === WebSocket.OPEN) {
      const out = { type: 'controller', payload };
      ws.send(JSON.stringify(out));
      lastSend = { ...payload }; // shallow copy important
      console.log('controller sent', out);
    }
  }

  // Enable orientation button - iOS permission flow if required
  enableBtn.addEventListener('click', async () => {
    appendDebug('Requesting orientation permission (if needed)...');
    console.log('Enable orientation pressed');
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const resp = await DeviceOrientationEvent.requestPermission();
        console.log('DeviceOrientation permission response', resp);
        if (resp !== 'granted') {
          appendDebug('DeviceOrientation permission denied');
          return;
        }
      }
      // attach the handler (use capture true for timeliness)
      window.addEventListener('deviceorientation', handleOrientationEvent, true);
      appendDebug('DeviceOrientation listener attached');
    } catch (e) {
      console.error('Error enabling DeviceOrientation', e);
      appendDebug('Error enabling DeviceOrientation: ' + (e && e.message));
    }
  });

  // Calibrate button: snapshot current orientation as baseline
  calBtn.addEventListener('click', () => {
    appendDebug('Calibrating baseline (taking a snapshot)');
    console.log('Calibrate pressed');
    function takeSnapshot(ev) {
      if (ev) {
        baseline.alpha = ev.alpha ?? 0;
        baseline.beta = ev.beta ?? 0;
        baseline.gamma = ev.gamma ?? 0;
        baseline.set = true;
        appendDebug(`Calibrated: a=${baseline.alpha.toFixed(1)} b=${baseline.beta.toFixed(1)} g=${baseline.gamma.toFixed(1)}`);
        window.removeEventListener('deviceorientation', takeSnapshot, true);
      } else {
        baseline.alpha = lastSend.alpha || 0;
        baseline.beta = lastSend.beta || 0;
        baseline.gamma = lastSend.gamma || 0;
        baseline.set = true;
        appendDebug(`Calibrated from lastSend: a=${baseline.alpha.toFixed(1)} b=${baseline.beta.toFixed(1)} g=${baseline.gamma.toFixed(1)}`);
      }
    }
    // try to get immediate event, fallback after 300ms
    const handleOnce = (ev) => { takeSnapshot(ev); };
    window.addEventListener('deviceorientation', handleOnce, true);
    setTimeout(() => {
      if (!baseline.set) takeSnapshot(null);
    }, 300);
    // notify game immediately of calibration
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'controller', payload: { x:0,y:0,fire:false,reload:false,calibrate:true,alpha:baseline.alpha,beta:baseline.beta,gamma:baseline.gamma }}));
    }
  });

  // Fire button (touch & click support)
  function sendFirePulse() {
    lastSend.fire = true;
    const payload = { x:lastSend.x||0, y:lastSend.y||0, fire:true, reload:false, calibrate:false, alpha:lastSend.alpha, beta:lastSend.beta, gamma:lastSend.gamma };
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'controller', payload }));
    setTimeout(()=> {
      lastSend.fire = false;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'controller', payload: { ...payload, fire:false } }));
    }, 120);
  }
  fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); appendDebug('FIRE pressed'); sendFirePulse(); });
  fireBtn.addEventListener('click', (e) => { e.preventDefault(); appendDebug('FIRE clicked'); sendFirePulse(); });

  // Reload
  reloadBtn.addEventListener('click', () => {
    appendDebug('RELOAD clicked');
    lastSend.reload = true;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'controller', payload: { x: lastSend.x||0, y:lastSend.y||0, fire:false, reload:true, calibrate:false, alpha:lastSend.alpha, beta:lastSend.beta, gamma:lastSend.gamma }}));
    setTimeout(() => {
      lastSend.reload = false;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'controller', payload: { x:lastSend.x||0, y:lastSend.y||0, fire:false, reload:false, calibrate:false, alpha:lastSend.alpha, beta:lastSend.beta, gamma:lastSend.gamma }}));
    }, 250);
  });

  // Show UA and loaded message
  if (navigator.userAgent) {
    appendDebug('UA: ' + navigator.userAgent.split('(')[0]);
  }
  appendDebug('Controller script loaded. Click "Enable Orientation" to allow motion data (iOS may prompt).');

  // tiny interval to keep baseline/live state accurate if needed (no-op by default)
  setInterval(()=>{}, 1000);

})();
