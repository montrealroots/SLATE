import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCurrency } from '../../../src/core/money/money.ts';

/**
 * Compiles what a person under age meets in each country's screen work (src/person/youth/youth.json), from the
 * research's files, one per country (research/sources/person/ages/<CC>.json, register fact person.ages.<CC>), each
 * checked against the SHA-256 its register entry cites before a byte of it is read, and the game's readings of them
 * (tools/person/youth/readings.json). The age of majority and the working age with its performer's rule are layer 3's
 * (papers.ages), the one copy: they aren't compiled here.
 *
 * A country gives, where its research reads them:
 * - `contract`: how a minor's contract for the work is made binding, as the research's words say it (person.ages.model:
 *   `voidable` where the contract stands but the minor may avoid it, `court` where a court approves it, `authority`
 *   where a labour or other public authority does, `guardian` where the legal representative signs or consents; `self`,
 *   by a reading, where the minor binds themself), the
 *   age from which the minor contracts alone where the research gives one, and the work it reaches;
 * - `setAside`: the share of the minor's pay the law sets aside and the account it names (the Coogan trust's 15%, the
 *   Caisse des dépôts' pécule), with the threshold it starts above where the law sets one; `none` where the research
 *   says the law sets none aside, or has it paid into an account in the child's own name (the person's own);
 * - `permit`: a region's own permit for a child's work where the rules are the region's (California's Entertainment Work
 *   Permit), its issuer, the age it is needed under and the youngest age it is granted at; the country's is layer 3's;
 * - `reach`: the work the child-work rules (the permit, the hours) reach, a performer's always;
 * - `hours`: the hours a day and a week a minor may work, by age;
 * - `company`: the age from which a person may direct a company (the producer's vehicle), or the majority;
 * - `fund`: the age from which the public film fund takes an applicant, or `company` where it takes only companies;
 * - `unions`: the unions whose rules for a young member the research shows exist but couldn't read (SAG-AFTRA's: its
 *   site refused every read), so the player is told; a union whose research gives no age rule has none.
 *
 * Each is read from the research's own keys (KEYS below) or, where a reading names it, from where the reading points;
 * a country whose rules are its regions' is read for the region its work is made in (the reading's `seat`). What
 * neither finds is null, and the player is told it isn't known. Every figure is the research's: a reading names where it
 * stands and, where it stands inside the research's words, the words it is read from, never the figure alone.
 */
export const SOURCES = 'research/sources/person/ages';
export const READINGS = 'tools/person/youth/readings.json';
export const OUTPUT = 'src/person/youth/youth.json';
export const PLACES = 'src/world/gazetteer/places';
export const FACT = 'person.ages.';
export const BLOCKED = 'person.ages.blocked.';

/** The kinds of work, as money.tax names them (a test holds the two lists one). */
export const WORKS = ['performer', 'director', 'producer', 'author'] as const;
export type Work = (typeof WORKS)[number];

export type Age = number | { years: number; months: number } | { years: number; days: number };
export const BY = ['self', 'voidable', 'court', 'authority', 'guardian'] as const;
export type By = (typeof BY)[number];

export interface Contract {
  by: By;
  /** The age from which the minor contracts alone; none where the research gives none (the rule binds to majority). */
  alone: Age | null;
  roles: Work[];
}
export interface Over {
  amount: string;
  currency: string;
  /** Counted over one engagement, or over a calendar year. */
  per: 'engagement' | 'year';
  /** Only the part above it is set aside (Ontario's), or all of it once it is passed (the Philippines'). */
  above: boolean;
}
export interface SetAside {
  share: string;
  /** The account the law names; none where the research names none. */
  into: string | null;
  roles: Work[];
  over: Over | null;
}
export interface Permit {
  /** Who issues it; none where the region needs no permit, only the youngest age. */
  issuer: string | null;
  under: Age | 'majority';
  from: Age | null;
}
export interface Band {
  from: Age;
  /** The age it ends at: none, at majority; `work`, at the country's working age (layer 3), where the research says the school-leaving age. */
  to: Age | 'work' | null;
  day: number | null;
  week: number | null;
}
export interface Youth {
  zone: string | null;
  seat: string | null;
  contract: Contract | null;
  setAside: SetAside | 'none' | null;
  permit: Permit | null;
  reach: Work[];
  hours: Band[] | null;
  company: Age | 'majority' | null;
  fund: Age | 'company' | null;
  /** The unions whose rules for a young member the research shows exist but couldn't read (SAG-AFTRA's). */
  unions: string[];
}

