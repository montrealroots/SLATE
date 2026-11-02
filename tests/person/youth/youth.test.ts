import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, pass, type Context, type Json, type Life } from '../../../src/core/frame/frame.ts';
import { fromMajor, money } from '../../../src/core/money/money.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { dayStart } from '../../../src/core/time/dates.ts';
import { t } from '../../../src/core/text/text.ts';
import { accountOf, balance } from '../../../src/money/ledger/ledger.ts';
import type { Paid } from '../../../src/money/tax/tax.ts';
import { majorityAt, workAge } from '../../../src/papers/ages/ages.ts';
import { ACTING_START, playPart, type ActingSlice, type Audition, type Part } from '../../../src/person/acting/acting.ts';
import { ATTRIBUTES_START, chooseAttributes, componentValues, DAILY, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import { cutFilm, DIRECTING_START, finish, onSet, prepFilm, shootFilm, shootNeeded, type DirectingSlice } from '../../../src/person/directing/directing.ts';
import type { IdentitySlice, Person } from '../../../src/person/identity/identity.ts';
import { PERMITS_START, type PermitsSlice } from '../../../src/person/permits/permits.ts';
import { CAREER_START, offerScript, pitchScript, type CareerSlice } from '../../../src/person/work/career.ts';
import { SCRIPTS_START, writeScript, type ScriptsSlice } from '../../../src/person/work/work.ts';
import { applyToFunder, optionMaterial, planProject, PRODUCING_START, projectOf, shootProject, type ProducingSlice } from '../../../src/person/producing/producing.ts';
import { UNIONS_START, type UnionsSlice } from '../../../src/person/unions/unions.ts';
import {
  aboutYouth,
  authoriseWork,
  holdBack,
  DAY_HOURS,
  engagement,
  fundRefuses,
  hoursShare,
  MISSING,
  needsOf,
  reachedAt,
  RELEASE_KIND,
  RULES,
  rulesOf,
  setAsideOf,
  UNKEPT_LINE,
  MODEL_LINE,
  YOUTH_START,
  type Rules,
  type YouthSlice,
} from '../../../src/person/youth/youth.ts';
import { readYouth, serialize } from '../../../tools/person/youth/compile.ts';
import { falsifyAny } from '../../support/falsify-core.ts';
import { permitsEverywhere } from '../../support/permits.ts';
import { person } from '../../support/person.ts';
import { ACCOUNT, minorIn, purse } from '../../support/purse.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const SEED = '0123456789abcdef';
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * SECONDS_PER_DAY;
/** Midday UT, Monday 2 November 2026. */
const NOW = day(2026, 11, 2) + 12 * 3600;
const ALL = ['performer', 'director', 'producer', 'author'];
const grown = (from: number, days: number) => 100 - (100 - from) * (1 - DAILY) ** days;
/** A person born on a date in a country, its citizen, and growing up there. */
const born = (date: string, country: string, over: Partial<Person> = {}): Person => person({ born: { date, country: country as never, region: '' }, citizenship: [country as never], grewUp: { country: country as never, region: '' }, ...over });
const identityOf = (p: Person): IdentitySlice => ({ person: p, sessions: [] });
const youthOf = (l: { slices: { youth: YouthSlice } }) => l.slices.youth;

describe('the youth rules', () => {
  it("are each country's own, as the research gives them", () => {
    expect(rulesOf('US')).toEqual({
      zone: 'America/Los_Angeles',
      seat: 'US.CA',
      contract: { by: 'voidable', alone: null, roles: ALL },
      setAside: { share: '0.15', into: "Coogan trust account (Family Code 6753); to The Actors' Fund of America if no trustee statement within 180 days", roles: ALL, over: null },
      permit: { issuer: "Entertainment Work Permit and employer's Permit to Employ, issued by the Labor Commissioner (DLSE)", under: 'majority', from: { years: 0, days: 15 } },
      reach: ['performer'],
      hours: [
        { from: { years: 0, days: 15 }, to: { years: 0, months: 6 }, day: 20 / 60, week: null },
        { from: { years: 0, months: 6 }, to: 2, day: 2, week: null },
        { from: 2, to: 6, day: 3, week: null },
        { from: 6, to: 9, day: 4, week: null },
        { from: 9, to: 16, day: 5, week: null },
        { from: 16, to: 18, day: 6, week: null },
      ],
      company: null,
      fund: 'company',
      unions: ['SAG-AFTRA'],
    });
    expect(rulesOf('CA')).toEqual({ zone: 'America/Toronto', seat: 'CA.08', contract: null, setAside: { share: '0.25', into: null, roles: ['performer'], over: { amount: '2000', currency: 'CAD', per: 'engagement', above: true } }, permit: { issuer: null, under: 'majority', from: { years: 0, days: 15 } }, reach: ['performer'], hours: [{ from: 0, to: null, day: 8, week: null }], company: null, fund: null, unions: [] });
    expect(rulesOf('AU')).toEqual({
      zone: 'Australia/Sydney',
      seat: 'AU.02',
      contract: { by: 'self', alone: null, roles: ALL },
      setAside: null,
      permit: { issuer: "Authority to employ children (Office of the Children's Guardian), held by the person who casts and directs", under: 16, from: null },
      reach: ['performer'],
      hours: [{ from: 0, to: { years: 0, months: 6 }, day: 4, week: null }, { from: { years: 0, months: 6 }, to: 3, day: 4, week: null }, { from: 3, to: 8, day: 6, week: null }, { from: 8, to: 16, day: 8, week: null }],
      company: 18,
      fund: 18,
      unions: [],
    });
    expect(rulesOf('GB')).toEqual({ zone: 'Europe/London', seat: null, contract: null, setAside: null, permit: null, reach: ['performer'], hours: [{ from: 0, to: 5, day: 2, week: null }, { from: 5, to: 9, day: 3, week: null }, { from: 9, to: 'work', day: 5, week: null }], company: 16, fund: 18, unions: [] });
    expect(rulesOf('FR')).toEqual({ zone: 'Europe/Paris', seat: null, contract: null, setAside: { share: '0.9', into: 'Caisse des dépôts et consignations', roles: ALL, over: null }, permit: null, reach: ALL, hours: [{ from: 0, to: null, day: 8, week: 35 }], company: 16, fund: 'company', unions: [] });
    expect(rulesOf('IE')).toEqual({ zone: 'Europe/Dublin', seat: null, contract: { by: 'guardian', alone: null, roles: ALL }, setAside: 'none', permit: null, reach: ['performer'], hours: [{ from: 0, to: 7, day: 2, week: null }, { from: 7, to: 13, day: 3, week: null }, { from: 13, to: 'work', day: 4, week: null }], company: 18, fund: null, unions: [] });
    expect(rulesOf('PH')).toMatchObject({ setAside: { share: '0.3', into: 'trust fund set up by the parent or guardian', roles: ALL, over: { amount: '200000', currency: 'PHP', per: 'year', above: false } }, hours: [{ from: 0, to: 15, day: 4, week: 20 }, { from: 15, to: 18, day: 8, week: 40 }] });
    expect(rulesOf('IN')?.setAside).toEqual({ share: '0.2', into: "fixed deposit in a nationalised bank in the child's name, credited at majority", roles: ALL, over: null });
    expect(rulesOf('LU')?.setAside).toEqual({ share: '1', into: "compte d'épargne bloqué au nom de l'enfant", roles: ALL, over: null });
    expect(rulesOf('AT')?.contract).toEqual({ by: 'guardian', alone: 14, roles: ALL });
    expect(rulesOf('DE')).toMatchObject({ contract: { by: 'guardian', alone: null, roles: ALL }, setAside: 'none', hours: [{ from: 3, to: 6, day: 2, week: null }, { from: 6, to: 15, day: 3, week: null }] });
    expect(Object.keys(RULES)).toHaveLength(252);
    expect(rulesOf('XX')).toBeUndefined();
    expect(rulesOf('toString')).toBeUndefined();
  });

  it('are as built from the research', () => {
    expect(readFileSync(join(ROOT, 'src/person/youth/youth.json'), 'utf8')).toBe(serialize(readYouth(ROOT)));
  });

  it("tell the player what of a country's rules isn't known", () => {
    const told = (country: string, missing: string) => t(UNKEPT_LINE, { country, missing });
    expect(UNKEPT_LINE).toBe('youth.unkept');
    expect(MODEL_LINE).toBe('youth.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own");
    expect(aboutYouth('GB')).toBe(told('United Kingdom', "how a minor's contract is made binding and what of a minor's pay is set aside"));
    expect(aboutYouth('FR')).toBe(told('France', "how a minor's contract is made binding"));
    expect(aboutYouth('AT')).toBe(told('Austria', 'the hours a minor may work and the age from which its public film fund takes an applicant'));
    expect(aboutYouth('XX')).toBeUndefined();
    const us = rulesOf('US') as Rules;
    expect(aboutYouth('US', { ...us, contract: { by: 'self', alone: null, roles: [] }, company: 16 })).toBe(told('United States', "SAG-AFTRA's rules for its young members"));
    expect(aboutYouth('US', { ...us, contract: { by: 'self', alone: null, roles: [] }, company: 16, unions: ['SAG-AFTRA', 'the DGA'] })).toBe(told('United States', "SAG-AFTRA's rules for its young members and the DGA's rules for its young members"));
    const whole: Rules = { ...(rulesOf('GB') as Rules), contract: { by: 'self', alone: null, roles: [] }, setAside: 'none' };
    expect(aboutYouth('GB', whole)).toBeUndefined();
    expect(aboutYouth('GB', { ...whole, hours: null, company: null, fund: null })).toBe(told('United Kingdom', 'the hours a minor may work, the age from which a person may direct a company and the age from which its public film fund takes an applicant'));
    expect(aboutYouth('AQ', { ...whole, permit: null })).toBe(told('Antarctica', "the age of majority and a child performer's permit"));
    expect(aboutYouth('AQ', { ...whole, permit: { issuer: null, under: 16, from: null } })).toBe(told('Antarctica', 'the age of majority'));
    expect(MISSING).toEqual({
      majority: 'the age of majority',
      permit: "a child performer's permit",
      contract: "how a minor's contract is made binding",
      setAside: "what of a minor's pay is set aside",
      hours: 'the hours a minor may work',
      company: 'the age from which a person may direct a company',
      fund: 'the age from which its public film fund takes an applicant',
      union: "'s rules for its young members",
    });
  });

  it("reckon an age from midnight in the work's zone, a day the month hasn't on the next", () => {
    expect(reachedAt('2008-02-29', 18, 'Europe/London')).toBe(dayStart('Europe/London', { year: 2026, month: 3, day: 1 }));
    expect(reachedAt('2008-02-29', 16, 'Europe/London')).toBe(dayStart('Europe/London', { year: 2024, month: 2, day: 29 }));
    expect(reachedAt('2008-11-03', 18, 'America/Los_Angeles')).toBe(day(2026, 11, 3) + 8 * 3600);
    expect(reachedAt('2026-01-01', { years: 0, days: 15 }, 'Europe/Paris')).toBe(dayStart('Europe/Paris', { year: 2026, month: 1, day: 16 }));
    expect(reachedAt('2010-01-31', { years: 0, months: 1 }, 'Europe/Paris')).toBe(dayStart('Europe/Paris', { year: 2010, month: 3, day: 1 }));
    expect(reachedAt('2010-03-31', { years: 0, months: 1 }, 'Europe/Paris')).toBe(dayStart('Europe/Paris', { year: 2010, month: 5, day: 1 }));
    expect(reachedAt('2010-03-30', { years: 0, months: 1 }, 'Europe/Paris')).toBe(dayStart('Europe/Paris', { year: 2010, month: 4, day: 30 }));
    expect(reachedAt('2010-11-15', { years: 1, months: 2 }, 'Europe/Paris')).toBe(dayStart('Europe/Paris', { year: 2012, month: 1, day: 15 }));
    expect(reachedAt('2010-12-15', { years: 0, months: 13 }, 'Europe/Paris')).toBe(dayStart('Europe/Paris', { year: 2012, month: 1, day: 15 }));
  });

  it('bar the work the law bars at the person\'s age, and name what it needs first', () => {
    const at = (date: string, country: string, role: string, now = NOW) => needsOf(born(date, country), country, role as never, now);
    // The UK: a child performer needs the licence below 16; directing below it is employment, barred; a script sold isn't.
    expect(at('2016-03-10', 'GB', 'performer')).toEqual({ barred: null, needs: ['permit'] });
    expect(at('2016-03-10', 'GB', 'director')).toEqual({ barred: 'no one under 16 may be employed in United Kingdom', needs: [] });
    expect(at('2016-03-10', 'GB', 'producer')).toEqual({ barred: 'no one under 16 may be employed in United Kingdom', needs: [] });
    expect(at('2016-03-10', 'GB', 'author')).toEqual({ barred: null, needs: [] });
    expect(at('2010-11-02', 'GB', 'performer')).toEqual({ barred: null, needs: [] });
    expect(at('2010-11-02', 'GB', 'director')).toEqual({ barred: null, needs: [] });
    expect(at('2010-11-03', 'GB', 'director')).toEqual({ barred: 'no one under 16 may be employed in United Kingdom', needs: [] });
    // Germany: no child under 3 performs; the permit below 15; the legal representative signs to 18.
    expect(at('2024-06-01', 'DE', 'performer')).toEqual({ barred: 'no child under 3 may do that work in Germany', needs: [] });
    expect(at('2016-03-10', 'DE', 'performer')).toEqual({ barred: null, needs: ['permit', 'guardian'] });
    expect(at('2010-03-10', 'DE', 'performer')).toEqual({ barred: null, needs: ['guardian'] });
    expect(at('2010-03-10', 'DE', 'author')).toEqual({ barred: null, needs: ['guardian'] });
    expect(at('2008-11-02', 'DE', 'author')).toEqual({ barred: null, needs: [] });
    // Austria: the representative's consent below 14, the minor's own signature from it.
    expect(at('2013-03-10', 'AT', 'performer')).toEqual({ barred: null, needs: ['permit', 'guardian'] });
    expect(at('2012-03-10', 'AT', 'performer')).toEqual({ barred: null, needs: ['permit'] });
    // France: the prefect's authorisation reaches any capacity, so a young director needs it too.
    expect(at('2014-05-20', 'FR', 'director')).toEqual({ barred: null, needs: ['permit'] });
    expect(at('2010-05-20', 'FR', 'director')).toEqual({ barred: null, needs: [] });
    // New South Wales: the authority to employ a child below 16; the minor binds themself.
    expect(at('2016-03-10', 'AU', 'performer')).toEqual({ barred: null, needs: ['permit'] });
    expect(at('2010-03-10', 'AU', 'performer')).toEqual({ barred: null, needs: [] });
    // Where no child may perform below the working age.
    const ug = workAge('UG');
    expect(ug?.performers).toBe('barred');
    expect(at('2014-03-10', 'UG', 'performer')).toEqual({ barred: `no child under ${String(ug?.from)} may do that work in Uganda`, needs: [] });
    expect(at('1990-03-10', 'UG', 'performer')).toEqual({ barred: null, needs: [] });
  });

  it("read a region's own permit, and the birthday in the seat's zone", () => {
    const m = majorityAt({ country: 'US', region: 'US.CA' });
    const ca = (date: string, now = NOW) => needsOf(born(date, 'US'), 'US', 'performer', now);
    // Below the youngest age a California permit is granted at, no child works; below majority, the permit is needed.
    expect(ca('2026-10-25')).toEqual(m === undefined ? { barred: null, needs: [] } : { barred: 'no child under 15 days may do that work in United States', needs: [] });
    expect(ca('2016-03-10')).toEqual({ barred: null, needs: m === undefined ? [] : ['permit'] });
    expect(ca('2016-03-10', day(2016, 3, 25) + 7 * 3600 - 1)).toEqual(m === undefined ? { barred: null, needs: [] } : { barred: 'no child under 15 days may do that work in United States', needs: [] });
    expect(ca('2016-03-10', day(2016, 3, 25) + 7 * 3600)).toEqual({ barred: null, needs: m === undefined ? [] : ['permit'] });
    // An Austrian turning 14 at midnight in Vienna, an hour before midnight UT.
    const vienna = (now: number) => needsOf(born('2012-11-03', 'AT'), 'AT', 'performer', now);
    expect(vienna(day(2026, 11, 2) + 23 * 3600 - 1)).toEqual({ barred: null, needs: ['permit', 'guardian'] });
    expect(vienna(day(2026, 11, 2) + 23 * 3600)).toEqual({ barred: null, needs: ['permit'] });
    // Ontario needs no permit, only the youngest age.
    const on = majorityAt({ country: 'CA', region: 'CA.08' });
    expect(needsOf(born('2016-03-10', 'CA'), 'CA', 'performer', NOW)).toEqual({ barred: null, needs: [] });
    expect(needsOf(born('2026-10-25', 'CA'), 'CA', 'performer', NOW)).toEqual(on === undefined ? { barred: null, needs: [] } : { barred: 'no child under 15 days may do that work in Canada', needs: [] });
    expect(() => needsOf(born('2016-03-10', 'US'), 'AQ', 'performer', NOW)).toThrow("where the work in AQ is made isn't known to this game");
    expect(() => needsOf(born('2016-03-10', 'US'), 'XX', 'performer', NOW)).toThrow("where the work in XX is made isn't known to this game");
  });

  it('limit the hours a day and a week to the band of the person\'s age, against an eight-hour day of a five-day week', () => {
    const share = (date: string, country: string, role = 'performer') => hoursShare(born(date, country), country, role as never, NOW);
    expect(DAY_HOURS).toBe(8);
    expect([share('2022-11-03', 'GB'), share('2021-11-02', 'GB'), share('2017-11-03', 'GB'), share('2017-11-02', 'GB'), share('2016-03-10', 'GB'), share('2010-11-03', 'GB'), share('2010-11-02', 'GB')]).toEqual([2 / 8, 3 / 8, 3 / 8, 5 / 8, 5 / 8, 5 / 8, 1]);
    expect(share('2016-03-10', 'GB', 'director')).toBe(1);
    expect(share('2016-03-10', 'FR', 'director')).toBe(35 / 40);
    expect(share('2016-03-10', 'PH')).toBe(0.5);
    expect(share('2010-03-10', 'PH')).toBe(1);
    expect(share('2016-03-10', 'AT')).toBe(1);
    expect(share('2024-06-01', 'DE')).toBe(1);
    expect(share('2022-06-01', 'DE')).toBe(2 / 8);
    expect(share('2016-03-10', 'DE')).toBe(3 / 8);
    expect(share('2010-03-10', 'DE')).toBe(1);
    expect(share('2016-03-10', 'IN')).toBe(5 / 8);
    expect(share('2010-03-10', 'IN')).toBe(1);
    expect(share('2010-03-10', 'FR')).toBe(35 / 40);
    expect(share('2008-11-02', 'FR')).toBe(1);
    expect(share('2016-03-10', 'AU')).toBe(1);
    expect(share('2020-03-10', 'AU')).toBe(6 / 8);
  });

  it("set aside the law's share of the gross, above its threshold or once it is passed, never by halves", () => {
    const paid = (gross: number, currency = 'EUR'): Paid => ({ at: 0, what: 'pay', country: 'FR', home: 'FR', work: 'performer', account: ACCOUNT, currency, gross, tax: 0, social: 0, vat: 0, counted: 0, credited: 0 });
    const fr = rulesOf('FR')?.setAside as Parameters<typeof setAsideOf>[0];
    expect(setAsideOf(fr, paid(100_000), 0, '2026-11-02')).toBe(90_000);
    expect(setAsideOf(fr, paid(5), 0, '2026-11-02')).toBe(4);
    expect(setAsideOf(fr, paid(15), 0, '2026-11-02')).toBe(14);
    const on = rulesOf('CA')?.setAside as Parameters<typeof setAsideOf>[0];
    expect(setAsideOf(on, paid(150_000, 'CAD'), 0, '2026-11-02')).toBe(0);
    expect(setAsideOf(on, paid(150_000, 'CAD'), 100_000, '2026-11-02')).toBe(12_500);
    expect(setAsideOf(on, paid(150_000, 'CAD'), 250_000, '2026-11-02')).toBe(37_500);
    expect(setAsideOf(on, paid(200_000, 'CAD'), 0, '2026-11-02')).toBe(0);
    expect(setAsideOf(on, paid(200_001, 'CAD'), 0, '2026-11-02')).toBe(0);
    expect(setAsideOf(on, paid(200_002, 'CAD'), 0, '2026-11-02')).toBe(0);
    expect(setAsideOf(on, paid(200_004, 'CAD'), 0, '2026-11-02')).toBe(1);
    const ph = rulesOf('PH')?.setAside as Parameters<typeof setAsideOf>[0];
    expect(setAsideOf(ph, paid(2_000_000, 'PHP'), 19_000_000, '2026-11-02')).toBe(600_000);
    expect(setAsideOf(ph, paid(2_000_000, 'PHP'), 0, '2026-11-02')).toBe(0);
    expect(setAsideOf(ph, paid(1_000_000, 'PHP'), 19_000_000, '2026-11-02')).toBe(0);
    expect(setAsideOf(ph, paid(1_000_001, 'PHP'), 19_000_000, '2026-11-02')).toBe(300_000);
  });

  it("refuse a fund's application below its age, or, where it takes only companies, below the age to direct one", () => {
    const at = (date: string, country: string) => fundRefuses(born(date, country), country, NOW);
    expect(at('2010-03-10', 'GB')).toBe("United Kingdom's public fund takes no applicant under 18");
    expect(at('2008-11-02', 'GB')).toBeNull();
    expect(at('2011-03-10', 'FR')).toBe("France's public fund takes only companies, and no one under 16 may direct one there");
    expect(at('2010-03-10', 'FR')).toBeNull();
    expect(at('2016-03-10', 'IE')).toBeNull();
    expect(at('2016-03-10', 'US')).toBeNull();
    const gb = rulesOf('GB') as Rules & { zone: string };
    expect(fundRefuses(born('2010-03-10', 'GB'), 'GB', NOW, { ...gb, fund: 'company', company: 'majority' })).toBe("United Kingdom's public fund takes only companies, and no one under 18 may direct one there");
    expect(fundRefuses(born('2008-11-02', 'GB'), 'GB', NOW, { ...gb, fund: 'company', company: 'majority' })).toBeNull();
    expect(fundRefuses(born('2010-03-10', 'GB'), 'GB', NOW, { ...gb, fund: 'company', company: null })).toBeNull();
    expect(fundRefuses(born('2010-03-10', 'AQ'), 'AQ', NOW, { ...gb, fund: 'majority' as never })).toBeNull();
    expect(fundRefuses(born('2010-03-10', 'GB'), 'GB', NOW, { ...gb, fund: { years: 0, months: 6 } })).toBeNull();
  });
});

describe('the youth rules, on rules of their own', () => {
  const gb = rulesOf('GB') as Rules & { zone: string };
  const aq = { ...gb, zone: 'Europe/London', seat: null } as Rules & { zone: string };
  const kid = (date: string) => born(date, 'GB');
  it("read a contract the minor binds themself by, or may avoid, as needing nothing; an age in months as months", () => {
    expect(needsOf(kid('2016-03-10'), 'GB', 'performer', NOW, { ...gb, contract: { by: 'self', alone: null, roles: ALL as never } })).toEqual({ barred: null, needs: ['permit'] });
    expect(needsOf(kid('2016-03-10'), 'GB', 'performer', NOW, { ...gb, contract: { by: 'voidable', alone: null, roles: ALL as never } })).toEqual({ barred: null, needs: ['permit'] });
    expect(needsOf(kid('2016-03-10'), 'GB', 'performer', NOW, { ...gb, contract: { by: 'court', alone: null, roles: ALL as never } })).toEqual({ barred: null, needs: ['permit', 'court'] });
    expect(needsOf(kid('2016-03-10'), 'GB', 'performer', NOW, { ...gb, contract: { by: 'authority', alone: null, roles: ['author'] } })).toEqual({ barred: null, needs: ['permit'] });
    expect(needsOf(kid('2026-08-10'), 'GB', 'performer', NOW, { ...gb, permit: { issuer: 'x', under: 16, from: { years: 0, months: 6 } } })).toEqual({ barred: 'no child under 6 months may do that work in United Kingdom', needs: [] });
    expect(needsOf(kid('2026-04-10'), 'GB', 'performer', NOW, { ...gb, permit: { issuer: 'x', under: 16, from: { years: 0, months: 6 } } })).toEqual({ barred: null, needs: ['permit'] });
    expect(needsOf(born('2016-03-10', 'MX'), 'MX', 'performer', NOW)).toMatchObject({ barred: null });
    expect(needsOf(born('2016-03-10', 'MX'), 'MX', 'performer', NOW).needs).not.toContain('permit');
  });

  it('need nothing a country whose working age or majority isn\'t known can\'t say', () => {
    expect(workAge('AQ')).toBeUndefined();
    expect(needsOf(kid('2016-03-10'), 'AQ', 'director', NOW, aq)).toEqual({ barred: null, needs: [] });
    expect(needsOf(kid('2016-03-10'), 'AQ', 'performer', NOW, aq)).toEqual({ barred: null, needs: [] });
    expect(needsOf(kid('2016-03-10'), 'AQ', 'performer', NOW, { ...aq, permit: { issuer: 'x', under: 'majority', from: null } })).toEqual({ barred: null, needs: [] });
    expect(needsOf(kid('2016-03-10'), 'AQ', 'performer', NOW, { ...aq, contract: { by: 'court', alone: null, roles: ALL as never } })).toEqual({ barred: null, needs: [] });
    expect(hoursShare(kid('2016-03-10'), 'AQ', 'performer', NOW, { ...aq, hours: [{ from: 0, to: 'work', day: 2, week: null }] })).toBe(1);
    expect(hoursShare(kid('2016-03-10'), 'AQ', 'performer', NOW, { ...aq, hours: [{ from: 0, to: null, day: 2, week: null }] })).toBe(1);
    expect(hoursShare(kid('2016-03-10'), 'GB', 'performer', NOW, { ...gb, hours: [{ from: 0, to: null, day: null, week: 20 }] })).toBe(0.5);
    expect(hoursShare(kid('2016-03-10'), 'GB', 'performer', NOW, { ...gb, hours: [{ from: 0, to: null, day: 12, week: null }] })).toBe(1);
  });

  type Held = { identity: IdentitySlice; youth: YouthSlice } & ReturnType<typeof purse>;
  const scheduled: { kind: string; at: number; data: Json }[] = [];
  const context = (now: number): Context => ({ now, schedule: (kind: string, at: number, data: Json = null) => scheduled.push({ kind, at, data }) } as unknown as Context);
  const slices = (date: string, currency: string): Held => ({ identity: identityOf(born(date, 'GB')), youth: structuredClone(YOUTH_START), ...purse(currency) });
  const pay = (country: string, gross: number, currency: string, over: Partial<Paid> = {}): Paid => ({ at: NOW, what: 'pay', country, home: country, work: 'performer', account: ACCOUNT, currency, gross, tax: 0, social: 0, vat: 0, counted: 0, credited: 0, ...over });
  const over = (per: 'engagement' | 'year', above: boolean): Rules & { zone: string } => ({ ...gb, setAside: { share: '0.25', into: 'a trust', roles: ['performer'], over: { amount: '2000', currency: 'GBP', per, above } } });
  it('count a threshold over the engagement or the calendar year, in the country it is set in', () => {
    const s = slices('2016-03-10', 'GBP');
    holdBack(s, pay('GB', 150_000, 'GBP'), 'acting:1', context(NOW), over('engagement', true));
    holdBack(s, pay('GB', 150_000, 'GBP'), 'acting:2', context(NOW), over('engagement', true));
    expect(s.youth.held).toEqual([]);
    holdBack(s, pay('GB', 150_000, 'GBP'), 'acting:1', context(NOW), over('engagement', true));
    expect(s.youth.held.map((h) => [h.engagement, h.amount])).toEqual([['acting:1', 25_000]]);
    expect(s.youth.earned.map((e) => e.engagement)).toEqual(['acting:1', 'acting:2', 'acting:1']);
    holdBack(s, pay('FR', 150_000, 'GBP'), 'acting:1', context(NOW), over('engagement', true));
    expect(s.youth.held).toHaveLength(1);
    const y = slices('2016-03-10', 'GBP');
    holdBack(y, pay('GB', 150_000, 'GBP'), 'a', context(NOW), over('year', false));
    holdBack(y, pay('GB', 100_000, 'GBP'), 'b', context(day(2027, 1, 2)), over('year', false));
    expect(y.youth.held).toEqual([]);
    holdBack(y, pay('GB', 100_000, 'GBP'), 'c', context(NOW), over('year', false));
    expect(y.youth.held.map((h) => [h.engagement, h.amount])).toEqual([['c', 25_000]]);
  });

  it('hold no more than the payment left after what was withheld, and nothing where nothing is due', () => {
    const lu = rulesOf('LU') as Rules & { zone: string };
    const s = slices('2016-03-10', 'EUR');
    holdBack(s, pay('LU', 100_000, 'EUR', { tax: 20_000, social: 10_000, vat: 5_000 }), 'acting:1', context(NOW), lu);
    expect(s.youth.held.map((h) => h.amount)).toEqual([75_000]);
    const posted = accountOf(s.ledger, ACCOUNT).postings.at(-1);
    expect(posted).toMatchObject({ what: 'set aside', amount: -75_000 });
    holdBack(s, pay('LU', 100_000, 'EUR', { work: 'author' }), 'x', context(NOW), { ...lu, setAside: { share: '1', into: null, roles: ['performer'], over: null } });
    holdBack(s, pay('DE', 100_000, 'EUR'), 'x', context(NOW));
    holdBack(s, pay('GB', 100_000, 'EUR'), 'x', context(NOW), over('engagement', true));
    holdBack(slices('2000-03-10', 'EUR'), pay('LU', 100_000, 'EUR'), 'x', context(NOW), lu);
    holdBack(s, pay('AQ', 100_000, 'EUR'), 'x', context(NOW), { ...aq, setAside: lu.setAside });
    expect(s.youth.held).toHaveLength(1);
    expect(minorIn(s.ledger, 'world:youth:LU:EUR')).toBe(75_000);
  });

  it('pays the held pay back, posted as released', () => {
    const l = dispatch(dispatch(life(born('2014-05-20', 'FR', { billedAs: 'actor', pronouns: 'he' }), 'actor', 'EUR', [booked(FRENCH)]), authoriseWork, { country: 'FR', role: 'performer' }), playPart, { audition: 1, account: ACCOUNT });
    const after = pass(l, reachedAt('2014-05-20', 18, 'Europe/Paris')).life;
    expect(accountOf(after.slices.ledger, ACCOUNT).postings.at(-1)?.what).toBe('set aside, released');
    expect(accountOf(l.slices.ledger, ACCOUNT).postings.at(-1)?.what).toBe('set aside');
    expect(RELEASE_KIND).toBe('youth.release');
    expect(youthOf(dispatch(life(born('2011-03-10', 'FR'), 'producer', 'EUR'), authoriseWork, { country: 'FR', role: 'producer' })).granted[0]?.needs).toEqual(['permit']);
  });
});

type Lives = { attributes: AttributesSlice; acting: ActingSlice; identity: IdentitySlice; unions: UnionsSlice; permits: PermitsSlice; directing: DirectingSlice; producing: ProducingSlice; youth: YouthSlice; genres: { loved: string[] } } & ReturnType<typeof purse>;
const life = (p: Person, role: 'actor' | 'director' | 'producer', currency: string, auditions: Audition[] = [], now = NOW, all = 50): Life<Lives> =>
  dispatch(
    begin(SEED, now, { attributes: structuredClone(ATTRIBUTES_START), acting: { ...structuredClone(ACTING_START), auditions }, identity: identityOf(p), unions: structuredClone(UNIONS_START), permits: role === 'actor' ? structuredClone(PERMITS_START) : permitsEverywhere(), directing: structuredClone(DIRECTING_START), producing: structuredClone(PRODUCING_START), youth: structuredClone(YOUTH_START), genres: { loved: ['drama'] }, ...purse(currency) }),
    chooseAttributes,
    { role, all, each: {} },
  );
const booked = (part: Part, id = 1): Audition => ({ id, at: 0, breakdown: 0, part, taped: true, score: 50, booked: true, work: null });
const PACT: Part = { agreement: 'pact-equity', budget: 5_000_000, seats: 0, lines: 20, term: 'day', length: 3, rehearsal: 0, asks: [] };
const FRENCH: Part = { agreement: 'fr-film', budget: 1_000_000, seats: 0, lines: 20, term: 'day', length: 2, rehearsal: 0, asks: [] };
const played = (l: Life<Lives>, id = 1) => l.slices.acting.auditions[id - 1]?.work;

describe("a minor's work in each role", () => {
  it("has a French director's prep and cut taught and carried at the young worker's hours", () => {
    const teen = dispatch(life(born('2011-03-10', 'FR'), 'director', 'EUR'), authoriseWork, { country: 'FR', role: 'director' });
    const prepped = dispatch(teen, prepFilm, { account: ACCOUNT, form: 'feature', country: 'FR', agreement: 'idcc-3097', prep: 10, shoot: 20, cut: 10 });
    expect(prepped.slices.attributes['director']?.['vision']).toBeCloseTo(grown(50, 10 * (35 / 40)), 10);
    expect(youthOf(prepped).held[0]?.engagement).toBe('directing:1');
    const shot = dispatch(prepped, shootFilm, { film: 1, account: ACCOUNT });
    const editing = shot.slices.attributes['director']?.['editing'] as number;
    const cut = dispatch(shot, cutFilm, { film: 1, account: ACCOUNT });
    expect(cut.slices.attributes['director']?.['editing']).toBeCloseTo(grown(editing, 10 * (35 / 40)), 10);
    expect(youthOf(cut).held).toHaveLength(3);
  });

  it("has a French producer authorised, the fee's pécule set aside, the days at the young worker's hours", () => {
    const shoot = (date: string, grant: boolean) => {
      let l = life(born(date, 'FR'), 'producer', 'USD', [], NOW, 90);
      if (grant) l = dispatch(l, authoriseWork, { country: 'FR', role: 'producer' });
      l = dispatch(l, optionMaterial, { account: ACCOUNT, days: 10, genre: 'drama', market: 'FR' });
      l = dispatch(l, planProject, { project: 1, budget: '2000000' });
      const producing = structuredClone(l.slices.producing);
      const p = projectOf(producing, 1);
      p.raised['equity'] = money('EUR', (p.plan as { budget: { minor: number } }).budget.minor);
      return { ...l, slices: { ...l.slices, producing } };
    };
    expect(() => dispatch(shoot('2011-03-10', false), shootProject, { project: 1, account: ACCOUNT })).toThrow('that work in France needs permit first');
    const before = shoot('2011-03-10', true);
    const done = dispatch(before, shootProject, { project: 1, account: ACCOUNT });
    const days = (projectOf(done.slices.producing, 1).shot as { days: number }).days;
    expect(done.slices.attributes['producer']?.['leadership']).toBeCloseTo(grown(before.slices.attributes['producer']?.['leadership'] as number, days * (35 / 40)), 10);
    expect(youthOf(done).granted[0]?.used).toBe(true);
    expect(projectOf(done.slices.producing, 1).shot?.fee?.minor).toBeGreaterThan(0);
    expect(youthOf(done).held.map((h) => h.engagement)).toEqual(['producing:1']);
  });

  type Writing = { attributes: AttributesSlice; scripts: ScriptsSlice; career: CareerSlice; identity: IdentitySlice; genres: { loved: string[] }; youth: YouthSlice } & ReturnType<typeof purse>;
  const writer = (p: Person): Life<Writing> => {
    const l = dispatch(dispatch(begin(SEED, NOW, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START), career: structuredClone(CAREER_START), identity: identityOf(p), genres: { loved: ['drama'] }, youth: structuredClone(YOUTH_START), ...purse('EUR') }), chooseAttributes, { role: 'screenwriter', all: 100, each: {} }), writeScript, { form: 'episode', genre: 'drama', days: 200 });
    const asked = { ...l, slices: { ...l.slices, career: { ...l.slices.career, out: { '1': { documents: { 'pitch-document': 100 }, requests: 40, sold: null } } } } };
    return dispatch(asked, offerScript, { script: 1, agreement: 'fr-tv', country: 'FR', budget: 1_000_000, minutes: 52 });
  };
  const sell = (l: Life<Writing>) => {
    let at = l;
    for (let i = 0; i < 40 && at.slices.career.out['1']?.sold === null; i += 1) at = dispatch({ ...at, frame: { ...at.frame, now: at.frame.now + 3600 } }, pitchScript, { script: 1, account: ACCOUNT });
    return at;
  };
  it("has a young French writer's sale authorised and its pécule set aside", () => {
    const fr = (date: string) => born(date, 'FR', { languages: [{ lang: 'fr', level: 'C2' }] });
    expect(() => dispatch(writer(fr('2014-03-10')), pitchScript, { script: 1, account: ACCOUNT })).toThrow('that work in France needs permit first');
    const sold = sell(dispatch(writer(fr('2014-03-10')), authoriseWork, { country: 'FR', role: 'author' }));
    expect(sold.slices.career.out['1']?.sold).not.toBeNull();
    expect(youthOf(sold).granted[0]?.used).toBe(true);
    expect(youthOf(sold).held.map((h) => [h.engagement, h.amount])).toEqual([['script:1', Math.min(Math.round(0.9 * (sold.slices.tax.paid[0] as Paid).gross), (sold.slices.tax.paid[0] as Paid).gross - (sold.slices.tax.paid[0] as Paid).tax - (sold.slices.tax.paid[0] as Paid).social + (sold.slices.tax.paid[0] as Paid).vat)]]);
    const adult = sell(writer(fr('2000-03-10')));
    expect(youthOf(adult).held).toEqual([]);
  });
});

