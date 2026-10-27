import { posix } from 'node:path';
import ts from 'typescript';
import { PATHS } from '../lib/paths.ts';
import { isIsoDate, isNonEmptyString, isRecord, readJson, type Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';

export interface Layer {
  n: number;
  name: string;
  dirs: string[];
  /** Each directory directly under this layer's directories is an engine, declared in registry/engines.json. */
  holdsEngines: boolean;
}
export interface Proof {
  layer: number;
  commit: string;
  date: string;
  evidence: string;
}
export interface LayerLedger {
  layers: Layer[];
  proven: Proof[];
}

/** Asks git about a commit; injected so the check is testable without a history. */
export interface Git {
  /** True when the commit exists and is an ancestor of (or is) HEAD. */
  isAncestorOfHead(commit: string): boolean;
}

export function parseLedger(value: unknown): { ok: true; ledger: LayerLedger } | { ok: false; why: string } {
  if (!isRecord(value) || !Array.isArray(value['layers']) || !Array.isArray(value['proven'])) {
    return { ok: false, why: 'the ledger needs "layers" and "proven" arrays' };
  }
  const layers: Layer[] = [];
  for (const [i, l] of value['layers'].entries()) {
    if (!isRecord(l) || l['n'] !== i || !isNonEmptyString(l['name']) || !Array.isArray(l['dirs']) || !l['dirs'].every(isNonEmptyString)) {
      return { ok: false, why: `layer at index ${i} must be { n: ${i}, name, dirs: string[] }` };
    }
    if (l['holdsEngines'] !== undefined && typeof l['holdsEngines'] !== 'boolean') return { ok: false, why: `layer ${i}'s holdsEngines is true or false` };
    layers.push({ n: i, name: l['name'], dirs: l['dirs'] as string[], holdsEngines: l['holdsEngines'] === true });
  }
  const proven: Proof[] = [];
  for (const [i, p] of value['proven'].entries()) {
    if (!isRecord(p) || typeof p['layer'] !== 'number' || !isNonEmptyString(p['commit']) || !/^[0-9a-f]{40}$/.test(p['commit']) || !isIsoDate(p['date']) || !isNonEmptyString(p['evidence'])) {
      return { ok: false, why: `proof at index ${i} must be { layer, commit (40 hex), date (YYYY-MM-DD), evidence }` };
    }
    proven.push({ layer: p['layer'], commit: p['commit'], date: p['date'], evidence: p['evidence'] });
  }
  return { ok: true, ledger: { layers, proven } };
}

/** The lowest layer not yet proven: the one being built. */
export function layerInProgress(ledger: LayerLedger): number {
  const proven = new Set(ledger.proven.map((p) => p.layer));
  return ledger.layers.find((l) => !proven.has(l.n))?.n ?? ledger.layers.length;
}

/** The layer a file belongs to: the one whose directory holds it most closely. */
export function layerOf(ledger: LayerLedger, file: string): Layer | undefined {
  const holding = ledger.layers.flatMap((layer) => layer.dirs.filter((d) => file === d || file.startsWith(`${d}/`)).map((d) => ({ layer, depth: d.length })));
  return holding.sort((a, b) => b.depth - a.depth)[0]?.layer;
}

/** The repository-relative file a relative import names, trying the extensions the bundler would. */
function resolveImport(repo: Repo, from: string, spec: string): string {
  const base = posix.normalize(posix.join(posix.dirname(from), spec));
  const tries = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return tries.find((t) => repo.read(t) !== undefined) ?? base;
}

export function checkLayers(repo: Repo, git: Git): CheckResult {
  const r = result('build-order');
  const raw = readJson(repo, PATHS.layers);
  if (!raw.ok) {
    r.red(raw.why, PATHS.layers);
    return r;
  }
  const parsed = parseLedger(raw.value);
  if (!parsed.ok) {
    r.red(parsed.why, PATHS.layers);
    return r;
  }
  const { ledger } = parsed;
  const current = layerInProgress(ledger);

  // Proofs run from layer 0 upward with no gap, each at a commit this branch carries.
  const provenLayers = ledger.proven.map((p) => p.layer).sort((a, b) => a - b);
  provenLayers.forEach((n, i) => {
    if (n !== i) r.red(`layer ${n} is recorded proven but layer ${i} is not`, PATHS.layers);
  });
  for (const p of ledger.proven) {
    if (!git.isAncestorOfHead(p.commit)) r.red(`layer ${p.layer}'s proof names commit ${p.commit}, which this branch doesn't carry`, PATHS.layers);
  }

  // Every source file belongs to a layer, and no layer above the one in progress has started.
  const srcFiles = repo.files(PATHS.src);
  for (const file of srcFiles) {
    const layer = layerOf(ledger, file);
    if (layer === undefined) {
      r.red('a source file sits outside every layer', file);
      continue;
    }
    if (layer.n > current) r.red(`layer ${layer.n} (${layer.name}) has code, but layer ${current} isn't proven yet`, file);
  }

  // Imports run downward only: a layer reads the layers under it, never one above, and the app reads nothing outside
  // itself (the gate, the tests, the registries, the owner's documents). A package import resolves beside the file,
  // inside its own layer, so it passes as it should.
  for (const file of srcFiles.filter((f) => /\.(ts|tsx)$/.test(f))) {
    const from = layerOf(ledger, file);
    if (from === undefined) continue;
    // Stryker disable next-line StringLiteral: the file was just listed, so it reads.
    const info = ts.preProcessFile(repo.read(file) ?? '', true, true);
    for (const imp of info.importedFiles) {
      const target = resolveImport(repo, file, imp.fileName);
      const to = layerOf(ledger, target);
      if (!target.startsWith(`${PATHS.src}/`)) r.red(`the app imports ${target}, which is outside the app`, file);
      else if (to !== undefined && to.n > from.n) r.red(`layer ${from.n} imports layer ${to.n} (${target}); imports run downward only`, file);
    }
  }

  const lines = [
    '# The Build Order, As The Gate Holds It',
    '',
    'Generated by the gate from `registry/layers.json`; do not edit by hand.',
    '',
    '| Layer | Name | Directories | State |',
    '|---|---|---|---|',
    ...ledger.layers.map((l) => {
      const proof = ledger.proven.find((p) => p.layer === l.n);
      const state = proof ? `proven ${proof.date} at \`${proof.commit.slice(0, 12)}\`` : l.n === current ? 'in progress' : 'not started';
      return `| ${l.n} | ${l.name} | ${l.dirs.map((d) => `\`${d}\``).join(', ') || '(none)'} | ${state} |`;
    }),
    '',
  ];
  r.generate(`${PATHS.matrixDir}/LAYERS.md`, lines.join('\n'));
  r.note(`layer ${current} in progress; ${ledger.proven.length} proven; ${srcFiles.length} source files placed`);
  return r;
}
