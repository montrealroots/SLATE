import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import regions from '../../../src/world/gazetteer/regions.json' with { type: 'json' };
import { ageOf, type Age } from '../licence/compile.ts';
import { isRecord, only, readCited } from '../numbers/compile.ts';

/**
 * Compiles what a person may do at what age, and what their sex changes, in each country (src/papers/ages/ages.json),
 * from the research's files, one per country (research/sources/papers/ages/<CC>.json, register fact papers.ages.<CC>),
 * each checked against the SHA-256 its register entry cites before a byte of it is read (from 2026-10-31, at the
 * owner's ruling that sex and age matter wherever a real rule reads them). A file gives:
 * - `majority`: the age a person is of full age in law and makes contracts in their own name, with `regions` where a
 *   first-level region's own law sets another (Alabama's 19, Mississippi's 21);
 * - `work`: the youngest age a person may be employed in general (`from`), and what the law says of a performer
 *   younger (`performers`): `permit` (allowed with the permit or licence it names, `permit`, from the age it sets, if any),
 *   `free` (performing isn't held to the age), or `barred`;
 * - `service`: military service, `none` where the law asks none (or none is enforced, as its source says), or who is
 *   called (`sexes`), from and until what age, and for how many months (`months`, null where the law sets none).
 * Each is null where the source wasn't found, and the note says why; an age is whole years, or years and months or days.
 */
export const SOURCES = 'research/sources/papers/ages';
export const OUTPUT = 'src/papers/ages/ages.json';

export const PERFORMERS = ['permit', 'free', 'barred'] as const;
export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

export interface Work {
  from: Age;
  performers: (typeof PERFORMERS)[number];
  permit?: string;
  permitFrom?: Age;
}
export type Service = 'none' | { sexes: Sex[]; from: Age; until: Age; months: number | null };

export interface Ages {
  majority: Age | null;
  regions?: Record<string, Age>;
  work: Work | null;
  service: Service | null;
}

/** An age as the form holds it, or the error the file gets. */
function age(v: unknown, what: string): Age {
  const a = ageOf(v);
  if (a === undefined) throw new Error(`${what} is an age: whole years, or years and months (1 to 11) or days (1 to 364)`);
  return a;
}

const years = (a: Age) => (typeof a === 'number' ? a : a.years);

function work(w: unknown, what: string): Work {
  if (!isRecord(w)) throw new Error(`${what} is an object`);
  only(w, ['from', 'performers', 'permit', 'permitFrom'], what);
  const out: Work = { from: age(w['from'], `${what}'s from`), performers: w['performers'] as Work['performers'] };
  if (!PERFORMERS.includes(out.performers)) throw new Error(`${what}'s performers are permit, free or barred`);
  if (out.performers !== 'permit') {
    if (w['permit'] !== undefined || w['permitFrom'] !== undefined) throw new Error(`${what} names a permit only where performers need one`);
    return out;
  }
  if (typeof w['permit'] !== 'string' || w['permit'] === '' || w['permit'].trim() !== w['permit']) throw new Error(`${what} names the permit a young performer needs`);
  out.permit = w['permit'];
  if (w['permitFrom'] !== undefined) out.permitFrom = age(w['permitFrom'], `${what}'s permitFrom`);
  return out;
}

function service(s: unknown, what: string): Service {
  if (s === 'none') return 'none';
  if (!isRecord(s)) throw new Error(`${what} is none or an object`);
  only(s, ['sexes', 'from', 'until', 'months'], what);
  const sexes = s['sexes'];
  if (!Array.isArray(sexes) || sexes.length === 0 || !sexes.every((x, i) => SEXES.includes(x as Sex) && sexes.indexOf(x) === i)) throw new Error(`${what} calls male, female or both, each once`);
  const from = age(s['from'], `${what}'s from`);
  const until = age(s['until'], `${what}'s until`);
  if (years(until) <= years(from)) throw new Error(`${what} runs until an age above the one it calls from`);
  const months = s['months'];
  if (months !== null && !(Number.isSafeInteger(months) && (months as number) >= 1)) throw new Error(`${what} lasts a whole number of months, or null`);
  return { sexes: sexes as Sex[], from, until, months: months as number | null };
}

/** A country's file: its ages, each null where the source wasn't found. */
export function compileAges(code: string, file: Record<string, unknown>): Ages {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  only(file, ['country', 'majority', 'regions', 'work', 'service', 'note', 'sources'], code);
  for (const k of ['majority', 'work', 'service']) if (!(k in file)) throw new Error(`${code} gives its ${k}, or null`);
  const out: Ages = {
    majority: file['majority'] === null ? null : age(file['majority'], `${code}'s majority`),
    work: file['work'] === null ? null : work(file['work'], `${code}'s work`),
    service: file['service'] === null ? null : service(file['service'], `${code}'s service`),
  };
  if (file['regions'] !== undefined) {
    const r = file['regions'];
    if (!isRecord(r) || Object.keys(r).length === 0 || out.majority === null) throw new Error(`${code}'s regions set their own majority beside the country's`);
    out.regions = {};
    for (const [key, a] of Object.entries(r)) {
      if (!key.startsWith(`${code}.`) || !Object.hasOwn(regions, key)) throw new Error(`${code}'s region ${key} is one of its regions on the map`);
      out.regions[key] = age(a, `${code}'s majority in ${key}`);
    }
  }
  return out;
}

/** Every country's ages, of the files the register cites and checks. */
export function readAges(root: string): Record<string, Ages> {
  return Object.fromEntries(readCited(root, SOURCES, 'papers.ages.').map(([code, file]) => [code, compileAges(code, file)]));
}

export { serialize } from '../numbers/compile.ts';
