import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import regions from '../../../src/world/gazetteer/regions.json' with { type: 'json' };
import { ageOf, type Age } from '../licence/compile.ts';
import { isRecord, only, readCited } from '../numbers/compile.ts';
import { READINGS, type Reading } from './person.ts';

/**
 * Compiles what a person may do at what age in each country (src/papers/ages/ages.json), from the research's files, one
 * per country (research/sources/papers/ages/<CC>.json, register fact papers.ages.<CC>), each checked against the SHA-256
 * its register entry cites before a byte of it is read (from 2026-10-31, at the owner's ruling that age matters wherever
 * a real rule reads it). A file gives:
 * - `majority`: the age a person is of full age in law and makes contracts in their own name, with `regions` where a
 *   first-level region's own law sets it (Alabama's 19, Mississippi's 21; null for a region whose law wasn't read, so it
 *   doesn't take the country's, as Yukon would have taken Canada's 18 for its 19; and beside a country's own null where
 *   the age is each region's and only some were read);
 * - `work`: the youngest age a person may be employed in general (`from`), and what the law says of a performer
 *   younger (`performers`): `permit` (allowed with the permit or licence it names, `permit`, from the age it sets, if any),
 *   `free` (performing isn't held to the age), or `barred`.
 * Each is null where the source wasn't found, and the note says why; an age is whole years, or years and months or days.
 * Where the file leaves one unread, or there is no file, the person research's (research/sources/person/ages/<CC>.json,
 * register fact person.ages.<CC>, from 2026-11-01) is read where `READINGS` (./person.ts) says it finds it, from that
 * file, checked as the first is: one copy of each fact.
 */
export const SOURCES = 'research/sources/papers/ages';
export const PERSON = 'research/sources/person/ages';
export const OUTPUT = 'src/papers/ages/ages.json';

export const PERFORMERS = ['permit', 'free', 'barred'] as const;

export interface Work {
  from: Age;
  performers: (typeof PERFORMERS)[number];
  permit?: string;
  permitFrom?: Age;
}

export interface Ages {
  majority: Age | null;
  regions?: Record<string, Age | null>;
  work: Work | null;
}

/** An age as the form holds it, or the error the file gets. */
function age(v: unknown, what: string): Age {
  const a = ageOf(v);
  if (a === undefined) throw new Error(`${what} is an age: whole years, or years and months (1 to 11) or days (1 to 364)`);
  return a;
}

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

/** A country's file: its ages, each null where the source wasn't found. */
export function compileAges(code: string, file: Record<string, unknown>): Ages {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  // A file's `service` stays in the research and isn't read: the owner, 2026-11-01, "Dont need military service at all".
  only(file, ['country', 'majority', 'regions', 'work', 'service', 'note', 'sources'], code);
  for (const k of ['majority', 'work']) if (!(k in file)) throw new Error(`${code} gives its ${k}, or null`);
  const out: Ages = {
    majority: file['majority'] === null ? null : age(file['majority'], `${code}'s majority`),
    work: file['work'] === null ? null : work(file['work'], `${code}'s work`),
  };
  if (file['regions'] !== undefined) {
    const r = file['regions'];
    if (!isRecord(r) || Object.keys(r).length === 0) throw new Error(`${code}'s regions set their own majority beside the country's`);
    out.regions = {};
    for (const [key, a] of Object.entries(r)) {
      if (!key.startsWith(`${code}.`) || !Object.hasOwn(regions, key)) throw new Error(`${code}'s region ${key} is one of its regions on the map`);
      out.regions[key] = a === null ? null : age(a, `${code}'s majority in ${key}`);
    }
  }
  return out;
}

const dig = (v: unknown, keys: readonly string[]): unknown => keys.reduce<unknown>((o, k) => (isRecord(o) ? o[k] : undefined), v);

