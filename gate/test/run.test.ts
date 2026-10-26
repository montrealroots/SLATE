import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '../checks/handoff.ts';
import { lockOf } from '../checks/owner-docs.ts';
import type { CheckResult } from '../lib/types.ts';
import { runGate, type GateOptions } from '../run.ts';
import { all, fixture } from './fixture.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const today = '2026-10-26';
const git = { isAncestorOfHead: () => true };
const noRun = () => ({ code: 0, output: '' });
const noTests = { run: { passed: new Set<string>() }, falsifiers: [] };

/** A whole repository at layer 0, with every registry, copied from this one's toolchain. */
function minimal(over: Record<string, unknown> = {}) {
  const docs = { 'CLAUDE.md': 'rules\n', 'docs/MANDATE.md': 'mandate\n' };
  return fixture({
    'package.json': readFileSync(join(ROOT, 'package.json'), 'utf8'),
    'package-lock.json': readFileSync(join(ROOT, 'package-lock.json'), 'utf8'),
    '.nvmrc': '22.22.0\n',
    ...docs,
    'registry/owner-docs.lock.json': { files: lockOf(fixture(docs).repo) },
    'registry/layers.json': { layers: [{ n: 0, name: 'Gate', dirs: ['gate'] }, { n: 1, name: 'Core', dirs: ['src/core'], holdsEngines: true }], proven: [] },
    'registry/features.json': {},
    'registry/pages.json': {},
    'registry/engines.json': {},
    'registry/axes.json': readFileSync(join(ROOT, 'registry/axes.json'), 'utf8'),
    'registry/voice.json': readFileSync(join(ROOT, 'registry/voice.json'), 'utf8'),
    'research/register.json': { entries: [] },
    'HANDOFF.md': `Layer in progress: 0\n\n${SECTIONS.join('\n\n')}\n`,
    ...over,
  });
}
const opts = (root: string, o: Partial<GateOptions> = {}): GateOptions => ({ root, full: false, write: false, today, git, run: noRun, testRun: noTests, ...o });
const named = (results: readonly CheckResult[], check: string): CheckResult => {
  const r = results.find((x) => x.check === check);
  if (r === undefined) throw new Error(`no ${check} result`);
  return r;
};
const put = (root: string, files: Record<string, string>) => {
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), c);
  }
};

