import { PATHS } from '../lib/paths.ts';
import { isRecord, readJson, type Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';

/**
 * The owner's decisions (docs/ and CLAUDE.md) are held byte for byte against a lock of their hashes, so nothing the
 * owner decided changes without the change showing in the commit that makes it. A new file under docs/ must be
 * locked too, so nothing joins the owner's package unseen.
 */
export const OWNER_SCOPE = { dirs: ['docs'], files: ['CLAUDE.md'] } as const;

export function ownerFiles(repo: Repo): string[] {
  // CLAUDE.md sorts before every path under docs/, so the list comes out in order.
  return [...OWNER_SCOPE.files.filter((f) => repo.exists(f)), ...OWNER_SCOPE.dirs.flatMap((d) => repo.files(d))];
}

export function lockOf(repo: Repo): Record<string, string> {
  const out: Record<string, string> = {};
  // Stryker disable next-line StringLiteral: every file listed was just found, so it has a hash.
  for (const f of ownerFiles(repo)) out[f] = repo.sha256(f) ?? '';
  return out;
}

export function checkOwnerDocs(repo: Repo): CheckResult {
  const r = result('owner-docs');
  const lock = readJson(repo, PATHS.ownerDocsLock);
  const locked = lock.ok && isRecord(lock.value) ? lock.value['files'] : undefined;
  if (!isRecord(locked)) {
    r.red(lock.ok ? 'the lock has no "files" object' : lock.why, PATHS.ownerDocsLock);
    return r;
  }
  const present = new Set(ownerFiles(repo));
  for (const [file, hash] of Object.entries(locked)) {
    const actual = repo.sha256(file);
    if (actual === undefined) r.red('an owner document is gone', file);
    else if (actual !== hash) r.red('an owner document changed without its lock being updated', file);
  }
  for (const file of present) {
    if (!(file in locked)) r.red('a file joined the owner documents without being locked', file);
  }
  r.note(`${Object.keys(locked).length} owner documents held to their hashes`);
  return r;
}
