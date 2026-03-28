// Diagnostic logging API for playtest sessions
// POST /api/diagnostic-log { event, details, sessionId, timestamp }
// POST /api/diagnostic-log-control { action: 'start'|'stop', sessionId }

const fs = require('fs');
const path = require('path');

const DIAGNOSTIC_LOG_PATH = path.join(__dirname, 'diagnostic.txt');
let isRecordingDiagnostics = false;
let currentSessionId = null;

function appendDiagnosticLog({ event, details, sessionId, timestamp }) {
  const now = timestamp || new Date().toISOString();
  const msg = `[${now}] [${event}] ${details} [sessionId=${sessionId || 'none'}]\n`;
  fs.appendFileSync(DIAGNOSTIC_LOG_PATH, msg);
}

function writeDiagnosticControl(action, sessionId) {
  const now = new Date().toISOString();
  const msg = `[${now}] [CONTROL] ${action.toUpperCase()} DIAGNOSTIC RECORDING [sessionId=${sessionId || 'none'}]\n`;
  fs.appendFileSync(DIAGNOSTIC_LOG_PATH, msg);
}

module.exports = {
  DIAGNOSTIC_LOG_PATH,
  isRecordingDiagnostics,
  currentSessionId,
  appendDiagnosticLog,
  writeDiagnosticControl,
};