interface Figure {
  item: string;
  value: unknown;
}
export interface Research {
  country: string;
  figures: Figure[];
  blockers: { item: string; sought: string; tried?: unknown }[];
}
interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

const record = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what} is not an object`);
  return v as Record<string, unknown>;
};

/** What stands at a pointer, "figure:path/to/it" (an array's place by its number), in a country's research. */
export function pointed(r: Research, ptr: string): unknown {
  const m = /^(\d+):(.*)/.exec(ptr);
  const figure = m === null ? undefined : r.figures[Number(m[1])];
  if (figure === undefined) throw new Error(`${r.country} has no figure at ${ptr}`);
  const path = (m as RegExpExecArray)[2] as string;
  let here = figure.value;
  for (const key of path === '' ? [] : path.split('/')) {
    if (typeof here !== 'object' || here === null || !Object.hasOwn(here, key)) throw new Error(`${r.country} has nothing at ${ptr}`);
    here = (here as Record<string, unknown>)[key];
  }
  return here;
}

/**
 * A figure a reading names: at a pointer, the value there; `{ at, is }`, the words `is` read inside the research's words
 * at the pointer (refused where they don't stand there).
 */
export function named(r: Research, v: unknown): unknown {
  if (typeof v === 'string') return pointed(r, v);
  const o = record(v, `${r.country}'s figure`);
  const words = pointed(r, String(o['at']));
  if (typeof o['is'] !== 'string' || !JSON.stringify(words).includes(o['is'])) throw new Error(`${r.country}'s research doesn't say "${String(o['is'])}" at ${String(o['at'])}`);
  return o['is'];
}

/** An age as the research writes it: whole years, or "N days", "N months", "N years" (or just "N"). */
export function ageOf(v: unknown): Age {
  if (Number.isSafeInteger(v) && (v as number) >= 0) return v as number;
  const m = typeof v === 'string' ? /^(\d+)(?: (days?|months?|years?))?$/.exec(v.trim()) : null;
  if (m === null) throw new Error(`${JSON.stringify(v)} isn't an age`);
  const n = Number(m[1]);
  if (m[2] === undefined || m[2].startsWith('year')) return n;
  return m[2].startsWith('day') ? { years: 0, days: n } : { years: 0, months: n };
}

/** Hours as the research writes them: a number above nothing, or "N minutes". */
export function hoursOf(v: unknown): number {
  if (typeof v === 'number' && v > 0) return v;
  const m = typeof v === 'string' ? /^(\d+) minutes$/.exec(v) : null;
  if (m === null) throw new Error(`${JSON.stringify(v)} isn't a number of hours`);
  return Number(m[1]) / 60;
}

/** The research's keys the game reads, by what they say, in the order it reads them. */
export const KEYS = {
  setAside: ['setAside', 'earningsSetAside'],
  into: ['into', 'to', 'where'],
  binding: ['binding', 'authorisation', 'employment', 'contractBy', 'consent', 'parentConsent', 'madeBy'],
  alone: ['ownContractFrom', 'contractAloneFrom', 'employmentContractFrom', 'fullCapacityFrom', 'fullAgeForWorkAndArtFrom', 'deemedOfAgeFrom'],
  reach: ['reachesRoles', 'reachesWritingDirecting'],
  company: ['directorMinAge', 'directorMinimumAge', 'directorFrom', 'directorAge', 'directAge', 'formAndDirectFrom', 'boardMemberFrom', 'boardFrom', 'boardMinAge', 'managementFrom', 'managingDirectorFrom'],
  fund: ['minimumAge', 'applicantAge', 'age', 'minAge', 'applicantMinAge', 'individualMinAge', 'individualFrom', 'coreTeamMinAge'],
} as const;

/**
 * How the research's words say a minor's contract is made binding (person.ages.model): voidable where they say the
 * contract stands and may be avoided; else a court where they name one; else an authority; else the guardian.
 */
