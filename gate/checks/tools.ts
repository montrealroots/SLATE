import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isRecord } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';
import type { FalsifierRecord, TestRun } from './features.ts';

/** Runs a command; injected so the checks' handling of each outcome is testable without running the tools. */
export type Runner = (cmd: string, args: string[], env?: Record<string, string>) => { code: number; output: string };

const tail = (s: string, n = 40) => s.trim().split('\n').slice(-n).join('\n');

export function checkTypecheck(run: Runner): CheckResult {
  const r = result('typecheck');
  const out = run('npx', ['tsc', '-p', 'tsconfig.json', '--pretty', 'false']);
  if (out.code !== 0) r.red(`the typecheck failed:\n${tail(out.output)}`);
  return r;
}

export function checkLint(run: Runner): CheckResult {
  const r = result('lint');
  const out = run('npx', ['eslint', '--max-warnings', '0', '.']);
  if (out.code !== 0) r.red(`the lint failed:\n${tail(out.output)}`);
  return r;
}

/** The ledger's records, written by falsify() one JSON line each, per test worker (in no order: the matrix sorts). */
export function readLedger(dir: string): FalsifierRecord[] {
  if (!existsSync(dir)) return [];
  const out: FalsifierRecord[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      const v = JSON.parse(line) as unknown;
      if (isRecord(v) && typeof v['feature'] === 'string' && typeof v['claim'] === 'string' && typeof v['file'] === 'string' && typeof v['test'] === 'string') {
        out.push({ feature: v['feature'], claim: v['claim'], file: v['file'], test: v['test'] });
      }
    }
  }
  return out;
}

/** The passing tests in a Vitest JSON report, as `${file}::${describe > test}` with the file relative to the root. */
export function passedTests(root: string, report: unknown): Set<string> {
  const passed = new Set<string>();
  if (!isRecord(report) || !Array.isArray(report['testResults'])) return passed;
  for (const file of report['testResults']) {
    if (!isRecord(file) || typeof file['name'] !== 'string' || !Array.isArray(file['assertionResults'])) continue;
    const rel = relative(root, file['name']).split(sep).join('/');
    for (const a of file['assertionResults']) {
      if (!isRecord(a) || a['status'] !== 'passed' || typeof a['title'] !== 'string') continue;
      const ancestors = Array.isArray(a['ancestorTitles']) ? (a['ancestorTitles'] as unknown[]).filter((t): t is string => typeof t === 'string') : [];
      passed.add(`${rel}::${[...ancestors, a['title']].join(' > ')}`);
    }
  }
  return passed;
}

/** The test run's JSON report, or undefined when there's none or it can't be read. */
function readReport(path: string): unknown {
  // Stryker disable next-line BlockStatement: an empty catch returns undefined just the same.
  try { return JSON.parse(readFileSync(path, 'utf8')) as unknown; } catch { return undefined; }
}

export function checkTests(root: string, run: Runner): CheckResult & { run: TestRun; falsifiers: FalsifierRecord[] } {
  const r = result('tests');
  const gateDir = join(root, '.gate');
  const ledgerDir = join(gateDir, 'ledger');
  const reportPath = join(gateDir, 'vitest.json');
  rmSync(ledgerDir, { recursive: true, force: true });
  rmSync(reportPath, { force: true });
  mkdirSync(ledgerDir, { recursive: true });
  const out = run('npx', ['vitest', 'run', '--reporter=dot', '--reporter=json', `--outputFile.json=${reportPath}`], { SLATE_LEDGER_DIR: ledgerDir });
  const report = readReport(reportPath);
  if (out.code !== 0) r.red(`the test suite failed:\n${tail(out.output)}`);
  if (report === undefined) r.red('the test run left no report');
  const passed = passedTests(root, report);
  const total = isRecord(report) && typeof report['numTotalTests'] === 'number' ? report['numTotalTests'] : 0;
  r.note(`${passed.size} of ${total} tests passed`);
  return Object.assign(r, { run: { passed }, falsifiers: readLedger(ledgerDir) });
}

/** Mutation testing (the full gate): Stryker's own break threshold decides; the score goes in the receipt. */
export function checkMutation(root: string, run: Runner): CheckResult {
  const r = result('mutation');
  const out = run('npx', ['stryker', 'run']);
  if (out.code !== 0) r.red(`mutation testing fell under its threshold or failed:\n${tail(out.output)}`);
  const reportPath = join(root, 'reports', 'mutation', 'mutation.json');
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as unknown;
    const files = Object.values(isRecord(report) && isRecord(report['files']) ? report['files'] : {});
    const statuses = files.filter(isRecord).flatMap((f) => f['mutants']).filter(isRecord).map((m) => m['status']);
    const killed = statuses.filter((s) => s === 'Killed' || s === 'Timeout').length;
    const counted = statuses.filter((s) => s !== 'Ignored' && s !== 'CompileError' && s !== 'RuntimeError').length;
    r.note(`mutation score ${counted === 0 ? 'n/a' : `${((killed / counted) * 100).toFixed(2)}%`} (${killed} of ${counted} mutants killed)`);
  } else r.red('mutation testing left no report');
  return r;
}
