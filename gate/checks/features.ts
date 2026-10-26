import { PATHS } from '../lib/paths.ts';
import { isNonEmptyString, isRecord, isSourceFile, readJson, type Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';

/**
 * The feature-to-effect matrix (MANDATE rule 1). Every feature on every page:
 *
 * - is on a page: an element carries `data-feature="<id>"`;
 * - reads real state, bites (changes real state), and is read downstream by something that changes an outcome the
 *   player meets: each proven by an anchor comment `@slate:reads <id>`, `@slate:bites <id>`, `@slate:downstream <id>`
 *   in the app's source, which the gate resolves to the file and line of the code under it;
 * - is falsifiable: a test changed the input and the outcome (state, never a sentence) changed, for the bite and for
 *   the downstream claim, recorded by `falsify()` in a test that passed.
 *
 * The downstream reader sits outside the files that draw the feature, so a page can't vouch for itself.
 */
export const CLAIMS = ['reads', 'bites', 'downstream'] as const;
export type Claim = (typeof CLAIMS)[number];
/** The claims that must each have a falsifier. */
export const FALSIFIED: readonly Claim[] = ['bites', 'downstream'];
export const KINDS = ['field', 'control', 'display'] as const;

export interface Anchor {
  claim: Claim;
  feature: string;
  file: string;
  line: number;
}

export interface FalsifierRecord {
  feature: string;
  claim: string;
  file: string;
  test: string;
}

const ANCHOR = /@slate:(reads|bites|downstream)\s+([A-Za-z0-9.-]+)/g;
const MALFORMED = /@slate:(?!(reads|bites|downstream)\s+[A-Za-z0-9.-])/;

/** A line with no code on it: blank, or starting as a comment (`//`, `/*`, ` *`, or JSX's `{/*`). */
const isCommentOnly = (line: string) => /^\s*(\/\/|\/\*|\*|\{\s*\/\*|$)/.test(line);

/**
 * Finds every anchor in a file and the line of code each one vouches for: its own line when code comes before it
 * there, otherwise the next line that holds code.
 */
export function scanAnchors(file: string, text: string): { anchors: Anchor[]; errors: { line: number; message: string }[] } {
  const lines = text.split('\n');
  const anchors: Anchor[] = [];
  const errors: { line: number; message: string }[] = [];
  lines.forEach((line, i) => {
    if (MALFORMED.test(line)) errors.push({ line: i + 1, message: 'a malformed @slate anchor (it is @slate:reads|bites|downstream <feature-id>)' });
    for (const m of line.matchAll(ANCHOR)) {
      const [, claim, feature] = m as unknown as [string, Claim, string];
      // A line that starts as a comment vouches for the next line of code; one that starts with code, for itself.
      // Stryker disable next-line EqualityOperator: line i is comment-only on this branch, so j >= i finds the same line.
      const target = isCommentOnly(line) ? lines.findIndex((l, j) => j > i && !isCommentOnly(l)) : i;
      if (target === -1) errors.push({ line: i + 1, message: 'an anchor with no code under it' });
      else anchors.push({ claim, feature, file, line: target + 1 });
    }
  });
  return { anchors, errors };
}

export function scanFeatureMarks(text: string): string[] {
  return [...text.matchAll(/data-feature=(?:"([^"]*)"|'([^']*)'|\{\s*['"]([^'"]*)['"]\s*\})/g)].map((m) => String(m[1] ?? m[2] ?? m[3]));
}

export interface TestRun {
  /** `${file}::${full test name}` for every test that passed. */
  passed: ReadonlySet<string>;
}

export function checkFeatures(repo: Repo, falsifiers: readonly FalsifierRecord[], tests: TestRun): CheckResult {
  const r = result('feature-matrix');
  const raw = readJson(repo, PATHS.features);
  const pagesRaw = readJson(repo, PATHS.pages);
  if (!raw.ok || !isRecord(raw.value)) {
    r.red(raw.ok ? 'the feature registry is not an object' : raw.why, PATHS.features);
    return r;
  }
  if (!pagesRaw.ok || !isRecord(pagesRaw.value)) {
    r.red(pagesRaw.ok ? 'the page registry is not an object' : pagesRaw.why, PATHS.pages);
    return r;
  }
  const pages = pagesRaw.value;
  for (const [id, p] of Object.entries(pages)) {
    if (!isRecord(p) || !isNonEmptyString(p['title']) || !isNonEmptyString(p['decidedIn'])) r.red('a page needs its "title" and where the owner "decidedIn" it', `${PATHS.pages} ${id}`);
  }
  const features = raw.value;
  for (const [id, f] of Object.entries(features)) {
    const at = `${PATHS.features} ${id}`;
    if (!/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(id)) r.red('a feature id is dotted lower-case words', at);
    if (!isRecord(f)) {
      r.red('a feature is an object', at);
      continue;
    }
    if (!isNonEmptyString(f['page']) || !(f['page'] in pages)) r.red(`a feature's page must be a registered page (${String(f['page'])})`, at);
    if (!KINDS.includes(f['kind'] as (typeof KINDS)[number])) r.red(`a feature's kind is ${KINDS.join(', ')}`, at);
    if (!isNonEmptyString(f['what'])) r.red('a feature says what it is', at);
  }

  const anchors: Anchor[] = [];
  const marks = new Map<string, Set<string>>();
  for (const file of repo.files(PATHS.src).filter(isSourceFile)) {
    // Stryker disable next-line StringLiteral: every file listed was just found, so it reads.
    const text = repo.read(file) ?? '';
    const scanned = scanAnchors(file, text);
    for (const e of scanned.errors) r.red(e.message, `${file}:${e.line}`);
    anchors.push(...scanned.anchors);
    for (const id of scanFeatureMarks(text)) {
      if (!(id in features)) r.red(`data-feature names "${id}", which isn't a registered feature`, file);
      const seen = marks.get(id);
      if (seen) seen.add(file);
      else marks.set(id, new Set([file]));
    }
  }
  for (const a of anchors) if (!(a.feature in features)) r.red(`an anchor names "${a.feature}", which isn't a registered feature`, `${a.file}:${a.line}`);

  const accepted = falsifiers
    .filter((f) => tests.passed.has(`${f.file}::${f.test}`))
    .sort((a, b) => `${a.file}::${a.test}`.localeCompare(`${b.file}::${b.test}`));
  const rows: string[] = [];
  for (const id of Object.keys(features)) {
    const at = `${PATHS.features} ${id}`;
    const drawnIn = marks.get(id) ?? new Set<string>();
    if (drawnIn.size === 0) r.red('the feature is on no page (no element carries its data-feature)', at);
    const mine = anchors.filter((a) => a.feature === id);
    const cells: string[] = [];
    for (const claim of CLAIMS) {
      let found = mine.filter((a) => a.claim === claim);
      if (claim === 'downstream') {
        const own = found.filter((a) => drawnIn.has(a.file));
        for (const a of own) r.red('a downstream reader must sit outside the files that draw the feature', `${a.file}:${a.line}`);
        found = found.filter((a) => !drawnIn.has(a.file));
      }
      if (found.length === 0) r.red(`the feature has no ${claim} anchor`, at);
      cells.push(found.map((a) => `\`${a.file}:${a.line}\``).join('<br>') || '**missing**');
    }
    const falsified: string[] = [];
    for (const claim of FALSIFIED) {
      const proofs = accepted.filter((f) => f.feature === id && f.claim === claim);
      if (proofs.length === 0) r.red(`no passing test falsifies the ${claim} claim`, at);
      falsified.push(proofs.map((p) => `${claim}: ${p.file} › ${p.test}`).join('<br>') || `${claim}: **missing**`);
    }
    rows.push(`| \`${id}\` | ${cells.join(' | ')} | ${falsified.join('<br>')} |`);
  }
  for (const f of falsifiers) if (!(f.feature in features)) r.red(`a falsifier names "${f.feature}", which isn't a registered feature`, f.file);

  r.generate(
    `${PATHS.matrixDir}/FEATURES.md`,
    [
      '# The Feature-To-Effect Matrix',
      '',
      'Generated by the gate from `registry/features.json`, the `@slate:` anchors in `src/`, and the falsifiers recorded',
      'by the last test run; do not edit by hand. Every feature reads, bites, and is read downstream, each at a file and',
      'line, and a passing test shows that changing its input changes the outcome.',
      '',
      `Features: ${Object.keys(features).length}.`,
      '',
      '| Feature | Reads | Bites | Downstream | Falsified by |',
      '|---|---|---|---|---|',
      ...rows,
      '',
    ].join('\n'),
  );
  r.note(`${Object.keys(features).length} features, ${anchors.length} anchors, ${accepted.length} falsifiers accepted`);
  return r;
}
