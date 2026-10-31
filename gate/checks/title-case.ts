import { readsAsProse, titleCaseWord } from '../../src/core/text/case.ts';
import { PATHS } from '../lib/paths.ts';
import { isNonEmptyString, isRecord, readJson, type Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';

/**
 * Title Case, the owner's rule from the first SLATE (`.claude/rules/title-case.md`; HANDOFF's next step 6): every
 * label the game shows starts each word with a capital, and prose doesn't. 1221 held it with two tools,
 * `tools/title-case.mjs --check` (labels written in the interface) and `tools/label-sweep.mjs` (names in the content
 * registries, which render as labels); it went unchecked for a while there and "Delete slot 1" sat in a button. Here
 * both halves are one check, reading the rule from `src/core/text/case.ts`, the same code the screens write with.
 *
 * - A catalog line whose text reads as prose is left alone; any other is a label and must be its own Title Case.
 *   SLATE's own labels are Title Case to the letter; a real name inside one keeps its owner's spelling only when
 *   `registry/names.json` lists it, with why.
 * - A registry whose names are shown as labels is named in `registry/names.json` ("shownAsLabels": the file and the
 *   key its names sit under). Its names are real names, so a joining word inside one may stay lower case, never at its
 *   front ("Bank of America", never "of America Bank"), as 1221's label-sweep allowed.
 * - An exception nothing shows, or one already Title Case, is decoration, and red.
 */

/** Words that stay lower case inside a real name, never at its front; 1221's list (`tools/label-sweep.mjs`). */
export const JOINING_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'at', 'by', 'de', 'del', 'della', 'alla', 'di', 'da', 'du', 'for', 'from', 'in',
  'la', 'le', 'of', 'on', 'or', 'the', 'to', 'van', 'von', 'with', 'bin', 'al',
  'à', // Banque Internationale à Luxembourg, as the bank writes it.
]);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Every word of a text in Title Case, prose or not: a name is never a sentence, whatever it ends with. */
const everyWord = (text: string) => text.replace(/\S+/g, titleCaseWord);

/** Every string under the key, anywhere in the JSON, with the path that reaches it. */
function namesUnder(value: unknown, key: string, path: string, out: [string, string][]): [string, string][] {
  if (Array.isArray(value)) value.forEach((v, i) => namesUnder(v, key, `${path}[${i}]`, out));
  else if (isRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      const at = path === '' ? k : `${path}.${k}`;
      if (k === key && typeof v === 'string') out.push([at, v]);
      else namesUnder(v, key, at, out);
    }
  }
  return out;
}

export function checkTitleCase(repo: Repo): CheckResult {
  const r = result('title-case');
  const raw = readJson(repo, PATHS.names);
  const names = raw.ok && isRecord(raw.value) && isNonEmptyString(raw.value['source']) ? raw.value : undefined;
  const asWrittenRaw = names?.['asWritten'];
  const shownRaw = names?.['shownAsLabels'];
  if (!Array.isArray(asWrittenRaw) || !Array.isArray(shownRaw)) {
    r.red(raw.ok ? 'the names need a "source", an "asWritten" list and a "shownAsLabels" list' : raw.why, PATHS.names);
    return r;
  }

  // The real names spelled as their owners spell them, each with where it sits in the list, and those a label used.
  const asWritten = new Map<string, string>();
  const used = new Set<string>();
  for (const [i, n] of asWrittenRaw.entries()) {
    const at = `${PATHS.names} asWritten ${i}`;
    if (!isRecord(n) || !isNonEmptyString(n['name']) || !isNonEmptyString(n['why'])) r.red('a name as its owner writes it needs "name" and "why"', at);
    else if (everyWord(n['name']) === n['name']) r.red(`"${n['name']}" is already Title Case, so it's no exception`, at);
    else asWritten.set(n['name'], at);
  }
  // Any listed name, whole, the longest first; with none listed, the group is one that never matches.
  const listed = [...asWritten.keys()].sort((a, b) => b.length - a.length).map(escape);
  const nameIn = new RegExp(`(?<![\\p{L}\\p{N}])(${listed.join('|') || '(?!)'})(?![\\p{L}\\p{N}])`, 'u');

  // The catalog's labels: Title Case to the letter, but for a listed real name inside one. A catalog the
  // text-inventory check can't read is that check's to report.
  const catalog = readJson(repo, PATHS.catalog);
  let labels = 0;
  let prose = 0;
  for (const [id, entry] of Object.entries(catalog.ok && isRecord(catalog.value) ? catalog.value : {})) {
    const text = isRecord(entry) ? entry['text'] : undefined;
    if (typeof text !== 'string') continue;
    if (readsAsProse(text)) {
      prose += 1;
      continue;
    }
    labels += 1;
    // Split around the listed names (the capture keeps each at an odd index), and case only what's between them.
    const expected = text
      .split(nameIn)
      .map((p, i) => (i % 2 === 1 ? (used.add(p), p) : everyWord(p)))
      .join('');
    if (expected !== text) r.red(`a label is Title Case: "${expected}", not "${text}"`, `${PATHS.catalog} ${id}`);
  }

  // The registries whose names are shown as labels.
  let shown = 0;
  for (const [i, s] of shownRaw.entries()) {
    const at = `${PATHS.names} shownAsLabels ${i}`;
    if (!isRecord(s) || !isNonEmptyString(s['file']) || !isNonEmptyString(s['key'])) {
      r.red('a registry shown as labels needs its "file" and the "key" its names sit under', at);
      continue;
    }
    const file = s['file'];
    const data = readJson(repo, file);
    if (!data.ok) {
      r.red(data.why, at);
      continue;
    }
    const found = namesUnder(data.value, s['key'], '', []);
    if (found.length === 0) r.red(`${file} has no name under "${s['key']}"`, at);
    for (const [path, name] of found) {
      shown += 1;
      if (asWritten.has(name)) {
        used.add(name);
        continue;
      }
      let first = true;
      const expected = name.replace(/\S+/g, (w) => {
        const keep = !first && JOINING_WORDS.has(w);
        first = false;
        return keep ? w : titleCaseWord(w);
      });
      if (expected !== name) r.red(`a name shown as a label is Title Case, but for the joining words inside it: "${expected}", not "${name}"`, `${file} ${path}`);
    }
  }

  for (const [name, at] of asWritten) if (!used.has(name)) r.red(`no label or name shown says "${name}", so it's no exception`, at);
  r.note(`${labels} labels and ${prose} lines of prose in the catalog; ${shown} names shown as labels from ${shownRaw.length} registries`);
  return r;
}
