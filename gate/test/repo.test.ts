import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isIsoDate, isNonEmptyString, isRecord, isSourceFile, readJson } from '../lib/repo.ts';
import { fixture } from './fixture.ts';

describe('the repository as the checks see it', () => {
  it('lists files sorted, skipping the tools\' output and the version store, and only files', () => {
    const { root, repo } = fixture({});
    for (const name of ['b.ts', 'a.ts', 'd/c.ts', 'node_modules/x.ts', '.git/y', 'dist/z.js', '.gate/r.json', 'reports/m.json', '.stryker-tmp/s.ts', 'z.ts', 'm.ts']) {
      mkdirSync(join(root, name, '..'), { recursive: true });
      writeFileSync(join(root, name), 'x');
    }
    symlinkSync(join(root, 'a.ts'), join(root, 'link.ts'));
    expect(repo.files('.').map((f) => f.replace(/^\.\//, ''))).toEqual(['a.ts', 'b.ts', 'd/c.ts', 'm.ts', 'z.ts']);
    expect(repo.files('d')).toEqual(['d/c.ts']);
    expect(repo.files('none')).toEqual([]);
    expect(repo.files('a.ts')).toEqual([]);
  });
  it('reads, checks and hashes files, and only files', () => {
    const { repo } = fixture({ 'a.txt': 'abc', 'd/e.txt': 'x' });
    expect(repo.read('a.txt')).toBe('abc');
    expect(repo.read('d')).toBeUndefined();
    expect(repo.read('none')).toBeUndefined();
    expect(repo.exists('d')).toBe(true);
    expect(repo.exists('none')).toBe(false);
    expect(repo.sha256('a.txt')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(repo.sha256('none')).toBeUndefined();
  });
  it('reads JSON or says why not', () => {
    const { repo } = fixture({ 'a.json': { x: 1 }, 'b.json': '{ x' });
    expect(readJson(repo, 'a.json')).toEqual({ ok: true, value: { x: 1 } });
    expect(readJson(repo, 'none.json')).toEqual({ ok: false, why: 'none.json is missing' });
    const b = readJson(repo, 'b.json');
    expect(b.ok ? '' : b.why).toMatch(/^b\.json is not valid JSON: /);
  });
});

describe('the small judgments', () => {
  it('a record is a plain object', () => {
    expect([{}, { a: 1 }].map(isRecord)).toEqual([true, true]);
    expect([[], null, 'x', 1, undefined].map(isRecord)).toEqual([false, false, false, false, false]);
  });
  it('a non-empty string has more than spaces', () => {
    expect(['a', ' a '].map(isNonEmptyString)).toEqual([true, true]);
    expect(['', '  ', 1, undefined].map(isNonEmptyString)).toEqual([false, false, false, false]);
  });
  it('a date is a real calendar date written YYYY-MM-DD', () => {
    expect(['2026-10-26', '2024-02-29', '1999-12-31'].map(isIsoDate)).toEqual([true, true, true]);
    expect(['2026-02-30', '2025-02-29', '2026-13-01', '26-10-2026', 'x2026-10-26', '2026-10-26x', '2026-1-26', '+02026-10-26', 20261026, undefined, ''].map(isIsoDate)).toEqual(Array(11).fill(false));
  });
  it('a source file is TypeScript that is neither a test nor a declaration', () => {
    expect(['a.ts', 'b/c.tsx', 'a.test.ts.ts'].map(isSourceFile)).toEqual([true, true, true]);
    expect(['a.test.ts', 'a.test.tsx', 'types.d.ts', 'a.ts.md', 'a.js', 'a.tsx.bak'].map(isSourceFile)).toEqual(Array(6).fill(false));
  });
});
