import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checkCoverage } from './checks/coverage.ts';
import { checkEffects } from './checks/effects.ts';
import { checkFeatures, type FalsifierRecord, type TestRun } from './checks/features.ts';
import { checkHandoff } from './checks/handoff.ts';
import { checkLayers, layerInProgress, parseLedger, type Git } from './checks/layers.ts';
import { checkOwnerDocs } from './checks/owner-docs.ts';
import { checkRegister } from './checks/register.ts';
import { checkText } from './checks/text.ts';
import { checkTitleCase } from './checks/title-case.ts';
import { checkToolchain } from './checks/toolchain.ts';
import { checkAudit, checkLint, checkMutation, checkTests, checkTypecheck, type Runner } from './checks/tools.ts';
import { PATHS } from './lib/paths.ts';
import { openRepo, readJson } from './lib/repo.ts';
import { result, verdictOf, type CheckResult, type Verdict } from './lib/types.ts';

export interface GateOptions {
  root: string;
  /** The full gate adds mutation testing; a layer is proven only on a green full gate. */
  full: boolean;
  /** Write the generated matrices instead of comparing them. */
  write: boolean;
  /** Today, as YYYY-MM-DD: nothing in the register may be read after it. */
  today: string;
  git: Git;
  run: Runner;
  /**
   * What the test run said, given instead of running the typecheck, the lint and the tests (the gate's own fixture
   * tests use this); left out, the gate runs all three.
   */
  testRun?: { run: TestRun; falsifiers: FalsifierRecord[] };
}

export interface GateOutcome {
  verdict: Verdict;
  results: CheckResult[];
}

export function runGate(o: GateOptions): GateOutcome {
  const repo = openRepo(o.root);
  const results: CheckResult[] = [];

  results.push(checkToolchain(repo));
  results.push(checkOwnerDocs(repo));
  results.push(checkLayers(repo, o.git));

  const ledgerRaw = readJson(repo, PATHS.layers);
  const parsed = ledgerRaw.ok ? parseLedger(ledgerRaw.value) : undefined;
  const ledger = parsed?.ok === true ? parsed.ledger : undefined;
  const current = ledger === undefined ? undefined : layerInProgress(ledger);

  // Before the ledger can be read, the text is held as at layer 0: placeholder wording isn't yet unfinished work.
  const text = checkText(repo, current ?? 0);
  results.push(text.result);
  results.push(checkTitleCase(repo));
  const register = checkRegister(repo, o.today, text.ids);
  results.push(register.result);

  let tests = o.testRun;
  if (tests === undefined) {
    results.push(checkTypecheck(o.run));
    results.push(checkLint(o.run));
    const t = checkTests(o.root, o.run);
    results.push(t);
    tests = { run: t.run, falsifiers: t.falsifiers };
  }

  results.push(checkFeatures(repo, tests.falsifiers, tests.run));
  results.push(checkEffects(repo, tests.falsifiers, tests.run));
  results.push(checkCoverage(repo, ledger, register.index, tests.run));
  results.push(checkHandoff(repo, current));
  if (o.full) {
    results.push(checkAudit(o.run));
    results.push(checkMutation(o.root, o.run));
  }

  // The generated matrices: written on request, otherwise held to what the checks just found.
  const gen = result('generated');
  const owned = new Set<string>();
  for (const g of results.flatMap((r) => r.generated)) {
    owned.add(g.path);
    if (o.write) {
      mkdirSync(dirname(join(o.root, g.path)), { recursive: true });
      writeFileSync(join(o.root, g.path), g.content);
    } else if (repo.read(g.path) !== g.content) gen.red('out of date; run `npm run gate:write` and commit it', g.path);
  }
  for (const f of repo.files(PATHS.matrixDir)) if (!owned.has(f)) gen.red('a file in matrix/ that no check generates', f);
  results.push(gen);

  return { verdict: verdictOf(results), results };
}
