/**
 * API trạng thái & service của ZeroClaw
 *
 * - GET  /api/service/status         -> zeroclaw status
 * - GET  /api/service/service-status -> zeroclaw service status
 * - POST /api/service/restart        -> zeroclaw service restart
 */
const express = require('express');
const { run } = require('../utils/shell');

const router = express.Router();

const ZEROCLAW_BIN = process.env.ZEROCLAW_BIN || 'zeroclaw';

/**
 * Parse output của `zeroclaw status` thành JSON thân thiện.
 * Hàm này thiết kế để \"best-effort\": nếu không parse được một phần,
 * vẫn trả về raw để debug.
 * @param {string} stdout
 */
function parseStatus(stdout) {
  const lines = stdout.split('\n').map((l) => l.trimEnd());

  // Bỏ các dòng log kỹ thuật (bắt đầu bằng timestamp + INFO ...)
  const filtered = lines.filter((l, idx) => {
    if (idx === 0 && /\bINFO\b/.test(l)) return false;
    return l.trim().length > 0;
  });

  const result = {
    raw: stdout,
    version: null,
    workspace: null,
    config_path: null,
    provider: null,
    model: null,
    observability: null,
    trace_storage: null,
    autonomy: null,
    runtime: null,
    heartbeat: null,
    memory: {
      backend: null,
      auto_save: null,
    },
    security: {
      workspace_only: null,
      allowed_roots: null,
      allowed_commands: null,
      max_actions_per_hour: null,
      max_cost_per_day: null,
      otp_enabled: null,
      estop_enabled: null,
    },
    channels: {},
    peripherals: {
      enabled: null,
      boards: null,
    },
  };

  let section = null;

  for (const line of filtered) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('🦀 ZeroClaw Status')) {
      continue;
    }

    if (/^Version:/i.test(trimmed)) {
      result.version = trimmed.split(':').slice(1).join(':').trim();
      continue;
    }
    if (/^Workspace:/i.test(trimmed)) {
      result.workspace = trimmed.split(':').slice(1).join(':').trim();
      continue;
    }
    if (/^Config:/i.test(trimmed)) {
      result.config_path = trimmed.split(':').slice(1).join(':').trim();
      continue;
    }

    if (trimmed.includes('Provider:')) {
      const m = trimmed.match(/Provider:\s*(.+?)$/);
      if (m) result.provider = m[1].trim();
      continue;
    }
    if (trimmed.includes('Model:')) {
      const m = trimmed.match(/Model:\s*(.+?)$/);
      if (m) result.model = m[1].trim();
      continue;
    }
    if (trimmed.includes('Observability:')) {
      const m = trimmed.match(/Observability:\s*(.+?)$/);
      if (m) result.observability = m[1].trim();
      continue;
    }
    if (trimmed.includes('Trace storage:')) {
      const m = trimmed.match(/Trace storage:\s*(.+?)$/);
      if (m) result.trace_storage = m[1].trim();
      continue;
    }
    if (trimmed.includes('Autonomy:')) {
      const m = trimmed.match(/Autonomy:\s*(.+?)$/);
      if (m) result.autonomy = m[1].trim();
      continue;
    }
    if (trimmed.includes('Runtime:')) {
      const m = trimmed.match(/Runtime:\s*(.+?)$/);
      if (m) result.runtime = m[1].trim();
      continue;
    }
    if (trimmed.includes('Heartbeat:')) {
      const m = trimmed.match(/Heartbeat:\s*(.+?)$/);
      if (m) result.heartbeat = m[1].trim();
      continue;
    }
    if (trimmed.includes('Memory:')) {
      const m = trimmed.match(/Memory:\s*(.+?)$/);
      if (m) {
        const text = m[1].trim();
        const backendMatch = text.match(/^([^(]+)\s*/);
        if (backendMatch) {
          result.memory.backend = backendMatch[1].trim();
        } else {
          result.memory.backend = text;
        }
        if (text.toLowerCase().includes('auto-save: on')) {
          result.memory.auto_save = true;
        } else if (text.toLowerCase().includes('auto-save: off')) {
          result.memory.auto_save = false;
        }
      }
      continue;
    }

    if (/^Security:/i.test(trimmed)) {
      section = 'security';
      continue;
    }
    if (/^Channels:/i.test(trimmed)) {
      section = 'channels';
      continue;
    }
    if (/^Peripherals:/i.test(trimmed)) {
      section = 'peripherals';
      continue;
    }

    if (section === 'security') {
      const secLine = trimmed.replace(/^[-•]\s*/, '');
      if (secLine.startsWith('Workspace only:')) {
        const v = secLine.split(':').slice(1).join(':').trim().toLowerCase();
        result.security.workspace_only = v === 'true' || v === 'yes';
      } else if (secLine.startsWith('Allowed roots:')) {
        const v = secLine.split(':').slice(1).join(':').trim();
        result.security.allowed_roots = v === '(none)' ? [] : v.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (secLine.startsWith('Allowed commands:')) {
        const v = secLine.split(':').slice(1).join(':').trim();
        result.security.allowed_commands = v.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (secLine.startsWith('Max actions/hour:')) {
        const v = secLine.split(':').slice(1).join(':').trim();
        result.security.max_actions_per_hour = Number(v) || null;
      } else if (secLine.startsWith('Max cost/day:')) {
        const m = secLine.match(/\$([\d.]+)/);
        result.security.max_cost_per_day = m ? Number(m[1]) : null;
      } else if (secLine.startsWith('OTP enabled:')) {
        const v = secLine.split(':').slice(1).join(':').trim().toLowerCase();
        result.security.otp_enabled = v === 'true' || v === 'yes';
      } else if (secLine.startsWith('E-stop enabled:')) {
        const v = secLine.split(':').slice(1).join(':').trim().toLowerCase();
        result.security.estop_enabled = v === 'true' || v === 'yes';
      }
      continue;
    }

    if (section === 'channels') {
      const m = trimmed.match(/^([A-Za-z ]+):\s*(✅|❌)\s*(.*)$/u);
      if (m) {
        const name = m[1].trim();
        const enabled = m[2] === '✅';
        const detail = m[3].trim();
        const key = name.toLowerCase().replace(/\s+/g, '_');
        result.channels[key] = { name, enabled, detail };
      }
      continue;
    }

    if (section === 'peripherals') {
      if (trimmed.startsWith('Enabled:')) {
        const v = trimmed.split(':').slice(1).join(':').trim().toLowerCase();
        result.peripherals.enabled = v === 'yes' || v === 'true';
      } else if (trimmed.startsWith('Boards:')) {
        const v = trimmed.split(':').slice(1).join(':').trim();
        result.peripherals.boards = Number(v) || null;
      }
      continue;
    }
  }

  return result;
}

/**
 * GET /api/service/status
 * Chạy `zeroclaw status` và trả về JSON đã parse.
 */
router.get('/status', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['status'], {
      timeout: 15000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw status timed out' });
    }
    if (exitCode !== 0) {
      return res.status(500).json({
        error: 'zeroclaw status failed',
        exitCode,
        stdout,
        stderr,
      });
    }

    const parsed = parseStatus(stdout);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/service/service-status
 * Chạy `zeroclaw service status`.
 * Vì format có thể thay đổi, tạm thời chỉ parse thành mảng dòng.
 */
router.get('/service-status', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['service', 'status'], {
      timeout: 15000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw service status timed out' });
    }
    if (exitCode !== 0) {
      return res.status(500).json({
        error: 'zeroclaw service status failed',
        exitCode,
        stdout,
        stderr,
      });
    }

    const lines = stdout.split('\n').map((l) => l.trimEnd());
    res.json({
      raw: stdout,
      exitCode,
      lines: lines.filter((l) => l.trim().length > 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/service/restart
 * Chạy `zeroclaw service restart`, trả về kết quả thô.
 */
router.post('/restart', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['service', 'restart'], {
      timeout: 30000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw service restart timed out' });
    }

    res.json({
      exitCode,
      stdout,
      stderr,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