export const VOIDABLE = /voidable|disaffirm|unenforceable unless|affirm|set aside on application|annullable|relatively void|may be set aside|may end it|may rescind/i;
export const COURT = /court|tribunal|juez|juiz|judge|giudice|alvará|juge/i;
export const AUTHORITY = /inspect|authorit|autoridad|autorité|\bministr|\bminister|préfet|prefect|department|departament|labour service|defensor|council|MOHRE|office|commission/i;
export const GUARDIAN = /representative|guardian|parent|tutor|consent|représentant|representante|padres|curator|værge|vergemål|carer|administrat|vertreter|ouder|vertegenwoordig|genitor|rodzic/i;

export function byOf(words: string): By | null {
  for (const [by, re] of [['voidable', VOIDABLE], ['court', COURT], ['authority', AUTHORITY], ['guardian', GUARDIAN]] as const) if (re.test(words)) return by;
  return null;
}

/**
 * The work the research's words say a rule reaches (person.ages.model): every kind where they say yes, any, every or
 * general; a performer's only where they say no, not named, only, or that other work falls outside it; else the
 * kinds they name. A list names its kinds.
 */
export const NONE_ELSE = /^(no|false)\b(?! distinction)|not named|(?<!not )\bonly\b|falls? outside/i;
export const EVERY = /^(yes|true)\b|\bany\b|\bevery|general|whatever|à quelque titre|no distinction|not distinguished|all employment/i;
export const KINDS: readonly (readonly [Work, RegExp])[] = [
  ['performer', /perform|actor|actress|artist|model|dancer|musician/i],
  ['author', /writ|author|scénar|screenwriter/i],
  ['director', /direct|réalis/i],
  ['producer', /produc/i],
];

export function reachOf(v: unknown): Work[] | null {
  // A list's words joined, true and false as their words; anything else names no kind ("null", "[object Object]").
  const words = String(v);
  if (!Array.isArray(v) && NONE_ELSE.test(words)) return ['performer'];
  if (!Array.isArray(v) && EVERY.test(words)) return [...WORKS];
  const named = WORKS.filter((w) => KINDS.some(([k, re]) => k === w && re.test(words)));
  return named.length === 0 ? null : named;
}

/** The first of a set of keys an object holds a value other than null at. */
const first = (o: Record<string, unknown>, keys: readonly string[]): [string, unknown] | undefined => keys.map((k) => [k, o[k]] as [string, unknown]).find(([, v]) => v !== undefined && v !== null);

/** A figure's value, read for the seat where it is set by region and holds the seat's own. */
// Stryker disable next-line ConditionalExpression: a primitive holds no region's code as its own key, so the object test only says plainly what hasOwn does.
export const forSeat = (v: unknown, seat: string | null): unknown => (seat !== null && v instanceof Object && Object.hasOwn(v, seat) ? (v as Record<string, unknown>)[seat] : v);

/** The values of a country's figures of an item, each read for the seat. */
const valuesOf = (r: Research, item: string, seat: string | null): Record<string, unknown>[] =>
  r.figures
    .filter((f) => f.item === item)
    .map((f) => forSeat(f.value, seat))
    .filter((v): v is Record<string, unknown> => v instanceof Object);

/** Whether the country's blockers of an item name a fact (by the words of what they sought). */
const blockedOn = (r: Research, item: string, re: RegExp): boolean => r.blockers.some((b) => b.item === item && re.test(b.sought));
export const SET_ASIDE_SOUGHT = /set.?aside|share of .*earnings|earnings set/i;
export const BINDING_SOUGHT = /bind|approv|signs|capacity|contract is made|contract for/i;

/** The set-aside the research reads by its own keys: none where it is null and nothing sought of it is blocked. */
export function setAsideOf(r: Research, seat: string | null, roles: Work[]): SetAside | 'none' | null {
  for (const v of valuesOf(r, 'minorsContracts', seat)) {
    const k = KEYS.setAside.find((x) => Object.hasOwn(v, x));
    if (k === undefined) continue;
    const s = v[k];
    if (s === null) return blockedOn(r, 'minorsContracts', SET_ASIDE_SOUGHT) ? null : 'none';
    if (typeof (s as Record<string, unknown>)['share'] !== 'number') return null;
    const into = first(s as Record<string, unknown>, KEYS.into);
    if (typeof into?.[1] !== 'string') return null;
    return { share: String((s as Record<string, unknown>)['share']), into: into[1], roles, over: null };
  }
  return null;
}

