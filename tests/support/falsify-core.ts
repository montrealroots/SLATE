import { appendFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect } from 'vitest';

/** The claims a falsifier can prove; the gate requires one for the bite and one for the downstream effect. */
export type FalsifiedClaim = 'bites' | 'downstream';

export interface FalsifySpec<I, O> {
  feature: string;
  claim: FalsifiedClaim;
  /** What the claim is, in a sentence, for the matrix's reader. */
  says: string;
  base: I;
  /** The same input with the one thing the feature reads changed. */
  twin: I;
  /** The outcome the player meets, as state: never a sentence, so a reworded line can't pass for an effect. */
  outcome: (input: I) => O;
}

/**
 * MANDATE rule 1's falsifiability test: change the input, and the outcome changes, not only the sentence. Asserts
 * the outcome is state, is the same twice over (deterministic), and differs between base and twin; then records
 * the proof in the gate's ledger, which only counts it if the test as a whole passes.
 */
export function falsifyAny<I, O>(spec: FalsifySpec<I, O>): void {
  const once = spec.outcome(spec.base);
  if (typeof once === 'string') throw new Error(`falsify(${spec.feature}): the outcome is a sentence; it must be state`);
  expect(spec.outcome(spec.base), `falsify(${spec.feature}): the outcome isn't deterministic`).toEqual(once);
  const twin = spec.outcome(spec.twin);
  expect(twin, `falsify(${spec.feature}, ${spec.claim}): changing the input left the outcome the same (${spec.says})`).not.toEqual(once);

  const dir = process.env['SLATE_LEDGER_DIR'];
  if (dir === undefined || dir === '') return;
  const state = expect.getState();
  // Stryker disable next-line StringLiteral: inside a test, Vitest always knows the test's path.
  const file = relative(process.cwd(), state.testPath ?? '').split(sep).join('/');
  // Stryker disable next-line StringLiteral: inside a test, Vitest always knows the test's name.
  const record = { feature: spec.feature, claim: spec.claim, says: spec.says, file, test: state.currentTestName ?? '' };
  appendFileSync(join(dir, `${process.pid}.jsonl`), `${JSON.stringify(record)}\n`);
}
