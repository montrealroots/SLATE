import { PATHS } from '../lib/paths.ts';
import { isNonEmptyString, isRecord, isSourceFile, readJson, type Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';
import { isCommentOnly, type FalsifierRecord, type TestRun } from './features.ts';

/**
 * The engines' effects (MANDATE rule 1 below the screens; the depth audit of 2026-10-30, which found the feature matrix
 * asked nothing of an engine, so three of layer 3's had no reader outside their tests). Every command, scheduled kind
 * and notice declared in `src/` (`defineCommand({ id })`, `defineKind({ kind })`, `defineNotice(id)`):
 *
 * - is registered in `registry/effects.json`, saying what it changes (`what`);
 * - is read: an anchor `@slate:consumer <id>` sits at the line of code that reads what it changes and changes an
 *   outcome by it, at a line other than its declaration; or, where only a later layer's code can read it (a notice is
 *   read by the screen that tells it to the player), `awaits` names that layer and why, and then no consumer may be
 *   anchored yet (one found means the wait is over: take `awaits` out);
 * - bites: a command or a kind has a passing test that falsifies it (`falsifyAny` with its id and the claim `bites`):
 *   change its input, and the state it leaves changes. A notice bites by being left, which its consumer reads.
 */
export const CONSUMER = /@slate:consumer\s+([A-Za-z0-9.-]+)/g;

export interface Declared {
  id: string;
  sort: 'command' | 'kind' | 'notice';
  file: string;
  line: number;
}

/** The commands, kinds and notices a source file declares, a kind's id read through the constant naming it where it's one. */
export function scanDeclarations(file: string, text: string): Declared[] {
  const lines = text.split('\n');
  const constants = new Map([...text.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*'([^']+)'/g)].map((m) => [m[1] as string, m[2] as string]));
  const out: Declared[] = [];
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/defineCommand(?:<[^(]*>)?\(\{\s*id:\s*'([^']+)'/g)) out.push({ id: m[1] as string, sort: 'command', file, line: i + 1 });
    for (const m of l.matchAll(/defineNotice\(\s*'([^']+)'\s*\)/g)) out.push({ id: m[1] as string, sort: 'notice', file, line: i + 1 });
    for (const m of l.matchAll(/defineKind(?:<[^(]*>)?\(\{\s*kind:\s*(?:'([^']+)'|([A-Z_][A-Z0-9_]*))/g)) {
      const id = m[1] ?? constants.get(m[2] as string);
      if (id !== undefined) out.push({ id, sort: 'kind', file, line: i + 1 });
    }
  });
  return out;
}

/** Each consumer anchor and the line of code it vouches for: its own where code comes first on it, else the next. */
export function scanConsumers(file: string, text: string): { id: string; file: string; line: number }[] {
  const lines = text.split('\n');
  return lines.flatMap((l, i) =>
    [...l.matchAll(CONSUMER)].flatMap((m) => {
      // Stryker disable next-line EqualityOperator: line i is comment-only on this branch, so j >= i finds the same line.
      const target = isCommentOnly(l) ? lines.findIndex((x, j) => j > i && !isCommentOnly(x)) : i;
      return target === -1 ? [] : [{ id: m[1] as string, file, line: target + 1 }];
    }),
  );
}

export function checkEffects(repo: Repo, falsifiers: readonly FalsifierRecord[], tests: TestRun): CheckResult {
  const r = result('effects');
  const raw = readJson(repo, PATHS.effects);
  if (!raw.ok || !isRecord(raw.value)) {
    r.red(raw.ok ? 'the effects registry is not an object' : raw.why, PATHS.effects);
    return r;
  }
  const registry = raw.value;
  const declared: Declared[] = [];
  const consumers: { id: string; file: string; line: number }[] = [];
  for (const file of repo.files(PATHS.src).filter(isSourceFile)) {
    // Stryker disable next-line StringLiteral: every file listed was just found, so it reads.
    const text = repo.read(file) ?? '';
    // The frame's own declarations are its definitions, not effects.
    if (file !== 'src/core/frame/frame.ts') declared.push(...scanDeclarations(file, text));
    consumers.push(...scanConsumers(file, text));
  }
  const ids = new Set(declared.map((d) => d.id));
  for (const id of Object.keys(registry)) if (!ids.has(id)) r.red('a registered effect that no code declares', `${PATHS.effects} ${id}`);
  for (const c of consumers) if (!ids.has(c.id)) r.red(`a consumer anchor names "${c.id}", which no code declares`, `${c.file}:${c.line}`);
  const accepted = falsifiers.filter((f) => f.claim === 'bites' && tests.passed.has(`${f.file}::${f.test}`));
  const rows: string[] = [];
  for (const d of declared.sort((a, b) => a.id.localeCompare(b.id))) {
    const at = `${d.file}:${d.line}`;
    const entry = registry[d.id];
    if (!isRecord(entry) || !isNonEmptyString(entry['what'])) {
      r.red(`the ${d.sort} ${d.id} isn't registered in ${PATHS.effects} with what it changes`, at);
      continue;
    }
    const read = consumers.filter((c) => c.id === d.id && !(c.file === d.file && c.line === d.line));
    const awaits = entry['awaits'];
    if (awaits !== undefined && !isNonEmptyString(awaits)) r.red('an effect awaits a later layer, named in words', `${PATHS.effects} ${d.id}`);
    if (read.length === 0 && awaits === undefined) r.red(`nothing reads the ${d.sort} ${d.id}: anchor its consumer (@slate:consumer ${d.id}) or say what layer it awaits`, at);
    if (read.length > 0 && awaits !== undefined) r.red(`the ${d.sort} ${d.id} is read now (${read.map((c) => `${c.file}:${c.line}`).join(', ')}), so it awaits nothing`, `${PATHS.effects} ${d.id}`);
    const proofs = accepted.filter((f) => f.feature === d.id);
    if (d.sort !== 'notice' && proofs.length === 0) r.red(`no passing test falsifies the ${d.sort} ${d.id} (falsifyAny with claim 'bites')`, at);
    const readCell = read.map((c) => `\`${c.file}:${c.line}\``).join('<br>') || `awaits: ${String(awaits)}`;
    // In file and test order, not the order the parallel run finished them in, so the matrix is the same every run.
    const proofCell = proofs.map((p) => `${p.file} › ${p.test}`).sort().join('<br>') || (d.sort === 'notice' ? 'left for its reader' : '**missing**');
    rows.push(`| \`${d.id}\` | ${d.sort} | \`${at}\` | ${String(entry['what'])} | ${readCell} | ${proofCell} |`);
  }
  r.generate(
    `${PATHS.matrixDir}/EFFECTS.md`,
    [
      "# The Engines' Effects",
      '',
      'Generated by the gate from the declarations in `src/`, `registry/effects.json`, the `@slate:consumer` anchors and',
      'the falsifiers recorded by the last test run; do not edit by hand. Every command, scheduled kind and notice is read',
      'by code that changes an outcome by it (or awaits the layer that will read it), and every command and kind is',
      'falsified: changing its input changes the state it leaves.',
      '',
      `Effects: ${declared.length}.`,
      '',
      '| Effect | Sort | Declared | What it changes | Read at | Falsified by |',
      '|---|---|---|---|---|---|',
      ...rows,
      '',
    ].join('\n'),
  );
  r.note(`${declared.length} effects, ${consumers.length} consumer anchors, ${accepted.filter((f) => ids.has(f.feature)).length} falsifiers accepted`);
  return r;
}