/** The contract rule the research reads by its own keys. */
export function contractOf(r: Research, seat: string | null, roles: Work[]): Contract | null {
  if (blockedOn(r, 'minorsContracts', BINDING_SOUGHT)) return null;
  for (const v of valuesOf(r, 'minorsContracts', seat)) {
    const said = first(v, KEYS.binding);
    const by = said === undefined ? null : byOf(JSON.stringify(said[1]));
    if (by === null) continue;
    const alone = first(v, KEYS.alone);
    return { by, alone: typeof alone?.[1] === 'number' ? alone[1] : null, roles };
  }
  return null;
}

/** The work an item's rule reaches, by the research's own keys; none found, none said. */
export function reachIn(r: Research, item: string, seat: string | null): Work[] | null {
  for (const v of valuesOf(r, item, seat)) {
    const said = first(v, KEYS.reach);
    const roles = said === undefined ? null : reachOf(said[1]);
    if (roles !== null) return roles;
  }
  return null;
}

/** The company age the research reads by its own keys: a number of years, or the majority where its words say so. */
export function companyOf(r: Research, seat: string | null): Age | 'majority' | null {
  if (r.blockers.some((b) => b.item === 'companies')) return null;
  for (const v of valuesOf(r, 'companies', seat)) {
    const own = first(v, KEYS.company);
    if (typeof own?.[1] === 'number') return own[1];
    if (typeof own?.[1] === 'string' && /^majority/.test(own[1])) return 'majority';
  }
  return null;
}

/** The fund's applicant age the research reads by its own keys, at its top or under the fund's name; `company` where it takes no person. */
export function fundOf(r: Research): Age | 'company' | null {
  if (r.blockers.some((b) => b.item === 'funds')) return null;
  for (const v of valuesOf(r, 'funds', null)) {
    const levels = [v, ...Object.values(v).filter((x): x is Record<string, unknown> => x instanceof Object)];
    for (const o of levels) {
      const own = first(o, KEYS.fund);
      if (typeof own?.[1] === 'number') return own[1];
    }
    if (levels.some((o) => o['individualsMayApply'] === false || o['individuals'] === false)) return 'company';
  }
  return null;
}

const ROLES_OK = (v: unknown): Work[] => {
  if (!Array.isArray(v) || v.length === 0 || v.some((x) => !(WORKS as readonly string[]).includes(x as string))) throw new Error(`${JSON.stringify(v)} isn't a list of kinds of work`);
  return v as Work[];
};

/** A reading's roles, `every` for all four, and the research's words it reads them from. */
function rolesRead(r: Research, o: Record<string, unknown>): Work[] {
  named(r, o['at']);
  return o['roles'] === 'every' ? [...WORKS] : ROLES_OK(o['roles']);
}

/** A reading's threshold: an amount (read from the research's words or figure), its currency, what it is counted over and how. */
export function overOf(r: Research, v: unknown): Over {
  const o = record(v, `${r.country}'s threshold`);
  const amount = String(named(r, o['amount'])).replace(/[^\d.]/g, '');
  const said = String(o['currency']);
  const currency = /^\d+:/.test(said) ? String(named(r, said)) : said;
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error(`${r.country}'s threshold isn't an amount`);
  if (!isCurrency(currency)) throw new Error(`${r.country}'s threshold is in ${currency}, which isn't a currency of ISO 4217's list`);
  if (o['per'] !== 'engagement' && o['per'] !== 'year') throw new Error(`${r.country}'s threshold is counted over ${String(o['per'])}`);
  if (typeof o['above'] !== 'boolean') throw new Error(`${r.country}'s threshold says whether only the part above it is set aside`);
  return { amount, currency, per: o['per'], above: o['above'] };
}

