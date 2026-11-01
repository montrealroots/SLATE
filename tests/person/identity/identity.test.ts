import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { fromMajor } from '../../../src/core/money/money.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import {
  ageOf,
  ETHNICITIES,
  FAMILY,
  HEADSHOT_PRICE,
  IDENTITY_START,
  identifiesAs,
  inTheBusiness,
  languagesOf,
  LEVELS,
  makePerson,
  personOf,
  playingAge,
  PRONOUNS,
  sexOf,
  settledTitle,
  speaks,
  suggestedCitizenship,
  suggestedLanguages,
  takeHeadshot,
  TITLES,
  type IdentitySlice,
  type MakeArgs,
} from '../../../src/person/identity/identity.ts';
import { person } from '../../support/person.ts';
import { falsifyAny } from '../../support/falsify-core.ts';
import { ACCOUNT, minorIn, purse } from '../../support/purse.ts';

type Identity = { identity: IdentitySlice } & ReturnType<typeof purse>;
const SEED = '0123456789abcdef';
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * SECONDS_PER_DAY;
const NOW = day(2026, 11, 1) + 12 * 3600;

const ARGS: MakeArgs = {
  first: 'Ada',
  middle: '',
  last: 'Reyes',
  preferred: 'Ada Reyes',
  pronouns: 'she',
  billedAs: null,
  born: '2000-06-14',
  bornCountry: 'US',
  bornRegion: 'US.CA',
  citizenship: ['US'],
  languages: [{ lang: 'en', level: 'C2' }],
  ethnicity: [],
  grewUpCountry: 'US',
  grewUpRegion: 'US.CA',
  family: 'outside',
  portrait: true,
};

const life = (now = NOW): Life<Identity> => begin(SEED, now, { identity: structuredClone(IDENTITY_START), ...purse() });
const make = (over: Partial<MakeArgs> = {}, now = NOW) => dispatch(life(now), makePerson, { ...ARGS, ...over } as MakeArgs);
const made = (over: Partial<MakeArgs> = {}, now = NOW) => personOf(make(over, now).slices.identity);
const refused = (over: Partial<MakeArgs>, error: string, now = NOW) => expect(() => make(over, now), JSON.stringify(over)).toThrow(error);

