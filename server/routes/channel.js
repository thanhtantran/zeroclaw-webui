/**
 * API quản lý channels của ZeroClaw
 *
 * - GET  /api/channel/list           -> zeroclaw channel list
 * - GET  /api/channel/doctor         -> zeroclaw channel doctor
 * - POST /api/channel/bind-telegram  -> zeroclaw channel bind-telegram <chat_id>
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
 * GET /api/channel/list
 * Chạy `zeroclaw channel list` và trả về danh sách channels.
 */
router.get('/list', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['channel', 'list'], {
      timeout: 15000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw channel list timed out' });
    }
    if (exitCode !== 0) {
      return res.status(500).json({
        error: 'zeroclaw channel list failed',
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
 * GET /api/channel/doctor
 * Chạy `zeroclaw channel doctor` để kiểm tra sức khỏe channels.
 */
router.get('/doctor', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['channel', 'doctor'], {
      timeout: 30000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw channel doctor timed out' });
    }

    const cleaned = stripAnsi(stdout);
    const lines = cleaned.split('\n').map((l) => l.trimEnd()).filter(Boolean);

    res.json({
      exitCode,
      raw: cleaned.trim(),
      stderr: stripAnsi(stderr),
      lines,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/channel/bind-telegram
 * Body: { chatId: "123456789" }
 * Chạy `zeroclaw channel bind-telegram <chatId>`.
 */
router.post('/bind-telegram', async (req, res) => {
  const { chatId } = req.body;

  if (!chatId || typeof chatId !== 'string') {
    return res.status(400).json({ error: 'chatId is required and must be a string' });
  }

  try {
    const { stdout, stderr, exitCode, timedOut } = await run(
      ZEROCLAW_BIN,
      ['channel', 'bind-telegram', chatId],
      { timeout: 30000 }
    );

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw channel bind-telegram timed out' });
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