/** A country's research as the readings and its own keys read it. */
export function youthOf(r: Research, reading: Record<string, unknown>, zone: string | null): Youth {
  const seat = reading['seat'] === undefined ? null : String(reading['seat']);
  const has = (k: string) => Object.hasOwn(reading, k);
  const sub = (k: string) => record(reading[k], `${r.country}'s ${k}`);
  const reach = has('reach') ? rolesRead(r, sub('reach')) : (reachIn(r, 'childPerformers', seat) ?? ['performer']);
  if (!reach.includes('performer')) throw new Error(`${r.country}'s child-work rules leave out a performer`);
  const roles = has('roles') ? rolesRead(r, sub('roles')) : (reachIn(r, 'minorsContracts', seat) ?? [...WORKS]);
  const out: Youth = { zone, seat, contract: contractOf(r, seat, roles), setAside: setAsideOf(r, seat, roles), permit: null, reach, hours: null, company: companyOf(r, seat), fund: fundOf(r), unions: [] };
  if (has('contract')) out.contract = reading['contract'] === null ? null : contractRead(r, sub('contract'), roles);
  if (has('setAside')) out.setAside = reading['setAside'] === null ? null : setAsideRead(r, sub('setAside'), roles);
  if (has('permit')) out.permit = permitRead(r, sub('permit'));
  if (has('hours')) out.hours = hoursRead(r, reading['hours']);
  if (has('company')) out.company = reading['company'] === null ? null : ageOrMajority(named(r, reading['company']));
  if (has('fund')) out.fund = reading['fund'] === null ? null : ageOf(named(r, reading['fund']));
  if (has('unions')) out.unions = unionsRead(r, reading['unions']);
  for (const k of Object.keys(reading)) if (!['seat', 'reach', 'roles', 'contract', 'setAside', 'permit', 'hours', 'company', 'fund', 'unions', 'note'].includes(k)) throw new Error(`${r.country}'s reading names ${k}, which the game doesn't read`);
  return out;
}

/**
 * The unions a reading names whose rules for a young member exist but couldn't be read: each one the research's union
 * blocker seeks, with the words its attempts found showing the rule exists (`is`).
 */
function unionsRead(r: Research, v: unknown): string[] {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`${r.country}'s unions are no list`);
  return v.map((u) => {
    const o = record(u, `${r.country}'s union`);
    const b = r.blockers.find((x) => x.item === 'unions');
    const words = JSON.stringify(b ?? null);
    if (typeof o['union'] !== 'string' || typeof o['is'] !== 'string' || !words.includes(o['union']) || !words.includes(o['is'])) throw new Error(`${r.country}'s union blocker doesn't seek ${String(o['union'])}'s rule, or doesn't say "${String(o['is'])}"`);
    return o['union'];
  });
}

const ageOrMajority = (v: unknown): Age | 'majority' => (typeof v === 'string' && v.startsWith('majority') ? 'majority' : ageOf(v));

function contractRead(r: Research, o: Record<string, unknown>, roles: Work[]): Contract {
  if (!(BY as readonly string[]).includes(o['by'] as string)) throw new Error(`${r.country}'s contract is bound by ${String(o['by'])}`);
  named(r, o['at']);
  return { by: o['by'] as By, alone: o['alone'] === undefined ? null : ageOf(named(r, o['alone'])), roles };
}

function setAsideRead(r: Research, o: Record<string, unknown>, roles: Work[]): SetAside | 'none' {
  if (o['none'] !== undefined) {
    if (pointed(r, String(o['none'])) !== null) throw new Error(`${r.country}'s research sets something aside at ${String(o['none'])}`);
    return 'none';
  }
  // Paid into an account in the child's own name (Ireland's licence condition): the account the pay goes into is the person's, so nothing is held from them.
  if (o['own'] !== undefined) {
    if (typeof named(r, o['own']) !== 'string') throw new Error(`${r.country}'s research names no account of the child's own at ${JSON.stringify(o['own'])}`);
    return 'none';
  }
  const share = named(r, o['share']);
  if (typeof share !== 'number' || share <= 0 || share > 1) throw new Error(`${r.country}'s share set aside is ${JSON.stringify(share)}, not a share`);
  const into = o['into'] === null ? null : named(r, o['into']);
  if (into !== null && (typeof into !== 'string' || into === '')) throw new Error(`${r.country}'s set-aside names no account`);
  const own = o['roles'] === undefined ? roles : rolesRead(r, record(o['roles'], `${r.country}'s set-aside's work`));
  return { share: String(share), into, roles: own, over: o['over'] === undefined ? null : overOf(r, o['over']) };
}