/** The age at a key (dotted, unless `whole`) of the one figure of an item in a country's person research that holds it. */
function figureAge(code: string, person: Record<string, unknown>, item: string, key: string, whole = false): Age {
  const keys = whole ? [key] : key.split('.');
  const found = (person['figures'] as Record<string, unknown>[]).filter((f) => f['item'] === item).map((f) => dig(f['value'], keys)).filter((v) => v !== undefined);
  if (found.length !== 1) throw new Error(`${code}'s person research gives its ${item} ${key} in ${found.length} figures, not one`);
  return age(found[0], `${code}'s ${item} ${key}`);
}

/**
 * A country's file with what the person research finds read into it where the reading says (an empty file where layer 3
 * has none), each field layer 3 holds kept unless the reading says why the person research's stands over it.
 */
export function readInto(code: string, own: Record<string, unknown> | undefined, read?: { reading: Reading; person: Record<string, unknown> }): Record<string, unknown> {
  const file = own ?? { country: code, majority: null, work: null };
  if (read === undefined) return file;
  const { reading: r, person } = read;
  const over = (what: string, was: unknown) => {
    if (was != null && !r.settles) throw new Error(`${code}'s ${what} is layer 3's; the person research's stands over it only where the reading says why`);
  };
  const out = { ...file };
  if (r.majority !== undefined) {
    over('majority', file['majority']);
    out['majority'] = figureAge(code, person, 'majority', r.majority);
  }
  if (r.regions !== undefined) {
    const regions = { ...(file['regions'] as Record<string, unknown> | undefined) };
    for (const key of r.regions) {
      over(`majority in ${key}`, regions[key]);
      regions[key] = figureAge(code, person, 'majority', key, true);
    }
    out['regions'] = regions;
  }
  if (r.from === undefined && r.performers === undefined) return out;
  const was = file['work'] as Record<string, unknown> | null;
  let work: Record<string, unknown> = { ...was };
  if (r.from !== undefined) {
    over('working age', was?.['from']);
    work['from'] = figureAge(code, person, 'minimumWorkAge', r.from);
  }
  if (r.performers !== undefined) {
    over("rule for a younger performer", was?.['performers']);
    work = { from: work['from'], performers: r.performers };
    if (r.permit !== undefined) {
      if (!JSON.stringify(person['figures']).includes(r.permit)) throw new Error(`${code}'s person research doesn't name the permit ${r.permit}`);
      work['permit'] = r.permit;
    }
    if (r.permitFrom !== undefined) work['permitFrom'] = figureAge(code, person, 'childPerformers', r.permitFrom);
  }
  out['work'] = work;
  return out;
}

type Register = { entries: { fact: string; value?: { file?: string; sha256?: string } }[] };

/** A country's person research, checked against the SHA-256 its register entry (person.ages.<CC>) cites before it is read. */
export function readPerson(root: string, register: Register, code: string): Record<string, unknown> {
  const path = `${PERSON}/${code}.json`;
  const cited = register.entries.find((e) => e.fact === `person.ages.${code}`)?.value;
  if (cited?.file !== path) throw new Error(`${path} isn't cited by the register`);
  const bytes = readFileSync(join(root, path));
  if (createHash('sha256').update(bytes).digest('hex') !== cited.sha256) throw new Error(`${path} isn't the file the register cites`);
  return JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
}

/** Every country's ages, of the files the register cites and checks, with what the person research finds where it's read. */
export function readAges(root: string, readings: Readonly<Record<string, Reading>> = READINGS): Record<string, Ages> {
  const own = new Map(readCited(root, SOURCES, 'papers.ages.'));
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const codes = [...new Set([...own.keys(), ...Object.keys(readings)])].sort();
  return Object.fromEntries(
    codes.map((code) => {
      const reading = readings[code];
      return [code, compileAges(code, readInto(code, own.get(code), reading && { reading, person: readPerson(root, register, code) }))];
    }),
  );
}

export { serialize } from '../numbers/compile.ts';
