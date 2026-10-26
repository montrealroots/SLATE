import { PATHS } from '../lib/paths.ts';
import { isNonEmptyString, isRecord, readJson, type Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';
import type { TestRun } from './features.ts';
import type { LayerLedger } from './layers.ts';
import type { RegisterIndex } from './register.ts';

/**
 * The coverage matrices (MANDATE rule 3, KEEP entries 5, 6 and 19). Every engine declares one or more matrices; each
 * matrix has one row per key of its axis's universe, no more and no fewer. An engine that reads a place covers the
 * country axis (all 252 countries and territories) and names a passing test that runs it over every place of the
 * map (all 171,654, GeoNames of 2026-10-26, by the owner's word that day).
 *
 * A row is:
 * - researched: its facts cited in the register (found or secondary) and a passing test holds it;
 * - proven: nothing outside the game to research (arithmetic, a contract), and a passing test holds it;
 * - blocked: a blocker in the register, and a passing test shows the game saying what isn't modeled;
 * - game: the game's own figure, labeled to the player, in the register, and a passing test holds it;
 * - pending: not done; the layer isn't proven while one remains.
 */
export const ROW_STATUSES = ['researched', 'proven', 'blocked', 'game', 'pending'] as const;
type RowStatus = (typeof ROW_STATUSES)[number];

/**
 * Where an axis's keys come from: a file (`keys` of its object, `keys:<field>` of an object inside it, an `array` of
 * strings, or each item's `field:<name>`), or, for an axis that is the engine's own declared scope, the keys listed.
 */
type Universe = { source: string; pick: string } | { keys: string[] };

function readUniverse(repo: Repo, u: Universe): { ok: true; keys: string[] } | { ok: false; why: string } {
  if ('keys' in u) return { ok: true, keys: u.keys };
  const raw = readJson(repo, u.source);
  if (!raw.ok) return raw;
  const v = raw.value;
  if (u.pick === 'keys') return isRecord(v) ? { ok: true, keys: Object.keys(v) } : { ok: false, why: `${u.source} is not an object` };
  const inner = /^keys:(.+)$/.exec(u.pick)?.[1];
  if (inner !== undefined) return isRecord(v) && isRecord(v[inner]) ? { ok: true, keys: Object.keys(v[inner]) } : { ok: false, why: `${u.source} has no object "${inner}"` };
  if (u.pick === 'array') return Array.isArray(v) && v.every((k) => typeof k === 'string') ? { ok: true, keys: v as string[] } : { ok: false, why: `${u.source} is not an array of strings` };
  const field = /^field:(.+)$/.exec(u.pick)?.[1];
  if (field !== undefined && Array.isArray(v)) {
    const keys = v.map((x) => (isRecord(x) ? x[field] : undefined));
    return keys.every((k) => typeof k === 'string') ? { ok: true, keys: keys as string[] } : { ok: false, why: `${u.source}: not every item has a string "${field}"` };
  }
  return { ok: false, why: `pick "${u.pick}" is keys, array or field:<name>` };
}

const asUniverse = (v: unknown): Universe | undefined => {
  if (!isRecord(v)) return undefined;
  if (Array.isArray(v['keys']) && v['keys'].length > 0 && v['keys'].every(isNonEmptyString)) return { keys: v['keys'] as string[] };
  return isNonEmptyString(v['source']) && isNonEmptyString(v['pick']) ? { source: v['source'], pick: v['pick'] } : undefined;
};

export function checkCoverage(repo: Repo, ledger: LayerLedger | undefined, register: RegisterIndex, tests: TestRun): CheckResult {
  const r = result('coverage');
  const enginesRaw = readJson(repo, PATHS.engines);
  const axesRaw = readJson(repo, PATHS.axes);
  if (!enginesRaw.ok || !isRecord(enginesRaw.value)) {
    r.red(enginesRaw.ok ? 'the engine registry is not an object' : enginesRaw.why, PATHS.engines);
    return r;
  }
  if (!axesRaw.ok || !isRecord(axesRaw.value)) {
    r.red(axesRaw.ok ? 'the axis registry is not an object' : axesRaw.why, PATHS.axes);
    return r;
  }
  const axes = axesRaw.value;
  for (const [name, a] of Object.entries(axes)) {
    if (!isRecord(a) || asUniverse(a) === undefined || typeof a['count'] !== 'number' || !isNonEmptyString(a['decidedIn'])) {
      r.red('an axis needs source, pick, the count the owner decided, and where it was decided', `${PATHS.axes} ${name}`);
    }
  }
  const countryAxis = isRecord(axes['country']) ? axes['country'] : undefined;
  if (countryAxis === undefined) r.red('the country axis is not declared', PATHS.axes);
  const placeAxis = isRecord(axes['place']) ? axes['place'] : undefined;
  if (placeAxis === undefined) r.red('the place axis is not declared', PATHS.axes);

  const engines = enginesRaw.value;
  const engineDirs = new Set<string>();
  const summary: string[] = [];
  const detail: string[] = [];
  let pending = 0;
  /** Matrix A: each engine's status for each country, from its matrix on the country axis. */
  const byCountry = new Map<string, Map<string, RowStatus>>();

  const passed = (ref: unknown) => tests.passed.has(String(ref));

  for (const [id, e] of Object.entries(engines)) {
    const at = `${PATHS.engines} ${id}`;
    if (!isRecord(e) || typeof e['layer'] !== 'number' || !isNonEmptyString(e['dir']) || typeof e['readsPlace'] !== 'boolean' || !Array.isArray(e['matrices']) || e['matrices'].length === 0) {
      r.red('an engine needs layer, dir, readsPlace and at least one matrix', at);
      continue;
    }
    engineDirs.add(e['dir']);
    if (repo.files(e['dir']).length === 0) r.red(`the engine's directory ${e['dir']} holds nothing`, at);
    const layer = ledger?.layers.find((l) => l.n === e['layer']);
    if (ledger !== undefined && (layer === undefined || !layer.dirs.some((d) => (e['dir'] as string).startsWith(`${d}/`)))) r.red(`the engine's directory isn't inside layer ${String(e['layer'])}`, at);

    let coversCountries = false;
    const counts: Record<RowStatus, number> = { researched: 0, proven: 0, blocked: 0, game: 0, pending: 0 };
    for (const path of e['matrices']) {
      if (!isNonEmptyString(path)) {
        r.red('a matrix is named by its path', at);
        continue;
      }
      const m = readJson(repo, path);
      const matrix = m.ok && isRecord(m.value) ? m.value : undefined;
      if (matrix === undefined || matrix['engine'] !== id || !isNonEmptyString(matrix['axis']) || !Array.isArray(matrix['rows'])) {
        r.red(m.ok ? `a matrix needs engine "${id}", its axis and its rows` : m.why, path);
        continue;
      }
      const axisName = matrix['axis'];
      const declared = isRecord(axes[axisName]) ? axes[axisName] : undefined;
      const universe = declared !== undefined ? asUniverse(declared) : asUniverse(matrix['universe']);
      if (universe === undefined) {
        r.red(`the axis "${axisName}" is neither a declared axis nor given a universe here`, path);
        continue;
      }
      const keys = readUniverse(repo, universe);
      if (!keys.ok) {
        r.red(`the axis "${axisName}" can't be read: ${keys.why}`, path);
        continue;
      }
      if (declared !== undefined && typeof declared['count'] === 'number' && keys.keys.length !== declared['count']) {
        r.red(`the axis "${axisName}" holds ${keys.keys.length} keys, but the owner's count is ${declared['count']} (${String(declared['decidedIn'])})`, 'source' in universe ? universe.source : PATHS.axes);
      }
      if (axisName === 'country') coversCountries = true;
      const column = new Map<string, RowStatus>();
      if (axisName === 'country' && !byCountry.has(id)) byCountry.set(id, column);
      const want = new Set(keys.keys);
      const seen = new Set<string>();
      for (const [i, row] of matrix['rows'].entries()) {
        const rw = `${path} row ${i}`;
        if (!isRecord(row) || !isNonEmptyString(row['key']) || !ROW_STATUSES.includes(row['status'] as RowStatus)) {
          r.red(`a row needs its key and a status (${ROW_STATUSES.join(', ')})`, rw);
          continue;
        }
        const key = row['key'];
        const status = row['status'] as RowStatus;
        const where = `${path} ${key}`;
        if (seen.has(key)) r.red('the key has two rows', where);
        seen.add(key);
        if (!want.has(key)) r.red(`the key isn't in the axis "${axisName}"`, where);
        counts[status] += 1;
        column.set(key, status);
        const refs = Array.isArray(row['register']) ? row['register'] : [];
        const entries = refs.map((ref) => register.entries.get(String(ref)));
        refs.forEach((ref, j) => {
          if (entries[j] === undefined) r.red(`the row cites ${String(ref)}, which the register doesn't hold`, where);
        });
        const testRefs = Array.isArray(row['tests']) ? row['tests'] : [];
        if (status !== 'pending') {
          if (testRefs.length === 0) r.red('the row names no test that holds it', where);
          for (const t of testRefs) if (!passed(t)) r.red(`the row's test didn't pass in this run: ${String(t)}`, where);
        }
        const has = (s: string) => entries.some((x) => x?.status === s);
        if (status === 'researched' && !(has('found') || has('secondary'))) r.red('a researched row cites a found fact', where);
        if (status === 'researched' && entries.some((x) => x !== undefined && x.status !== 'found' && x.status !== 'secondary')) r.red('a researched row cites only found facts', where);
        if (status === 'blocked' && !has('blocked')) r.red('a blocked row cites its blocker', where);
        if (status === 'game' && !has('game')) r.red("a row standing on the game's own figure cites it", where);
        if (status === 'pending') pending += 1;
      }
      const missing = keys.keys.filter((k) => !seen.has(k));
      if (missing.length > 0) r.red(`${missing.length} keys of the axis "${axisName}" have no row (first: ${missing.slice(0, 5).join(', ')})`, path);
      detail.push(`### ${id}: ${axisName}`, '', `\`${path}\`, ${keys.keys.length} keys.`, '');
    }
    if (e['readsPlace'] === true) {
      if (!coversCountries) r.red('the engine reads a place, so it covers the country axis', at);
      if (!passed(e['allPlacesTest'])) r.red('the engine reads a place, so a passing test runs it over every place of the map (allPlacesTest)', at);
    }
    summary.push(`| \`${id}\` | ${String(e['layer'])} | ${e['readsPlace'] === true ? 'yes' : 'no'} | ${ROW_STATUSES.map((s) => counts[s]).join(' | ')} |`);
  }
  if (pending > 0) r.incomplete(`${pending} coverage rows are pending`);

  // Every directory directly under a layer that holds engines is a declared engine: no engine goes unmatrixed.
  for (const layer of ledger?.layers.filter((l) => l.holdsEngines) ?? []) {
    for (const dir of layer.dirs) {
      const inside = repo.files(dir).map((f) => f.slice(dir.length + 1));
      const children = new Set(inside.filter((p) => p.includes('/')).map((p) => `${dir}/${p.slice(0, p.indexOf('/'))}`));
      for (const child of children) if (!engineDirs.has(child)) r.red('a directory of engine code that no engine in the registry declares', child);
      for (const p of inside) if (!p.includes('/')) r.red("a file sits loose in a layer that holds engines; it belongs to an engine's directory", `${dir}/${p}`);
    }
  }

  r.generate(
    `${PATHS.matrixDir}/COVERAGE.md`,
    [
      '# Coverage, Engine By Engine',
      '',
      'Generated by the gate from `registry/engines.json` and the matrices it names; do not edit by hand.',
      '',
      '| Engine | Layer | Reads a place | Researched | Proven | Blocked | Game | Pending |',
      '|---|---|---|---|---|---|---|---|',
      ...summary,
      '',
      ...detail,
    ].join('\n'),
  );
  // Matrix A (BUILD-ORDER layer 2): the countries down, each engine that covers them across, the status in each cell.
  const countryUniverse = asUniverse(countryAxis);
  const countryKeys = countryUniverse === undefined ? undefined : readUniverse(repo, countryUniverse);
  if (countryKeys?.ok === true) {
    const source = 'source' in (countryUniverse as Universe) ? readJson(repo, (countryUniverse as { source: string }).source) : undefined;
    const names = source?.ok === true && isRecord(source.value) ? source.value : {};
    const nameOf = (k: string) => {
      const v = names[k];
      return isRecord(v) && isNonEmptyString(v['name']) ? v['name'] : '';
    };
    const ids = [...byCountry.keys()];
    const columns = [...byCountry.values()];
    r.generate(
      `${PATHS.matrixDir}/COUNTRIES.md`,
      [
        '# Coverage Matrix A, Country By Country',
        '',
        'Generated by the gate from each engine\'s matrix on the country axis; do not edit by hand. Every engine that reads',
        'a place fills a column; a cell is the row\'s status in that engine\'s matrix, or blank where it has no row.',
        '',
        `| Code | Country |${ids.map((id) => ` \`${id}\` |`).join('')}`,
        `|---|---|${ids.map(() => '---|').join('')}`,
        ...countryKeys.keys.map((k) => `| ${k} | ${nameOf(k)} |${columns.map((c) => ` ${c.get(k) ?? ''} |`).join('')}`),
        '',
      ].join('\n'),
    );
  }
  r.note(`${Object.keys(engines).length} engines; ${pending} rows pending`);
  return r;
}
