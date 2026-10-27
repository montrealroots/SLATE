import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAudit, checkLint, checkMutation, checkTests, checkTypecheck, passedTests, readLedger, type Runner } from '../checks/tools.ts';
import { all, fixture } from './fixture.ts';

const ok: Runner = () => ({ code: 0, output: 'fine' });
const fails: Runner = () => ({ code: 2, output: '  line 1\nthe error  \n' });
const long = Array.from({ length: 45 }, (_, i) => `line ${i + 1}`).join('\n');

describe('the typecheck and the lint', () => {
  it('pass when the tool passes, and fail with its last words when it fails', () => {
    expect([checkTypecheck(ok).check, checkLint(ok).check]).toEqual(['typecheck', 'lint']);
    expect(all(checkTypecheck(ok))).toEqual([]);
    expect(all(checkTypecheck(fails))).toEqual(['red - | the typecheck failed:\nline 1\nthe error']);
    expect(all(checkLint(ok))).toEqual([]);
    expect(all(checkLint(fails))).toEqual(['red - | the lint failed:\nline 1\nthe error']);
  });
  it('keep only the last forty lines of a long failure', () => {
    const [finding] = all(checkLint(() => ({ code: 1, output: long })));
    expect(finding).toBe(`red - | the lint failed:\n${Array.from({ length: 40 }, (_, i) => `line ${i + 6}`).join('\n')}`);
  });
  it('run the tools as the scripts do', () => {
    const calls: string[] = [];
    const spy: Runner = (cmd, args) => (calls.push([cmd, ...args].join(' ')), { code: 0, output: '' });
    checkTypecheck(spy);
    checkLint(spy);
    expect(calls).toEqual(['npx tsc -p tsconfig.json --pretty false', 'npx eslint --max-warnings 0 .']);
  });
});

describe('the ledger', () => {
  it('reads every well-formed falsifier record from every worker file, and skips the rest', () => {
    const good = (feature: string) => JSON.stringify({ feature, claim: 'bites', file: 't.ts', test: 'x > y' });
    const { root } = fixture({
      'l/1.jsonl': `${good('a.b')}\n\n   \n{"feature":"no claim","file":"f","test":"t"}\n{"feature":"x","claim":"bites","test":"no file"}\n{"feature":"x","claim":"bites","file":"no test"}\n{"feature":3,"claim":"bites","file":"f","test":"t"}\n[1]\n"text"\n`,
      'l/2.jsonl': `${good('a.c')}\n`,
      'l/notes.txt': `${good('not.a.ledger')}\n`,
    });
    expect(readLedger(join(root, 'l')).map((r) => r.feature).sort()).toEqual(['a.b', 'a.c']);
    expect(readLedger(join(root, 'l')).find((r) => r.feature === 'a.b')).toEqual({ feature: 'a.b', claim: 'bites', file: 't.ts', test: 'x > y' });
    expect(readLedger(join(root, 'none'))).toEqual([]);
  });
});

describe('the report', () => {
  it('names each passing test by its file and its full title, and skips everything else', () => {
    const report = {
      testResults: [
        { name: '/r/tests/a.test.ts', assertionResults: [
          { status: 'passed', title: 't1', ancestorTitles: ['outer', 'inner'] },
          { status: 'passed', title: 't2', ancestorTitles: ['outer', 3] },
          { status: 'failed', title: 't3', ancestorTitles: [] },
          { status: 'passed', title: 't4' },
          { status: 'passed', title: 5 },
          'junk',
        ] },
        { name: 3, assertionResults: [{ status: 'passed', title: 'x' }] },
        { name: '/r/tests/b.test.ts', assertionResults: 'x' },
        { name: '/r/tests/c.test.ts' },
        'junk',
      ],
    };
    expect([...passedTests('/r', report)]).toEqual(['tests/a.test.ts::outer > inner > t1', 'tests/a.test.ts::outer > t2', 'tests/a.test.ts::t4']);
    expect(passedTests('/r', undefined).size).toBe(0);
    expect(passedTests('/r', { testResults: {} }).size).toBe(0);
  });
});

