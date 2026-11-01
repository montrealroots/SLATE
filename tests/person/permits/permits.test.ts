import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, pass, type Life } from '../../../src/core/frame/frame.ts';
import { CURRENCY_CODES, fromMajor, money, roundHalfEven } from '../../../src/core/money/money.ts';
import { exchangeOn, knowsRate } from '../../../src/money/rates/rates.ts';
import { t } from '../../../src/core/text/text.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { ACTING_START, daysWorked, pay, WEEK_DAYS, type ActingSlice, type Agreement, type Audition, type Part } from '../../../src/person/acting/acting.ts';
import type { IdentitySlice, Person } from '../../../src/person/identity/identity.ts';
import { DIRECTING_START, type DirectingSlice, type Film } from '../../../src/person/directing/directing.ts';
import { PRODUCING_START, type ProducingSlice, type Project } from '../../../src/person/producing/producing.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import { keepsWork, work } from '../../../src/papers/work/work.ts';
import data from '../../../src/person/permits/permits.json';
import {
  aboutPermit,
  after,
  applyForPermit,
  MISSING,
  COVERS,
  engagedIn,
  mayVisit,
  ROLES,
  whyNoVisit,
  MONTH_DAYS,
  priced,
  UNKEPT_LINE,
  daysWorkedIn,
  DECISION_KIND,
  ELIGIBILITY,
  LAO_AGE,
  permitFor,
  permitOf,
  permitted,
  PERMITS_START,
  PROFICIENT,
  RECOGNITION,
  renewPermit,
  type Application,
  type PermitsSlice,
} from '../../../src/person/permits/permits.ts';
import { falsifyAny } from '../../support/falsify-core.ts';
import { identity } from '../../support/person.ts';

type Lives = { identity: IdentitySlice; acting: ActingSlice; directing: DirectingSlice; producing: ProducingSlice; permits: PermitsSlice };

const SEED = '0123456789abcdef';
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * SECONDS_PER_DAY;
/** A Monday. */
const NOW = day(2026, 11, 2);
const gbp = (n: string) => fromMajor('GBP', n);
const usd = (n: string) => fromMajor('USD', n);

const part = (agreement: Agreement, length = 3): Part => ({ agreement, budget: 5_000_000, seats: 0, lines: 10, term: 'day', length, rehearsal: 0, asks: [] });
const booked = (agreement: Agreement, length = 3): Audition => ({ id: 0, at: 0, breakdown: 0, part: part(agreement, length), taped: true, score: 50, booked: true, work: null });
const played = (agreement: Agreement, at: number, quality = 50, length = 3): Audition => ({ ...booked(agreement, length), work: { at, quality, pay: null } });

function life(parts: Audition[], who: Partial<Person> = {}, applications: Application[] = [], now = NOW): Life<Lives> {
  return begin(SEED, now, { identity: identity(who), acting: { ...structuredClone(ACTING_START), auditions: parts.map((a, i) => ({ ...a, id: i + 1 })) }, directing: structuredClone(DIRECTING_START), producing: structuredClone(PRODUCING_START), permits: { applications } });
}
const apps = (l: Life<Lives>) => l.slices.permits.applications;
const granted = (country: Application['country'], until: number, id = 1, engagement = 1): Application => ({ id, at: 0, country, role: 'actor', engagement, renews: null, by: 'worker', premium: false, fees: null, decided: { at: 0, until } });

