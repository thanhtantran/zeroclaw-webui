const express = require('express');
const fs = require('fs');
const path = require('path');
const { run } = require('../utils/shell');

const router = express.Router();

const ZEROCLAW_BIN = process.env.ZEROCLAW_BIN || 'zeroclaw';
const ZEROCLAW_WORKSPACE = process.env.ZEROCLAW_WORKSPACE || '';

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

async function resolveWorkspacePaths() {
  if (!ZEROCLAW_WORKSPACE) {
    throw new Error('ZEROCLAW_WORKSPACE is not set');
  }

  const workspaceAbs = path.resolve(ZEROCLAW_WORKSPACE);
  let workspaceReal = workspaceAbs;
  try {
    workspaceReal = await fs.promises.realpath(workspaceAbs);
  } catch (_) {
    throw new Error(`Workspace not found: ${workspaceAbs}`);
  }

  const memoryDirAbs = path.join(workspaceReal, 'memory');
  const memoryFileAbs = path.join(workspaceReal, 'MEMORY.md');

  return { workspaceReal, memoryDirAbs, memoryFileAbs };
}

function ensureInsideWorkspace(workspaceReal, targetPath) {
  const ws = path.resolve(workspaceReal);
  const tp = path.resolve(targetPath);
  const prefix = ws.endsWith(path.sep) ? ws : ws + path.sep;
  if (!(tp === ws || tp.startsWith(prefix))) {
    throw new Error('Unsafe path: outside workspace');
  }
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

router.post('/clear-short-term', async (_req, res) => {
  try {
    const { workspaceReal, memoryDirAbs } = await resolveWorkspacePaths();
    ensureInsideWorkspace(workspaceReal, memoryDirAbs);

    if (path.basename(memoryDirAbs) !== 'memory') {
      return res.status(500).json({ error: 'Refusing to clear: invalid memory dir' });
    }

    let dirents = [];
    try {
      dirents = await fs.promises.readdir(memoryDirAbs, { withFileTypes: true });
    } catch (e) {
      if (e && e.code === 'ENOENT') {
        return res.json({ ok: true, deleted: 0, note: 'memory dir not found' });
      }
      throw e;
    }

    let deleted = 0;
    for (const d of dirents) {
      const name = d.name;
      if (!name || name === '.' || name === '..') continue;
      const p = path.join(memoryDirAbs, name);
      ensureInsideWorkspace(workspaceReal, p);
      await fs.promises.rm(p, { recursive: true, force: true });
      deleted += 1;
    }

    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/long-term', async (_req, res) => {
  try {
    const { workspaceReal, memoryFileAbs } = await resolveWorkspacePaths();
    ensureInsideWorkspace(workspaceReal, memoryFileAbs);

    let text = '';
    try {
      text = await fs.promises.readFile(memoryFileAbs, 'utf8');
    } catch (e) {
      if (e && e.code === 'ENOENT') {
        return res.json({ exists: false, path: memoryFileAbs, text: '' });
      }
      throw e;
    }

    res.json({ exists: true, path: memoryFileAbs, text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/long-term', async (req, res) => {
  try {
    const text = req?.body?.text;
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'text must be a string' });
    }
    if (text.length > 300000) {
      return res.status(400).json({ error: 'text too large' });
    }

    const { workspaceReal, memoryFileAbs } = await resolveWorkspacePaths();
    ensureInsideWorkspace(workspaceReal, memoryFileAbs);

    await fs.promises.mkdir(path.dirname(memoryFileAbs), { recursive: true });
    await fs.promises.writeFile(memoryFileAbs, text, 'utf8');

    res.json({ ok: true, path: memoryFileAbs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;