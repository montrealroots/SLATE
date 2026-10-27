import { PATHS } from '../lib/paths.ts';
import { isIsoDate, isNonEmptyString, isRecord, readJson, type Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';

/**
 * The research register (MANDATE rule 3, KEEP entry 7). Each entry is one fact sought, and says how it was found:
 *
 * - found: read from the primary source (the government's, the institution's own page or document), with the
 *   page and the date it was read.
 * - secondary: found only in a secondary source that quotes the primary, marked so, naming the primary it quotes.
 * - blocked: not found after every method KEEP entry 7 names, each tried and dated, with the player-facing line
 *   that says what isn't modeled.
 * - game: the game's own figure standing in where nothing real exists to read, labeled to the player as the game's
 *   (KEEP entry 5), with the reason.
 *
 * A fact appears once (no second copy, MANDATE rule 7): two entries may not hold the same fact key.
 */
export const STATUSES = ['found', 'secondary', 'blocked', 'game'] as const;
export type Status = (typeof STATUSES)[number];

/** Every method KEEP entry 7 names; a blocker stands only when each was tried. */
export const METHODS = ['web-search', 'institution', 'official-register', 'trade-press', 'archive'] as const;

export interface RegisterEntry {
  id: string;
  fact: string;
  status: Status;
}

export interface RegisterIndex {
  entries: Map<string, RegisterEntry>;
}

const isUrl = (v: unknown) => /^https?:\/\/\S+$/.test(String(v));

export function checkRegister(repo: Repo, today: string, textIds: ReadonlySet<string> | undefined): { result: CheckResult; index: RegisterIndex } {
  const r = result('research-register');
  const index: RegisterIndex = { entries: new Map() };
  const out = { result: r, index };
  const raw = readJson(repo, PATHS.register);
  if (!raw.ok || !isRecord(raw.value) || !Array.isArray(raw.value['entries'])) {
    r.red(raw.ok ? 'the register needs an "entries" array' : raw.why, PATHS.register);
    return out;
  }
  const facts = new Map<string, string>();
  const textId = (id: unknown, what: string, where: string) => {
    if (!isNonEmptyString(id)) r.red(`${what} must name a line of the text catalog`, where);
    else if (textIds !== undefined && !textIds.has(id)) r.red(`${what} names "${id}", which the text catalog doesn't hold`, where);
  };
  const dated = (d: unknown, what: string, where: string) => {
    if (!isIsoDate(d)) r.red(`${what} needs the date it was read, as YYYY-MM-DD`, where);
    else if (d > today) r.red(`${what} is dated ${d}, after today (${today})`, where);
  };

  for (const [i, e] of raw.value['entries'].entries()) {
    const where = `${PATHS.register} entry ${i}`;
    if (!isRecord(e)) {
      r.red('an entry is not an object', where);
      continue;
    }
    if (!/^R-\d{4,}$/.test(String(e['id']))) {
      r.red('an entry needs an id like R-0001', where);
      continue;
    }
    const id = String(e['id']);
    const at = `${PATHS.register} ${id}`;
    if (index.entries.has(id)) r.red(`the id ${id} is used twice`, at);
    if (!isNonEmptyString(e['fact'])) r.red('an entry needs the fact key it holds', at);
    if (!isNonEmptyString(e['sought'])) r.red('an entry needs what was sought, in words', at);
    const status = e['status'];
    if (!STATUSES.includes(status as Status)) {
      r.red(`status must be one of ${STATUSES.join(', ')}`, at);
      continue;
    }
    if (isNonEmptyString(e['fact'])) {
      const prior = facts.get(e['fact']);
      if (prior !== undefined) r.red(`the fact "${e['fact']}" is held twice, by ${prior} and ${id}`, at);
      facts.set(e['fact'], id);
    }
    const sources = Array.isArray(e['sources']) ? e['sources'] : [];
    for (const [j, s] of sources.entries()) {
      const sw = `${at} source ${j}`;
      if (!isRecord(s)) {
        r.red('a source is not an object', sw);
        continue;
      }
      if (s['kind'] !== 'primary' && s['kind'] !== 'secondary') r.red('a source is "primary" or "secondary"', sw);
      if (!isUrl(s['url'])) r.red('a source needs the page it was read from, as a URL', sw);
      if (!isNonEmptyString(s['title'])) r.red('a source needs its title', sw);
      if (!isNonEmptyString(s['said'])) r.red('a source needs what it said', sw);
      dated(s['read'], 'a source', sw);
      if (s['kind'] === 'secondary' && !isUrl(s['quotes'])) r.red('a secondary source must name the primary it quotes', sw);
    }
    const kinds = sources.map((s) => (isRecord(s) ? s['kind'] : undefined));
    if (status === 'found' && !kinds.includes('primary')) r.red('a found fact needs its primary source', at);
    if (status === 'secondary' && !kinds.includes('secondary')) r.red('a fact marked secondary needs the secondary source it was found in', at);
    if ((status === 'found' || status === 'secondary') && !('value' in e)) r.red('a found fact needs its value', at);
    if (status === 'blocked') {
      const attempts = Array.isArray(e['attempts']) ? e['attempts'] : [];
      const tried = new Set<string>();
      for (const [j, a] of attempts.entries()) {
        const aw = `${at} attempt ${j}`;
        if (!isRecord(a) || !METHODS.includes(a['method'] as (typeof METHODS)[number])) {
          r.red(`an attempt's method is one of ${METHODS.join(', ')}`, aw);
          continue;
        }
        if (!isNonEmptyString(a['tried'])) r.red('an attempt says what was tried (the query, the page)', aw);
        if (!isNonEmptyString(a['result'])) r.red('an attempt says what came of it', aw);
        dated(a['date'], 'an attempt', aw);
        tried.add(a['method'] as string);
      }
      for (const m of METHODS) if (!tried.has(m)) r.red(`a blocker stands only after every method; "${m}" wasn't tried`, at);
      textId(e['notModeled'], "a blocker's line telling the player what isn't modeled", at);
    }
    if (status === 'game') {
      if (!isNonEmptyString(e['why'])) r.red("the game's own figure needs the reason nothing real stands there", at);
      textId(e['playerLabel'], "the game's own figure's label to the player", at);
    }
    index.entries.set(id, { id, fact: isNonEmptyString(e['fact']) ? e['fact'] : '', status: status as Status });
  }

  const counts = STATUSES.map((s) => `${[...index.entries.values()].filter((e) => e.status === s).length} ${s}`);
  const lines = [
    '# The Research Register, In Brief',
    '',
    'Generated by the gate from `research/register.json`; do not edit by hand. The register itself holds the sources,',
    'the dates and the attempts.',
    '',
    `Entries: ${index.entries.size} (${counts.join(', ')}).`,
    '',
    '| Id | Fact | Status |',
    '|---|---|---|',
    ...[...index.entries.values()].map((e) => `| ${e.id} | \`${e.fact}\` | ${e.status} |`),
    '',
  ];
  r.generate(`${PATHS.matrixDir}/REGISTER.md`, lines.join('\n'));
  r.note(`${index.entries.size} register entries (${counts.join(', ')})`);
  return out;
}
