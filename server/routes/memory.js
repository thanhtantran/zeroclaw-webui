const express = require('express');
const { run } = require('../utils/shell');

const router = express.Router();

const ZEROCLAW_BIN = process.env.ZEROCLAW_BIN || 'zeroclaw';

const ANSI_PATTERN = /\x1B\[[0-?]*[ -\/]*[@-~]/g;

function stripAnsi(text) {
  return String(text || '').replace(ANSI_PATTERN, '');
}

function isZeroclawLogLine(line) {
  return /^\d{4}-\d{2}-\d{2}T.*\s(?:INFO|WARN|DEBUG|TRACE)\b/.test(String(line || '').trim());
}

function cleanCliOutput(text) {
  const cleaned = stripAnsi(text);
  const lines = cleaned.split(/\r?\n/).map((l) => l.trimEnd());
  const filtered = lines.filter((l) => {
    const t = String(l || '').trim();
    if (!t) return false;
    return !isZeroclawLogLine(t);
  });
  return filtered.join('\n').trim();
}

function parseMemoryList(cleaned) {
  const lines = String(cleaned || '').split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const entries = lines.map((line) => {
    const first = String(line).trim().split(/\s+/)[0] || '';
    return { key: first, line };
  });
  return entries.filter((e) => e.key);
}

router.get('/list', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['memory', 'list'], {
      timeout: 20000,
    });

    if (timedOut) return res.status(504).json({ error: 'zeroclaw memory list timed out' });
    if (exitCode !== 0) {
      return res.status(500).json({ error: 'zeroclaw memory list failed', exitCode, stdout, stderr });
    }

    const output = cleanCliOutput(stdout);
    res.json({
      raw: output,
      entries: parseMemoryList(output),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['memory', 'stats'], {
      timeout: 20000,
    });

    if (timedOut) return res.status(504).json({ error: 'zeroclaw memory stats timed out' });
    if (exitCode !== 0) {
      return res.status(500).json({ error: 'zeroclaw memory stats failed', exitCode, stdout, stderr });
    }

    const output = cleanCliOutput(stdout);
    res.json({ raw: output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/get', async (req, res) => {
  try {
    const key = typeof req.query.key === 'string' ? req.query.key.trim() : '';
    if (!key) return res.status(400).json({ error: 'key is required' });
    if (key.length > 4096) return res.status(400).json({ error: 'key too long' });

    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['memory', 'get', key], {
      timeout: 20000,
    });

    if (timedOut) return res.status(504).json({ error: 'zeroclaw memory get timed out' });
    if (exitCode !== 0) {
      return res.status(500).json({ error: 'zeroclaw memory get failed', exitCode, stdout, stderr });
    }

    const output = cleanCliOutput(stdout);
    res.json({ key, raw: output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;