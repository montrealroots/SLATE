import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { falsifyAny } from '../../tests/support/falsify-core.ts';
import { passedTests, readLedger } from '../checks/tools.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const means = (family: string) => ({ checking: family === 'wealthy' ? 9_239_100 : 120_000 });

describe('falsify', () => {
  // These prove falsify itself with made-up features; they must not reach the gate's ledger of real proofs.
  const ledger = process.env['SLATE_LEDGER_DIR'];
  beforeAll(() => {
    delete process.env['SLATE_LEDGER_DIR'];
    mkdirSync(join(ROOT, '.gate'), { recursive: true });
  });
  afterAll(() => {
    if (ledger !== undefined) process.env['SLATE_LEDGER_DIR'] = ledger;
  });
  it('passes when changing the input changes the outcome', () => {
    expect(() => falsifyAny({ feature: 'a.b', claim: 'bites', says: 'the family sets the money', base: 'modest', twin: 'wealthy', outcome: means })).not.toThrow();
  });
  it('fails when the outcome stays the same', () => {
    expect(() => falsifyAny({ feature: 'a.b', claim: 'downstream', says: 'x', base: 'modest', twin: 'scraping by', outcome: means })).toThrow(/changing the input left the outcome the same/);
  });
  it('fails an outcome that is only a sentence', () => {
    expect(() => falsifyAny({ feature: 'a.b', claim: 'bites', says: 'x', base: 1, twin: 2, outcome: (n) => `You have ${n}` })).toThrow(/the outcome is a sentence/);
  });
  it('records the proof in the ledger, by this test\'s file and full name, only when a ledger is set', () => {
    const dir = mkdtempSync(join(ROOT, '.gate', 'ledger-'));
    const spec = { feature: 'a.b', claim: 'downstream' as const, says: 'the family sets the money', base: 'modest', twin: 'wealthy', outcome: means };
    process.env['SLATE_LEDGER_DIR'] = '';
    falsifyAny(spec);
    expect(existsSync(join(process.cwd(), `${process.pid}.jsonl`))).toBe(false);
    process.env['SLATE_LEDGER_DIR'] = dir;
    try {
      falsifyAny(spec);
      falsifyAny(spec);
    } finally {
      delete process.env['SLATE_LEDGER_DIR'];
    }
    const record = { feature: 'a.b', claim: 'downstream', says: 'the family sets the money', file: 'gate/test/falsify.test.ts', test: "falsify > records the proof in the ledger, by this test's file and full name, only when a ledger is set" };
    expect(readFileSync(join(dir, `${process.pid}.jsonl`), 'utf8')).toBe(`${JSON.stringify(record)}\n${JSON.stringify(record)}\n`);
    expect(readdirSync(dir)).toEqual([`${process.pid}.jsonl`]);
  });
  it('fails an outcome that is not the same twice over', () => {
    let calls = 0;
    expect(() => falsifyAny({ feature: 'a.b', claim: 'bites', says: 'x', base: 1, twin: 2, outcome: () => ({ n: (calls += 1) }) })).toThrow(/isn't deterministic/);
  });
});

describe('falsify and the gate, end to end', () => {
  it('records under the very name the test report gives a passing test, and a failing test is not counted', () => {
    const base = join(ROOT, '.gate');
    mkdirSync(base, { recursive: true });
    const dir = mkdtempSync(join(base, 'it-'));
    mkdirSync(join(dir, 'ledger'));
    const core = join(ROOT, 'tests/support/falsify-core.ts');
    writeFileSync(join(dir, 'vitest.config.mjs'), "export default { test: { include: ['*.test.ts'] } };\n");
    writeFileSync(
      join(dir, 'family.test.ts'),
      `import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { falsifyAny } from ${JSON.stringify(core)};
const money = (f: string) => ({ checking: f === 'wealthy' ? 2 : 1 });
describe('family', () => {
  describe('means', () => {
    it('set the first morning', () => {
      falsifyAny({ feature: 'background.family-means', claim: 'downstream', says: 's', base: 'modest', twin: 'wealthy', outcome: money });
    });
    it('fails after proving', () => {
      falsifyAny({ feature: 'background.family-means', claim: 'bites', says: 's', base: 'modest', twin: 'wealthy', outcome: money });
      expect(1).toBe(2);
    });
  });
});
`,
    );
    const out = spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile.json=${join(dir, 'report.json')}`], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, SLATE_LEDGER_DIR: join(dir, 'ledger') },
    });
    expect(out.status).toBe(1);
    const passed = passedTests(dir, JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')) as unknown);
    const ledger = readLedger(join(dir, 'ledger'));
    expect(ledger.map((l) => `${l.claim} ${l.file}::${l.test}`)).toEqual([
      'downstream family.test.ts::family > means > set the first morning',
      'bites family.test.ts::family > means > fails after proving',
    ]);
    expect(ledger.filter((l) => passed.has(`${l.file}::${l.test}`)).map((l) => l.claim)).toEqual(['downstream']);
  });
});
