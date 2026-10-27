import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { openRepo, type Repo } from '../lib/repo.ts';
import type { CheckResult } from '../lib/types.ts';

/** A throwaway repository on disk: a string is written as is, anything else as JSON. */
export function fixture(files: Record<string, unknown>, base = tmpdir()): { root: string; repo: Repo } {
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, 'slate-gate-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, ...path.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { root, repo: openRepo(root) };
}

export const reds = (r: CheckResult) => r.findings.filter((f) => f.severity === 'red').map((f) => f.message);
export const incompletes = (r: CheckResult) => r.findings.filter((f) => f.severity === 'incomplete').map((f) => f.message);
/** True when some red finding's message contains the text. */
export const redWith = (r: CheckResult, text: string) => reds(r).some((m) => m.includes(text));

/** Every finding, exactly: its severity, its place and its words. */
export const all = (r: CheckResult) => r.findings.map((f) => `${f.severity} ${f.where ?? '-'} | ${f.message}`);
