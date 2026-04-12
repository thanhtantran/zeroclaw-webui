/**
 * API quản lý auth profiles của ZeroClaw
 *
 * - POST /api/auth/login   -> zeroclaw auth login --provider <name>
 * - GET  /api/auth/status  -> zeroclaw auth status
 * - POST /api/auth/use     -> zeroclaw auth use --provider <name> --profile <profile>
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
 * POST /api/auth/login
 * Body: { provider: "anthropic" }
 * Chạy `zeroclaw auth login --provider <name>`.
 */
router.post('/login', async (req, res) => {
  const { provider } = req.body;

  if (!provider || typeof provider !== 'string') {
    return res.status(400).json({ error: 'provider is required and must be a string' });
  }

  try {
    const { stdout, stderr, exitCode, timedOut } = await run(
      ZEROCLAW_BIN,
      ['auth', 'login', '--provider', provider],
      { timeout: 60000 }
    );

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw auth login timed out' });
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
 * GET /api/auth/status
 * Chạy `zeroclaw auth status` và trả về trạng thái auth.
 */
router.get('/status', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['auth', 'status'], {
      timeout: 15000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw auth status timed out' });
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
 * POST /api/auth/use
 * Body: { provider: "anthropic", profile: "default" }
 * Chạy `zeroclaw auth use --provider <name> --profile <profile>`.
 */
router.post('/use', async (req, res) => {
  const { provider, profile } = req.body;

  if (!provider || typeof provider !== 'string') {
    return res.status(400).json({ error: 'provider is required and must be a string' });
  }
  if (!profile || typeof profile !== 'string') {
    return res.status(400).json({ error: 'profile is required and must be a string' });
  }

  try {
    const { stdout, stderr, exitCode, timedOut } = await run(
      ZEROCLAW_BIN,
      ['auth', 'use', '--provider', provider, '--profile', profile],
      { timeout: 30000 }
    );

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw auth use timed out' });
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
