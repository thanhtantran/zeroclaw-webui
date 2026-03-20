/**
 * API gửi message đến ZeroClaw như chat
 *
 */

const express = require('express');
const { spawn } = require('child_process');

const router = express.Router();

const ANSI_PATTERN = /\x1B\[[0-?]*[ -\/]*[@-~]/g;

function stripAnsi(text) {
  return String(text || '').replace(ANSI_PATTERN, '');
}

function filterAgentReply(text) {
  const cleaned = stripAnsi(text);
  const lines = cleaned.split(/\r?\n/);
  const kept = lines.filter((line) => {
    const t = String(line || '').trim();
    if (!t) return false;
    if (/^\d{4}-\d{2}-\d{2}T.*\s(?:INFO|WARN|DEBUG|TRACE)\b/.test(t)) return false;
    return true;
  });
  return kept.join('\n').trim();
}

function runZeroclawAgentMessage(message, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120000;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let finished = false;

    const child = spawn('zeroclaw', ['agent', '-m', message], {
      shell: false,
      windowsHide: true,
    });

    const timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        child.kill('SIGKILL');
      } catch (_) {}
      resolve({ stdout, stderr, exitCode: null, timedOut: true });
    }, timeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: (stderr ? `${stderr}\n` : '') + (err && err.message ? err.message : String(err)),
        exitCode: 1,
      });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      resolve({ stdout, stderr, exitCode: code });
    });
  });
}

router.post('/message', async (req, res) => {
  const message = req?.body?.message;

  if (typeof message !== 'string') {
    res.status(400).json({ error: 'message must be a string' });
    return;
  }

  const trimmed = message.trim();
  if (!trimmed) {
    res.status(400).json({ error: 'message is empty' });
    return;
  }

  if (trimmed.length > 4000) {
    res.status(400).json({ error: 'message too long (max 4000 chars)' });
    return;
  }

  if (/\x00/.test(trimmed)) {
    res.status(400).json({ error: 'invalid message' });
    return;
  }

  const result = await runZeroclawAgentMessage(trimmed, { timeoutMs: 120000 });

  if (result.timedOut) {
    res.status(504).json({
      error: 'agent timed out',
      output: filterAgentReply(result.stdout + '\n' + result.stderr),
    });
    return;
  }

  const combined = `${result.stdout || ''}${result.stderr ? `\n${result.stderr}` : ''}`;
  const output = filterAgentReply(combined);

  res.json({
    exitCode: result.exitCode,
    output,
  });
});

module.exports = router;