/**
 * WebSocket giao tiếp trực tiếp với Agent (CLI: `zeroclaw agent`)
 * WS path: /ws/agent
 * Tin nhắn:
 *  - Server -> Client:
 *      { event: 'status', status: 'connected'|'disconnected' }
 *      { event: 'output', data: '...' }
 *      { event: 'error', error: '...' }
 *  - Client -> Server:
 *      { type: 'input', data: '...' }  // ghi vào stdin của tiến trình agent
 */
const WebSocket = require('ws');
const { spawn } = require('child_process');

function initAgentWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/agent' });

  wss.on('connection', (ws) => {
    let child = null;

    try {
      child = spawn('zeroclaw', ['agent'], {
        shell: false,
        windowsHide: true,
      });
    } catch (e) {
      try {
        ws.send(JSON.stringify({ event: 'error', error: e && e.message ? e.message : String(e) }));
      } catch (_) {}
      ws.close();
      return;
    }

    // Trạng thái
    try {
      ws.send(JSON.stringify({ event: 'status', status: 'connected' }));
    } catch (_) {}

    // Stream stdout/stderr về client
    const sendOutput = (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ event: 'output', data: chunk.toString() }));
        } catch (_) {}
      }
    };
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', sendOutput);
    child.stderr?.on('data', sendOutput);

    // Nhận input từ client -> ghi stdin cho agent
    ws.on('message', (data) => {
      let msg = null;
      try { msg = JSON.parse(data.toString()); } catch (_) {}
      if (!msg || msg.type !== 'input') return;
      const text = String(msg.data || '');
      try {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.write(text + '\n');
        }
      } catch (e) {
        try {
          ws.send(JSON.stringify({ event: 'error', error: e && e.message ? e.message : String(e) }));
        } catch (_) {}
      }
    });

    const cleanup = () => {
      try { child?.kill(); } catch (_) {}
      try { ws.send(JSON.stringify({ event: 'status', status: 'disconnected' })); } catch (_) {}
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    child.on('close', () => {
      cleanup();
      try { ws.close(); } catch (_) {}
    });
    child.on('error', (e) => {
      try {
        ws.send(JSON.stringify({ event: 'error', error: e && e.message ? e.message : String(e) }));
      } catch (_) {}
      cleanup();
      try { ws.close(); } catch (_) {}
    });
  });
}

module.exports = { initAgentWebSocket };