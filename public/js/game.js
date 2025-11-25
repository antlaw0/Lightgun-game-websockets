// public/js/game.js
// PC/game side. Connects to wss, receives controller messages and draws reticle/target.

(() => {
  console.log('game.js starting');

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const connStatus = document.getElementById('connStatus');
  const retXY = document.getElementById('retXY');
  const abc = document.getElementById('abc');
  const debugConsole = document.getElementById('debugConsole');

  let cw = canvas.width = window.innerWidth;
  let ch = canvas.height = window.innerHeight;

  function resize() {
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);

  // WebSocket (wss) - use same host, port 8080
  const WS_URL = `wss://${window.location.hostname}:8080`;
  console.log('Connecting to WS at', WS_URL);
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('game ws open');
    connStatus.textContent = 'WS: connected';
    ws.send(JSON.stringify({ type: 'register', client: 'game' }));
  };

  ws.onclose = () => {
    console.log('game ws closed');
    connStatus.textContent = 'WS: disconnected';
  };

  ws.onerror = (e) => {
    console.error('game ws error', e);
    connStatus.textContent = 'WS: error';
  };

  // Animation state
  let ret = { x: cw / 2, y: ch / 2 };
  const retRadius = 12;
  let lastController = null;

  // target example
  const target = { x: cw * 0.8, y: ch * 0.5, r: 30 };

  // Sounds
  const fireAudio = new Audio('sounds/fire.ogg');
  const reloadAudio = new Audio('sounds/reload.ogg');

  function logDebug(msg) {
    const ts = new Date().toLocaleTimeString();
    debugConsole.textContent = `${ts} - ${msg}\n` + debugConsole.textContent;
    debugConsole.textContent = debugConsole.textContent.split('\n').slice(0, 200).join('\n');
  }

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);

    if (msg.type === 'registered') {
      logDebug(`got register ack ${msg.client}`);
      return;
    }

    if (msg.type === 'controller') {
      const p = msg.payload;

      lastController = p;

      // x and y are already normalized -1..1
      // Convert to screen coords
      const px = ((p.x + 1) / 2) * cw;  // map [-1..1] to [0..cw]
      const py = ((p.y + 1) / 2) * ch;  // map [-1..1] to [0..ch]

      ret.x = px;
      ret.y = py;

      retXY.textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
      abc.textContent = `${p.alpha?.toFixed(1)}, ${p.beta?.toFixed(1)}, ${p.gamma?.toFixed(1)}`;

      if (p.fire) fireAudio.play();
      if (p.reload) reloadAudio.play();
    }
  };

  // Draw everything
  function draw() {
    ctx.clearRect(0, 0, cw, ch);

    // background
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, cw, ch);

    // draw target
    ctx.fillStyle = '#f33';
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
    ctx.fill();

    // draw reticle crosshair
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ret.x, ret.y, retRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ret.x - 20, ret.y);
    ctx.lineTo(ret.x + 20, ret.y);
    ctx.moveTo(ret.x, ret.y - 20);
    ctx.lineTo(ret.x, ret.y + 20);
    ctx.stroke();

    requestAnimationFrame(draw);
  }

  draw();
})();
