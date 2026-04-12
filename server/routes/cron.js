/**
 * API quản lý cron jobs của ZeroClaw
 *
 * - GET    /api/cron/list    -> zeroclaw cron list
 * - POST   /api/cron/add     -> zeroclaw cron add "<schedule>" --prompt "<prompt>"
 * - DELETE /api/cron/:id     -> zeroclaw cron remove <id>
 */
const express = require('express');
const { run } = require('../utils/shell');

const router = express.Router();

const ZEROCLAW_BIN = process.env.ZEROCLAW_BIN || 'zeroclaw';

const ANSI_PATTERN = /\x1B\[[0-?]*[ -\/]*[@-~]/g;

function stripAnsi(text) {
  return String(text || '').replace(ANSI_PATTERN, '');
}

/**
 * GET /api/cron/list
 * Chạy `zeroclaw cron list` và trả về danh sách cron jobs.
 */
router.get('/list', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['cron', 'list'], {
      timeout: 15000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw cron list timed out' });
    }
    if (exitCode !== 0) {
      return res.status(500).json({
        error: 'zeroclaw cron list failed',
        exitCode,
        stdout,
        stderr,
      });
    }

    const cleaned = stripAnsi(stdout);
    const lines = cleaned.split('\n').map((l) => l.trimEnd()).filter(Boolean);

    res.json({
      exitCode,
      raw: cleaned.trim(),
      lines,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/cron/add
 * Body: { schedule: "schedule_string", prompt: "Check system health" }
 * Chạy `zeroclaw cron add "<schedule>" --prompt "<prompt>"`.
 */
router.post('/add', async (req, res) => {
  const { schedule, prompt } = req.body;

  if (!schedule || typeof schedule !== 'string') {
    return res.status(400).json({ error: 'schedule is required and must be a string' });
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required and must be a string' });
  }

  try {
    const { stdout, stderr, exitCode, timedOut } = await run(
      ZEROCLAW_BIN,
      ['cron', 'add', schedule, '--prompt', prompt],
      { timeout: 30000 }
    );

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw cron add timed out' });
    }

    res.json({
      exitCode,
      stdout: stripAnsi(stdout),
      stderr: stripAnsi(stderr),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/cron/:id
 * Chạy `zeroclaw cron remove <id>`.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const { stdout, stderr, exitCode, timedOut } = await run(
      ZEROCLAW_BIN,
      ['cron', 'remove', id],
      { timeout: 30000 }
    );

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw cron remove timed out' });
    }

    res.json({
      exitCode,
      stdout: stripAnsi(stdout),
      stderr: stripAnsi(stderr),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
