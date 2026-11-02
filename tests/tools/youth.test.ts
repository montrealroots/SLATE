import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORKS as TAX_WORKS } from '../../src/money/tax/tax.ts';
import {
  ageOf,
  AUTHORITY,
  BINDING_SOUGHT,
  BLOCKED,
  BY,
  byOf,
  companyOf,
  contractOf,
  COURT,
  EVERY,
  FACT,
  forSeat,
  fundOf,
  GUARDIAN,
  hoursOf,
  KEYS,
  KINDS,
  named,
  NONE_ELSE,
  OUTPUT,
  overOf,
  PLACES,
  pointed,
  reachIn,
  reachOf,
  READINGS,
  readResearch,
  readYouth,
  serialize,
  SET_ASIDE_SOUGHT,
  setAsideOf,
  SOURCES,
  unread,
  VOIDABLE,
  WORKS,
  youthOf,
  zoneIn,
  type Research,
  type Youth,
} from '../../tools/person/youth/compile.ts';
import { COVERAGE, coverageOf, serializeCoverage, TESTS, TOLD, youthCoverage } from '../../tools/person/youth/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const ALL = ['performer', 'director', 'producer', 'author'];
const research = (figures: { item: string; value: unknown }[], blockers: Research['blockers'] = [], country = 'XX'): Research => ({ country, figures, blockers });
const R = research([
  { item: 'minorsContracts', value: { binding: 'the legal representative\'s consent', ownContractFrom: 15, setAside: { share: 0.15, into: 'a trust' }, reachesRoles: ['actor', 'writer'], fullAge: 'majority (18)' } },
  { item: 'childPerformers', value: { permit: 'a licence', ages: '15 days to 18', bands: [{ from: '15 days', to: '6 months', work: '20 minutes' }, { from: 6, work: 4, week: 20 }], reachesWritingDirecting: true } },
  { item: 'companies', value: { directorFrom: 18 } },
  { item: 'funds', value: { 'A Fund': { minimumAge: 18 } } },
]);
const EMPTY: Youth = unread('Europe/London');

