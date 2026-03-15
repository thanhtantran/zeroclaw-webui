/**
 * Unit test cho utils/shell.js
 * Chạy: npm test hoặc node --test server/utils/shell.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { run, sanitizeInput } = require('./shell.js');

describe('sanitizeInput', () => {
  it('chấp nhận chuỗi an toàn: chữ, số, đường dẫn, dấu chấm gạch ngang', () => {
    assert.strictEqual(sanitizeInput('zeroclaw'), 'zeroclaw');
    assert.strictEqual(sanitizeInput('status'), 'status');
    assert.strictEqual(sanitizeInput('/home/admin/zeroclaw'), '/home/admin/zeroclaw');
    assert.strictEqual(sanitizeInput('config.toml'), 'config.toml');
    assert.strictEqual(sanitizeInput('skill-name_1'), 'skill-name_1');
  });

  it('ném lỗi khi có ký tự shell injection: ;', () => {
    assert.throws(
      () => sanitizeInput('x; rm -rf /'),
      { message: /Invalid character|shell injection/i }
    );
  });

  it('ném lỗi khi có |', () => {
    assert.throws(
      () => sanitizeInput('a | cat /etc/passwd'),
      { message: /Invalid character|shell injection/i }
    );
  });

  it('ném lỗi khi có &', () => {
    assert.throws(() => sanitizeInput('a & b'), { message: /Invalid character|shell injection/i });
  });

  it('ném lỗi khi có $()', () => {
    assert.throws(
      () => sanitizeInput('$(whoami)'),
      { message: /Invalid character|shell injection/i }
    );
  });

  it('ném lỗi khi có backtick', () => {
    assert.throws(
      () => sanitizeInput('`id`'),
      { message: /Invalid character|shell injection/i }
    );
  });

  it('ném lỗi khi input không phải string', () => {
    assert.throws(() => sanitizeInput(123), { message: /must be a string/i });
    assert.throws(() => sanitizeInput(null), { message: /must be a string/i });
  });
});

describe('run', () => {
  it('trả về { stdout, stderr, exitCode } khi lệnh thành công', async () => {
    const result = await run('node', ['--version']);
    assert(typeof result.stdout === 'string');
    assert(typeof result.stderr === 'string');
    assert(result.exitCode === 0);
    assert(result.stdout.includes('v') || result.stdout.trim().length >= 1);
  });

  it('dùng timeout mặc định và hoàn thành trước timeout', async () => {
    const result = await run('node', ['-e', 'console.log("ok")']);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.trim(), 'ok');
  });

  it('có thể tùy chỉnh timeout', async () => {
    const result = await run('node', ['-e', 'console.log("fast")'], { timeout: 5000 });
    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('fast'));
  });

  it('trả về exitCode khác 0 khi lệnh thất bại', async () => {
    const result = await run('node', ['-e', 'process.exit(2)']);
    assert.strictEqual(result.exitCode, 2);
  });

  it('sanitize args mặc định: từ chối arg có ký tự nguy hiểm', async () => {
    await assert.rejects(
      () => run('node', ['-e', 'console.log("x"); process.exit(0)']),
      { message: /Invalid character|shell injection/i }
    );
  });

  it('có thể tắt sanitize bằng options.sanitize = false', async () => {
    const result = await run('node', ['-e', 'console.log("ok")'], { sanitize: false });
    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('ok'));
  });

  it('timeout: trả về timedOut và exitCode null khi quá thời gian', async () => {
    const result = await run('node', ['-e', 'setTimeout(()=>{}, 100000)'], { timeout: 100 });
    assert.strictEqual(result.timedOut, true);
    assert.strictEqual(result.exitCode, null);
  });

  it('ném khi args không phải mảng', async () => {
    await assert.rejects(
      () => run('node', '--version'),
      { message: /args must be an array/i }
    );
  });
});
