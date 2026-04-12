/**
 * API quản lý channels của ZeroClaw
 *
 * - GET  /api/channel/list           -> zeroclaw channel list
 * - GET  /api/channel/doctor         -> zeroclaw channel doctor
 * - POST /api/channel/bind-telegram  -> zeroclaw channel bind-telegram <chat_id>
 * - GET  /api/channel/telegram-config -> Get Telegram config from config.toml
 * - POST /api/channel/telegram-config -> Set Telegram config in config.toml
 */
const express = require('express');
const toml = require('@iarna/toml');
const { run } = require('../utils/shell');
const { readConfig, writeConfig, createBackup } = require('../utils/backup');

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

/**
 * GET /api/channel/telegram-config
 * Read Telegram configuration from config.toml
 */
router.get('/telegram-config', async (_req, res) => {
  try {
    const content = await readConfig();
    const config = toml.parse(content);
    
    const telegramConfig = config.channels_config?.telegram || null;
    
    res.json({
      exists: !!telegramConfig,
      config: telegramConfig ? {
        enabled: telegramConfig.enabled,
        hasToken: !!telegramConfig.bot_token,
        tokenPreview: telegramConfig.bot_token 
          ? `${telegramConfig.bot_token.substring(0, 10)}...` 
          : null,
        allowed_users: telegramConfig.allowed_users,
        stream_mode: telegramConfig.stream_mode,
        interrupt_on_new_message: telegramConfig.interrupt_on_new_message,
        mention_only: telegramConfig.mention_only,
      } : null,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Config file not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/channel/telegram-config
 * Body: { botToken: "token_string" }
 * Write Telegram configuration to config.toml
 */
router.post('/telegram-config', async (req, res) => {
  const { botToken } = req.body;

  if (!botToken || typeof botToken !== 'string') {
    return res.status(400).json({ error: 'botToken is required and must be a string' });
  }

  try {
    let content;
    let config;
    
    try {
      content = await readConfig();
      config = toml.parse(content);
    } catch (e) {
      if (e.code === 'ENOENT') {
        // Create new config if doesn't exist
        config = {};
      } else {
        throw e;
      }
    }

    // Ensure channels_config exists
    if (!config.channels_config) {
      config.channels_config = {};
    }

    // Set Telegram configuration
    config.channels_config.telegram = {
      enabled: true,
      bot_token: botToken.trim(),
      allowed_users: ['*'],
      stream_mode: 'off',
      draft_update_interval_ms: 1000,
      interrupt_on_new_message: false,
      mention_only: false,
    };

    // Create backup before writing
    if (content) {
      await createBackup(content);
    }

    // Write updated config
    const newContent = toml.stringify(config);
    await writeConfig(newContent);

    res.json({
      ok: true,
      message: 'Telegram configuration saved',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
