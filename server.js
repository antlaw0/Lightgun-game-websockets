// server.js (HTTPS + WebSocket)
//
// - Serves files from /public via HTTPS
// - Keeps track of two clients: "game" and "controller"
// - Forwards controller input -> game
// - Forwards game audio events -> controller
// - Stores latest controller state so a late-connecting game gets the current input

const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');
const WebSocket = require('ws');

const app = express();
const PORT = 8080;

// ==== SSL ====
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
};

// ==== Express static ====
app.use(express.static(path.join(__dirname, 'public')));

// Basic routing (optional, static will already serve these)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));
app.get('/controller.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'controller.html')));

// ==== HTTPS server ====
const server = https.createServer(sslOptions, app);

// ==== WebSocket server attached to HTTPS server ====
const wss = new WebSocket.Server({ server });

// Track clients
let gameClient = null;
let controllerClient = null;

// Store latest controller state so a game connecting later can get the latest
let latestControllerState = null;

function safeSend(ws, obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify(obj));
    return true;
  } catch (err) {
    console.error('safeSend error', err);
    return false;
  }
}

wss.on('connection', (ws, req) => {
  console.log('New WS connection from', req.socket.remoteAddress);

  // per-socket metadata
  ws.role = null; // 'game' | 'controller' after registration

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn('Received non-JSON message, ignoring:', raw.toString());
      return;
    }

    // Registration message: { type: 'register', client: 'game' | 'controller' }
    if (data.type === 'register') {
      if (data.client === 'game') {
        gameClient = ws;
        ws.role = 'game';
        console.log('Registered game client');

        // If we already have latest controller state, send it immediately so the game has something to work with
        if (latestControllerState) {
          safeSend(gameClient, { type: 'controller', payload: latestControllerState });
        }
      } else if (data.client === 'controller') {
        controllerClient = ws;
        ws.role = 'controller';
        console.log('Registered controller client');

        // Optionally inform controller of current connection state
        safeSend(controllerClient, { type: 'info', payload: { msg: 'controller registered' } });
      } else {
        console.warn('Unknown client type in register:', data.client);
      }
      return;
    }

    // Controller input: { type: 'input', payload: { x, y, fire, reload, calibrate } }
    if (data.type === 'input' && ws.role === 'controller') {
      latestControllerState = data.payload;
      // forward to game if connected
      if (gameClient && gameClient.readyState === WebSocket.OPEN) {
        safeSend(gameClient, { type: 'controller', payload: data.payload });
      }
      return;
    }

    // Audio events from game to controller: { type: 'audio', payload: { sound: 'gunfire' } }
    if (data.type === 'audio' && ws.role === 'game') {
      if (controllerClient && controllerClient.readyState === WebSocket.OPEN) {
        safeSend(controllerClient, { type: 'audio', payload: data.payload });
      } else {
        // controller not connected; you could buffer audio events if desired
        console.log('Audio event from game but controller not connected. Dropping audio:', data.payload);
      }
      return;
    }

    // Debug / passthrough support: let game and controller exchange arbitrary messages if prefixed
    if (data.type === 'raw' && data.target) {
      if (data.target === 'game' && gameClient) safeSend(gameClient, data.payload);
      if (data.target === 'controller' && controllerClient) safeSend(controllerClient, data.payload);
      return;
    }

    console.warn('Unhandled message', data);
  });

  ws.on('close', () => {
    console.log('WS closed for role:', ws.role);
    if (ws === gameClient) {
      gameClient = null;
      console.log('Cleared game client');
    }
    if (ws === controllerClient) {
      controllerClient = null;
      console.log('Cleared controller client');
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// Optionally, a heartbeat to close dead connections (keeps memory clean)
function noop() {}
function heartbeat() { this.isAlive = true; }

wss.on('connection', function connection(ws) {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) {
      console.log('Terminating dead connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000);

// Start server
server.listen(PORT, () => {
  console.log(`HTTPS server running at https://localhost:${PORT}`);
});
