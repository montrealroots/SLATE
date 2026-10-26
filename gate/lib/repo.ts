import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Directories the gate never walks: tools' output and the version store. */
const SKIP = new Set(['node_modules', '.git', 'dist', '.gate', 'reports', '.stryker-tmp']);

/** The repository as the checks see it: paths are POSIX and relative to the root. */
export interface Repo {
  root: string;
  exists(path: string): boolean;
  read(path: string): string | undefined;
  /** Every file under a directory, recursively, sorted. */
  files(dir: string): string[];
  sha256(path: string): string | undefined;
}

export function openRepo(root: string): Repo {
  const abs = (p: string) => join(root, ...p.split('/'));
  return {
    root,
    exists: (p) => existsSync(abs(p)),
    read: (p) => (existsSync(abs(p)) && statSync(abs(p)).isFile() ? readFileSync(abs(p), 'utf8') : undefined),
    files(dir) {
      const start = abs(dir);
      if (!existsSync(start) || !statSync(start).isDirectory()) return [];
      const out: string[] = [];
      const walk = (d: string) => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          if (SKIP.has(entry.name)) continue;
          const full = join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.isFile()) out.push(relative(root, full).split(sep).join('/'));
        }
      };
      walk(start);
      // Stryker disable next-line MethodExpression: this machine's filesystem lists in order already; others don't.
      return out.sort();
    },
    sha256(p) {
      if (!existsSync(abs(p))) return undefined;
      return createHash('sha256').update(readFileSync(abs(p))).digest('hex');
    },
  };
}

/** Reads a JSON file, or says why it can't be read. */
export function readJson(repo: Repo, path: string): { ok: true; value: unknown } | { ok: false; why: string } {
  const text = repo.read(path);
  if (text === undefined) return { ok: false, why: `${path} is missing` };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (e) {
    return { ok: false, why: `${path} is not valid JSON: ${(e as Error).message}` };
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** A calendar date as the register writes it, and a real one (no February 30th). */
export function isIsoDate(v: unknown): v is string {
  const d = new Date(`${String(v)}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isSourceFile(path: string): boolean {
  return /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path) && !path.endsWith('.d.ts');
}
