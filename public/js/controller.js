// js/controller.js

// HTML elements
const orientationBtn = document.getElementById('orientationBtn');
const fireBtn = document.getElementById('fireBtn');
const reloadBtn = document.getElementById('reloadBtn');
const calibrateBtn = document.getElementById('calibrateBtn');

const gunfireSound = document.getElementById('gunfireSound');
const reloadSound = document.getElementById('reloadSound');
const debugDiv = document.getElementById('debug');

// ------------------------
// Controller state
// ------------------------
let tiltX = 0;
let tiltY = 0;
let calibrateOffset = { x: 0, y: 0 };
let firePressed = false;
let reloadPressed = false;
let calibratePressed = false;

// ------------------------
// WebSocket
// ------------------------
let ws;
function connectWebSocket() {
  ws = new WebSocket(`ws://${window.location.hostname}:8080`);
  ws.onopen = () => {
    logDebug('Connected to server');
    ws.send(JSON.stringify({ type: 'register', client: 'controller' }));
  };
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === 'audio') playAudio(data.payload.sound);
  };
  ws.onclose = () => {
    logDebug('Disconnected. Reconnecting in 2s...');
    setTimeout(connectWebSocket, 2000);
  };
}

// ------------------------
// Audio playback
// ------------------------
function playAudio(sound) {
  if (sound === 'gunfire') {
    gunfireSound.currentTime = 0;
    gunfireSound.play().catch(() => {});
  } else if (sound === 'reload') {
    reloadSound.currentTime = 0;
    reloadSound.play().catch(() => {});
  }
}

// ------------------------
// Buttons
// ------------------------
fireBtn.addEventListener('touchstart', () => firePressed = true);
fireBtn.addEventListener('touchend', () => firePressed = false);

reloadBtn.addEventListener('touchstart', () => reloadPressed = true);
reloadBtn.addEventListener('touchend', () => reloadPressed = false);

calibrateBtn.addEventListener('touchstart', () => {
  calibratePressed = true;
  calibrateOffset.x = tiltX;
  calibrateOffset.y = tiltY;
});
calibrateBtn.addEventListener('touchend', () => calibratePressed = false);

// ------------------------
// Device Orientation
// ------------------------
orientationBtn.addEventListener('click', () => {
  // Unlock audio
  gunfireSound.play().then(() => gunfireSound.pause());
  reloadSound.play().then(() => reloadSound.pause());

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS
    DeviceOrientationEvent.requestPermission()
      .then(result => {
        if (result === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          logDebug('Orientation permission granted');
        } else {
          logDebug('Orientation permission denied');
        }
      })
      .catch(err => logDebug('Orientation error: ' + err));
  } else {
    // Android / desktop
    window.addEventListener('deviceorientation', handleOrientation);
    logDebug('Orientation listener added');
  }
});

function handleOrientation(event) {
  tiltX = event.gamma / 90; // normalized -1..1
  tiltY = event.beta / 90;  // normalized -1..1
}

// ------------------------
// Send input to PC
// ------------------------
function sendInput() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const payload = {
      x: tiltX - calibrateOffset.x,
      y: tiltY - calibrateOffset.y,
      fire: firePressed,
      reload: reloadPressed,
      calibrate: calibratePressed
    };
    ws.send(JSON.stringify({ type: 'input', payload }));

    logDebug(
      `tiltX:${tiltX.toFixed(2)} tiltY:${tiltY.toFixed(2)} | fire:${firePressed} reload:${reloadPressed} calibrate:${calibratePressed}`
    );
  }
}

// ------------------------
// Debug helper
// ------------------------
function logDebug(msg) {
  console.log(msg);
  debugDiv.innerText = msg;
}

// ------------------------
// Main loop
// ------------------------
function loop() {
  sendInput();
  requestAnimationFrame(loop);
}

// ------------------------
// Start
// ------------------------
connectWebSocket();
loop();