describe('the person', () => {
  it('is held as the lists the engines read', () => {
    expect([PRONOUNS, TITLES, LEVELS]).toEqual([['he', 'she', 'they'], ['actor', 'actress'], ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']]);
    expect(ETHNICITIES).toEqual(['white', 'black', 'latino', 'asian', 'middle-eastern', 'south-asian', 'mixed', 'pacific-islander', 'native-american']);
    expect(FAMILY).toEqual(['outside', 'acting', 'directing', 'writing', 'producing', 'music']);
    expect(HEADSHOT_PRICE).toStrictEqual({ US: fromMajor('USD', '304') });
    expect(IDENTITY_START).toStrictEqual({ person: null, sessions: [] });
    expect(() => personOf(IDENTITY_START)).toThrow('the person is not made yet');
  });

  it('declares each command with what it reads and writes', () => {
    const index = commandIndex().filter((c) => c.id.startsWith('identity.'));
    expect(index).toEqual([
      { id: 'identity.make', reads: [], writes: ['identity'] },
      { id: 'identity.headshot', reads: [], writes: ['identity', 'accounts', 'ledger'] },
    ]);
  });
});

describe('identity.make', () => {
  it('makes the person from what the player gives, trimmed, with the headshot their photo is', () => {
    const l = make({ first: ' Ada ', middle: ' Maria ', last: ' Reyes', preferred: 'Ada Reyes ', citizenship: ['US', 'IE'], languages: [{ lang: 'en', level: 'C2' }, { lang: 'es', level: 'B1' }], ethnicity: ['latino', 'white'], family: 'acting', grewUpCountry: 'IE', grewUpRegion: '' });
    expect(l.slices.identity).toStrictEqual({
      person: {
        legal: { first: 'Ada', middle: 'Maria', last: 'Reyes' },
        preferred: 'Ada Reyes',
        pronouns: 'she',
        billedAs: 'actress',
        born: { date: '2000-06-14', country: 'US', region: 'US.CA' },
        citizenship: ['US', 'IE'],
        languages: [{ lang: 'en', level: 'C2' }, { lang: 'es', level: 'B1' }],
        ethnicity: ['latino', 'white'],
        grewUp: { country: 'IE', region: '' },
        family: 'acting',
        headshot: NOW,
      },
      sessions: [],
    });
    // The test person the other engines read is one this command makes.
    expect(made()).toStrictEqual(person({ headshot: NOW }));
    expect(made({ portrait: false }).headshot).toBeNull();
    // No middle name given is none.
    expect(made({ middle: null as never }).legal.middle).toBe('');
  });

  it('is made once', () => {
    expect(() => dispatch(make(), makePerson, ARGS)).toThrow('the person is made already');
  });

  it('lets the pronouns settle Billed As, and leaves it to the player under they/them', () => {
    expect([made({ pronouns: 'he' }).billedAs, made({ pronouns: 'she' }).billedAs]).toEqual(['actor', 'actress']);
    expect([made({ pronouns: 'he', billedAs: 'actor' }).billedAs, made({ pronouns: 'she', billedAs: 'actress' }).billedAs]).toEqual(['actor', 'actress']);
    expect([made({ pronouns: 'they', billedAs: 'actor' }).billedAs, made({ pronouns: 'they', billedAs: 'actress' }).billedAs]).toEqual(['actor', 'actress']);
    expect(made({ pronouns: 'they', billedAs: 'actor' }).pronouns).toBe('they');
    refused({ pronouns: 'they', billedAs: null }, 'they/them pronouns leave the billing to the player');
    refused({ pronouns: 'he', billedAs: 'actress' }, 'he pronouns bill a person as actor');
    refused({ pronouns: 'she', billedAs: 'actor' }, 'she pronouns bill a person as actress');
    refused({ pronouns: 'he', billedAs: 'star' as never }, "there's no title star");
    refused({ pronouns: 'it' as never }, "there are no pronouns it");
    // Billed As is the sex: an actor male, an actress female, they/them either.
    expect([sexOf(made({ pronouns: 'he' })), sexOf(made({ pronouns: 'she' })), sexOf(made({ pronouns: 'they', billedAs: 'actor' })), sexOf(made({ pronouns: 'they', billedAs: 'actress' }))]).toEqual(['male', 'female', 'male', 'female']);
  });

  it('needs every name but the middle one', () => {
    for (const v of ['', '   ', 7 as never]) {
      refused({ first: v }, 'a first name is needed');
      refused({ last: v }, 'a last name is needed');
      refused({ preferred: v }, 'the name you go by is needed');
    }
  });

  it('holds the places to the map, and each region to its country', () => {
    refused({ bornCountry: 'XX' }, "there's no country XX for the birthplace");
    refused({ grewUpCountry: 'XX' }, "there's no country XX for where you grew up");
    refused({ citizenship: ['US', 'XX'] }, "there's no country XX for the citizenship");
    refused({ bornRegion: 'GB.ENG' }, "GB.ENG isn't a region of US for the birthplace");
    refused({ grewUpRegion: 'US.XX' }, "US.XX isn't a region of US for where you grew up");
    const p = made({ bornCountry: 'GB', bornRegion: 'GB.ENG', grewUpRegion: '' });
    expect([p.born, p.grewUp]).toStrictEqual([{ date: '2000-06-14', country: 'GB', region: 'GB.ENG' }, { country: 'US', region: '' }]);
  });

  it("takes a birth date on the calendar, today's at the latest", () => {
    for (const d of ['2000-02-29', '2000-01-31', '2000-12-01', '1999-02-28', '2026-11-01', '2026-11-02']) expect(made({ born: d }).born.date, d).toBe(d);
    for (const d of ['2001-02-29', '2000-04-31', '2000-01-32', '2000-00-10', '2000-13-01', '2000-01-00', '2000-1-01', '2000-01-1', ' 2000-01-01', '2000-01-01 ', '20000-01-01', '2000/01/01', '']) refused({ born: d }, `${d} isn't a date`);
    for (const d of ['2026-11-03', '2026-12-01', '2027-01-01']) refused({ born: d }, `${d} is after today`);
    // Today is the day in Kiribati's Line Islands, fourteen hours ahead of UTC all year, written in two digits.
    const march = day(2026, 3, 5) - 14 * 3600;
    expect(made({ born: '2026-03-05' }, march).born.date).toBe('2026-03-05');
    expect(made({ born: '2026-03-05' }, march + SECONDS_PER_DAY - 1).born.date).toBe('2026-03-05');
    refused({ born: '2026-03-06' }, '2026-03-06 is after today', march + SECONDS_PER_DAY - 1);
    refused({ born: '2026-03-05' }, '2026-03-05 is after today', march - 1);
  });

  it('takes each citizenship, language and ethnicity once', () => {
    refused({ citizenship: [] }, 'a citizenship is needed');
    refused({ citizenship: ['US', 'IE', 'US'] }, 'a citizenship is given twice');
    refused({ languages: [] }, 'a language is needed');
    refused({ languages: [{ lang: 'en', level: 'C2' }, { lang: 'en', level: 'A1' }] }, 'a language is given twice');
    refused({ ethnicity: ['black', 'black'] }, 'an ethnicity is given twice');
    refused({ ethnicity: ['martian'] }, "there's no ethnicity martian");
    expect(made({ ethnicity: [...ETHNICITIES] }).ethnicity).toEqual([...ETHNICITIES]);
    refused({ family: 'circus' }, "there's no family trade circus");
    for (const f of FAMILY) expect(made({ family: f }).family).toBe(f);
  });

  it('takes a language CLDR names, at a CEFR level', () => {
    for (const lang of ['xx', 'constructor', 'toString', 'und']) refused({ languages: [{ lang, level: 'B1' }] }, `there's no language ${lang}`);
    for (const level of ['C3', 'a1', 'native', '']) refused({ languages: [{ lang: 'fr', level }] }, `there's no level ${level}`);
    expect(made({ languages: LEVELS.map((level, i) => ({ lang: ['en', 'fr', 'de', 'es', 'zh-Hant', 'gsw'][i] as string, level })) }).languages.map((l) => l.level)).toEqual([...LEVELS]);
  });

  it('bites: the birth date it holds is the playing age casting reads', () => {
    falsifyAny({
      feature: 'identity.make',
      claim: 'bites',
      says: 'A person born ten years later is made younger, and plays younger parts.',
      base: '2000-06-14',
      twin: '2010-06-14',
      outcome: (born: string) => playingAge(made({ born }), NOW, 'UTC'),
    });
  });
});

describe('identity.headshot', () => {
  const taken = (country: string, at = NOW + 3600) => {
    const l = make({ portrait: false });
    return dispatch({ ...l, frame: { ...l.frame, now: at } }, takeHeadshot, { account: ACCOUNT, country });
  };

  it('takes a new headshot, at the price a survey gives where it gives one', () => {
    const us = taken('US');
    expect(us.slices.identity.sessions).toStrictEqual([{ at: NOW + 3600, price: fromMajor('USD', '304') }]);
    expect(personOf(us.slices.identity).headshot).toBe(NOW + 3600);
    const gb = dispatch({ ...us, frame: { ...us.frame, now: NOW + 7200 } }, takeHeadshot, { account: ACCOUNT, country: 'GB' });
    expect(gb.slices.identity.sessions).toStrictEqual([{ at: NOW + 3600, price: fromMajor('USD', '304') }, { at: NOW + 7200, price: null }]);
    expect(personOf(gb.slices.identity).headshot).toBe(NOW + 7200);
    // The session is paid from the account named where its price is known; nothing where it isn't.
    expect([minorIn(us.slices.ledger, ACCOUNT), minorIn(gb.slices.ledger, ACCOUNT), minorIn(gb.slices.ledger, 'world:photographer:USD')]).toEqual([100_000_000 - 30_400, 100_000_000 - 30_400, 30_400]);
    const broke = make({ portrait: false });
    expect(() => dispatch({ ...broke, frame: { ...broke.frame, now: NOW + 3600 }, slices: { ...broke.slices, ...purse('USD', 30_399) } }, takeHeadshot, { account: ACCOUNT, country: 'US' })).toThrow("everyday:1 can't cover a headshot session");
    expect(() => taken('XX')).toThrow("there's no country XX for the session");
    expect(() => dispatch(life(), takeHeadshot, { account: ACCOUNT, country: 'US' })).toThrow('the person is not made yet');
  });

  it("bites: the session's market is the price the life pays", () => {
    falsifyAny({
      feature: 'identity.headshot',
      claim: 'bites',
      says: 'A session in the US is at its surveyed price; one elsewhere has none the game knows.',
      base: 'US',
      twin: 'GB',
      outcome: (country: string) => taken(country).slices.identity.sessions.map((s) => s.price),
    });
    falsifyAny({
      feature: 'identity.headshot',
      claim: 'bites',
      says: 'A person with no photo has no headshot until a session gives one.',
      base: false,
      twin: true,
      outcome: (session: boolean) => personOf((session ? taken('GB') : make({ portrait: false })).slices.identity).headshot,
    });
  });
});

describe("what the person's fields give", () => {
  const p = person();

  it('gives the age on a day where the person is, a year more from the birthday on', () => {
    const eve = day(2026, 6, 13);
    expect([ageOf(p, eve, 'UTC'), ageOf(p, eve + SECONDS_PER_DAY - 1, 'UTC'), ageOf(p, eve + SECONDS_PER_DAY, 'UTC')]).toEqual([25, 25, 26]);
    // 20:00 UTC on the eve is the birthday in Tokyo already.
    expect([ageOf(p, eve + 20 * 3600, 'UTC'), ageOf(p, eve + 20 * 3600, 'Asia/Tokyo')]).toEqual([25, 26]);
    expect([ageOf(p, day(2026, 5, 20), 'UTC'), ageOf(p, day(2026, 7, 1), 'UTC'), ageOf(p, day(2000, 6, 14), 'UTC')]).toEqual([25, 26, 0]);
  });

  it('gives the playing age: five years either way, one under 18, never below nothing', () => {
    const at = (born: string) => playingAge(person({ born: { date: born, country: 'US', region: '' } }), NOW, 'UTC');
    expect([at('2009-11-01'), at('2008-11-01'), at('2008-11-02'), at('2000-06-14')]).toEqual([[16, 18], [13, 23], [16, 18], [21, 31]]);
    expect([at('2026-11-01'), at('2025-11-01'), at('2024-11-01')]).toEqual([[0, 1], [0, 2], [1, 3]]);
  });

  it('reads a language by its base subtag, at a level or better', () => {
    const q = person({ languages: [{ lang: 'en', level: 'C2' }, { lang: 'fr', level: 'B1' }, { lang: 'zh-Hant', level: 'A2' }] });
    expect([speaks(q, 'en', 'C2'), speaks(q, 'en-GB', 'A1'), speaks(q, 'de', 'A1')]).toEqual([true, true, false]);
    expect(LEVELS.map((l) => speaks(q, 'fr-CA', l))).toEqual([true, true, true, false, false, false]);
    expect(LEVELS.map((l) => speaks(q, 'zh', l))).toEqual([true, true, false, false, false, false]);
  });

  it('reads an ethnicity the person gives, and a family in the business', () => {
    const q = person({ ethnicity: ['black', 'latino'], family: 'directing' });
    expect([identifiesAs(q, 'black'), identifiesAs(q, 'latino'), identifiesAs(q, 'asian'), identifiesAs(p, 'white')]).toEqual([true, true, false, false]);
    expect([inTheBusiness(q), inTheBusiness(p)]).toEqual(['directing', null]);
  });

  it("gives a place's languages most spoken first, and none where CLDR has none", () => {
    expect(languagesOf('NZ')).toStrictEqual([{ lang: 'en', share: 98, official: true }, { lang: 'mi', share: 2.8, official: true }]);
    expect(languagesOf('US').slice(0, 2)).toStrictEqual([{ lang: 'en', share: 96, official: true }, { lang: 'es', share: 9.6, official: true }]);
    for (const c of ['AN', 'CS', 'AQ', 'HM'] as const) expect(languagesOf(c), c).toEqual([]);
  });

  it('suggests the languages a tenth or more speak where one grew up, then where one was born, each once', () => {
    // es is 9.6% of the US, under the tenth; fr 29% of Canada.
    expect([suggestedLanguages('CA', 'US'), suggestedLanguages('US', 'CA')]).toEqual([['en', 'fr'], ['en', 'fr']]);
    expect([suggestedLanguages('PR', 'GB'), suggestedLanguages('GB', 'PR')]).toEqual([['en', 'fr', 'es'], ['es', 'en', 'fr']]);
    // A tenth exactly (Sri Lanka's English) is suggested; 9.9% (Azerbaijan's Cyrillic Azerbaijani) isn't.
    expect(languagesOf('LK').find((l) => l.lang === 'en')?.share).toBe(10);
    expect(suggestedLanguages('LK', 'LK')).toContain('en');
    expect(languagesOf('AZ').find((l) => l.lang === 'az-Cyrl')?.share).toBe(9.9);
    expect(suggestedLanguages('AZ', 'AZ')).not.toContain('az-Cyrl');
    expect(suggestedLanguages('AQ', 'AN')).toEqual([]);
  });

  it('suggests the citizenship the birthplace gives, and the title the pronouns settle', () => {
    expect((['US', 'PR', 'HK', 'GB'] as const).map(suggestedCitizenship)).toEqual(['US', 'US', 'CN', 'GB']);
    expect(suggestedCitizenship('AN')).toBeUndefined();
    expect(PRONOUNS.map(settledTitle)).toEqual(['actor', 'actress', null]);
  });
});

describe('the line for the game\'s own figures', () => {
  it("tells the player its own figures are the game's", async () => {
    const { MODEL_LINE } = await import('../../../src/person/identity/identity.ts');
    const { t } = await import('../../../src/core/text/text.ts');
    expect(MODEL_LINE).toBe('identity.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own");
  });
});
