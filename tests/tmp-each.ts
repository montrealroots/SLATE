import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

// Each test file's temporary files under a directory of its own (os.tmpdir() reads TMPDIR at each call), removed when
// the file is done, so a long run (mutation testing runs the files again and again) never piles them up.
const before = process.env['TMPDIR'];
const dir = mkdtempSync(join(tmpdir(), 'file-'));
process.env['TMPDIR'] = dir;
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  if (before === undefined) delete process.env['TMPDIR'];
  else process.env['TMPDIR'] = before;
});
