/**
 * API chẩn đoán ZeroClaw
 *
 * - GET /api/diagnostics/doctor        -> zeroclaw doctor
 * - GET /api/diagnostics/channel       -> zeroclaw channel doctor
 * - GET /api/diagnostics/daemon        -> đọc daemon_state.json
 */
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { run } = require('../utils/shell');
const { getConfigDir } = require('../utils/backup');

const router = express.Router();

const ZEROCLAW_BIN = process.env.ZEROCLAW_BIN || 'zeroclaw';
const CONFIG_DIR = getConfigDir();
const DAEMON_STATE_PATH = process.env.ZEROCLAW_DAEMON_STATE ||
  path.join(CONFIG_DIR, 'daemon_state.json');

/**
 * Parse output của `zeroclaw doctor` thành JSON có cấu trúc.
 * Best-effort: nếu không parse được hết vẫn giữ nguyên raw.
 * @param {string} stdout
 */
function parseDoctor(stdout) {
  const lines = stdout.split('\n').map((l) => l.trimEnd());

  const result = {
    raw: stdout,
    sections: {},
    summary: null,
  };

  // Bỏ dòng log INFO đầu tiên nếu có
  let idx = 0;
  if (lines[0] && /\bINFO\b/.test(lines[0])) {
    idx = 1;
  }

  let currentSection = null;

  for (; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('🩺')) {
      // Tiêu đề ZeroClaw Doctor
      result.title = trimmed;
      continue;
    }

    // Summary dòng cuối cùng
    if (/^Summary:/i.test(trimmed)) {
      result.summary = trimmed.replace(/^Summary:\s*/i, '').trim();
      continue;
    }

    // Section header dạng: [config]
    const mSection = trimmed.match(/^\[([a-zA-Z0-9_-]+)\]$/);
    if (mSection) {
      currentSection = mSection[1];
      if (!result.sections[currentSection]) {
        result.sections[currentSection] = [];
      }
      continue;
    }

    // Dòng check bắt đầu bằng dấu tick
    const mCheck = trimmed.match(/^(✅|⚠️|❌)\s*(.+)$/u);
    if (mCheck && currentSection) {
      const statusIcon = mCheck[1];
      const text = mCheck[2].trim();
      let status = 'ok';
      if (statusIcon === '⚠️') status = 'warning';
      if (statusIcon === '❌') status = 'error';

      // Thử tách key: value
      let label = text;
      let detail = null;
      const kv = text.split(':');
      if (kv.length > 1) {
        label = kv[0].trim();
        detail = kv.slice(1).join(':').trim();
      }

      result.sections[currentSection].push({
        status,
        label,
        detail,
        raw: text,
      });
      continue;
    }
  }

  return result;
}

/**
 * Parse output của `zeroclaw channel doctor`.
 * @param {string} stdout
 */
function parseChannelDoctor(stdout) {
  const lines = stdout.split('\n').map((l) => l.trimEnd());
  const result = {
    raw: stdout,
    channels: [],
    summary: null,
  };

  let idx = 0;
  if (lines[0] && /\bINFO\b/.test(lines[0])) {
    idx = 1;
  }

  for (; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('🩺')) {
      result.title = trimmed;
      continue;
    }

    if (/^Summary:/i.test(trimmed)) {
      result.summary = trimmed.replace(/^Summary:\s*/i, '').trim();
      continue;
    }

    const m = trimmed.match(/^(✅|⚠️|❌)\s*([A-Za-z ]+)\s+(.*)$/u);
    if (m) {
      const icon = m[1];
      const name = m[2].trim();
      const detail = m[3].trim();
      let status = 'ok';
      if (icon === '⚠️') status = 'warning';
      if (icon === '❌') status = 'error';
      result.channels.push({ name, status, detail, icon });
    }
  }

  return result;
}

/**
 * GET /api/diagnostics/doctor
 */
router.get('/doctor', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['doctor'], {
      timeout: 20000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw doctor timed out' });
    }
    if (exitCode !== 0) {
      return res.status(500).json({
        error: 'zeroclaw doctor failed',
        exitCode,
        stdout,
        stderr,
      });
    }

    const parsed = parseDoctor(stdout);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/diagnostics/channel
 */
router.get('/channel', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['channel', 'doctor'], {
      timeout: 15000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw channel doctor timed out' });
    }
    if (exitCode !== 0) {
      return res.status(500).json({
        error: 'zeroclaw channel doctor failed',
        exitCode,
        stdout,
        stderr,
      });
    }

    const parsed = parseChannelDoctor(stdout);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/diagnostics/daemon
 * Đọc daemon_state.json và trả JSON.
 */
router.get('/daemon', async (_req, res) => {
  try {
    const content = await fs.readFile(DAEMON_STATE_PATH, 'utf8');
    try {
      const json = JSON.parse(content);
      res.json(json);
    } catch (parseErr) {
      res.status(500).json({
        error: 'Failed to parse daemon_state.json',
        detail: parseErr.message,
      });
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'daemon_state.json not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

