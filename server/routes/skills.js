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
const OPEN_SKILLS_DIR = process.env.ZEROCLAW_OPEN_SKILLS_DIR || '/home/admin/open-skills';

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
 * - Bỏ dòng INFO
 * - Lấy các dòng không rỗng, không phải tiêu đề, trả về mảng strings
 */
function parseSkillsList(stdout) {
  const lines = stdout.split('\n').map((l) => l.trim());
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (/\bINFO\b/.test(line)) continue;
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
 * Liệt kê thư mục trong OPEN_SKILLS_DIR, đọc README.md hoặc skill.json nếu có.
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

      const skill = { name, path: skillDir, readme: null, metadata: null };

      // README.md (tuỳ chọn)
      try {
        const readmePath = path.join(skillDir, 'README.md');
        const readme = await fs.readFile(readmePath, 'utf8');
        skill.readme = readme;
      } catch (e) {
        // ignore
      }

      // skill.json (tuỳ chọn)
      try {
        const metaPath = path.join(skillDir, 'skill.json');
        const metaRaw = await fs.readFile(metaPath, 'utf8');
        try {
          skill.metadata = JSON.parse(metaRaw);
        } catch {
          skill.metadata = { parseError: 'Invalid JSON in skill.json' };
        }
      } catch (e) {
        // ignore
      }

      skills.push(skill);
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