describe('the youth compile', () => {
  it('reads the research, the readings and the map where the engine is built', () => {
    expect([SOURCES, READINGS, OUTPUT, PLACES, FACT, BLOCKED]).toEqual(['research/sources/person/ages', 'tools/person/youth/readings.json', 'src/person/youth/youth.json', 'src/world/gazetteer/places', 'person.ages.', 'person.ages.blocked.']);
    expect(WORKS).toEqual([...TAX_WORKS]);
    expect(BY).toEqual(['self', 'voidable', 'court', 'authority', 'guardian']);
    expect(unread(null)).toEqual({ zone: null, seat: null, contract: null, setAside: null, permit: null, reach: ['performer'], hours: null, company: null, fund: null, unions: [] });
  });

  it('points into a figure by its number and path, an array by its place', () => {
    expect(pointed(R, '1:bands/0/work')).toBe('20 minutes');
    expect(pointed(R, '2:')).toEqual({ directorFrom: 18 });
    expect(pointed(R, '0:setAside/share')).toBe(0.15);
    expect(() => pointed(R, '9:x')).toThrow('XX has no figure at 9:x');
    expect(() => pointed(R, 'x:y')).toThrow('XX has no figure at x:y');
    expect(() => pointed(R, '0:setAside/none')).toThrow('XX has nothing at 0:setAside/none');
    expect(() => pointed(R, '1:bands/0/work/x')).toThrow('XX has nothing at 1:bands/0/work/x');
    expect(() => pointed(research([{ item: 'funds', value: null }]), '0:a')).toThrow('has nothing at 0:a');
  });

  it('names a figure at a pointer, or words read inside the research\'s words there, refused where they don\'t stand', () => {
    expect(named(R, '2:directorFrom')).toBe(18);
    expect(named(R, { at: '1:ages', is: '15 days' })).toBe('15 days');
    expect(named(R, { at: '0:', is: 'trust' })).toBe('trust');
    expect(() => named(R, { at: '1:ages', is: '16 days' })).toThrow('XX\'s research doesn\'t say "16 days" at 1:ages');
    expect(() => named(R, { at: '1:ages', is: 15 })).toThrow('doesn\'t say "15"');
    expect(() => named(R, null)).toThrow("XX's figure is not an object");
    expect(() => named(R, [])).toThrow("XX's figure is not an object");
  });

  it('reads an age in whole years, days or months, and hours or minutes', () => {
    expect([ageOf(0), ageOf(16), ageOf('2'), ageOf(' 18 '), ageOf('3 years'), ageOf('1 year'), ageOf('15 days'), ageOf('1 day'), ageOf('6 months'), ageOf('1 month')]).toEqual([0, 16, 2, 18, 3, 1, { years: 0, days: 15 }, { years: 0, days: 1 }, { years: 0, months: 6 }, { years: 0, months: 1 }]);
    for (const bad of [-1, 1.5, '1.5', 'school leaving age', '15 weeks', null, '15days']) expect(() => ageOf(bad), String(bad)).toThrow(`${JSON.stringify(bad)} isn't an age`);
    expect([hoursOf(4), hoursOf(0.5), hoursOf('20 minutes'), hoursOf('90 minutes')]).toEqual([4, 0.5, 20 / 60, 1.5]);
    for (const bad of [0, -2, '4', '20 min', 'x 20 minutes', null]) expect(() => hoursOf(bad), String(bad)).toThrow(`${JSON.stringify(bad)} isn't a number of hours`);
  });

  it('reads how a contract binds from the research\'s words: voidable, a court, an authority, the guardian, in that order', () => {
    expect(byOf('approval by the superior court; otherwise disaffirmable')).toBe('voidable');
    for (const w of ['voidable', 'unenforceable unless affirmed', 'may be set aside', 'annullable', 'relatively void', 'the representative may end it', 'the guardian may rescind', 'set aside on application']) expect(byOf(w), w).toBe('voidable');
    for (const w of ['a court', 'tribunal de familia', 'el juez', 'juiz', 'the judge', 'giudice tutelare', 'alvará', 'le juge']) expect(byOf(w), w).toBe('court');
    for (const w of ['the labour inspector', 'the authority', 'autoridad laboral', "l'autorité", 'the ministry', 'the minister', 'du préfet', 'the prefect', 'the department', 'Departament de Treball', 'labour service', 'Defensoría', 'the council', 'MOHRE', 'the office', 'the commission']) expect(byOf(w), w).toBe('authority');
    for (const w of ['legal representative', 'the guardian', 'a parent', 'the tutor', 'written consent', 'représentant légal', 'representante', 'los padres', 'curator', 'værge', 'vergemål', 'carer', 'legal administrator', 'des gesetzlichen Vertreters', 'ouders', 'vertegenwoordiger', 'genitori', 'rodzica']) expect(byOf(w), w).toBe('guardian');
    expect(byOf('common law')).toBeNull();
    expect([VOIDABLE, COURT, AUTHORITY, GUARDIAN].every((re) => re.flags === 'i')).toBe(true);
  });

  it('reads the work a rule reaches: every kind, a performer only, or the kinds named', () => {
    expect(reachOf(true)).toEqual(ALL);
    expect(reachOf(false)).toEqual(['performer']);
    expect(reachOf(null)).toBeNull();
    expect(reachOf(3)).toBeNull();
    for (const w of ['no', 'false: x', 'not named (reading)', 'the exemption names actors and performers only', 'a freelance commission falls outside it', 'falls outside']) expect(reachOf(w), w).toEqual(['performer']);
    for (const w of ['yes, any work', 'true', 'any employment', 'every transaction', 'general contract law', 'whatever the role', "à quelque titre que ce soit", 'no distinction (all employment)', 'not distinguished', 'all employment contracts', 'reaches paid artistic and cultural activity generally', 'reaches any participation, not only performing']) expect(reachOf(w), w).toEqual(ALL);
    expect(reachOf(['actor', 'writer', 'director', 'producer', 'production executive'])).toEqual(ALL);
    expect(reachOf(['performer', 'model'])).toEqual(['performer']);
    expect(reachOf(['writer', 'director'])).toEqual(['director', 'author']);
    expect(reachOf(['only producers'])).toEqual(['producer']);
    expect(reachOf('screenwriters and réalisateurs')).toEqual(['director', 'author']);
    expect(reachOf(['nurse'])).toBeNull();
    expect(reachOf('the cinema')).toBeNull();
    expect(reachOf('a dancer, musician or artist')).toEqual(['performer']);
    expect(reachOf('an author')).toEqual(['author']);
    expect(reachOf('scénaristes')).toEqual(['author']);
    expect(KINDS.map(([k]) => k)).toEqual(['performer', 'author', 'director', 'producer']);
    expect([NONE_ELSE, EVERY].every((re) => re.flags === 'i')).toBe(true);
  });

  it('reads a figure for the seat where it is set by region and holds the seat\'s own', () => {
    expect(forSeat({ 'US.CA': 1, 'US.NY': 2 }, 'US.CA')).toBe(1);
    expect(forSeat({ 'US.NY': 2 }, 'US.CA')).toEqual({ 'US.NY': 2 });
    expect(forSeat({ a: 1 }, null)).toEqual({ a: 1 });
    expect(forSeat(null, 'US.CA')).toBeNull();
    expect(forSeat(5, 'US.CA')).toBe(5);
  });

  it("reads the set-aside by the research's own keys: the share and its account, none where it is null and nothing sought of it is blocked", () => {
    expect(KEYS.setAside).toEqual(['setAside', 'earningsSetAside']);
    expect(KEYS.into).toEqual(['into', 'to', 'where']);
    expect(setAsideOf(R, null, ['performer'])).toEqual({ share: '0.15', into: 'a trust', roles: ['performer'], over: null });
    const mc = (value: unknown, blockers: { item: string; sought: string }[] = []) => research([{ item: 'funds', value: {} }, { item: 'minorsContracts', value }], blockers);
    expect(setAsideOf(mc({ setAside: null }), null, ALL as never)).toBe('none');
    expect(setAsideOf(mc({ earningsSetAside: null }), null, ALL as never)).toBe('none');
    expect(setAsideOf(mc({ setAside: null }, [{ item: 'minorsContracts', sought: 'a statutory share of earnings set aside' }]), null, ALL as never)).toBeNull();
    expect(setAsideOf(mc({ setAside: null }, [{ item: 'childPerformers', sought: 'set aside' }]), null, ALL as never)).toBe('none');
    expect(setAsideOf(mc({ setAside: null }, [{ item: 'minorsContracts', sought: 'how a contract binds' }]), null, ALL as never)).toBe('none');
    expect(setAsideOf(mc({ setAside: { share: null } }), null, [])).toBeNull();
    expect(setAsideOf(mc({ setAside: 'a pécule' }), null, [])).toBeNull();
    expect(setAsideOf(mc({ setAside: { share: 0.2 } }), null, [])).toBeNull();
    expect(setAsideOf(mc({ setAside: { share: 0.2, to: 7 } }), null, [])).toBeNull();
    expect(setAsideOf(mc({ setAside: { share: 0.2, to: 'the Caisse', into: null } }), null, ['author'])).toEqual({ share: '0.2', into: 'the Caisse', roles: ['author'], over: null });
    expect(setAsideOf(mc({ setAside: { share: 0.2, where: 'a bank' } }), null, [])).toEqual({ share: '0.2', into: 'a bank', roles: [], over: null });
    expect(setAsideOf(mc({ binding: 'x' }), null, [])).toBeNull();
    expect(setAsideOf(mc({ 'US.CA': { setAside: { share: 0.15, into: 'Coogan' } }, setAside: null }), 'US.CA', [])).toEqual({ share: '0.15', into: 'Coogan', roles: [], over: null });
    expect(setAsideOf(research([{ item: 'minorsContracts', value: [1] }, { item: 'minorsContracts', value: { setAside: null } }]), null, [])).toBe('none');
    expect(SET_ASIDE_SOUGHT.test('the share of a child\'s earnings') && SET_ASIDE_SOUGHT.test('earnings set aside') && SET_ASIDE_SOUGHT.test('setaside')).toBe(true);
  });

  it("reads the contract by the research's own keys, none where its binding is blocked", () => {
    expect(KEYS.binding).toEqual(['binding', 'authorisation', 'employment', 'contractBy', 'consent', 'parentConsent', 'madeBy']);
    expect(KEYS.alone).toEqual(['ownContractFrom', 'contractAloneFrom', 'employmentContractFrom', 'fullCapacityFrom', 'fullAgeForWorkAndArtFrom', 'deemedOfAgeFrom']);
    expect(contractOf(R, null, ['author'])).toEqual({ by: 'guardian', alone: 15, roles: ['author'] });
    const mc = (value: unknown, blockers: { item: string; sought: string }[] = []) => research([{ item: 'minorsContracts', value }], blockers);
    expect(contractOf(mc({ binding: 'x' }, [{ item: 'minorsContracts', sought: 'how a minor\'s contract is made binding' }]), null, [])).toBeNull();
    expect(contractOf(mc({ binding: 'the court' }, [{ item: 'funds', sought: 'binding' }]), null, [])).toEqual({ by: 'court', alone: null, roles: [] });
    expect(contractOf(mc({ binding: null, madeBy: 'the parent' }), null, [])).toEqual({ by: 'guardian', alone: null, roles: [] });
    expect(contractOf(mc({ binding: 'common law' }), null, [])).toBeNull();
    expect(contractOf(mc({ setAside: null }), null, [])).toBeNull();
    expect(contractOf(mc({ binding: { under14: 'the inspector' }, contractAloneFrom: '14' }), null, [])).toEqual({ by: 'authority', alone: null, roles: [] });
    expect(contractOf(mc({ binding: 'the guardian', deemedOfAgeFrom: 16 }), null, [])).toEqual({ by: 'guardian', alone: 16, roles: [] });
    for (const w of ['bind', 'approval', 'who signs', 'capacity', 'how a contract is made binding', 'a contract for creative work']) expect(BINDING_SOUGHT.test(w), w).toBe(true);
    expect(contractOf(research([{ item: 'minorsContracts', value: { binding: 'x' } }, { item: 'minorsContracts', value: { binding: 'the judge' } }]), null, [])).toEqual({ by: 'court', alone: null, roles: [] });
  });

  it("reads the work a rule reaches by the research's own keys, the first that says", () => {
    expect(KEYS.reach).toEqual(['reachesRoles', 'reachesWritingDirecting']);
    expect(reachIn(R, 'minorsContracts', null)).toEqual(['performer', 'author']);
    expect(reachIn(R, 'childPerformers', null)).toEqual(ALL);
    expect(reachIn(R, 'companies', null)).toBeNull();
    expect(reachIn(research([{ item: 'childPerformers', value: { reachesRoles: ['nurse'], reachesWritingDirecting: false } }, { item: 'childPerformers', value: { reachesWritingDirecting: 'any work' } }]), 'childPerformers', null)).toEqual(ALL);
  });

  it("reads the company's age by the research's own keys, a number or the majority, none where companies are blocked", () => {
    expect(KEYS.company).toEqual(['directorMinAge', 'directorMinimumAge', 'directorFrom', 'directorAge', 'directAge', 'formAndDirectFrom', 'boardMemberFrom', 'boardFrom', 'boardMinAge', 'managementFrom', 'managingDirectorFrom']);
    expect(companyOf(R, null)).toBe(18);
    const co = (value: unknown, blockers: { item: string; sought: string }[] = []) => research([{ item: 'companies', value }], blockers);
    expect(companyOf(co({ directorMinAge: null, directorFrom: 16 }), null)).toBe(16);
    expect(companyOf(co({ directorFrom: 'majority (reading)' }), null)).toBe('majority');
    expect(companyOf(co({ directorFrom: '18, or emancipated' }), null)).toBeNull();
    expect(companyOf(co({ formFrom: 18 }), null)).toBeNull();
    expect(companyOf(co({ directorFrom: 18 }, [{ item: 'companies', sought: 'x' }]), null)).toBeNull();
    expect(companyOf(co({ 'CA.08': 18, CA: 17 }), 'CA.08')).toBeNull();
    expect(companyOf(co({ 'CA.10': { directorFrom: 18 } }), 'CA.10')).toBe(18);
    expect(companyOf(research([{ item: 'companies', value: { x: 1 } }, { item: 'companies', value: { boardFrom: 21 } }]), null)).toBe(21);
  });

  it("reads the fund's applicant age by the research's own keys, at its top or under its name, company where it takes no person", () => {
    expect(KEYS.fund).toEqual(['minimumAge', 'applicantAge', 'age', 'minAge', 'applicantMinAge', 'individualMinAge', 'individualFrom', 'coreTeamMinAge']);
    expect(fundOf(R)).toBe(18);
    const fu = (value: unknown, blockers: { item: string; sought: string }[] = []) => research([{ item: 'funds', value }], blockers);
    expect(fundOf(fu({ fund: 'X', individualFrom: 18 }))).toBe(18);
    expect(fundOf(fu({ CNC: { individualsMayApply: false } }))).toBe('company');
    expect(fundOf(fu({ individualsMayApply: false }))).toBe('company');
    expect(fundOf(fu({ NEA: { individuals: false } }))).toBe('company');
    expect(fundOf(fu({ individualsMayApply: true, minimumAge: null }))).toBeNull();
    expect(fundOf(fu({ fund: 'X', list: [{ minimumAge: 18 }] }))).toBeNull();
    expect(fundOf(fu({ minimumAge: 18 }, [{ item: 'funds', sought: 'x' }]))).toBeNull();
    expect(fundOf(fu({ minimumAge: 18 }, [{ item: 'unions', sought: 'x' }]))).toBe(18);
    expect(fundOf(fu({ minimumAge: '18' }))).toBeNull();
    expect(fundOf(research([{ item: 'funds', value: { a: null } }, { item: 'funds', value: { minAge: 21 } }]))).toBe(21);
  });

  it("reads a threshold's amount from the research's words or figure, its currency, what it counts over and how", () => {
    const r = research([{ item: 'minorsContracts', value: { threshold: 'earnings over $2,000 on a production', amount: 200000, currency: 'PHP' } }]);
    expect(overOf(r, { amount: { at: '0:threshold', is: '$2,000' }, currency: 'CAD', per: 'engagement', above: true })).toEqual({ amount: '2000', currency: 'CAD', per: 'engagement', above: true });
    expect(overOf(r, { amount: '0:amount', currency: '0:currency', per: 'year', above: false })).toEqual({ amount: '200000', currency: 'PHP', per: 'year', above: false });
    expect(() => overOf(r, { amount: { at: '0:threshold', is: 'over' }, currency: 'CAD', per: 'year', above: true })).toThrow("XX's threshold isn't an amount");
    expect(() => overOf(r, { amount: '0:amount', currency: 'XYZ', per: 'year', above: true })).toThrow("XX's threshold is in XYZ, which isn't a currency of ISO 4217's list");
    expect(() => overOf(r, { amount: '0:amount', currency: 'PHP', per: 'month', above: true })).toThrow("XX's threshold is counted over month");
    expect(() => overOf(r, { amount: '0:amount', currency: 'PHP', per: 'year', above: 'yes' })).toThrow("XX's threshold says whether only the part above it is set aside");
    expect(() => overOf(r, null)).toThrow("XX's threshold is not an object");
    expect(overOf(r, { amount: '0:amount', currency: 'EUR', per: 'year', above: false }).currency).toBe('EUR');
    expect(overOf(research([{ item: 'm', value: { a: '1.5 thousand' } }]), { amount: '0:a', currency: 'USD', per: 'year', above: false }).amount).toBe('1.5');
  });

  it('reads a country by its own keys, the readings overriding each field they name', () => {
    expect(youthOf(R, {}, 'Europe/London')).toEqual({ zone: 'Europe/London', seat: null, contract: { by: 'guardian', alone: 15, roles: ['performer', 'author'] }, setAside: { share: '0.15', into: 'a trust', roles: ['performer', 'author'], over: null }, permit: null, reach: ALL, hours: null, company: 18, fund: 18, unions: [] });
    const bare = research([]);
    expect(youthOf(bare, {}, null)).toEqual({ ...unread(null), contract: null });
    const read = youthOf(R, {
      seat: 'XX.01',
      note: 'prose',
      reach: { roles: ['performer', 'director'], at: '1:permit' },
      roles: { roles: 'every', at: '0:binding' },
      contract: { by: 'court', at: '0:binding', alone: { at: '1:ages', is: '18' } },
      setAside: { share: '0:setAside/share', into: null, roles: { roles: ['performer'], at: '0:binding' }, over: { amount: '2:directorFrom', currency: 'USD', per: 'engagement', above: true } },
      permit: { issuer: '1:permit', under: 'majority', from: { at: '1:ages', is: '15 days' } },
      hours: [{ from: 0, to: '1:bands/0/to', day: '1:bands/0/work' }, { from: '1:bands/1/from', to: null, day: '1:bands/1/work', week: '1:bands/1/week' }],
      company: { at: '2:', is: '18' },
      fund: '3:A Fund/minimumAge',
    }, 'Z');
    expect(read).toEqual({
      zone: 'Z',
      seat: 'XX.01',
      contract: { by: 'court', alone: 18, roles: ALL },
      setAside: { share: '0.15', into: null, roles: ['performer'], over: { amount: '18', currency: 'USD', per: 'engagement', above: true } },
      permit: { issuer: 'a licence', under: 'majority', from: { years: 0, days: 15 } },
      reach: ['performer', 'director'],
      hours: [{ from: 0, to: { years: 0, months: 6 }, day: 20 / 60, week: null }, { from: 6, to: null, day: 4, week: 20 }],
      company: 18,
      fund: 18,
      unions: [],
    });
    expect(youthOf(R, { contract: null, setAside: null, company: null, fund: null }, null)).toMatchObject({ contract: null, setAside: null, company: null, fund: null });
    expect(youthOf(R, { contract: { by: 'self', at: '0:binding' }, permit: { issuer: null, under: { at: '1:ages', is: '18' } } }, null)).toMatchObject({ contract: { by: 'self', alone: null, roles: ['performer', 'author'] }, permit: { issuer: null, under: 18, from: null } });
    expect(youthOf(research([{ item: 'minorsContracts', value: { setAside: null, into: "the child's own" } }]), { setAside: { none: '0:setAside' } }, null).setAside).toBe('none');
    expect(youthOf(research([{ item: 'minorsContracts', value: { into: "the child's own" } }]), { setAside: { own: '0:into' } }, null).setAside).toBe('none');
    expect(youthOf(R, { company: { at: '0:fullAge', is: 'majority' } }, null).company).toBe('majority');
    expect(youthOf(R, { company: '2:directorFrom' }, null).company).toBe(18);
    expect(youthOf(R, { setAside: { share: '0:setAside/share', into: '0:setAside/into' } }, null).setAside).toEqual({ share: '0.15', into: 'a trust', roles: ['performer', 'author'], over: null });
  });

  it("reads the unions whose rules for the young the research shows exist, from its union blocker's words", () => {
    const r = research([], [{ item: 'unions', sought: "SAG-AFTRA's rules for members under 18", tried: { 'web-search': 'the guardian signs the application' } }]);
    expect(youthOf(r, { unions: [{ union: 'SAG-AFTRA', is: 'the guardian signs' }] }, null).unions).toEqual(['SAG-AFTRA']);
    expect(youthOf(r, {}, null).unions).toEqual([]);
    const refused = (v: unknown, why: string) => expect(() => youthOf(r, { unions: v }, null), JSON.stringify(v)).toThrow(why);
    refused([], "XX's unions are no list");
    refused({}, "XX's unions are no list");
    refused([1], "XX's union is not an object");
    refused([{ union: 'DGA', is: 'the guardian signs' }], 'XX\'s union blocker doesn\'t seek DGA\'s rule, or doesn\'t say "the guardian signs"');
    refused([{ union: 'SAG-AFTRA', is: 'a parent' }], 'doesn\'t say "a parent"');
    refused([{ union: 1, is: 'the guardian signs' }], "doesn't seek 1's rule");
    refused([{ union: 'SAG-AFTRA', is: 18 }], "doesn't say \"18\"");
    expect(() => youthOf(research([], [{ item: 'funds', sought: 'SAG-AFTRA the guardian signs' }]), { unions: [{ union: 'SAG-AFTRA', is: 'the guardian signs' }] }, null)).toThrow("doesn't seek SAG-AFTRA's rule");
  });

  it("refuses a reading the research doesn't bear out", () => {
    const refused = (reading: Record<string, unknown>, why: string) => expect(() => youthOf(R, reading, null), JSON.stringify(reading)).toThrow(why);
    refused({ age: 1 }, "XX's reading names age, which the game doesn't read");
    refused({ reach: { roles: ['director'], at: '1:permit' } }, "XX's child-work rules leave out a performer");
    refused({ reach: { roles: [], at: '1:permit' } }, "[] isn't a list of kinds of work");
    refused({ reach: { roles: ['nurse'], at: '1:permit' } }, '["nurse"] isn\'t a list of kinds of work');
    refused({ reach: { roles: 'performer', at: '1:permit' } }, '"performer" isn\'t a list of kinds of work');
    refused({ reach: { roles: ['performer'], at: '1:nothing' } }, 'XX has nothing at 1:nothing');
    refused({ reach: 'every' }, "XX's reach is not an object");
    refused({ contract: { by: 'parent', at: '0:binding' } }, "XX's contract is bound by parent");
    refused({ contract: { by: 'court', at: '0:none' } }, 'XX has nothing at 0:none');
    refused({ contract: { by: 'court', at: '0:binding', alone: '1:permit' } }, '"a licence" isn\'t an age');
    refused({ setAside: { none: '0:setAside' } }, "XX's research sets something aside at 0:setAside");
    refused({ setAside: { own: '2:directorFrom' } }, 'XX\'s research names no account of the child\'s own at "2:directorFrom"');
    refused({ setAside: { share: '1:permit', into: null } }, 'XX\'s share set aside is "a licence", not a share');
    refused({ setAside: { share: '2:directorFrom', into: null } }, "XX's share set aside is 18, not a share");
    refused({ setAside: { share: '0:setAside/into', into: null } }, 'not a share');
    refused({ setAside: { share: '0:setAside/share', into: '2:directorFrom' } }, "XX's set-aside names no account");
    refused({ setAside: { share: '0:setAside/share', into: { at: '0:binding', is: '' } } }, "XX's set-aside names no account");
    refused({ setAside: { share: '0:setAside/share', into: null, roles: 'every' } }, "XX's set-aside's work is not an object");
    refused({ permit: { issuer: '2:directorFrom', under: 'majority' } }, "XX's permit names no issuer");
    refused({ permit: { issuer: { at: '1:permit', is: '' }, under: 'majority' } }, "XX's permit names no issuer");
    refused({ permit: { issuer: null, under: '1:permit' } }, '"a licence" isn\'t an age');
    refused({ hours: [] }, "XX's hours are no list of bands");
    refused({ hours: {} }, "XX's hours are no list of bands");
    refused({ hours: [1] }, "XX's band is not an object");
    refused({ hours: [{ from: 0 }] }, "XX's band sets no hours");
    refused({ hours: [{ from: 0, day: '1:permit' }] }, '"a licence" isn\'t a number of hours');
    refused({ fund: '1:permit' }, '"a licence" isn\'t an age');
    refused({ company: '1:permit' }, '"a licence" isn\'t an age');
    refused({ setAside: { share: '0:setAside/share', into: null, over: { amount: '2:directorFrom', currency: 'USD', per: 'day', above: true } } }, "XX's threshold is counted over day");
  });

  it('finds the zone of the most populous place in a country, or in its region', () => {
    expect(zoneIn(ROOT, 'US', null)).toBe('America/New_York');
    expect(zoneIn(ROOT, 'US', 'US.CA')).toBe('America/Los_Angeles');
    expect(zoneIn(ROOT, 'CA', 'CA.08')).toBe('America/Toronto');
    expect(zoneIn(ROOT, 'AU', 'AU.02')).toBe('Australia/Sydney');
    expect(zoneIn(ROOT, 'GB', null)).toBe('Europe/London');
    expect(zoneIn(ROOT, 'AQ', null)).toBeNull();
    expect(zoneIn(ROOT, 'US', 'US.XX')).toBeNull();
  });
});