describe('the test run', () => {
  const runWith = (code: number, report: unknown, ledger: string, seen: { args?: string[]; env?: Record<string, string> } = {}): Runner => (cmd, args, env) => {
    seen.args = [cmd, ...args];
    if (env !== undefined) seen.env = env;
    const out = args.find((a) => a.startsWith('--outputFile.json='))?.slice('--outputFile.json='.length) ?? '';
    if (report !== undefined) writeFileSync(out, typeof report === 'string' ? report : JSON.stringify(report));
    writeFileSync(join(env?.['SLATE_LEDGER_DIR'] ?? '/nonexistent', '9.jsonl'), ledger);
    return { code, output: code === 0 ? 'ok' : 'a test failed' };
  };
  it('runs Vitest with a fresh ledger and a report in .gate, and collects the passing tests and the falsifiers', () => {
    const { root } = fixture({ '.gate/ledger/old.jsonl': '{"feature":"stale","claim":"bites","file":"f","test":"t"}\n', '.gate/vitest.json': '{"stale":true}' });
    const report = { numTotalTests: 2, testResults: [{ name: join(root, 'tests/a.test.ts'), assertionResults: [{ status: 'passed', title: 't', ancestorTitles: ['d'] }] }] };
    const seen: { args?: string[]; env?: Record<string, string> } = {};
    const r = checkTests(root, runWith(0, report, '{"feature":"a.b","claim":"bites","file":"tests/a.test.ts","test":"d > t"}\n', seen));
    expect(seen.args).toEqual(['npx', 'vitest', 'run', '--reporter=dot', '--reporter=json', `--outputFile.json=${join(root, '.gate', 'vitest.json')}`]);
    expect(seen.env).toEqual({ SLATE_LEDGER_DIR: join(root, '.gate', 'ledger') });
    expect(r.check).toBe('tests');
    expect(all(r)).toEqual([]);
    expect([...r.run.passed]).toEqual(['tests/a.test.ts::d > t']);
    expect(r.falsifiers).toEqual([{ feature: 'a.b', claim: 'bites', file: 'tests/a.test.ts', test: 'd > t' }]);
    expect(r.notes).toEqual(['1 of 2 tests passed']);
  });
  it('fails when the suite fails, and when it leaves no report or an unreadable one', () => {
    const { root } = fixture({});
    expect(all(checkTests(root, runWith(1, { testResults: [] }, '')))).toEqual(['red - | the test suite failed:\na test failed']);
    const none = checkTests(root, runWith(0, undefined, ''));
    expect(all(none)).toEqual(['red - | the test run left no report']);
    expect(none.notes).toEqual(['0 of 0 tests passed']);
    expect(existsSync(join(root, '.gate', 'vitest.json'))).toBe(false);
    expect(all(checkTests(root, runWith(0, '{ broken', '')))).toEqual(['red - | the test run left no report']);
    expect(checkTests(root, runWith(0, { testResults: [] }, '')).notes).toEqual(['0 of 0 tests passed']);
  });
});

