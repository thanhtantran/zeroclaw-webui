/**
 * API quản lý config.toml
 * GET /api/config - đọc nội dung
 * PUT /api/config - ghi (validate TOML, backup, ghi)
 * GET /api/config/backups - liệt kê backup
 * POST /api/config/restore/:filename - restore từ backup
 */
const express = require('express');
const toml = require('@iarna/toml');
const {
  readConfig,
  writeConfig,
  createBackup,
  listBackups,
  readBackup,
} = require('../utils/backup');

const router = express.Router();

/**
 * GET /api/config
 * Trả về nội dung config.toml dạng text/plain
 */
router.get('/', async (_req, res) => {
  try {
    const content = await readConfig();
    res.type('text/plain').send(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Config file not found' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/config
 * Body: raw text (nội dung TOML). Validate bằng @iarna/toml, backup rồi ghi.
 */
router.put('/', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const content = req.body;
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Body must be raw TOML text' });
  }

  try {
    toml.parse(content);
  } catch (err) {
    return res.status(400).json({
      error: 'Invalid TOML syntax',
      detail: err.message,
    });
  }

  try {
    let currentContent;
    try {
      currentContent = await readConfig();
    } catch (e) {
      if (e.code === 'ENOENT') currentContent = '';
      else throw e;
    }
    const backupFilename = await createBackup(currentContent);
    await writeConfig(content);
    res.json({
      ok: true,
      backup: backupFilename,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/config/backups
 * Liệt kê các file backup (filename + mtime)
 */
router.get('/backups', async (_req, res) => {
  try {
    const backups = await listBackups();
    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/config/restore/:filename
 * Restore config từ file backup (chỉ basename, validate TOML rồi ghi).
 */
router.post('/restore/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename' });
  }

  let content;
  try {
    content = await readBackup(filename);
  } catch (err) {
    if (err.message === 'Invalid backup filename' || err.message === 'Not a backup file') {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    throw err;
  }

  try {
    toml.parse(content);
  } catch (err) {
    return res.status(400).json({
      error: 'Invalid TOML in backup',
      detail: err.message,
    });
  }

  try {
    await writeConfig(content);
    res.json({ ok: true, restored: filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
