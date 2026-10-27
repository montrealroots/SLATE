import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Every test's temporary files under one directory of the run's own (os.tmpdir() reads TMPDIR, and the workers are
 * started with this process's environment), removed with all it holds when the run ends.
 */
export default function setup(): () => void {
  const dir = mkdtempSync(join(tmpdir(), 'slate-test-'));
  const before = process.env['TMPDIR'];
  process.env['TMPDIR'] = dir;
  return () => {
    rmSync(dir, { recursive: true, force: true });
    if (before === undefined) delete process.env['TMPDIR'];
    else process.env['TMPDIR'] = before;
  };
}