describe('the audit', () => {
  const audit = (report: unknown) => {
    const calls: string[] = [];
    const r = checkAudit((cmd, args) => (calls.push([cmd, ...args].join(' ')), { code: 1, output: typeof report === 'string' ? report : JSON.stringify(report) }));
    return { r, calls };
  };
  it('runs npm audit and passes a tree with no known advisory', () => {
    const { r, calls } = audit({ auditReportVersion: 2, vulnerabilities: {} });
    expect(calls).toEqual(['npm audit --json']);
    expect(r.check).toBe('audit');
    expect(all(r)).toEqual([]);
    expect(r.notes).toEqual(['0 vulnerable packages, 0 advisories']);
  });
  it('names each advisory once, sorted by its page, and skips what only points at another package', () => {
    const qs = { name: 'qs', severity: 'moderate', range: '<6.16.0', title: 'qs: DoS', url: 'https://github.com/advisories/GHSA-b' };
    const mocker = { name: '@vitest/mocker', severity: 'high', range: '<4.1.12', title: 'Code injection', url: 'https://github.com/advisories/GHSA-a' };
    const { r } = audit({ vulnerabilities: { qs: { via: [qs] }, 'typed-rest-client': { via: ['qs'] }, '@vitest/mocker': { via: [mocker, qs] }, odd: { via: 'x' }, odder: 'x', oddest: null } });
    expect(all(r)).toEqual([
      'red https://github.com/advisories/GHSA-a | a known advisory: high: @vitest/mocker <4.1.12, Code injection',
      'red https://github.com/advisories/GHSA-b | a known advisory: moderate: qs <6.16.0, qs: DoS',
    ]);
    expect(r.notes).toEqual(['6 vulnerable packages, 2 advisories']);
  });
  it('reads the report from stdout alone when the runner gives it apart', () => {
    const r = checkAudit(() => ({ code: 0, output: '{"vulnerabilities":{}}\nnpm warn something', stdout: '{"vulnerabilities":{}}' }));
    expect(all(r)).toEqual([]);
  });
  it("fails when the audit can't be read", () => {
    for (const bad of ['npm error network', { error: 'x' }, { vulnerabilities: [] }, 'null']) {
      expect(all(audit(bad).r)[0]).toMatch(/^red - \| the audit couldn't be read:\n/);
    }
    expect(all(audit('npm error network').r)).toEqual(["red - | the audit couldn't be read:\nnpm error network"]);
  });
});

describe('mutation testing', () => {
  const withReport = (report: unknown) => {
    const { root } = fixture({});
    mkdirSync(join(root, 'reports/mutation'), { recursive: true });
    writeFileSync(join(root, 'reports/mutation/mutation.json'), JSON.stringify(report));
    return root;
  };
  const mutants = (statuses: unknown[]) => ({ files: { 'a.ts': { mutants: statuses.map((status) => ({ status })) } } });
  it('runs Stryker, and reports the score from killed and timed-out mutants over those that count', () => {
    const calls: string[] = [];
    const root = withReport(mutants(['Killed', 'Timeout', 'Survived', 'NoCoverage', 'Ignored', 'CompileError', 'RuntimeError']));
    const r = checkMutation(root, (cmd, args) => (calls.push([cmd, ...args].join(' ')), { code: 0, output: '' }));
    expect(calls).toEqual(['npx stryker run']);
    expect(r.check).toBe('mutation');
    expect(all(r)).toEqual([]);
    expect(r.notes).toEqual(['mutation score 50.00% (2 of 4 mutants killed)']);
  });
  it('reads every file of the report and skips what is not a mutant', () => {
    const report = { files: { 'a.ts': { mutants: [{ status: 'Killed' }, 'x', null] }, 'b.ts': { mutants: [{ status: 'Killed' }, { status: 'Survived' }] }, 'c.ts': { mutants: 'x' }, 'd.ts': 'x', 'e.ts': null, 'f.ts': {} } };
    expect(checkMutation(withReport(report), ok).notes).toEqual(['mutation score 66.67% (2 of 3 mutants killed)']);
    expect(checkMutation(withReport(null), ok).notes).toEqual(['mutation score n/a (0 of 0 mutants killed)']);
    expect(checkMutation(withReport({ files: [] }), ok).notes).toEqual(['mutation score n/a (0 of 0 mutants killed)']);
    expect(checkMutation(withReport([]), ok).notes).toEqual(['mutation score n/a (0 of 0 mutants killed)']);
  });
  it('fails under the threshold, and without a report', () => {
    expect(all(checkMutation(withReport(mutants([])), fails))).toEqual(['red - | mutation testing fell under its threshold or failed:\nline 1\nthe error']);
    expect(all(checkMutation(fixture({}).root, ok))).toEqual(['red - | mutation testing left no report']);
  });
});
