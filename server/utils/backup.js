/**
 * Helper backup/restore cho config.toml
 * Backup: config.toml.bak.<timestamp> trong cùng thư mục
 */
const fs = require('fs').promises;
const path = require('path');

const CONFIG_DIR = process.env.ZEROCLAW_CONFIG_DIR || '/home/admin/.zeroclaw';
const CONFIG_FILENAME = 'config.toml';
const CONFIG_PATH = path.join(CONFIG_DIR, CONFIG_FILENAME);
const BACKUP_PREFIX = CONFIG_FILENAME + '.bak.';

/**
 * Đường dẫn đầy đủ tới file config
 */
function getConfigPath() {
  return CONFIG_PATH;
}

/**
 * Đường dẫn thư mục config
 */
function getConfigDir() {
  return CONFIG_DIR;
}

/**
 * Tạo backup file hiện tại, trả về tên file backup (basename).
 * @param {string} currentContent - Nội dung config hiện tại
 * @returns {Promise<string>} Tên file backup (vd: config.toml.bak.1710501234567)
 */
async function createBackup(currentContent) {
  const timestamp = Date.now();
  const backupFilename = BACKUP_PREFIX + timestamp;
  const backupPath = path.join(CONFIG_DIR, backupFilename);
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(backupPath, currentContent, 'utf8');
  return backupFilename;
}

/**
 * Liệt kê các file backup (basename), sắp xếp mới nhất trước.
 * @returns {Promise<Array<{ filename: string, mtime: Date }>>}
 */
async function listBackups() {
  let entries;
  try {
    entries = await fs.readdir(CONFIG_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const backups = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.startsWith(BACKUP_PREFIX)) continue;
    const fullPath = path.join(CONFIG_DIR, e.name);
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
  if (!filename || path.isAbsolute(filename) || filename.includes('..')) {
    throw new Error('Invalid backup filename');
  }
  if (!filename.startsWith(BACKUP_PREFIX)) {
    throw new Error('Not a backup file');
  }
  const backupPath = path.join(CONFIG_DIR, filename);
  const content = await fs.readFile(backupPath, 'utf8');
  return content;
}

/**
 * Ghi nội dung ra config.toml (không tạo backup ở đây; caller tạo backup trước khi ghi).
 * @param {string} content
 */
async function writeConfig(content) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, content, 'utf8');
}

/**
 * Đọc nội dung config hiện tại.
 * @returns {Promise<string>}
 */
async function readConfig() {
  const content = await fs.readFile(CONFIG_PATH, 'utf8');
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
