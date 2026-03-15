/**
 * Wrapper an toàn cho child_process.spawn
 * - Timeout mặc định 30s
 * - Sanitize input để chặn shell injection
 * - Trả về { stdout, stderr, exitCode }
 */
const { spawn } = require('child_process');

/** Ký tự không cho phép (shell injection / meta) */
const UNSAFE_PATTERN = /[;&|`$()<>\\\n\r'"\x00]/;

/**
 * Kiểm tra và sanitize một chuỗi dùng làm command hoặc argument.
 * Chỉ cho phép chữ, số, đường dẫn và ký tự an toàn: / . - _ space
 * @param {string} input
 * @returns {string} Chuỗi đã kiểm tra (giữ nguyên nếu hợp lệ)
 * @throws {Error} Nếu chứa ký tự nguy hiểm
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  if (UNSAFE_PATTERN.test(input)) {
    throw new Error('Invalid character in input: shell injection not allowed');
  }
  return input;
}

/**
 * Chạy lệnh qua spawn (không dùng shell), có timeout và sanitize.
 * @param {string} command - Tên lệnh (vd: 'zeroclaw')
 * @param {string[]} args - Mảng tham số (vd: ['status'])
 * @param {object} options
 * @param {number} [options.timeout=30000] - Timeout ms (mặc định 30s)
 * @param {boolean} [options.sanitize=true] - Có sanitize command và args không
 * @param {object} [options.spawnOptions] - Tùy chọn bổ sung cho spawn (vd: { cwd })
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number | null, timedOut?: boolean }>}
 */
async function run(command, args = [], options = {}) {
  const timeoutMs = options.timeout !== undefined ? options.timeout : 30000;
  const doSanitize = options.sanitize !== false;

  if (doSanitize) {
    sanitizeInput(command);
    if (!Array.isArray(args)) {
      throw new Error('args must be an array');
    }
    args = args.map((a) => (typeof a === 'string' ? sanitizeInput(a) : String(a)));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(command, args, {
      signal: controller.signal,
      shell: false,
      windowsHide: true,
      ...(options.spawnOptions || {}),
    });

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }
    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        resolve({
          stdout,
          stderr,
          exitCode: null,
          timedOut: true,
        });
      } else {
        reject(err);
      }
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeoutId);
      const exitCode = code !== null && code !== undefined
        ? code
        : signal
          ? 128 + signal
          : 0;
      resolve({
        stdout,
        stderr,
        exitCode,
      });
    });
  });
}

module.exports = {
  run,
  sanitizeInput,
};