describe("a minor's work", () => {
  it("is engaged, limited and paid as the work's country's law says", () => {
    // A ten-year-old British actress: the licence first, granted once for one part; the days at five hours of eight.
    const girl = born('2016-03-10', 'GB');
    const l = life(girl, 'actor', 'GBP', [booked(PACT), booked(PACT, 2)]);
    expect(() => dispatch(l, playPart, { audition: 1, account: ACCOUNT })).toThrow('that work in United Kingdom needs permit first');
    const granted = dispatch(l, authoriseWork, { country: 'GB', role: 'performer' });
    expect(youthOf(granted).granted).toEqual([{ id: 1, at: NOW, country: 'GB', role: 'performer', needs: ['permit'], used: false }]);
    const p = dispatch(granted, playPart, { audition: 1, account: ACCOUNT });
    expect(played(p)?.pay).toEqual(fromMajor('GBP', '483'));
    expect(youthOf(p).granted[0]?.used).toBe(true);
    expect(youthOf(p).held).toEqual([]);
    expect(p.slices.attributes['actor']?.['acting']).toBeCloseTo(grown(50, 3 * (5 / 8)), 10);
    expect(() => dispatch(p, playPart, { audition: 2, account: ACCOUNT })).toThrow('that work in United Kingdom needs permit first');
    // At sixteen, nothing is needed and the day is whole.
    const older = dispatch(life(born('2010-03-10', 'GB'), 'actor', 'GBP', [booked(PACT)]), playPart, { audition: 1, account: ACCOUNT });
    expect(older.slices.attributes['actor']?.['acting']).toBeCloseTo(grown(50, 3), 10);
    expect(() => dispatch(l, authoriseWork, { country: 'GB', role: 'author' })).toThrow('nothing needs authorising for that work in United Kingdom');
    expect(() => dispatch(l, authoriseWork, { country: 'GB', role: 'director' })).toThrow('no one under 16 may be employed in United Kingdom');
    expect(() => dispatch(l, authoriseWork, { country: 'GB', role: 'nurse' as never })).toThrow("there's no work nurse");
  });

  it("has the law's share of a minor's pay set aside into the account it names, paid back the day they come of age", () => {
    const boy = born('2014-05-20', 'FR', { billedAs: 'actor', pronouns: 'he' });
    const l = dispatch(dispatch(life(boy, 'actor', 'EUR', [booked(FRENCH)]), authoriseWork, { country: 'FR', role: 'performer' }), playPart, { audition: 1, account: ACCOUNT });
    const paid = l.slices.tax.paid[0] as Paid;
    expect(paid.gross).toBe(83_650);
    const net = paid.gross - paid.tax - paid.social + paid.vat;
    const kept = Math.min(Math.round(0.9 * 83_650), net);
    const release = reachedAt('2014-05-20', 18, 'Europe/Paris');
    expect(youthOf(l).earned).toEqual([]);
    expect(youthOf(l).held).toEqual([{ at: NOW, country: 'FR', engagement: 'acting:1', account: ACCOUNT, amount: kept, currency: 'EUR', into: 'Caisse des dépôts et consignations', release, released: false }]);
    expect(minorIn(l.slices.ledger, 'world:youth:FR:EUR')).toBe(kept);
    expect(minorIn(l.slices.ledger, ACCOUNT)).toBe(100_000_000 + net - kept);
    expect(l.frame.schedule.find((i) => i.kind === RELEASE_KIND)).toMatchObject({ at: release, data: { held: 0 } });
    const before = pass(l, release - 1).life;
    expect(minorIn(before.slices.ledger, ACCOUNT)).toBe(100_000_000 + net - kept);
    const after = pass(l, release).life;
    expect(minorIn(after.slices.ledger, ACCOUNT)).toBe(100_000_000 + net);
    expect(minorIn(after.slices.ledger, 'world:youth:FR:EUR')).toBe(0);
    expect(youthOf(after).held[0]?.released).toBe(true);
    // An adult's pay isn't held.
    const man = dispatch(life(born('2000-05-20', 'FR', { billedAs: 'actor', pronouns: 'he' }), 'actor', 'EUR', [booked(FRENCH)]), playPart, { audition: 1, account: ACCOUNT });
    expect(youthOf(man).held).toEqual([]);
    expect(balance(accountOf(man.slices.ledger, ACCOUNT)).minor).toBe(100_000_000 + (man.slices.tax.paid[0] as Paid).gross - (man.slices.tax.paid[0] as Paid).tax - (man.slices.tax.paid[0] as Paid).social + (man.slices.tax.paid[0] as Paid).vat);
  });

  it("sets aside a Californian minor's Coogan 15% where the state's majority is known", () => {
    const m = majorityAt({ country: 'US', region: 'US.CA' });
    const SAG: Part = { agreement: 'sag-aftra', budget: 5_000_000, seats: 0, lines: 20, term: 'day', length: 1, rehearsal: 0, asks: [] };
    const kid = born('2016-03-10', 'US', { born: { date: '2016-03-10', country: 'US', region: 'US.CA' } });
    let l = life(kid, 'actor', 'USD', [booked(SAG)]);
    if (m !== undefined) l = dispatch(l, authoriseWork, { country: 'US', role: 'performer' });
    l = dispatch(l, playPart, { audition: 1, account: ACCOUNT });
    const paid = l.slices.tax.paid[0] as Paid;
    expect(youthOf(l).held.map((h) => h.amount)).toEqual(m === undefined ? [] : [Math.round(0.15 * paid.gross)]);
    expect(l.slices.attributes['actor']?.['acting']).toBeCloseTo(grown(50, 5 / 8), 10);
  });

  it("counts Ontario's threshold over the engagement: a quarter of what is over $2,000", () => {
    const m = majorityAt({ country: 'CA', region: 'CA.08' });
    const ACTRA: Part = { agreement: 'actra', budget: 5_000_000, seats: 0, lines: 20, term: 'day', length: 3, rehearsal: 0, asks: [] };
    const l = dispatch(life(born('2016-03-10', 'CA'), 'actor', 'CAD', [booked(ACTRA)]), playPart, { audition: 1, account: ACCOUNT });
    const gross = (l.slices.tax.paid[0] as Paid).gross;
    expect(youthOf(l).earned).toEqual(m === undefined ? [] : [{ at: NOW, country: 'CA', engagement: 'acting:1', currency: 'CAD', gross }]);
    expect(youthOf(l).held.map((h) => h.amount)).toEqual(m === undefined ? [] : [Math.round(0.25 * (gross - 200_000))]);
  });

  it('bars a young director below the working age, and has a French one authorised by the prefect, the days at the young worker\'s hours', () => {
    expect(() => dispatch(life(born('2011-03-10', 'US'), 'director', 'USD', [], NOW), prepFilm, { account: ACCOUNT, form: 'feature', budget: 5_000_000, shoot: 30 })).toThrow('no one under 16 may be employed in United States');
    const teen = life(born('2011-03-10', 'FR'), 'director', 'EUR');
    const args = { account: ACCOUNT, form: 'feature', country: 'FR', agreement: 'idcc-3097', prep: 10, shoot: 20, cut: 10 } as const;
    expect(() => dispatch(teen, prepFilm, args)).toThrow('that work in France needs permit first');
    const prepped = dispatch(dispatch(teen, authoriseWork, { country: 'FR', role: 'director' }), prepFilm, args);
    expect(youthOf(prepped).granted[0]?.used).toBe(true);
    expect(youthOf(prepped).held).toHaveLength(1);
    expect(youthOf(prepped).held[0]?.into).toBe('Caisse des dépôts et consignations');
    const shot = dispatch(prepped, shootFilm, { film: 1, account: ACCOUNT });
    const v = componentValues(prepped.slices.attributes, 'director');
    const film = shot.slices.directing.films[0];
    const carried = finish(v, 20 * (35 / 40), shootNeeded(v, { form: 'feature' })) * onSet(v);
    expect(film?.shot?.['story']).toBeCloseTo((film?.plan['story'] as number) * carried, 10);
    expect(youthOf(shot).held).toHaveLength(2);
  });

  it('bars a young producer below the working age, and refuses the fund below its age', () => {
    const shoot = (date: string) => {
      let l = life(born(date, 'GB'), 'producer', 'GBP');
      l = dispatch(l, optionMaterial, { account: ACCOUNT, days: 10, genre: 'drama' });
      l = dispatch(l, planProject, { project: 1, budget: '2000000' });
      const producing = structuredClone(l.slices.producing);
      const p = projectOf(producing, 1);
      p.raised['equity'] = money('GBP', (p.plan as { budget: { minor: number } }).budget.minor);
      l = { ...l, slices: { ...l.slices, producing } };
      return l;
    };
    expect(() => dispatch(shoot('2011-03-10'), shootProject, { project: 1, account: ACCOUNT })).toThrow('no one under 16 may be employed in United Kingdom');
    const sixteen = shoot('2010-03-10');
    const done = dispatch(sixteen, shootProject, { project: 1, account: ACCOUNT });
    expect(projectOf(done.slices.producing, 1).shot).not.toBeNull();
    expect(youthOf(done).held).toEqual([]);
    const fresh = dispatch(dispatch(life(born('2010-03-10', 'GB'), 'producer', 'GBP'), optionMaterial, { account: ACCOUNT, days: 10, genre: 'drama' }), planProject, { project: 1, budget: '2000000' });
    expect(() => dispatch(fresh, applyToFunder, { project: 1 })).toThrow("United Kingdom's public fund takes no applicant under 18");
  });

  it('uses a grant for its own country and work only, once', () => {
    const l = dispatch(dispatch(life(born('2016-03-10', 'GB'), 'actor', 'GBP'), authoriseWork, { country: 'FR', role: 'performer' }), authoriseWork, { country: 'GB', role: 'performer' });
    const s = structuredClone(l.slices);
    expect(engagement(s, 'GB', 'performer', NOW)?.id).toBe(2);
    expect(engagement(s, 'FR', 'performer', NOW)?.id).toBe(1);
    expect(() => engagement(s, 'FR', 'director', NOW)).toThrow('that work in France needs permit first');
    expect(() => engagement(s, 'GB', 'director', NOW)).toThrow('no one under 16 may be employed in United Kingdom');
    expect(engagement(s, 'GB', 'author', NOW)).toBeNull();
    (s.youth.granted[1] as { used: boolean }).used = true;
    expect(() => engagement(s, 'GB', 'performer', NOW)).toThrow('that work in United Kingdom needs permit first');
    expect(() => engagement({ ...s, youth: { ...s.youth, granted: [{ ...(s.youth.granted[1] as YouthSlice['granted'][number]), used: false, role: 'director' }] } }, 'DE', 'performer', NOW)).toThrow('that work in Germany needs permit and guardian first');
  });

  it('youth.authorise bites: a grant for the work\'s country lets the part be played', () => {
    falsifyAny({
      feature: 'youth.authorise',
      claim: 'bites',
      says: "a ten-year-old's part in the UK is played once the licence is granted there, and refused with one granted in France",
      base: 'GB',
      twin: 'FR',
      outcome: (country) => {
        const l = dispatch(life(born('2016-03-10', 'GB'), 'actor', 'GBP', [booked(PACT)]), authoriseWork, { country, role: 'performer' });
        try {
          return played(dispatch(l, playPart, { audition: 1, account: ACCOUNT })) !== null;
        } catch {
          return false;
        }
      },
    });
  });

  it("youth.release bites: the pay set aside comes back on the person's eighteenth birthday", () => {
    const l = dispatch(dispatch(life(born('2014-05-20', 'FR', { billedAs: 'actor', pronouns: 'he' }), 'actor', 'EUR', [booked(FRENCH)]), authoriseWork, { country: 'FR', role: 'performer' }), playPart, { audition: 1, account: ACCOUNT });
    const release = reachedAt('2014-05-20', 18, 'Europe/Paris');
    falsifyAny({
      feature: 'youth.release',
      claim: 'bites',
      says: 'the Caisse des dépôts pays the pécule back into the account the day the person comes of age, not a moment before',
      base: release - 1,
      twin: release,
      outcome: (at) => minorIn(pass(l, at).life.slices.ledger, ACCOUNT),
    });
  });

  it('is run through the frame, each command declaring what it reads and writes', () => {
    expect(YOUTH_START).toEqual({ granted: [], held: [], earned: [] });
    expect(commandIndex().filter((x) => x.id.startsWith('youth.'))).toEqual([{ id: 'youth.authorise', reads: ['identity'], writes: ['youth'] }]);
  });
});