describe('the permits', () => {
  it("are each country's own, as the research gives them", () => {
    const gb = permitOf('GB');
    expect([gb?.by, gb?.standard, gb?.premium, gb?.term, gb?.renews]).toEqual(['worker', { n: 3, unit: 'weeks' }, { n: 5, unit: 'business-days' }, { n: 12, unit: 'months' }, true]);
    expect(gb?.fees?.map((f) => [f.money, f.premium, f.when])).toEqual([
      [gbp('340'), false, 'grant'],
      [gbp('55'), false, 'grant'],
      [gbp('1035'), false, 'grant'],
      [gbp('500'), true, 'grant'],
      [gbp('1000'), true, 'grant'],
    ]);
    const us = permitOf('US');
    expect([us?.by, us?.standard, us?.premium, us?.term, us?.renews]).toEqual(['engager', null, { n: 15, unit: 'business-days' }, { n: 3, unit: 'years' }, true]);
    // A country every passport works in freely holds no permit; nor one whose rules papers.work doesn't keep.
    expect([permitOf('AM'), permitOf('SJ'), permitOf('AQ'), permitOf('AF')]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("are held only where papers.work says a passport needs one, and where one isn't known whole the player is told what isn't", () => {
    const needs = COUNTRY_CODES.filter((c) => keepsWork(c) && COUNTRY_CODES.some((p) => { const w = work(p, c); return w !== 'home' && w?.right === 'permit'; }));
    const held = Object.keys(data.countries);
    expect(held.filter((c) => !needs.includes(c as never))).toEqual([]);
    for (const c of needs) expect(aboutPermit(c) === undefined, c).toBe(permitOf(c)?.unknown.length === 0);
    expect(UNKEPT_LINE).toBe('permits.unkept');
    // Known whole: nothing to tell. Known in part: what isn't. Not known at all: every fact sought.
    expect(aboutPermit('GB')).toBeUndefined();
    expect(aboutPermit('US')).toBe(t(UNKEPT_LINE, { country: 'United States', missing: 'how long a decision takes, its pay rule and how long a short engagement may be worked without it' }));
    expect(aboutPermit('IL')).toBe(t(UNKEPT_LINE, { country: 'Israel', missing: Object.values(MISSING).slice(1, 10).join(', ').replace(/, ([^,]*)$/, ' and $1') }));
    expect(aboutPermit('IL')).toBe("Some of what Israel asks of someone from abroad for a work permit isn't known to this game yet: who applies, what must come first, its fees, how long a decision takes, how long it is granted for, any union consultation, who is eligible, its pay rule and how long a short engagement may be worked without it.");
    // Every passport free, or the country's rules not kept: nothing of a permit to tell (papers.work tells the latter).
    expect([aboutPermit('AM'), aboutPermit('SJ'), aboutPermit('AF'), aboutPermit('AQ')]).toEqual([undefined, undefined, undefined, undefined]);
    expect(Object.keys(MISSING)).toEqual(['route', 'applies', 'first', 'fees', 'processing', 'validity', 'union', 'eligibility', 'pay', 'exempt', 'country', 'all']);
    expect([MISSING.route, MISSING.country, MISSING.all]).toEqual(["the permit's name", 'the permit itself', 'the permit itself']);
  });
});

describe('a span of time', () => {
  it('runs on from a moment by hours, days, weeks, months and years', () => {
    expect(after(NOW, { n: 36, unit: 'hours' }, 'GB')).toBe(NOW + 36 * 3600);
    expect(after(NOW, { n: 47, unit: 'days' }, 'GB')).toBe(NOW + 47 * SECONDS_PER_DAY);
    expect(after(NOW, { n: 3, unit: 'weeks' }, 'GB')).toBe(day(2026, 11, 23));
    expect(after(day(2027, 1, 31), { n: 1, unit: 'months' }, 'GB')).toBe(day(2027, 2, 28));
    expect(after(NOW, { n: 12, unit: 'months' }, 'GB')).toBe(day(2027, 11, 2));
    expect(after(day(2028, 2, 29), { n: 3, unit: 'years' }, 'GB')).toBe(day(2031, 2, 28));
  });

  it('counts business days Monday to Friday, less the holidays of the country', () => {
    expect(after(NOW, { n: 5, unit: 'business-days' }, 'GB')).toBe(day(2026, 11, 9));
    expect(after(day(2026, 11, 6), { n: 1, unit: 'business-days' }, 'GB')).toBe(day(2026, 11, 9));
    expect(after(day(2026, 11, 7), { n: 1, unit: 'business-days' }, 'GB')).toBe(day(2026, 11, 9));
    // Veterans Day and Thanksgiving in the United States; Christmas and Boxing Day's Monday in the United Kingdom.
    expect(after(NOW, { n: 15, unit: 'business-days' }, 'US')).toBe(day(2026, 11, 24));
    expect(after(NOW, { n: 15, unit: 'business-days' }, 'GB')).toBe(day(2026, 11, 23));
    expect(after(day(2026, 12, 21), { n: 5, unit: 'business-days' }, 'GB')).toBe(day(2026, 12, 30));
  });
});

describe('permits.apply', () => {
  it('lodges an application for an engagement booked abroad: who applies, the fees, the decision at the standard processing time', () => {
    const l = dispatch(life([booked('pact-equity')]), applyForPermit, { role: 'actor', engagement: 1, premium: false });
    expect(apps(l)).toEqual([
      {
        id: 1,
        at: NOW,
        country: 'GB',
        role: 'actor',
        engagement: 1,
        renews: null,
        by: 'worker',
        premium: false,
        fees: [
          { what: 'Visa application fee, each person', money: gbp('340') },
          { what: 'Certificate of sponsorship, Temporary Worker (paid by the sponsor)', money: gbp('55') },
          { what: 'Immigration health surcharge, per year (usually)', money: gbp('1035') },
        ],
        decided: null,
      },
    ]);
    expect(l.frame.schedule).toEqual([{ id: 1, at: day(2026, 11, 23), kind: DECISION_KIND, data: { application: 1 } }]);
  });

  it("takes the premium service where it is asked and offered, its first fee with the others; the engager applies where the research says", () => {
    const gb = dispatch(life([booked('pact-equity')]), applyForPermit, { role: 'actor', engagement: 1, premium: true });
    expect(apps(gb)[0]?.fees?.map((f) => f.money)).toEqual([gbp('340'), gbp('55'), gbp('1035'), gbp('500')]);
    expect([apps(gb)[0]?.premium, gb.frame.schedule[0]?.at]).toEqual([true, day(2026, 11, 9)]);
    const us = dispatch(life([booked('sag-aftra')], { citizenship: ['CA'] }), applyForPermit, { role: 'actor', engagement: 1, premium: true });
    expect([apps(us)[0]?.country, apps(us)[0]?.by, us.frame.schedule[0]?.at]).toEqual(['US', 'engager', day(2026, 11, 24)]);
    expect(apps(us)[0]?.fees?.map((f) => f.money)).toEqual([usd('1055'), usd('600'), usd('205'), usd('2965')]);
  });

  it("is refused where nothing is booked, where the person needs no permit, or the permit isn't known well enough to apply for", () => {
    const l = life([{ ...booked('pact-equity'), booked: false }, played('pact-equity', 0), booked('pact-equity'), booked('sag-aftra'), booked('actra')], { citizenship: ['CA'] });
    expect(() => dispatch(l, applyForPermit, { role: 'actor', engagement: 9, premium: false })).toThrow("there's no audition 9");
    expect(() => dispatch(l, applyForPermit, { role: 'actor', engagement: 1, premium: false })).toThrow("audition 1 didn't book a part");
    expect(() => dispatch(l, applyForPermit, { role: 'actor', engagement: 2, premium: false })).toThrow('the part from audition 2 is played');
    expect(() => dispatch(l, applyForPermit, { role: 'actor', engagement: 4, premium: false })).toThrow("Some of what United States asks of someone from abroad for a work permit isn't known to this game yet: how long a decision takes.");
    expect(() => dispatch(l, applyForPermit, { role: 'actor', engagement: 5, premium: false })).toThrow('you need no permit to work in CA');
    expect(() => dispatch(life([booked('pact-equity')], { citizenship: ['IE'] }), applyForPermit, { role: 'actor', engagement: 1, premium: false })).toThrow('you need no permit to work in GB');
    expect(() => dispatch(life([booked('actra')]), applyForPermit, { role: 'actor', engagement: 1, premium: true })).toThrow("Some of what Canada asks of someone from abroad for a work permit isn't known to this game yet: how long a premium decision takes.");
    // One application at a time for an engagement: pending, or granted and in force; a refused one may be made again.
    const once = dispatch(l, applyForPermit, { role: 'actor', engagement: 3, premium: false });
    expect(() => dispatch(once, applyForPermit, { role: 'actor', engagement: 3, premium: true })).toThrow('a permit is applied for already for that engagement');
    const refused: Application = { ...granted('GB', 0, 1, 3), decided: { at: 0, refused: 'no' } };
    expect(apps(dispatch(life(l.slices.acting.auditions, { citizenship: ['CA'] }, [refused]), applyForPermit, { role: 'actor', engagement: 3, premium: false }))).toHaveLength(2);
    const lapsed = granted('GB', NOW, 1, 3);
    expect(apps(dispatch(life(l.slices.acting.auditions, { citizenship: ['CA'] }, [lapsed]), applyForPermit, { role: 'actor', engagement: 3, premium: false }))).toHaveLength(2);
    expect(() => dispatch(life(l.slices.acting.auditions, { citizenship: ['CA'] }, [granted('GB', NOW + 1, 1, 3)]), applyForPermit, { role: 'actor', engagement: 3, premium: false })).toThrow('a permit is applied for already for that engagement');
    // Another engagement's application doesn't stand for this one's.
    expect(apps(dispatch(life(l.slices.acting.auditions, { citizenship: ['CA'] }, [granted('GB', NOW + 1, 1, 9)]), applyForPermit, { role: 'actor', engagement: 3, premium: false }))).toHaveLength(2);
    // A renewal of the engagement's permit doesn't stand for a first grant.
    const renewal: Application = { ...granted('GB', NOW + 1, 1, 3), renews: 7 };
    expect(apps(dispatch(life(l.slices.acting.auditions, { citizenship: ['CA'] }, [renewal]), applyForPermit, { role: 'actor', engagement: 3, premium: false }))).toHaveLength(2);
  });

  it("names what the permit lacks, and refuses a passport whose permit isn't the one researched, or a country whose rules aren't kept", () => {
    const who = (citizenship: string[]) => ({ identity: identity({ citizenship: citizenship as Person['citizenship'] }) });
    expect(permitFor(who(['US']), 'GB', false)).toBe(permitOf('GB'));
    expect(() => permitFor(who(['US']), 'AF', false)).toThrow("What Afghanistan asks of a performer from abroad isn't known to this game yet.");
    expect(() => permitFor(who(['US']), 'BT', false)).toThrow(aboutPermit('BT') as string);
    expect(() => permitFor(who(['IN']), 'AS', false)).toThrow("Some of what American Samoa asks of someone from abroad for a work permit isn't known to this game yet: how long a decision takes and how long it is granted for.");
    expect(() => permitFor(who(['US']), 'BJ', false)).toThrow(t(UNKEPT_LINE, { country: 'Benin', missing: 'who applies' }));
    expect(() => permitFor(who(['US']), 'AI', false)).toThrow("Some of what Anguilla asks of someone from abroad for a work permit isn't known to this game yet: how long a decision takes.");
    // Liechtenstein asks the EEA's citizens for another permit than the one researched; Jamaica's citizens take the CSME's in Grenada.
    expect(() => permitFor(who(['DE']), 'LI', false)).toThrow("the permit your passport takes in LI isn't known");
    expect(permitFor(who(['DE', 'IN']), 'LI', false)).toBe(permitOf('LI'));
    expect(() => permitFor(who(['JM']), 'GD', false)).toThrow("the permit your passport takes in GD isn't known");
  });

  it('permits.apply bites: an engagement booked in another country is applied for there', () => {
    falsifyAny({
      feature: 'permits.apply',
      claim: 'bites',
      says: "a part booked under Pact/Equity is applied for in the UK, one under SAG-AFTRA in the US, each at its own decision's time",
      base: 'pact-equity' as Agreement,
      twin: 'sag-aftra' as Agreement,
      outcome: (a) => {
        const l = dispatch(life([booked(a)], { citizenship: ['CA'] }), applyForPermit, { role: 'actor', engagement: 1, premium: true });
        return [apps(l)[0]?.country, l.frame.schedule[0]?.at];
      },
    });
  });
});

describe('the decision', () => {
  it('grants the permit for its term from the day of the decision, where nothing the records answer stands against it', () => {
    const l = pass(dispatch(life([booked('pact-equity')]), applyForPermit, { role: 'actor', engagement: 1, premium: false }), day(2026, 12, 1)).life;
    expect(apps(l)[0]?.decided).toEqual({ at: day(2026, 11, 23), until: day(2027, 11, 23) });
    expect(l.frame.schedule).toEqual([]);
  });

  it("refuses the O-1 where the parts played show no distinction: the best 75 or better, and three played", () => {
    expect(RECOGNITION).toEqual({ best: 75, parts: 3 });
    const decided = (parts: Audition[]) => apps(pass(dispatch(life([booked('sag-aftra'), ...parts], { citizenship: ['CA'] }), applyForPermit, { role: 'actor', engagement: 1, premium: true }), day(2027, 1, 1)).life)[0]?.decided;
    const refused = { at: day(2026, 11, 24), refused: 'the petition shows no distinction yet: the work recognised as substantially above the ordinary' };
    expect(decided([played('actra', 0, 75), played('actra', 0, 40)])).toEqual(refused);
    expect(decided([played('actra', 0, 74), played('actra', 0, 40), played('actra', 0, 40)])).toEqual(refused);
    expect(decided([played('actra', 0, 75), played('actra', 0, 40), played('actra', 0, 40)])).toEqual({ at: day(2026, 11, 24), until: day(2029, 11, 24) });
    // A part booked and not played is no credit.
    expect(decided([played('actra', 0, 90), played('actra', 0, 40), booked('actra')])).toEqual(refused);
  });

  it("reads the Turks and Caicos Islands' English and Laos's age from the person, and nothing elsewhere", () => {
    const s = (who: Partial<Person>) => ({ identity: identity(who), acting: structuredClone(ACTING_START) });
    expect([PROFICIENT, LAO_AGE]).toEqual(['C1', 20]);
    const tc = ELIGIBILITY.TC as NonNullable<typeof ELIGIBILITY.TC>;
    expect(tc(s({}), NOW)).toBeNull();
    expect(tc(s({ languages: [{ lang: 'en-GB', level: 'C1' }] }), NOW)).toBeNull();
    expect(tc(s({ languages: [{ lang: 'en', level: 'B2' }, { lang: 'fr', level: 'C2' }] }), NOW)).toBe('the permit asks proficiency in written and spoken English (C1 or better)');
    const la = ELIGIBILITY.LA as NonNullable<typeof ELIGIBILITY.LA>;
    // Born 2000-06-14: 20 from that day in 2020, in Vientiane's time (UTC+7).
    const born = s({ born: { date: '2000-06-14', country: 'US', region: '' } });
    expect(la(born, day(2020, 6, 13) + 17 * 3600 - 1)).toBe('the permit asks a worker more than 20 years old');
    expect(la(born, day(2020, 6, 13) + 17 * 3600)).toBeNull();
    expect(Object.keys(ELIGIBILITY)).toEqual(['US', 'GU', 'MP', 'PR', 'VI', 'TC', 'LA']);
    for (const c of ['GU', 'MP', 'PR', 'VI'] as const) expect(ELIGIBILITY[c]).toBe(ELIGIBILITY.US);
  });

  it('permits.decision bites: a permit granted lets the person work where the refused one does not', () => {
    falsifyAny({
      feature: 'permits.decision',
      claim: 'bites',
      says: "an O-1 decided on a record of distinction is granted, and the person may work in the US; on none it's refused, and they may not",
      base: 40,
      twin: 90,
      outcome: (best) => {
        const l = pass(dispatch(life([booked('sag-aftra'), played('actra', 0, best), played('actra', 0, 40), played('actra', 0, 40)], { citizenship: ['CA'] }), applyForPermit, { role: 'actor', engagement: 1, premium: true }), day(2027, 1, 1)).life;
        return [apps(l)[0]?.decided, permitted(l.slices, 'US', day(2027, 1, 1), 3)];
      },
    });
  });
});

describe('a permit for its engagement', () => {
  /** A life with an application lodged and its decision due now. */
  const due = (a: Application, parts: Audition[]) => {
    const l = life(parts, {}, [a]);
    return { ...l, frame: { ...l.frame, next: 2, schedule: [{ id: 1, at: NOW, kind: DECISION_KIND, data: { application: a.id } }] } };
  };
  const lodged = (country: Application['country'], renews: number | null = null): Application => ({ ...granted(country, 0), renews, decided: null });

  it("is granted for as long as its engagement, in force until the part is played, where the research gives the engagement's term", () => {
    expect(permitOf('NZ')?.term).toBe('engagement');
    expect(['CA', 'CW', 'NC'].map((c) => permitOf(c as Application['country'])?.term)).toEqual(['engagement', 'engagement', 'engagement']);
    const l = pass(due(lodged('NZ'), [booked('actra', 40)]), NOW).life;
    expect(apps(l)[0]?.decided).toEqual({ at: NOW, until: null });
    expect(permitted(l.slices, 'NZ', NOW + 400 * SECONDS_PER_DAY, 40)).toBe(true);
    const done = { ...l.slices, acting: { ...l.slices.acting, auditions: [{ ...played('actra', NOW, 50, 40), id: 1 }] } };
    expect(permitted(done, 'NZ', NOW, 40)).toBe(false);
    // Another engagement's permit doesn't stand for it, nor this one in force for another country.
    expect(permitted(l.slices, 'AU', NOW, 400)).toBe(false);
  });

  it("is renewed for the renewal's term where the research gives one apart from the first grant's", () => {
    expect([permitOf('LU')?.term, permitOf('LU')?.renewal, permitOf('GB')?.renewal]).toEqual([null, { n: 4, unit: 'years' }, null]);
    const l = pass(due({ ...lodged('LU', 9), id: 1 }, [booked('pact-equity')]), NOW).life;
    expect(apps(l)[0]?.decided).toEqual({ at: NOW, until: day(2030, 11, 2) });
  });

  it('is renewed while its engagement is unplayed, and has lapsed once it is played', () => {
    const held: Application = { ...granted('NZ', 0), decided: { at: 0, until: null } };
    const renewed = dispatch(life([booked('actra')], {}, [held]), renewPermit, { application: 1, premium: false });
    expect([apps(renewed)[1]?.renews, renewed.frame.schedule[0]?.kind]).toEqual([1, DECISION_KIND]);
    expect(() => dispatch(life([played('actra', 0)], {}, [held]), renewPermit, { application: 1, premium: false })).toThrow('the permit from application 1 has lapsed');
    // While it is in force, the engagement isn't applied for again.
    expect(() => dispatch(life([booked('pact-equity')], {}, [{ ...held, country: 'GB' }]), applyForPermit, { role: 'actor', engagement: 1, premium: false })).toThrow('a permit is applied for already for that engagement');
  });
});

describe('permits.renew', () => {
  const held = (decided: Application['decided'], country: Application['country'] = 'GB'): Application => ({ ...granted(country, 0), decided });

  it("lodges a renewal of a permit in force: the renewal's fees, none known where the research names none, and a new decision", () => {
    const gb = dispatch(life([booked('pact-equity')], {}, [held({ at: 0, until: NOW + 1 })]), renewPermit, { application: 1, premium: false });
    expect(apps(gb)[1]).toEqual({ id: 2, at: NOW, country: 'GB', role: 'actor', engagement: 1, renews: 1, by: 'worker', premium: false, fees: null, decided: null });
    expect(gb.frame.schedule).toEqual([{ id: 1, at: day(2026, 11, 23), kind: DECISION_KIND, data: { application: 2 } }]);
    // Japan's fee is a change of status's or an extension's, so asked at both.
    const jpFees = permitOf('JP')?.fees?.map((f) => f.when);
    expect(jpFees).toEqual(['both', 'both', 'both', 'both', 'both']);
    const decided = pass(gb, day(2026, 12, 1)).life;
    expect(apps(decided)[1]?.decided).toEqual({ at: day(2026, 11, 23), until: day(2027, 11, 23) });
  });

  it("is refused where there's no such application, it wasn't granted, it has lapsed, it doesn't renew, or it's renewed already", () => {
    const at = (a: Application, who: Partial<Person> = {}) => () => dispatch(life([booked('pact-equity')], who, [a]), renewPermit, { application: 1, premium: false });
    expect(() => dispatch(life([]), renewPermit, { application: 1, premium: false })).toThrow("there's no application 1");
    expect(at(held(null))).toThrow("application 1 wasn't granted");
    expect(at(held({ at: 0, refused: 'no' }))).toThrow("application 1 wasn't granted");
    expect(at(held({ at: 0, until: NOW }))).toThrow('the permit from application 1 has lapsed');
    expect(at(held({ at: 0, until: NOW + 1 }, 'AU'))).toThrow("AU's permit doesn't renew");
    expect(at(held({ at: 0, until: NOW + 1 }, 'CZ'))).toThrow("Some of what Czechia asks of someone from abroad for a work permit isn't known to this game yet: whether it renews.");
    expect(at(held({ at: 0, until: NOW + 1 }), { citizenship: ['IE'] })).toThrow('you need no permit to work in GB');
    const once = dispatch(life([booked('pact-equity')], {}, [held({ at: 0, until: NOW + 1 })]), renewPermit, { application: 1, premium: true });
    expect(apps(once)[1]?.fees).toBeNull();
    expect(() => dispatch(once, renewPermit, { application: 1, premium: false })).toThrow('the permit from application 1 is renewed already');
    const refusedRenewal: Application = { ...held({ at: 0, refused: 'no' }), id: 2, renews: 1 };
    const again = life([booked('pact-equity')], {}, [held({ at: 0, until: NOW + 1 }), refusedRenewal]);
    expect(apps(dispatch(again, renewPermit, { application: 1, premium: false }))).toHaveLength(3);
    // Another application's renewal doesn't stand for this one's.
    const other = life([booked('pact-equity')], {}, [held({ at: 0, until: NOW + 1 }), { ...held(null), id: 2, renews: 5 }]);
    expect(apps(dispatch(other, renewPermit, { application: 1, premium: false }))).toHaveLength(3);
  });

  it("renews the application asked for, among several, with the fees the research names for a renewal, or none known", () => {
    const two = (country: Application['country']) => life([booked('pact-equity')], {}, [held({ at: 0, until: NOW + 1 }), { ...held({ at: 0, until: NOW + 1 }, country), id: 2 }]);
    const fees = (country: Application['country'], premium = false) => apps(dispatch(two(country), renewPermit, { application: 2, premium }))[2];
    expect([fees('GE')?.country, fees('GE')?.renews, fees('GE')?.fees]).toEqual(['GE', 2, [{ what: 'Renewal', money: fromMajor('GEL', '200') }]]);
    expect(fees('GE', true)?.fees?.map((f) => f.money)).toEqual([fromMajor('GEL', '200'), fromMajor('GEL', '400')]);
    // Taiwan's review fee is asked at both; Laos's fees aren't known.
    expect(fees('TW')?.fees?.map((f) => f.money)).toEqual([fromMajor('TWD', '500')]);
    expect(fees('LA')?.fees).toBeNull();
  });

  it('records the fees the research names for a renewal, with the premium service', () => {
    const us = dispatch(life([booked('sag-aftra')], { citizenship: ['CA'] }, [held({ at: 0, until: NOW + 1 }, 'US')]), renewPermit, { application: 1, premium: true });
    // The United States names no renewal fee apart from the first grant's.
    expect([apps(us)[1]?.fees, apps(us)[1]?.by, us.frame.schedule[0]?.at]).toEqual([null, 'engager', day(2026, 11, 24)]);
  });

  it('permits.renew bites: a permit renewed is in force past the first term', () => {
    falsifyAny({
      feature: 'permits.renew',
      claim: 'bites',
      says: 'a UK permit renewed before it lapses lets the person work there a year on; one not renewed has lapsed',
      base: false,
      twin: true,
      outcome: (renewing) => {
        const first = life([booked('pact-equity', 40)], {}, [held({ at: 0, until: day(2026, 12, 1) })]);
        const l = pass(renewing ? dispatch(first, renewPermit, { application: 1, premium: false }) : first, day(2027, 6, 1)).life;
        return permitted(l.slices, 'GB', day(2027, 6, 1), 40);
      },
    });
  });
});

describe('a fee set on the pay', () => {
  const cm = permitOf('CM')?.fees?.[0] as NonNullable<NonNullable<ReturnType<typeof permitOf>>['fees']>[number];
  const date = '2026-11-02';
  // ACTRA's principal day in 2026, three days.
  const actra = part('actra');
  /** A part's engagement as the permit reads it: its days, and its pay on a day. */
  const job = (p: Part) => ({ days: daysWorked(p), earned: (d: string) => pay(p, d) });
  const inFrancs = exchangeOn(fromMajor('CAD', '2918.25'), 'XAF', date)?.money as ReturnType<typeof money>;
  const expected = (months: bigint) => money('XAF', Number(roundHalfEven(BigInt(inFrancs.minor) * 260n * months, 12n * 3n * 2n)));

  it("is Cameroon's contract visa: two months' gross pay, one for an African worker, less half, priced from the part's pay", () => {
    expect(MONTH_DAYS).toEqual({ num: 52n * BigInt(WEEK_DAYS), den: 12n });
    expect([cm.money, cm.salary?.currency, cm.salary?.months, cm.salary?.monthsAfrican, cm.salary?.abatement, cm.salary?.african.includes('NG'), cm.salary?.african.includes('US')]).toEqual([null, 'XAF', '2', '1', '0.5', true, false]);
    expect(priced(cm, identity().person as Person, job(actra), date)).toStrictEqual(expected(2n));
    expect(priced(cm, identity({ citizenship: ['US', 'NG'] }).person as Person, job(actra), date)).toStrictEqual(expected(1n));
    // A week's engagement: the pay for its five days, scaled to the month the same way.
    const week = { ...part('actra'), term: 'week' as const, length: 1 };
    const weekly = exchangeOn(fromMajor('CAD', '4133.50'), 'XAF', date)?.money as ReturnType<typeof money>;
    expect(priced(cm, identity().person as Person, job(week), date)).toStrictEqual(money('XAF', Number(roundHalfEven(BigInt(weekly.minor) * 260n * 2n, 12n * 5n * 2n))));
  });

  it('comes to nothing known where the part sets no pay or no rate is known; another fee is its amount', () => {
    const p = identity().person as Person;
    expect(priced(cm, p, job({ ...part('sag-aftra'), budget: 15_000 }), date)).toBeNull();
    const unknown = CURRENCY_CODES.find((c) => !knowsRate(c)) as (typeof CURRENCY_CODES)[number];
    expect(priced({ ...cm, salary: { ...(cm.salary as NonNullable<typeof cm.salary>), currency: unknown } }, p, job(actra), date)).toBeNull();
    const gb = permitOf('GB')?.fees?.[0] as typeof cm;
    expect(priced(gb, p, job(actra), date)).toStrictEqual(gbp('340'));
    // Months in a fraction: a month and a half.
    expect(priced({ ...cm, salary: { ...(cm.salary as NonNullable<typeof cm.salary>), months: '1.5' } }, p, job(actra), date)).toStrictEqual(money('XAF', Number(roundHalfEven(BigInt(inFrancs.minor) * 260n * 15n, 12n * 3n * 10n * 2n))));
    // No abatement: the whole months.
    expect(priced({ ...cm, salary: { ...(cm.salary as NonNullable<typeof cm.salary>), abatement: '0' } }, p, job(actra), date)).toStrictEqual(money('XAF', Number(roundHalfEven(BigInt(inFrancs.minor) * 260n * 2n, 12n * 3n))));
  });
});

describe("a short engagement's days, for whom and from when the law gives them", () => {
  const s = (parts: Audition[] = []) => life(parts).slices;
  const renowned = [played('actra', 0, 80), played('actra', 0, 40), played('actra', 0, 40)];

  it("are Belgium's for artists of renown, read as the O-1's distinction", () => {
    expect([permitted(s(), 'BE', NOW, 21), permitted(s(renowned), 'BE', NOW, 21), permitted(s(renowned), 'BE', NOW, 22)]).toEqual([false, true, false]);
  });

  it("are Switzerland's for work engaged from abroad, which no engagement the game books is", () => {
    expect([permitted(s(), 'CH', NOW, 1), permitted(s(renowned), 'CH', NOW, 1)]).toEqual([false, false]);
  });

  it("are Vietnam's from Decree 393/2026's first day, 5 December 2026", () => {
    expect([permitted(s(), 'VN', day(2026, 12, 4) + 86_399, 90), permitted(s(), 'VN', day(2026, 12, 5), 90), permitted(s(), 'VN', day(2026, 12, 5), 91)]).toEqual([false, true, false]);
  });
});

describe('working in a country', () => {
  it('is open by citizenship, by a permit in force on the day, or within the days a short engagement is worked without one', () => {
    const s = (who: Partial<Person>, applications: Application[] = [], parts: Audition[] = []) => life(parts, who, applications).slices;
    expect(permitted(s({}), 'US', NOW, 400)).toBe(true);
    // Where every passport works freely (papers.work), no permit is asked of anyone.
    for (const c of ['AM', 'KZ', 'SI', 'SJ', 'UA'] as const) expect(permitted(s({ citizenship: ['IN'] }), c, NOW, 400), c).toBe(true);
    expect(permitted(s({ citizenship: ['IE'] }), 'GB', NOW, 400)).toBe(true);
    expect(permitted(s({ citizenship: ['CA'] }), 'US', NOW, 1)).toBe(false);
    // The UK's 30 days of an engagement, each engagement counted alone.
    expect([permitted(s({}), 'GB', NOW, 30), permitted(s({}), 'GB', NOW, 31)]).toEqual([true, false]);
    expect(permitted(s({}, [], [played('pact-equity', NOW - SECONDS_PER_DAY, 50, 30)]), 'GB', NOW, 30)).toBe(true);
    // Croatia lets an OECD passport work 90 days in 180 without its permit, an Indian one none: either citizenship will do.
    expect([permitted(s({ citizenship: ['IN', 'US'] }), 'HR', NOW, 90), permitted(s({ citizenship: ['IN'] }), 'HR', NOW, 1)]).toEqual([true, false]);
    // Germany's 90 days in a year.
    expect([permitted(s({}), 'DE', NOW, 90), permitted(s({}), 'DE', NOW, 91)]).toEqual([true, false]);
    // A permit in force on the day, in that country.
    expect(permitted(s({}, [granted('GB', NOW + 1)]), 'GB', NOW, 31)).toBe(true);
    expect(permitted(s({}, [granted('GB', NOW)]), 'GB', NOW, 31)).toBe(false);
    expect(permitted(s({}, [granted('FR', NOW + 1)]), 'GB', NOW, 31)).toBe(false);
    expect(permitted(s({}, [{ ...granted('GB', NOW + 1), decided: null }]), 'GB', NOW, 31)).toBe(false);
    expect(permitted(s({}, [{ ...granted('GB', NOW + 1), decided: { at: 0, refused: 'no' } }]), 'GB', NOW, 31)).toBe(false);
    // A country whose rules aren't kept: closed.
    expect(permitted(s({}), 'AF', NOW, 1)).toBe(false);
  });

  it("adds the days worked there within the law's period to the engagement's, where the law counts one (Germany's 90 in a year)", () => {
    const s = (parts: Audition[]) => life(parts).slices;
    const before = (daysAgo: number, length: number) => played('de-screen', NOW - daysAgo * SECONDS_PER_DAY, 50, length);
    expect([permitted(s([before(60, 60)]), 'DE', NOW, 30), permitted(s([before(60, 60)]), 'DE', NOW, 31)]).toEqual([true, false]);
    // A part played longer ago than the year counts nothing.
    expect(permitted(s([before(366, 60)]), 'DE', NOW, 90)).toBe(true);
    // The UK counts no period: a part played the day before doesn't count against the next.
    expect(permitted(s([played('pact-equity', NOW - SECONDS_PER_DAY, 50, 30)]), 'GB', NOW, 30)).toBe(true);
  });

  it("counts the days worked there within the law's period, by the parts played there", () => {
    const acting = (parts: Audition[]) => ({ acting: { ...structuredClone(ACTING_START), auditions: parts }, directing: structuredClone(DIRECTING_START), producing: structuredClone(PRODUCING_START) });
    const parts = [played('pact-equity', NOW - 10 * SECONDS_PER_DAY, 50, 4), played('uk-theatre', NOW - 100 * SECONDS_PER_DAY), played('sag-aftra', NOW - SECONDS_PER_DAY), booked('pact-equity')];
    parts[1] = { ...(parts[1] as Audition), part: { ...part('uk-theatre'), term: 'week', length: 2, rehearsal: 1 } };
    expect(daysWorkedIn(acting(parts), 'GB', NOW, 365)).toBe(4 + 15);
    expect(daysWorkedIn(acting(parts), 'GB', NOW, 100)).toBe(4);
    expect(daysWorkedIn(acting(parts), 'GB', NOW, 101)).toBe(19);
    expect(daysWorkedIn(acting(parts), 'US', NOW, 365)).toBe(3);
  });
});

describe('the frame', () => {
  it('runs each command and the decision as declared, reading and writing what they say', () => {
    expect(commandIndex().filter((x) => x.id.startsWith('permits.'))).toEqual([
      { id: 'permits.apply', reads: ['identity', 'acting', 'directing', 'producing'], writes: ['permits', 'schedule'] },
      { id: 'permits.renew', reads: ['identity', 'acting', 'directing', 'producing'], writes: ['permits', 'schedule'] },
    ]);
    expect([DECISION_KIND, PERMITS_START]).toEqual(['permits.decision', { applications: [] }]);
  });

  it('is the same twice over', () => {
    const run = () => pass(dispatch(life([booked('pact-equity')]), applyForPermit, { role: 'actor', engagement: 1, premium: true }), day(2027, 1, 1)).life;
    expect(run()).toEqual(run());
  });
});

describe('the line for the game\'s own readings', () => {
  it("tells the player its own readings are the game's", async () => {
    const { MODEL_LINE } = await import('../../../src/person/permits/permits.ts');
    const { t } = await import('../../../src/core/text/text.ts');
    expect(MODEL_LINE).toBe('permits.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own");
  });
});

describe('an engagement in another role', () => {
  const film = (over: Record<string, unknown> = {}) => ({ id: 1, form: 'feature', country: 'NO', started: NOW, prepDays: 10, shootDays: 20, cutDays: 10, fee: fromMajor('NOK', '400000'), cut: null, shot: null, ...over }) as unknown as Film;
  const project = (over: Record<string, unknown> = {}) => ({ id: 1, market: 'IT', plan: { scheduled: 25, fee: fromMajor('EUR', '90000') }, shot: null, ...over }) as unknown as Project;
  const roles = (films: Film[] = [], projects: Project[] = [], who: Partial<Person> = {}, applications: Application[] = []) => {
    const l = life([], who, applications);
    return { ...l, slices: { ...l.slices, directing: { ...l.slices.directing, films }, producing: { ...l.slices.producing, projects } } };
  };

  it("is a director's film prepped or a producer's project planned, in its own country, for its own days", () => {
    expect(ROLES).toEqual(['actor', 'director', 'producer']);
    const s = roles([film()], [project()]).slices;
    expect([engagedIn(s, 'director', 1).country, engagedIn(s, 'director', 1).days, engagedIn(s, 'director', 1).done, engagedIn(s, 'director', 1).earned('2026-11-02')]).toEqual(['NO', 40, false, fromMajor('NOK', '400000')]);
    expect([engagedIn(s, 'producer', 1).country, engagedIn(s, 'producer', 1).days, engagedIn(s, 'producer', 1).done, engagedIn(s, 'producer', 1).earned('2026-11-02')]).toEqual(['IT', 25, false, fromMajor('EUR', '90000')]);
    const done = roles([film({ cut: 70 })], [project({ shot: { at: 0, days: 25 } })]).slices;
    expect([engagedIn(done, 'director', 1).done, engagedIn(done, 'producer', 1).done]).toEqual([true, true]);
    expect(() => engagedIn(s, 'writer' as 'actor', 1)).toThrow("there's no role writer a permit is applied for in");
  });

  it('is applied for there, the engager or the worker as the research says, and refused once done', () => {
    const l = dispatch(roles([film()], [project()]), applyForPermit, { role: 'director', engagement: 1, premium: false });
    expect([apps(l)[0]?.country, apps(l)[0]?.role, apps(l)[0]?.engagement, apps(l)[0]?.by]).toEqual(['NO', 'director', 1, permitOf('NO')?.by]);
    const p = dispatch(roles([film()], [project({ market: 'DE' })]), applyForPermit, { role: 'producer', engagement: 1, premium: false });
    expect([apps(p)[0]?.country, apps(p)[0]?.role]).toEqual(['DE', 'producer']);
    expect(() => dispatch(roles([film({ cut: 70 })]), applyForPermit, { role: 'director', engagement: 1, premium: false })).toThrow('film 1 is cut');
    expect(() => dispatch(roles([], [project({ shot: { at: 0, days: 25 } })]), applyForPermit, { role: 'producer', engagement: 1, premium: false })).toThrow('project 1 is shot');
    // The same engagement in another role is another application.
    expect(() => dispatch(l, applyForPermit, { role: 'director', engagement: 1, premium: false })).toThrow('a permit is applied for already for that engagement');
    expect(apps(dispatch({ ...l, slices: { ...l.slices, producing: { projects: [project({ market: 'DE' })] } } }, applyForPermit, { role: 'producer', engagement: 1, premium: false }))).toHaveLength(2);
    // A permit for an engagement's term is in force until that engagement is done.
    const held: Application = { ...granted('NO', 0), role: 'director', decided: { at: 0, until: null } };
    expect([permitted(roles([film()], [], {}, [held]).slices, 'NO', NOW, 400, 'director'), permitted(roles([film({ cut: 70 })], [], {}, [held]).slices, 'NO', NOW, 400, 'director')]).toEqual([true, false]);
  });

  it("is refused where the route doesn't cover the role, and the player is told", () => {
    expect(COVERS).toEqual({ KZ: { free: ['actor', 'director'] }, AM: { free: ['actor'] }, JP: { permit: ['actor'] }, SE: { permit: ['actor', 'director'] }, EG: { permit: ['actor', 'director'] } });
    const who = { identity: identity() };
    expect(() => permitFor(who, 'JP', false, 'director')).toThrow(t(UNKEPT_LINE, { country: 'Japan', missing: 'the permit a director takes' }));
    expect(permitFor(who, 'JP', false, 'actor')).toBe(permitOf('JP'));
    expect(() => permitFor(who, 'SE', false, 'producer')).toThrow(t(UNKEPT_LINE, { country: 'Sweden', missing: 'the permit a producer takes' }));
    // Kazakhstan's freedom is an actor's and a director's: a producer needs a permit, which isn't known.
    expect(() => permitFor(who, 'KZ', false, 'director')).toThrow('you need no permit to work in KZ');
    expect(() => permitFor(who, 'KZ', false, 'producer')).toThrow(t(UNKEPT_LINE, { country: 'Kazakhstan', missing: 'the permit a producer takes' }));
    expect(() => permitFor(who, 'AM', false, 'director')).toThrow(t(UNKEPT_LINE, { country: 'Armenia', missing: 'the permit a director takes' }));
    const s = roles().slices;
    expect([permitted(s, 'KZ', NOW, 400, 'actor'), permitted(s, 'KZ', NOW, 400, 'director'), permitted(s, 'KZ', NOW, 400, 'producer'), permitted(s, 'KZ', NOW, 400)]).toEqual([true, true, false, true]);
    // At home every role is free.
    expect(permitted(roles([], [], { citizenship: ['KZ'] }).slices, 'KZ', NOW, 400, 'producer')).toBe(true);
    expect(() => permitFor({ identity: identity({ citizenship: ['KZ'] }) }, 'KZ', false, 'producer')).toThrow('you need no permit to work in KZ');
  });

  it("counts every role's days worked there within the law's period", () => {
    const parts = [played('pact-equity', NOW - 10 * SECONDS_PER_DAY, 50, 4)];
    const l = roles([film({ country: 'GB', started: NOW - 20 * SECONDS_PER_DAY }), film({ id: 2, country: 'GB', started: NOW - 200 * SECONDS_PER_DAY }), film({ id: 3, country: 'NO' })], [project({ market: 'GB', shot: { at: NOW - 5 * SECONDS_PER_DAY, days: 7 } }), project({ id: 2, market: 'GB' }), project({ id: 3, market: 'IT', shot: { at: NOW, days: 9 } })]);
    const s = { ...l.slices, acting: { ...l.slices.acting, auditions: parts.map((a, i) => ({ ...a, id: i + 1 })) } };
    expect(daysWorkedIn(s, 'GB', NOW, 100)).toBe(4 + 40 + 7);
    expect(daysWorkedIn(s, 'GB', NOW, 365)).toBe(4 + 80 + 7);
    expect(daysWorkedIn(s, 'GB', NOW, 15)).toBe(4 + 7);
    expect(daysWorkedIn(s, 'GB', NOW, 20)).toBe(4 + 7);
    expect(daysWorkedIn(s, 'IT', NOW, 100)).toBe(9);
  });
});

describe('a visit for a meeting', () => {
  it("is open where the person's passport enters without a visa applied for beforehand, and at home", () => {
    const p = (citizenship: string[]) => identity({ citizenship: citizenship as Person['citizenship'] }).person as Person;
    expect([mayVisit(p(['US']), 'GB'), mayVisit(p(['US']), 'US'), mayVisit(p(['IN']), 'GB'), mayVisit(p(['IN', 'US']), 'GB')]).toEqual([true, true, false, true]);
    expect(mayVisit(p(['US']), 'AQ')).toBe(false);
    expect(whyNoVisit('GB')).toBe("a visit to GB takes a visa applied for beforehand, which the game doesn't hold");
    expect(whyNoVisit('AQ')).toBe(t('visits.unkept', { country: 'Antarctica' }));
  });
});
