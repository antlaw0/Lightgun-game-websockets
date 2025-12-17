// server.js
//
// Simple HTTPS static file server + a single WebSocket relay.
// Expects cert.pem and key.pem in project root (change names below if different).

const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');
const WebSocket = require('ws');

const CERT_PATH = path.join(__dirname, 'cert.pem');
const KEY_PATH = path.join(__dirname, 'key.pem');
const PORT = 8080;

if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
  console.error('Missing cert.pem or key.pem in project root. Place your cert/key and restart.');
  process.exit(1);
}

const options = {
  cert: fs.readFileSync(CERT_PATH),
  key: fs.readFileSync(KEY_PATH),
};

const app = express();
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'text/javascript');
    }
  }
}));

const server = https.createServer(options, app);

const wss = new WebSocket.Server({ server });

let gameClient = null;
let controllerClient = null;

wss.on('connection', (ws, req) => {
  console.log('WS: connection from', req.socket.remoteAddress);

  // expect first message to be registration: { type: 'register', client: 'game' | 'controller' }
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'register') {
        if (msg.client === 'game') {
          gameClient = ws;
          ws.clientType = 'game';
          console.log('Registered game client');
          ws.send(JSON.stringify({ type: 'registered', client: 'game' }));
        } else if (msg.client === 'controller') {
          controllerClient = ws;
          ws.clientType = 'controller';
          console.log('Registered controller client');
          ws.send(JSON.stringify({ type: 'registered', client: 'controller' }));
        } else {
          console.log('Unknown register client:', msg.client);
        }
        return;
      }

      // Relay controller -> game
      if (msg.type === 'controller' && gameClient && gameClient.readyState === WebSocket.OPEN) {
        // pass through
        gameClient.send(JSON.stringify(msg));
      }

      // Optionally allow game -> controller messages in future
      if (msg.type === 'game' && controllerClient && controllerClient.readyState === WebSocket.OPEN) {
        controllerClient.send(JSON.stringify(msg));
      }
    } catch (e) {
      console.warn('WS: could not parse message', e);
    }
  });

  ws.on('close', () => {
    console.log('WS: connection closed for clientType=', ws.clientType);
    if (ws === gameClient) gameClient = null;
    if (ws === controllerClient) controllerClient = null;
  });

  ws.on('error', (err) => {
    console.error('WS error:', err);
  });
});

// Simple ping to keep connections alive & detect dead peers
setInterval(() => {
  wss.clients.forEach((c) => {
    if (!c.isAlive) {
      console.log('Terminating dead client');
      return c.terminate();
    }
    c.isAlive = false;
    c.ping(() => {});
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`HTTPS + WebSocket server listening on port ${PORT}`);
  console.log(`Open https://<your-hostname>:${PORT}/game.html on PC and https://<your-host-ip>:${PORT}/controller.html on phone`);
});