describe('the youth compile, at its edges', () => {
  it('points only from the start, by figures past the ninth, never into words', () => {
    const many = research(Array.from({ length: 11 }, (_, i) => ({ item: 'funds', value: { n: i } })));
    expect(pointed(many, '10:n')).toBe(10);
    expect(() => pointed(R, 'a0:binding')).toThrow('XX has no figure at a0:binding');
    expect(() => pointed(R, '1:ages/0')).toThrow('XX has nothing at 1:ages/0');
  });

  it('reads hours only from a number or words of minutes alone', () => {
    expect(() => hoursOf(['20 minutes'])).toThrow('isn\'t a number of hours');
    expect(() => hoursOf('20 minutes long')).toThrow('isn\'t a number of hours');
  });

  it('reads reach by its words from the start, and the kinds a list names', () => {
    expect(reachOf('any work, no limit')).toEqual(ALL);
    expect(reachOf('it is true for actors')).toEqual(['performer']);
    expect(reachOf('a commission would fall outside it')).toEqual(['performer']);
    expect(reachOf({ writer: true })).toBeNull();
  });

  it("reads a figure for the seat, and nothing from a value that isn't an object", () => {
    expect(forSeat({ null: 1 }, null)).toEqual({ null: 1 });
    expect(setAsideOf(research([{ item: 'minorsContracts', value: null }, { item: 'minorsContracts', value: 'words' }, { item: 'minorsContracts', value: { setAside: null } }]), null, [])).toBe('none');
    expect(setAsideOf(research([{ item: 'minorsContracts', value: { setAside: { share: null, into: 'x' } } }]), null, [])).toBeNull();
    expect(setAsideOf(research([{ item: 'minorsContracts', value: { setAside: 5 } }]), null, [])).toBeNull();
    expect(contractOf(research([{ item: 'minorsContracts', value: { binding: 'the court' } }], [{ item: 'minorsContracts', sought: "how a minor's contract is made binding" }]), null, [])).toBeNull();
    expect(companyOf(research([{ item: 'companies', value: { directorFrom: 18 } }], [{ item: 'funds', sought: 'x' }]), null)).toBe(18);
    expect(companyOf(research([{ item: 'companies', value: { directorFrom: '18, or the majority' } }]), null)).toBeNull();
    expect(fundOf(research([{ item: 'funds', value: { a: 'words', b: 5 } }, { item: 'funds', value: { minimumAge: 16 } }]))).toBe(16);
  });

  it('refuses a reading of roles with any kind of work that isn\'t one, and reads a contract\'s roles as every kind where none are said', () => {
    expect(() => youthOf(R, { reach: { roles: ['performer', 'nurse'], at: '1:permit' } }, null)).toThrow('["performer","nurse"] isn\'t a list of kinds of work');
    expect(youthOf(research([{ item: 'minorsContracts', value: { binding: 'the court' } }]), {}, null).contract).toEqual({ by: 'court', alone: null, roles: ALL });
    expect(youthOf(R, { company: '0:fullAge' }, null).company).toBe('majority');
  });

  it("reads a threshold's currency at a pointer only where it is one, and its amount whole", () => {
    const r = research([{ item: 'm', value: { a: 'over .5', b: 'over 1.5.5', c: 'over 1.55' } }]);
    const at = (amount: string, currency = 'USD') => overOf(r, { amount: `0:${amount}`, currency, per: 'year', above: true });
    expect(() => at('a')).toThrow("XX's threshold isn't an amount");
    expect(() => at('b')).toThrow("XX's threshold isn't an amount");
    expect(at('c').amount).toBe('1.55');
    expect(() => at('c', 'X0:x')).toThrow("XX's threshold is in X0:x, which isn't a currency of ISO 4217's list");
    expect(() => overOf(research(Array.from({ length: 11 }, () => ({ item: 'm', value: { a: '5', c: 'USD' } }))), { amount: '0:a', currency: '10:c', per: 'year', above: true }).currency).not.toThrow();
  });

  it('reads a share above nothing to the whole, a band of the week alone, and one ending at the working age', () => {
    const r = research([{ item: 'm', value: { zero: 0, one: 1, h: 4 } }]);
    expect(() => youthOf(r, { setAside: { share: '0:zero', into: null } }, null)).toThrow("XX's share set aside is 0, not a share");
    expect(youthOf(r, { setAside: { share: '0:one', into: null } }, null).setAside).toEqual({ share: '1', into: null, roles: ALL, over: null });
    expect(youthOf(r, { hours: [{ from: 0, to: 'work', week: '0:h' }] }, null).hours).toEqual([{ from: 0, to: 'work', day: null, week: 4 }]);
  });
});

