import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runGate } from './run.ts';
import type { Runner } from './checks/tools.ts';

/** `npm run gate` (fast: every commit), `npm run gate:full` (adds mutation: proves a layer), `npm run gate:write`. */
const args = new Set(process.argv.slice(2));
const root = resolve(import.meta.dirname, '..');
const full = args.has('--full');
const write = args.has('--write');

const run: Runner = (cmd, cmdArgs, env) => {
  const out = spawnSync(cmd, cmdArgs, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 256 * 1024 * 1024 });
  return { code: out.status ?? 1, output: `${out.stdout ?? ''}${out.stderr ?? ''}`, stdout: out.stdout ?? '' };
};
const git = {
  isAncestorOfHead(commit: string) {
    return spawnSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { cwd: root }).status === 0;
  },
};
const today = new Date().toISOString().slice(0, 10);
const started = Date.now();
const outcome = runGate({ root, full, write, today, git, run });

const mark = { green: '✓', incomplete: '…', red: '✕' } as const;
for (const r of outcome.results) {
  const red = r.findings.filter((f) => f.severity === 'red');
  const inc = r.findings.filter((f) => f.severity === 'incomplete');
  const state = red.length > 0 ? 'red' : inc.length > 0 ? 'incomplete' : 'green';
  console.log(`${mark[state]} ${r.check}${r.notes.length > 0 ? `: ${r.notes.join('; ')}` : ''}`);
  for (const f of [...red, ...inc].slice(0, 50)) console.log(`    ${f.severity === 'red' ? '✕' : '…'} ${f.where !== undefined ? `${f.where}: ` : ''}${f.message.replace(/\n/g, '\n      ')}`);
  if (red.length + inc.length > 50) console.log(`    and ${red.length + inc.length - 50} more`);
}

let head = '';
let dirty = true;
try {
  head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '';
} catch {
  // No history yet.
}
const receipt = {
  verdict: outcome.verdict,
  mode: full ? 'full' : 'fast',
  date: new Date().toISOString(),
  seconds: Math.round((Date.now() - started) / 1000),
  head,
  dirty,
  checks: outcome.results.map((r) => ({ check: r.check, notes: r.notes, findings: r.findings })),
};
mkdirSync(join(root, '.gate'), { recursive: true });
writeFileSync(join(root, '.gate', 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`\nGate ${outcome.verdict} (${receipt.mode}, ${receipt.seconds}s)${write ? ', matrices written' : ''}.`);
process.exit(outcome.verdict === 'red' ? 1 : outcome.verdict === 'incomplete' ? 2 : 0);
