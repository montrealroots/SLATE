import { PATHS } from '../lib/paths.ts';
import { isRecord, readJson, type Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';

/** The tools BUILD-ORDER.md layer 0 names: "TypeScript, React, Vite, Vitest, ESLint, as this SLATE used them, pinned." */
export const REQUIRED_TOOLS = {
  dependencies: ['react', 'react-dom'],
  devDependencies: ['typescript', 'vite', 'vitest', 'eslint', '@vitejs/plugin-react'],
} as const;

const EXACT = /^\d+\.\d+\.\d+$/;

export function checkToolchain(repo: Repo): CheckResult {
  const r = result('toolchain');
  const pkg = readJson(repo, PATHS.packageJson);
  if (!pkg.ok || !isRecord(pkg.value)) {
    r.red(pkg.ok ? 'package.json is not an object' : pkg.why, PATHS.packageJson);
    return r;
  }
  const p = pkg.value;

  if (!/^npm@\d+\.\d+\.\d+$/.test(String(p['packageManager']))) {
    r.red('packageManager must pin npm to an exact version (npm@x.y.z)', PATHS.packageJson);
  }

  if (!EXACT.test(String(repo.read(PATHS.nvmrc)?.trim()))) r.red('.nvmrc must pin Node to an exact version', PATHS.nvmrc);

  const pinned = new Map<string, string>();
  for (const group of ['dependencies', 'devDependencies'] as const) {
    const deps = p[group];
    if (deps === undefined) continue;
    if (!isRecord(deps)) {
      r.red(`${group} is not an object`, PATHS.packageJson);
      continue;
    }
    for (const [name, spec] of Object.entries(deps)) {
      if (EXACT.test(String(spec))) pinned.set(name, String(spec));
      else r.red(`${name} is not pinned to an exact version (${String(spec)})`, PATHS.packageJson);
    }
  }
  for (const group of ['dependencies', 'devDependencies'] as const) {
    const deps = isRecord(p[group]) ? (p[group] as Record<string, unknown>) : {};
    for (const tool of REQUIRED_TOOLS[group]) {
      if (!(tool in deps)) r.red(`${tool} is missing from ${group}`, PATHS.packageJson);
    }
  }

  // An override forces a version deep in the tree (a security fix, a resolver's peer); it's pinned exactly, and one
  // naming a direct dependency is that dependency's own pin, so a version is never written two ways.
  const overrides = p['overrides'];
  if (overrides !== undefined && !isRecord(overrides)) r.red('overrides is not an object', PATHS.packageJson);
  for (const [name, spec] of Object.entries(isRecord(overrides) ? overrides : {})) {
    if (!EXACT.test(String(spec))) r.red(`the override of ${name} is not an exact version (${String(spec)})`, PATHS.packageJson);
    else if (pinned.has(name) && pinned.get(name) !== spec) r.red(`the override of ${name} (${String(spec)}) differs from its pin (${String(pinned.get(name))})`, PATHS.packageJson);
  }

  const lock = readJson(repo, PATHS.lockfile);
  if (!lock.ok || !isRecord(lock.value)) {
    r.red(lock.ok ? 'package-lock.json is not an object' : lock.why, PATHS.lockfile);
    return r;
  }
  if (lock.value['lockfileVersion'] !== 3) r.red('package-lock.json must be lockfileVersion 3', PATHS.lockfile);
  const packages = isRecord(lock.value['packages']) ? lock.value['packages'] : {};
  for (const [name, version] of pinned) {
    const entry = packages[`node_modules/${name}`];
    const locked = isRecord(entry) ? entry['version'] : undefined;
    if (locked !== version) r.red(`${name} is pinned at ${version} but the lockfile holds ${String(locked)}`, PATHS.lockfile);
  }
  r.note(`${pinned.size} packages pinned exactly and matched in the lockfile`);
  return r;
}