/** A root holding a register, the research files it cites, readings and a map, for the compile's own runs. */
function fixture(files: Record<string, unknown>, readings: Record<string, unknown>, cite: Record<string, 'found' | 'blocked' | 'both' | 'wrong'>): string {
  const root = mkdtempSync(join(tmpdir(), 'youth-'));
  mkdirSync(join(root, SOURCES), { recursive: true });
  mkdirSync(join(root, PLACES), { recursive: true });
  mkdirSync(join(root, 'tools/person/youth'), { recursive: true });
  mkdirSync(join(root, 'research'), { recursive: true });
  const entries: { fact: string; value?: { file: string; sha256: string } }[] = [];
  for (const [cc, body] of Object.entries(files)) {
    const text = JSON.stringify(body);
    writeFileSync(join(root, SOURCES, `${cc}.json`), text);
    const sha = createHash('sha256').update(cite[cc] === 'wrong' ? `${text} ` : text).digest('hex');
    if (cite[cc] !== 'blocked') entries.push({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/${cc}.json`, sha256: sha } });
    if (cite[cc] === 'blocked' || cite[cc] === 'both') entries.push({ fact: `${BLOCKED}${cc}` });
  }
  writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
  writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
  writeFileSync(join(root, READINGS), JSON.stringify(readings));
  writeFileSync(join(root, PLACES, 'GB.tsv'), ['1\tA\t\tGB.ENG\t0\t0\tEurope/London\t900\t1', '2\tB\t\tGB.SCT\t0\t0\tEurope/Edinburgh\t100\t1', '3\tC\t\tGB.SCT\t0\t0\tEurope/Glasgow\t100\t1', 'short line'].join('\n'));
  writeFileSync(join(root, PLACES, 'FR.tsv'), '1\tParis\t\tFR.11\t0\t0\tEurope/Paris\t1\t1\n');
  for (const f of ['aGB.json', 'GB.jsonx', 'GBR.json']) writeFileSync(join(root, SOURCES, f), '{}');
  return root;
}

describe('the youth compile, run', () => {
  const gb = { country: 'GB', figures: [{ item: 'companies', value: { directorMinimumAge: 16 } }], blockers: [] };
  const fr = { country: 'FR', figures: [{ item: 'minorsContracts', value: { setAside: { share: 0.9, to: 'the Caisse' } } }], blockers: [] };
  it('reads every country the register cites, checked against its SHA-256; one cited only by its blockers is read as unknown', () => {
    const root = fixture({ GB: gb, FR: fr }, { GB: { seat: 'GB.SCT' } }, { GB: 'both', FR: 'blocked' });
    expect(readYouth(root)).toEqual({ FR: unread('Europe/Paris'), GB: { ...unread('Europe/Edinburgh'), seat: 'GB.SCT', company: 16, reach: ['performer'] } });
    expect(readResearch(root, JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')), 'FR')).toBeNull();
  });

  it('refuses research the register doesn\'t cite, a file that isn\'t the one cited or another country\'s, and a reading without research', () => {
    expect(() => readYouth(fixture({ GB: gb }, {}, { GB: 'wrong' }))).toThrow(`${SOURCES}/GB.json isn't the file the register cites`);
    const none = fixture({ GB: gb }, {}, { GB: 'found' });
    writeFileSync(join(none, 'research/register.json'), JSON.stringify({ entries: [{ fact: `${BLOCKED}DE` }] }));
    expect(() => readYouth(none)).toThrow(`${SOURCES}/GB.json isn't cited by the register`);
    expect(() => readYouth(fixture({ GB: { ...gb, country: 'FR' } }, {}, { GB: 'found' }))).toThrow(`${SOURCES}/GB.json is FR's`);
    expect(() => readYouth(fixture({ GB: gb }, { DE: {} }, { GB: 'found' }))).toThrow('DE has a reading and no research');
    expect(() => readYouth(fixture({ FR: fr }, { FR: { seat: 'FR.11' } }, { FR: 'blocked' }))).toThrow('FR has a reading, and no research the register cites');
    expect(() => readYouth(fixture({ GB: gb }, { GB: 'x' }, { GB: 'found' }))).toThrow('the reading of GB is not an object');
    expect(() => readYouth(fixture({ GB: gb }, [] as never, { GB: 'found' }))).toThrow('the readings is not an object');
    expect(() => readYouth(fixture({ GB: gb }, { GB: { age: 1 } }, { GB: 'found' }))).toThrow("GB: GB's reading names age, which the game doesn't read");
    expect(readYouth(fixture({ FR: fr }, { FR: {} }, { FR: 'blocked' }))).toEqual({ FR: unread('Europe/Paris') });
    const bare = fixture({ FR: fr }, {}, { FR: 'blocked' });
    writeFileSync(join(bare, 'research/register.json'), JSON.stringify({ entries: [{ fact: `${FACT}FR` }, { fact: `${BLOCKED}FR` }] }));
    expect(readYouth(bare)).toEqual({ FR: unread('Europe/Paris') });
    let cause: unknown;
    try {
      readYouth(fixture({ GB: gb }, { GB: { age: 1 } }, { GB: 'found' }));
    } catch (e) {
      cause = (e as Error).cause;
    }
    expect((cause as Error).message).toBe("GB's reading names age, which the game doesn't read");
  });

  it('rows every country of the map from the register', () => {
    const rows = (JSON.parse(coverageOf(ROOT)) as { rows: { key: string; status: string; register?: string[] }[] }).rows;
    const countries = Object.keys(JSON.parse(readFileSync(join(ROOT, 'src/world/gazetteer/countries.json'), 'utf8')) as object);
    expect(rows.map((r) => r.key)).toEqual(countries);
    const ids = new Map((JSON.parse(readFileSync(join(ROOT, 'research/register.json'), 'utf8')) as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id]));
    // Antarctica has no place of its own: proven, its research's own finding still cited.
    expect(rows.find((r) => r.key === 'AQ')).toEqual({ key: 'AQ', status: 'proven', register: [ids.get(`${FACT}AQ`)], tests: [NO_PLACES] });
    expect(rows.find((r) => r.key === 'GB')).toEqual({ key: 'GB', status: 'blocked', register: [ids.get(`${BLOCKED}GB`), ids.get(`${FACT}GB`)], tests: [...TESTS, TOLD] });
    expect(rows.find((r) => r.key === 'KE')).toEqual({ key: 'KE', status: 'blocked', register: [ids.get(`${BLOCKED}KE`)], tests: [...TESTS, TOLD] });
  });

  it('serializes one country to a line, as the engine reads it', () => {
    expect(serialize({ GB: EMPTY })).toBe(`${JSON.stringify({ countries: { GB: EMPTY } }, null, 1)}\n`);
  });

  it('is as built from the research', () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readYouth(ROOT)));
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});

