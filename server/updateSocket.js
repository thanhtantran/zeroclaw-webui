/**
 * WebSocket cho stream log build ZeroClaw.
 *
 * Tạo endpoint WS tại path: /ws/build
 * Các message gửi dạng JSON:
 *  - { event: 'log', data: '...' }
 *  - { event: 'status', status: 'idle'|'running'|'success'|'failed', updatedAt }
 */
const WebSocket = require('ws');

/** @type {Set<import('ws').WebSocket>} */
const buildClients = new Set();

let lastStatusPayload = null;

function initBuildWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/build' });

  wss.on('connection', (ws) => {
    buildClients.add(ws);

    // Gửi trạng thái hiện tại ngay khi connect (nếu có)
    if (lastStatusPayload) {
      try {
        ws.send(JSON.stringify(lastStatusPayload));
      } catch (e) {
        console.warn('[ws:build] send failed:', e && e.message ? e.message : String(e));
      }
    }

    ws.on('close', () => {
      buildClients.delete(ws);
    });
    ws.on('error', () => {
      buildClients.delete(ws);
    });
  });
}

function broadcastBuildLog(chunk) {
  const payload = JSON.stringify({ event: 'log', data: chunk });
  for (const ws of buildClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch (e) {
        console.warn('[ws:build] send failed:', e && e.message ? e.message : String(e));
      }
    }
  }
}

function broadcastBuildStatus(status) {
  const payload = {
    event: 'status',
    status,
    updatedAt: new Date().toISOString(),
  };
  lastStatusPayload = payload;
  const json = JSON.stringify(payload);
  for (const ws of buildClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(json);
      } catch (e) {
        console.warn('[ws:build] send status failed:', e && e.message ? e.message : String(e));
      }
    }
  }
}

function getLastBuildStatus() {
  return lastStatusPayload || {
    event: 'status',
    status: 'idle',
    updatedAt: null,
  };
}

module.exports = {
  initBuildWebSocket,
  broadcastBuildLog,
  broadcastBuildStatus,
  getLastBuildStatus,
};

