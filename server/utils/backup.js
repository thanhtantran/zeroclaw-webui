/**
 * Helper backup/restore cho config.toml
 * Backup: config.toml.bak.<timestamp> trong cùng thư mục
 */
const fs = require('fs').promises;
const path = require('path');

const CONFIG_FILENAME = 'config.toml';
const BACKUP_PREFIX = CONFIG_FILENAME + '.bak.';

function getConfigDir() {
  return process.env.ZEROCLAW_CONFIG_DIR || '/home/admin/.zeroclaw';
}

function getConfigPath() {
  return path.join(getConfigDir(), CONFIG_FILENAME);
}

/**
 * Tạo backup file hiện tại, trả về tên file backup (basename).
 * @param {string} currentContent - Nội dung config hiện tại
 * @returns {Promise<string>} Tên file backup (vd: config.toml.bak.1710501234567)
 */
async function createBackup(currentContent) {
  const configDir = getConfigDir();
  const timestamp = Date.now();
  const backupFilename = BACKUP_PREFIX + timestamp;
  const backupPath = path.join(configDir, backupFilename);
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(backupPath, currentContent, 'utf8');
  return backupFilename;
}

/**
 * Liệt kê các file backup (basename), sắp xếp mới nhất trước.
 * @returns {Promise<Array<{ filename: string, mtime: Date }>>}
 */
async function listBackups() {
  const configDir = getConfigDir();
  let entries;
  try {
    entries = await fs.readdir(configDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const backups = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.startsWith(BACKUP_PREFIX)) continue;
    const fullPath = path.join(configDir, e.name);
    const stat = await fs.stat(fullPath);
    backups.push({ filename: e.name, mtime: stat.mtime });
  }
  backups.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return backups;
}

/**
 * Đọc nội dung một file backup. Filename chỉ được là basename (chặn path traversal).
 * @param {string} filename - Tên file (vd: config.toml.bak.1710501234567)
 * @returns {Promise<string>}
 */
async function readBackup(filename) {
  const configDir = getConfigDir();
  if (!filename || path.isAbsolute(filename) || filename.includes('..')) {
    throw new Error('Invalid backup filename');
  }
  if (!filename.startsWith(BACKUP_PREFIX)) {
    throw new Error('Not a backup file');
  }
  const backupPath = path.join(configDir, filename);
  const content = await fs.readFile(backupPath, 'utf8');
  return content;
}

/**
 * Ghi nội dung ra config.toml (không tạo backup ở đây; caller tạo backup trước khi ghi).
 * @param {string} content
 */
async function writeConfig(content) {
  const configDir = getConfigDir();
  const configPath = getConfigPath();
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(configPath, content, 'utf8');
}

async function readConfig() {
  const configPath = getConfigPath();
  const content = await fs.readFile(configPath, 'utf8');
  return content;
}

module.exports = {
  getConfigPath,
  getConfigDir,
  createBackup,
  listBackups,
  readBackup,
  writeConfig,
  readConfig,
};