describe('the gate, end to end on a fixture', () => {
  it('is red until the generated matrices are written, then green', () => {
    const { root } = minimal();
    const before = runGate(opts(root));
    expect(before.verdict).toBe('red');
    expect(all(named(before.results, 'generated'))).toEqual(
      ['LAYERS', 'REGISTER', 'FEATURES', 'COVERAGE'].map((m) => `red matrix/${m}.md | out of date; run \`npm run gate:write\` and commit it`),
    );
    expect(runGate(opts(root, { write: true })).verdict).toBe('green');
    expect(readFileSync(join(root, 'matrix/LAYERS.md'), 'utf8')).toContain('| 0 | Gate | `gate` | in progress |');
    const after = runGate(opts(root));
    expect(after.results.flatMap(all)).toEqual([]);
    expect(after.verdict).toBe('green');
    expect(after.results.map((r) => r.check)).toEqual(['toolchain', 'owner-docs', 'build-order', 'text-inventory', 'research-register', 'feature-matrix', 'coverage', 'handoff', 'generated']);
  });
  it('fails a matrix that is stale, and a file in matrix/ no check owns', () => {
    const { root } = minimal();
    runGate(opts(root, { write: true }));
    put(root, { 'matrix/LAYERS.md': 'edited by hand', 'matrix/NOTES.md': 'mine' });
    expect(all(named(runGate(opts(root)).results, 'generated'))).toEqual(['red matrix/LAYERS.md | out of date; run `npm run gate:write` and commit it', 'red matrix/NOTES.md | a file in matrix/ that no check generates']);
  });
  it('runs the tools, then the tests, then mutation when asked, and holds their results', () => {
    const { root } = minimal();
    runGate(opts(root, { write: true }));
    const calls: string[] = [];
    const spy = (cmd: string, args: string[]) => (calls.push(`${cmd} ${args[0] ?? ''}`), { code: 0, output: '' });
    const { testRun: _t, ...withoutTests } = opts(root, { full: true, run: spy });
    const out = runGate(withoutTests);
    expect(calls).toEqual(['npx tsc', 'npx eslint', 'npx vitest', 'npm audit', 'npx stryker']);
    expect(out.results.map((r) => r.check)).toEqual(['toolchain', 'owner-docs', 'build-order', 'text-inventory', 'research-register', 'typecheck', 'lint', 'tests', 'feature-matrix', 'coverage', 'handoff', 'audit', 'mutation', 'generated']);
    expect(all(named(out.results, 'tests'))).toEqual(['red - | the test run left no report']);
  });
  it('feeds what the test run said into the feature matrix and the coverage', () => {
    const { root } = minimal({
      'registry/pages.json': { home: { title: 'Home', decidedIn: 'x' } },
      'registry/features.json': { 'home.x': { page: 'home', kind: 'display', what: 'x' } },
      'src/core/a/a.ts': '// @slate:reads home.x @slate:bites home.x @slate:downstream home.x\nexport const a = 1;\n',
      'src/core/a/A.tsx': '<p data-feature="home.x" />\n',
      'src/core/a/keys.json': '["k"]',
      'registry/engines.json': { 'core.a': { layer: 1, dir: 'src/core/a', readsPlace: false, matrices: ['coverage/a.json'] } },
      'registry/layers.json': { layers: [{ n: 0, name: 'Gate', dirs: ['gate'] }, { n: 1, name: 'Core', dirs: ['src/core'], holdsEngines: true }], proven: [{ layer: 0, commit: 'a'.repeat(40), date: '2026-10-26', evidence: 'x' }] },
      'HANDOFF.md': `Layer in progress: 1\n\n${SECTIONS.join('\n\n')}\n`,
      'coverage/a.json': { engine: 'core.a', axis: 'k', universe: { source: 'src/core/a/keys.json', pick: 'array' }, rows: [{ key: 'k', status: 'proven', tests: ['t.ts::k'] }] },
    });
    const testRun = {
      run: { passed: new Set(['t.ts::k', 't.ts::b', 't.ts::d']) },
      falsifiers: [{ feature: 'home.x', claim: 'bites', file: 't.ts', test: 'b' }, { feature: 'home.x', claim: 'downstream', file: 't.ts', test: 'd' }],
    };
    runGate(opts(root, { write: true, testRun }));
    const out = runGate(opts(root, { testRun }));
    expect(out.results.flatMap((r) => all(r).map((f) => `${r.check}: ${f}`))).toEqual([]);
    expect(out.verdict).toBe('green');
    const without = runGate(opts(root, { testRun: noTests })).results.flatMap((r) => all(r).map((f) => `${r.check}: ${f}`));
    expect(without).toEqual([
      'feature-matrix: red registry/features.json home.x | no passing test falsifies the bites claim',
      'feature-matrix: red registry/features.json home.x | no passing test falsifies the downstream claim',
      "coverage: red coverage/a.json k | the row's test didn't pass in this run: t.ts::k",
      'generated: red matrix/FEATURES.md | out of date; run `npm run gate:write` and commit it',
    ]);
  });
  it('is incomplete, not red, when only declared work is unfinished', () => {
    const { root } = minimal({
      'registry/layers.json': { layers: [{ n: 0, name: 'Gate', dirs: ['gate'] }], proven: [] },
      'registry/engines.json': { 'gate.x': { layer: 0, dir: 'gate/x', readsPlace: false, matrices: ['coverage/x.json'] } },
      'gate/x/x.ts': 'export {};\n',
      'gate/x/keys.json': '["a"]',
      'coverage/x.json': { engine: 'gate.x', axis: 'x', universe: { source: 'gate/x/keys.json', pick: 'array' }, rows: [{ key: 'a', status: 'pending' }] },
    });
    runGate(opts(root, { write: true }));
    expect(runGate(opts(root)).verdict).toBe('incomplete');
  });
  it('holds the text as at layer 0, and the handoff by its form, when the ledger is unreadable', () => {
    const { root } = minimal({
      'registry/layers.json': { layers: 'x' },
      'HANDOFF.md': `Layer in progress: 3\n\n${SECTIONS.join('\n\n')}\n`,
      'src/core/text/catalog.json': { 'home.greeting': { text: 'Good morning.', where: 'Home', status: 'placeholder' } },
      'src/core/x/x.ts': "t('home.greeting');\n",
    });
    runGate(opts(root, { write: true }));
    const out = runGate(opts(root));
    expect(out.results.flatMap((r) => all(r).map((f) => `${r.check}: ${f}`))).toEqual(['build-order: red registry/layers.json | the ledger needs "layers" and "proven" arrays']);
  });
  it('passes on this repository, every check but what only the real test run can show', () => {
    // A test can't run the suite it belongs to, so here no test has passed: the claims that cite passing tests (and the
    // matrices written from them) are held by the gate's own run instead. Everything else must hold now; work declared
    // and not yet done (incomplete, such as pending research) is the gate's to report, not a break.
    const out = runGate(opts(ROOT));
    const runOnly = /^(the row's test didn't pass in this run|no passing test falsifies|the engine reads a place, so a passing test)/;
    const findings = out.results
      .filter((r) => r.check !== 'generated')
      .flatMap((r) => r.findings.filter((f) => f.severity === 'red' && !runOnly.test(f.message)).map((f) => `${r.check}: ${f.message}`));
    expect(findings).toEqual([]);
  });
});