function permitRead(r: Research, o: Record<string, unknown>): Permit {
  const issuer = o['issuer'] === null ? null : named(r, o['issuer']);
  if (issuer !== null && (typeof issuer !== 'string' || issuer === '')) throw new Error(`${r.country}'s permit names no issuer`);
  return { issuer: issuer as string | null, under: o['under'] === 'majority' ? 'majority' : ageOf(named(r, o['under'])), from: o['from'] === undefined ? null : ageOf(named(r, o['from'])) };
}

function hoursRead(r: Research, v: unknown): Band[] {
  if (!Array.isArray(v) || v.length === 0) throw new Error(`${r.country}'s hours are no list of bands`);
  return v.map((b) => {
    const o = record(b, `${r.country}'s band`);
    const read = (k: string, f: (x: unknown) => number | Age) => (o[k] === null || o[k] === undefined ? null : f(o[k] === 0 ? 0 : named(r, o[k])));
    const to = o['to'] === 'work' ? 'work' : (read('to', ageOf) as Age | null);
    const band: Band = { from: (read('from', ageOf) ?? 0) as Age, to, day: read('day', hoursOf) as number | null, week: read('week', hoursOf) as number | null };
    if (band.day === null && band.week === null) throw new Error(`${r.country}'s band sets no hours`);
    return band;
  });
}

/** The zone of the most populous place on the map in a country, or in its region where one is named; none where it has none. */
export function zoneIn(root: string, cc: string, region: string | null): string | null {
  const file = join(root, PLACES, `${cc}.tsv`);
  if (!existsSync(file)) return null;
  let best = { zone: null as string | null, population: -1 };
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const cells = line.split('\t');
    const population = Number(cells[7]);
    if ((region === null || cells[3] === region) && population > best.population) best = { zone: cells[6] as string, population };
  }
  return best.zone;
}

/** A country's research, checked against the register's SHA-256 before a byte is read; none where the register cites only its blockers. */
export function readResearch(root: string, register: Register, cc: string): Research | null {
  const file = `${SOURCES}/${cc}.json`;
  const sha = register.entries.find((e) => e.fact === `${FACT}${cc}`)?.value?.sha256;
  if (sha === undefined) {
    if (!register.entries.some((e) => e.fact === `${BLOCKED}${cc}`)) throw new Error(`${file} isn't cited by the register`);
    return null;
  }
  const bytes = readFileSync(join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${file} isn't the file the register cites`);
  const r = JSON.parse(bytes.toString('utf8')) as Research;
  if (r.country !== cc) throw new Error(`${file} is ${r.country}'s`);
  return r;
}

/** A country whose research the register cites only by its blockers: nothing read, every rule unknown. */
export const unread = (zone: string | null): Youth => ({ zone, seat: null, contract: null, setAside: null, permit: null, reach: ['performer'], hours: null, company: null, fund: null, unions: [] });

/** Every country the research holds, as its readings and its own keys read it; a reading without research is refused. */
export function readYouth(root: string): Record<string, Youth> {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const readings = record(read(READINGS), 'the readings');
  const register = read('research/register.json') as Register;
  // Stryker disable next-line MethodExpression: the directory's order is sorted on the file systems the gate runs on; the sort holds it on any other.
  const files = readdirSync(join(root, SOURCES)).filter((f) => /^[A-Z]{2}\.json$/.test(f)).map((f) => f.slice(0, -5)).sort();
  for (const cc of Object.keys(readings)) if (!files.includes(cc)) throw new Error(`${cc} has a reading and no research`);
  const out: Record<string, Youth> = {};
  for (const cc of files) {
    const reading = Object.hasOwn(readings, cc) ? record(readings[cc], `the reading of ${cc}`) : {};
    const seat = reading['seat'] === undefined ? null : String(reading['seat']);
    const zone = zoneIn(root, cc, seat);
    const r = readResearch(root, register, cc);
    if (r === null && Object.keys(reading).length > 0) throw new Error(`${cc} has a reading, and no research the register cites`);
    try {
      out[cc] = r === null ? unread(zone) : youthOf(r, reading, zone);
    } catch (e) {
      throw new Error(`${cc}: ${(e as Error).message}`, { cause: e });
    }
  }
  return out;
}

export const serialize = (countries: Readonly<Record<string, Youth>>) => `${JSON.stringify({ countries }, null, 1)}\n`;