describe('the youth coverage', () => {
  it('rows every country: proven with no place, blocked with its blocker, researched with its research, else pending', () => {
    const facts = new Map([[`${FACT}GB`, 'R-1'], [`${FACT}FR`, 'R-2'], [`${BLOCKED}FR`, 'R-3'], [`${BLOCKED}KE`, 'R-4'], [`${BLOCKED}BV`, 'R-5'], [`${FACT}HM`, 'R-6']]);
    expect(youthCoverage(['AQ', 'BV', 'HM', 'GB', 'FR', 'KE', 'DE'], new Set(['GB', 'FR', 'KE', 'DE']), facts)).toEqual([
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      { key: 'BV', status: 'proven', register: ['R-5'], tests: [NO_PLACES] },
      { key: 'HM', status: 'proven', register: ['R-6'], tests: [NO_PLACES] },
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-3', 'R-2'], tests: [...TESTS, TOLD] },
      { key: 'KE', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'DE', status: 'pending' },
    ]);
    expect(COVERAGE).toBe('coverage/youth-countries.json');
    expect(TESTS).toEqual(["tests/person/youth/youth.test.ts::the youth rules > are each country's own, as the research gives them", "tests/person/youth/youth.test.ts::a minor's work > is engaged, limited and paid as the work's country's law says"]);
    expect(TOLD).toBe("tests/person/youth/youth.test.ts::the youth rules > tell the player what of a country's rules isn't known");
    expect(serializeCoverage([{ key: 'DE', status: 'pending' }])).toBe(`${JSON.stringify({ engine: 'person.youth', axis: 'country', rows: [{ key: 'DE', status: 'pending' }] }, null, 1)}\n`);
  });
});