describe('the gate, reading the ledger', () => {
  const seven = (proven: number) => ({
    layers: ['Gate', 'Core', 'World', 'Papers', 'Person', 'Screens', 'Voice'].map((name, n) => ({ n, name, dirs: n === 1 ? ['src/core'] : [`x${n}`] })),
    proven: Array.from({ length: proven }, (_, layer) => ({ layer, commit: 'a'.repeat(40), date: '2026-10-26', evidence: 'x' })),
  });
  const handoff = (n: number) => `Layer in progress: ${n}\n\n${SECTIONS.join('\n\n')}\n`;
  const catalog = { 'src/core/text/catalog.json': { 'home.greeting': { text: 'Good morning.', where: 'Home', status: 'placeholder' } }, 'src/core/x/x.ts': "t('home.greeting');\n" };
  const findings = (files: Record<string, unknown>) => {
    const { root } = minimal(files);
    runGate(opts(root, { write: true }));
    return runGate(opts(root)).results.flatMap((r) => all(r).map((f) => `${r.check}: ${f}`));
  };
  it('holds the handoff to the layer the ledger says is in progress', () => {
    expect(findings({ 'registry/layers.json': seven(1), 'HANDOFF.md': handoff(3) })).toEqual(['handoff: red HANDOFF.md | the handoff says layer 3 is in progress, but the ledger says 1']);
  });
  it('holds placeholder wording as unfinished once the voice layer is in progress', () => {
    expect(findings({ 'registry/layers.json': seven(6), 'HANDOFF.md': handoff(6), ...catalog })).toEqual(['text-inventory: incomplete - | 1 lines still carry placeholder wording']);
    expect(findings({ 'registry/layers.json': seven(5), 'HANDOFF.md': handoff(5), ...catalog })).toEqual([]);
  });
  it('reports a missing ledger once, and holds the rest without it', () => {
    const { root } = minimal({ 'HANDOFF.md': handoff(2) });
    rmSync(join(root, 'registry/layers.json'));
    runGate(opts(root, { write: true }));
    expect(runGate(opts(root)).results.flatMap((r) => all(r).map((f) => `${r.check}: ${f}`))).toEqual(['build-order: red registry/layers.json | registry/layers.json is missing']);
  });
});
