// server.js
//
// Simple HTTPS static file server + a single WebSocket relay.
// Expects cert.pem and key.pem in project root (change names below if different).

const fs = require('fs');
const path = require('path');
const express = require('express');
const https = require('https');
const WebSocket = require('ws');

// prefer cert files in the `cert/` subfolder, fall back to project root
const CERT_DIR = path.join(__dirname, 'cert');
const CERT_PATH = fs.existsSync(path.join(CERT_DIR, 'cert.pem'))
  ? path.join(CERT_DIR, 'cert.pem')
  : path.join(__dirname, 'cert.pem');
const KEY_PATH = fs.existsSync(path.join(CERT_DIR, 'key.pem'))
  ? path.join(CERT_DIR, 'key.pem')
  : path.join(__dirname, 'key.pem');
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
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'text/javascript');
    }
  }
}));

const CRASH_REPORT_DIR = path.join(__dirname, 'crash-reports');
const DEBUG_RUNTIME_STATE_PATH = path.join(__dirname, 'debug-runtime-state.json');

function ensureCrashReportDir() {
  if (!fs.existsSync(CRASH_REPORT_DIR)) {
    fs.mkdirSync(CRASH_REPORT_DIR, { recursive: true });
  }
}

function safeFilePart(value, fallback = 'unknown') {
  const str = String(value || fallback).trim().toLowerCase();
  const clean = str.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || fallback;
}

function formatSection(title, content) {
  const lines = [];
  lines.push(`=== ${title} ===`);
  if (typeof content === 'string') {
    lines.push(content);
  } else {
    try {
      lines.push(JSON.stringify(content ?? null, null, 2));
    } catch (err) {
      lines.push(`<<failed to stringify section: ${err?.message || err}>>`);
    }
  }
  lines.push('');
  return lines;
}

app.post('/api/crash-report', (req, res) => {
  try {
    ensureCrashReportDir();

    const payload = req.body || {};
    const eventType = safeFilePart(payload.eventType, 'runtime');
    const stamp = new Date();
    const stampIso = stamp.toISOString();
    const fileStamp = stampIso.replace(/[:.]/g, '-');
    const fileName = `crash_${fileStamp}_${eventType}.txt`;
    const filePath = path.join(CRASH_REPORT_DIR, fileName);

    const report = [];
    report.push('Lightgun Crash Report');
    report.push('=====================');
    report.push(`GeneratedAt: ${stampIso}`);
    report.push(`RemoteIP: ${req.socket?.remoteAddress || 'unknown'}`);
    report.push(`UserAgent: ${req.headers['user-agent'] || 'unknown'}`);
    report.push('');

    report.push(...formatSection('Event', {
      eventType: payload.eventType || null,
      createdAt: payload.createdAt || null,
      reportVersion: payload.reportVersion || null,
      message: payload.error?.message || null
    }));

    report.push(...formatSection('Error', payload.error || null));
    report.push(...formatSection('Context', payload.context || null));
    report.push(...formatSection('WebGL', payload.webgl || null));
    report.push(...formatSection('Renderer', payload.renderer || null));
    report.push(...formatSection('Browser', payload.browser || null));
    report.push(...formatSection('Performance', payload.performance || null));
    report.push(...formatSection('Frames', payload.frames || []));
    report.push(...formatSection('Extra', payload.extra || null));
    report.push(...formatSection('Breadcrumbs', payload.breadcrumbs || []));

    fs.writeFileSync(filePath, report.join('\n'), 'utf8');

    res.json({
      ok: true,
      fileName,
      relativePath: `crash-reports/${fileName}`
    });
  } catch (err) {
    console.error('Failed to write crash report:', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
});

// API: list textures under public/assets/textures (recursive)
app.get('/api/list-textures', (req, res) => {
  const texDir = path.join(__dirname, 'public', 'assets', 'textures');
  const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']);
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) walk(p);
      else if (it.isFile()) {
        if (exts.has(path.extname(it.name).toLowerCase())) {
          // return path relative to public/ so client can fetch directly
          const rel = path.relative(path.join(__dirname, 'public'), p).split(path.sep).join('/');
          out.push('/' + rel);
        }
      }
    }
  }
  walk(texDir);
  res.json({ textures: out });
});

app.get('/api/debug-runtime-state', (req, res) => {
  try {
    if (!fs.existsSync(DEBUG_RUNTIME_STATE_PATH)) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    const raw = fs.readFileSync(DEBUG_RUNTIME_STATE_PATH, 'utf8');
    const state = JSON.parse(raw);
    res.json({ ok: true, state });
  } catch (err) {
    console.error('Failed to read debug runtime state:', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
});

app.post('/api/debug-runtime-state', (req, res) => {
  try {
    const payload = req.body || {};
    const state = payload.state || null;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, error: 'state object required' });
    }

    const toWrite = {
      savedAt: new Date().toISOString(),
      state
    };

    fs.writeFileSync(DEBUG_RUNTIME_STATE_PATH, JSON.stringify(toWrite, null, 2), 'utf8');
    res.json({ ok: true, relativePath: 'debug-runtime-state.json', savedAt: toWrite.savedAt });
  } catch (err) {
    console.error('Failed to write debug runtime state:', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown error' });
  }
});

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

function tryListen(startPort, maxAttempts = 10) {
  let attempt = 0;
  const tryPort = (p) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE') {
        server.close();
        attempt += 1;
        if (attempt > maxAttempts) {
          console.error(`All ports ${startPort}-${startPort + maxAttempts} in use. Exiting.`);
          process.exit(1);
        } else {
          const next = startPort + attempt;
          console.log(`Port ${p} in use, trying ${next}...`);
          tryPort(next);
        }
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    };

    server.once('error', onError);
    server.listen(p, () => {
      console.log(`HTTPS + WebSocket server listening on port ${p}`);
      console.log(`Open https://<your-hostname>:${p}/game.html on PC and https://<your-host-ip>:${p}/controller.html on phone`);
    });
  };
  tryPort(startPort);
}

tryListen(PORT, 10);
