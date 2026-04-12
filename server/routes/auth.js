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

function isZeroclawLogLine(line) {
  return /^\d{4}-\d{2}-\d{2}T.*\s(?:INFO|WARN|DEBUG|TRACE|ERROR)\b/.test(String(line || '').trim());
}

function filterLogLines(text) {
  const cleaned = stripAnsi(text);
  const lines = cleaned.split('\n').map((l) => l.trimEnd());
  const filtered = lines.filter((l) => {
    const t = String(l || '').trim();
    if (!t) return false;
    // Skip log lines
    if (isZeroclawLogLine(t)) return false;
    // Skip Usage lines
    if (t.startsWith('Usage:')) return false;
    return true;
  });
  return filtered.join('\n').trim();
}

/**
 * POST /api/auth/login
 * Body: { provider: "openai-codex" | "anthropic" | "gemini" }
 * Start interactive login process
 */
router.post('/login', async (req, res) => {
  const { provider } = req.body;

  if (!provider || typeof provider !== 'string') {
    return res.status(400).json({ error: 'provider is required and must be a string' });
  }

  const validProviders = ['openai-codex', 'anthropic', 'gemini'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ 
      error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` 
    });
  }

  // For Anthropic, redirect to paste-token flow
  if (provider === 'anthropic') {
    return res.json({
      requiresToken: true,
      message: 'Anthropic requires manual token setup. Please use the "Paste Token" section below.',
    });
  }

  // For OpenAI Codex and Gemini, these require interactive OAuth
  // Return instructions for the user
  res.json({
    requiresInteractive: true,
    provider,
    message: provider === 'openai-codex' 
      ? 'OpenAI Codex requires device code flow. Please run this command in your terminal: zeroclaw auth login --provider openai-codex --device-code'
      : 'Gemini requires OAuth flow. Please run this command in your terminal: zeroclaw auth login --provider gemini --profile default',
  });
});

/**
 * POST /api/auth/paste-token
 * Body: { provider: "anthropic", token: "sk-..." }
 * For Anthropic: paste token directly
 */
router.post('/paste-token', async (req, res) => {
  const { provider, token } = req.body;

  if (!provider || typeof provider !== 'string') {
    return res.status(400).json({ error: 'provider is required and must be a string' });
  }
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required and must be a string' });
  }

  try {
    // For Anthropic, use paste-token command
    if (provider !== 'anthropic') {
      return res.status(400).json({ error: 'paste-token is only supported for anthropic provider' });
    }

    // Run the command and pipe the token to stdin
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let finished = false;

      const child = spawn(ZEROCLAW_BIN, [
        'auth', 
        'paste-token', 
        '--provider', 
        provider, 
        '--profile', 
        'default', 
        '--auth-kind', 
        'authorization'
      ], {
        shell: false,
        windowsHide: true,
      });

      const timeoutId = setTimeout(() => {
        if (finished) return;
        finished = true;
        try {
          child.kill('SIGKILL');
        } catch (_) {}
        res.status(504).json({ error: 'Command timed out' });
        resolve();
      }, 30000);

      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk;
      });

      // Write the token to stdin
      try {
        child.stdin?.write(token.trim() + '\n');
        child.stdin?.end();
      } catch (err) {
        if (!finished) {
          finished = true;
          clearTimeout(timeoutId);
          res.status(500).json({ error: `Failed to write token: ${err.message}` });
          resolve();
        }
        return;
      }

      child.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        res.status(500).json({ error: err.message });
        resolve();
      });

      child.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        res.json({
          exitCode: code,
          stdout: filterLogLines(stdout),
          stderr: stripAnsi(stderr),
        });
        resolve();
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/profiles
 * Read auth-profiles.json to get current profiles
 */
router.get('/profiles', async (_req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    // Try to read from ZEROCLAW_CONFIG_DIR or default location
    const configDir = process.env.ZEROCLAW_CONFIG_DIR || path.join(os.homedir(), '.config', 'zeroclaw');
    const profilesPath = path.join(configDir, 'auth-profiles.json');
    
    try {
      const content = await fs.readFile(profilesPath, 'utf8');
      const profiles = JSON.parse(content);
      res.json({ profiles });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json({ profiles: null, message: 'No auth profiles found' });
      }
      throw err;
    }
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

    const cleaned = filterLogLines(stdout);
    const lines = cleaned.split('\n').filter(Boolean);

    res.json({
      exitCode,
      raw: cleaned,
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
