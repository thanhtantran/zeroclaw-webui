/**
 * API quản lý Skill của ZeroClaw
 *
 * - GET  /api/skills/installed -> zeroclaw skills list
 * - GET  /api/skills/available -> liệt kê thư mục open-skills
 * - POST /api/skills/install   -> zeroclaw skills install <path>
 */
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { run, sanitizeInput } = require('../utils/shell');

const router = express.Router();

const ZEROCLAW_BIN = process.env.ZEROCLAW_BIN || 'zeroclaw';
const OPEN_SKILLS_DIR = process.env.ZEROCLAW_OPEN_SKILLS_DIR || '/home/admin/open-skills/skills';

/**
 * Sanitizer name skill: chỉ cho phép [a-zA-Z0-9_-]
 */
function sanitizeSkillName(name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('Skill name must be a non-empty string');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid skill name');
  }
  return name;
}

/**
 * Parse output của `zeroclaw skills list` thành mảng.
 * Vì bạn chưa đưa mẫu, tạm thời:
 * - Bỏ dòng INFO/WARN
 * - Lấy các dòng không rỗng, không phải tiêu đề, trả về mảng strings
 */
function parseSkillsList(stdout) {
  const lines = stdout.split('\n').map((l) => l.trim());
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (/\b(INFO|WARN)\b/.test(line)) continue;
    if (line.startsWith('Skills') || line.startsWith('Installed')) continue;
    items.push(line);
  }
  return {
    raw: stdout,
    items,
  };
}

/**
 * GET /api/skills/installed
 */
router.get('/installed', async (_req, res) => {
  try {
    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['skills', 'list'], {
      timeout: 15000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw skills list timed out' });
    }
    if (exitCode !== 0) {
      return res.status(500).json({
        error: 'zeroclaw skills list failed',
        exitCode,
        stdout,
        stderr,
      });
    }

    const parsed = parseSkillsList(stdout);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/skills/available
 * Quét thư mục OPEN_SKILLS_DIR và chỉ lấy những skill có file SKILL.md.
 */
router.get('/available', async (_req, res) => {
  try {
    let entries;
    try {
      entries = await fs.readdir(OPEN_SKILLS_DIR, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json({ skills: [] });
      }
      throw err;
    }

    const skills = [];

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const name = ent.name;
      const skillDir = path.join(OPEN_SKILLS_DIR, name);

      const skillMdPath = path.join(skillDir, 'SKILL.md');
      let skillMd;
      try {
        skillMd = await fs.readFile(skillMdPath, 'utf8');
      } catch (err) {
        if (err && err.code === 'ENOENT') continue;
        throw err;
      }

      const lines = skillMd.split('\n').map((l) => l.trim());
      const h1 = lines.find((l) => l.startsWith('# '));
      const title = (h1 ? h1.replace(/^#\s+/, '').trim() : '') || name;

      let summary = '';
      for (let i = 0; i < lines.length; i += 1) {
        const l = lines[i];
        if (!l) continue;
        if (l.startsWith('#')) continue;
        summary = l;
        break;
      }

      skills.push({ name, path: skillDir, title, summary });
    }

    res.json({ baseDir: OPEN_SKILLS_DIR, skills });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/skills/install
 * Body: { name }
 */
router.post('/install', async (req, res) => {
  const { name } = req.body || {};
  try {
    const safeName = sanitizeSkillName(name);
    // Dùng sanitizeInput cho đường dẫn, nhưng tên đã hạn chế [a-zA-Z0-9_-]
    const dir = path.join(OPEN_SKILLS_DIR, safeName);

    const baseResolved = await fs.realpath(OPEN_SKILLS_DIR).catch(() => path.resolve(OPEN_SKILLS_DIR));
    const dirResolved = await fs.realpath(dir).catch(() => path.resolve(dir));
    const baseForRel = process.platform === 'win32' ? baseResolved.toLowerCase() : baseResolved;
    const dirForRel = process.platform === 'win32' ? dirResolved.toLowerCase() : dirResolved;
    const rel = path.relative(baseForRel, dirForRel);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return res.status(400).json({ error: 'Invalid skill path' });
    }

    // Xác nhận thư mục tồn tại
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'Skill path is not a directory' });
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Skill directory not found' });
      }
      throw err;
    }

    // Chạy: zeroclaw skills install /home/admin/open-skills/<name>/
    const skillPath = dirResolved.endsWith(path.sep) ? dirResolved : `${dirResolved}${path.sep}`;
    // sanitizeInput đảm bảo không có ký tự injection trong đường dẫn
    sanitizeInput(skillPath);

    const { stdout, stderr, exitCode, timedOut } = await run(ZEROCLAW_BIN, ['skills', 'install', skillPath], {
      timeout: 60000,
    });

    if (timedOut) {
      return res.status(504).json({ error: 'zeroclaw skills install timed out' });
    }

    res.json({
      exitCode,
      stdout,
      stderr,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

