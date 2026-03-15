/**
 * API cập nhật ZeroClaw
 *
 * - GET  /api/update/check        -> git fetch + liệt kê commit mới
 * - POST /api/update/pull         -> git pull
 * - POST /api/update/build        -> chạy install.sh, stream log qua WebSocket
 * - GET  /api/update/build-status -> trạng thái build hiện tại
 */
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { run } = require('../utils/shell');
const { broadcastBuildLog, broadcastBuildStatus, getLastBuildStatus } = require('../updateSocket');

const router = express.Router();

const REPO_DIR = process.env.ZEROCLAW_REPO_DIR || '/home/admin/zeroclaw';
const INSTALL_SCRIPT = process.env.ZEROCLAW_INSTALL_SCRIPT ||
  path.join(REPO_DIR, 'install.sh');

// Trạng thái build giữ trong memory
const buildState = {
  status: 'idle', // idle | running | success | failed
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  error: null,
};

function setBuildStatus(status, extra = {}) {
  buildState.status = status;
  if (status === 'running') {
    buildState.startedAt = new Date().toISOString();
    buildState.finishedAt = null;
    buildState.exitCode = null;
    buildState.error = null;
  } else if (status === 'success' || status === 'failed' || status === 'idle') {
    buildState.finishedAt = new Date().toISOString();
  }
  Object.assign(buildState, extra);
  broadcastBuildStatus(buildState.status);
}

/**
 * GET /api/update/check
 * git fetch và liệt kê commit mới so với origin/main
 */
router.get('/check', async (_req, res) => {
  try {
    const fetchResult = await run('git', ['fetch'], {
      timeout: 30000,
      spawnOptions: { cwd: REPO_DIR },
    });
    if (fetchResult.exitCode !== 0) {
      return res.status(500).json({
        error: 'git fetch failed',
        exitCode: fetchResult.exitCode,
        stdout: fetchResult.stdout,
        stderr: fetchResult.stderr,
      });
    }

    const logResult = await run('git', ['log', 'HEAD..origin/main', '--oneline'], {
      timeout: 30000,
      spawnOptions: { cwd: REPO_DIR },
    });

    if (logResult.exitCode !== 0) {
      return res.status(500).json({
        error: 'git log failed',
        exitCode: logResult.exitCode,
        stdout: logResult.stdout,
        stderr: logResult.stderr,
      });
    }

    const commits = logResult.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const [hash, ...rest] = line.split(' ');
        return {
          hash,
          summary: rest.join(' '),
        };
      });

    res.json({
      repoDir: REPO_DIR,
      commits,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/update/pull
 * git pull trong repo
 */
router.post('/pull', async (_req, res) => {
  try {
    const result = await run('git', ['pull'], {
      timeout: 60000,
      spawnOptions: { cwd: REPO_DIR },
    });
    res.json({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/update/build
 * Chạy install.sh --prefer-prebuilt, stream log qua WebSocket.
 * Chỉ cho phép 1 build đang chạy.
 */
router.post('/build', (_req, res) => {
  if (buildState.status === 'running') {
    return res.status(409).json({ error: 'Build already running' });
  }

  setBuildStatus('running');

  const child = spawn(INSTALL_SCRIPT, ['--prefer-prebuilt'], {
    cwd: REPO_DIR,
    shell: false,
  });

  broadcastBuildLog(`\n=== Build started at ${new Date().toISOString()} ===\n`);

  if (child.stdout) {
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      broadcastBuildLog(chunk);
    });
  }
  if (child.stderr) {
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      broadcastBuildLog(chunk);
    });
  }

  child.on('error', (err) => {
    broadcastBuildLog(`\n[build:error] ${err.message}\n`);
    setBuildStatus('failed', { error: err.message, exitCode: null });
  });

  child.on('close', (code) => {
    const ok = code === 0;
    broadcastBuildLog(`\n=== Build finished with code ${code} at ${new Date().toISOString()} ===\n`);
    setBuildStatus(ok ? 'success' : 'failed', { exitCode: code });
  });

  res.json({ ok: true, status: buildState.status });
});

/**
 * GET /api/update/build-status
 * Trả về trạng thái build hiện tại
 */
router.get('/build-status', (_req, res) => {
  const wsStatus = getLastBuildStatus();
  res.json({
    status: buildState.status,
    startedAt: buildState.startedAt,
    finishedAt: buildState.finishedAt,
    exitCode: buildState.exitCode,
    error: buildState.error,
    ws: wsStatus,
  });
});

module.exports = router;

