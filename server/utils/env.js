const fs = require('fs');
const path = require('path');

function parseEnv(text) {
  const out = {};
  const lines = String(text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    let key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();

    if (key.startsWith('export ')) key = key.slice('export '.length).trim();

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    out[key] = val;
  }
  return out;
}

function loadEnv(envPath) {
  try {
    const abs = path.resolve(envPath);
    if (!fs.existsSync(abs)) return;
    const text = fs.readFileSync(abs, 'utf8');
    const parsed = parseEnv(text);
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch (_) {
    return;
  }
}

module.exports = { loadEnv };