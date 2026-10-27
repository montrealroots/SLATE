/**
 * SLATE — Creating a universe.
 *
 * One save is one world. Everything below builds that world from the character
 * creation choices: the person, their accounts, where they live, what they
 * owe, and the surrounding world that was already running before they
 * arrived.
 */

import type { Person, Personality, SaveMeta, SaveUniverse } from '../domain/model';
import { SAVE_SCHEMA_VERSION } from '../domain/model';
import { CITIES, COUNTRIES, countryOfPlace } from '../content/geography';
import { exchange, hasRate } from '../content/currency';
import { DEFAULT_LEDGER_CURRENCY } from '../core/money';
import { instantFromZoned, MS_DAY } from '../core/time';
import type { Money } from '../core/money';
import { idAlreadyIssued } from '../core/ids';
import { ETHNICITY_BY_ID } from '../content/ethnicity';
import { GENRE_BY_ID } from '../content/film-genres';
import { ceilingAt } from '../content/lifespan';
import { ENGLISH_ONLY, cleanLanguages, type SpokenLanguage } from '../content/languages';

/** The ids on a list this build recognises, deduplicated, in the order given. */
function known(ids: readonly string[] | undefined, table: Readonly<Record<string, unknown>>): string[] {
  return [...new Set((ids ?? []).filter((id) => table[id] !== undefined))];
}
import { freshWellbeing } from '../systems/life';
import { citizenshipFor, citizenshipOf } from '../domain/citizenship';
import { cleanPersonality, cleanPersonalityTraits, defaultPersonality } from '../systems/personality';
import { ORIENTATION_2026, YALE_DRAMA, needFor } from '../content/school';
import { PERFORMER_NOUN, impliedPerformerTitle, isPerformerTitle, type PerformerTitle } from '../core/performer';
import { drawnBody, settle } from '../systems/body';

import { APP_VERSION } from '../version';
export { APP_VERSION };

// ---------------------------------------------------------------------------
// Character creation input
// ---------------------------------------------------------------------------

export type StartingWealth = 'nothing' | 'scraping' | 'modest' | 'comfortable' | 'wealthy' | 'inherited';
export interface NewSaveConfig {
  /** Identity */
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;
  pronouns: string;
  /**
   * Actor or actress. Settled by the pronouns where they settle it, and the
   * player's pick under they/them. Absent, the pronouns decide.
   */
  performerTitle?: PerformerTitle;
  /** Height and weight as the player gives them, in centimetres and kilograms; absent, drawn from where they were born (`systems/body.ts`). */
  /** Height and weight as given at creation, both inside `BODY_GIVEN`; otherwise the body is drawn. */
  heightCm?: number;
  weightKg?: number;
  /** Local date of birth in the starting city's zone. */
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  /**
   * Who the character is. More than one can be true, so it is a set, and it
   * carries nothing mechanical — see `content/ethnicity.ts`.
   */
  raceEthnicity: readonly string[];
  /** Said in their own words, when the list does not have it. */
  raceEthnicityOwn?: string;
  homeRegionId: string;
  /**
   * The country they're a citizen of, chosen on Identity (from 2026-10-24, brief 27): the place of birth suggests one
   * and decides none. Absent on a life a test or a tool makes, which takes the birthplace's (`citizenshipOf`).
   */
  citizenshipId?: string;
  // `livesWhereBorn`, whether they still lived where they were born, was form state here until 2026-10-24 (brief 27):
  // Place Of Birth carried the home town with it while it was true and Starting Point's I Still Live Where I Was Born set
  // it, but both read it only for a life outside the School, which creation never begins, and the engine never read it
  // (found by brief 20 on 2026-10-21, `create.livesWhereBorn`, left Blocked for the owner until brief 27 said to resolve
  // it). Where a life outside the School still needs it, it is whether `startLocationId` is `homeRegionId`; where a life
  // at the School lived before it is Before Yale's `priorResidence`, the player's own words.
  /** Headshot as a data URL, already fitted to the portrait frame. */
  portrait?: string;

  /** Dispositions & Traits: seven dispositions, and up to four traits that cost. */
  personality: Personality;
  personalityTraits: string[];

  /** Genres & Background. The interests were asked here too until 2026-10-10. */
  /** Genres they love: a rehearsal or a night of a play of the kind is a better day (`systems/enjoyment.ts`). */
  genres: string[];
  /**
   * The languages they speak, each with how well (from 2026-10-25, brief 27), asked with the genres and the background.
   * Absent on a life a test or a tool makes, which speaks English natively (`languagesOf`).
   */
  languages?: SpokenLanguage[];
  /** The life before this one, in their own words. Flavor, and said back to them. */
  background: string;
  // `beforeActing` (the body they started with, and the day job it led to)
  // and `dayJob` were asked here until 2026-09-26, when the job engine went.
  // Where they slept, a room in a shared flat or a place of their own, was asked here until the home went in the
  // scope reset of 2026-10-09.

  /**
   * Where the life begins: drama school (`content/school.ts`), which sets
   * the town and the day. Absent, the town and day chosen below.
   */
  school?: 'yale-drama';
  /**
   * The family they come from, as the need assessment reads it: a wealthy
   * family's means rule out need, so Yale's aid for living costs doesn't come
   * (`systems/school.ts`, `hasNeed`). Creation sets it from the family the
   * player chooses with their background (`familyOf`); until 2026-10-14 no
   * screen showed it, and every new life's was wealthy.
   */
  family?: 'wealthy';

  /** Starting point */
  startLocationId: string;
  wealth: StartingWealth;
  /** The bank they keep their money with, by id (`content/banks.ts`). Absent: the country's first. */
  bankId?: string;
  /**
   * Where they lived immediately before Yale, from a month and year to the day the life starts (from 2026-10-16,
   * Starting Point's Before Yale). Apart from the place of birth, which grants no account and is never read as a
   * residence. Absent: none said.
   */
  priorResidence?: { cityId: string; fromYear: number; fromMonth: number };
  /** The bank they kept an account at there, by id, where `homeAccountRefusal` (`systems/homeaccount.ts`) offers it. */
  homeBankId?: string;
  /** Their savings kept at the home bank (absent, or true) or moved to the American one (false). */
  savingsAtHome?: boolean;
  /** World start date, local to the starting city. */
  startYear: number;
  startMonth: number;
  startDay: number;

  /**
   * Whether the life begins with the guide (`world/tutorial.ts`): everything
   * shut but the first chapter, and the clock paused. The game's own new
   * saves do; a save made for a test or a tool doesn't unless it asks.
   */
  tutorial?: boolean;
  /** Whether the clock starts paused without the guide (from 2026-10-12: a life made with "I Know SLATE"). */
  paused?: boolean;
}

/**
 * Where a new save is born and lives until the player says otherwise.
 *
 * Mosfellsbær, outside Reykjavík, because that is where the family land was
 * and the land is what the rest of the defaults were built around. The land
 * is gone; the town is still a real one, and the screen asks for a different
 * one if the player wants it.
 */
export const DEFAULT_CITY_ID = 'is-39-mosfellsbr';

export function defaultConfig(): NewSaveConfig {
  return {
    firstName: 'Alex', lastName: 'Rivera', pronouns: 'they/them',
    birthYear: 2001, birthMonth: 6, birthDay: 14,
    raceEthnicity: [],
    homeRegionId: DEFAULT_CITY_ID,
    personality: defaultPersonality(), personalityTraits: [],
    genres: [],
    background: '',
    startLocationId: DEFAULT_CITY_ID,
    wealth: 'scraping',
    // Monday 5 January 2026, the first working Monday of the year.
    startYear: 2026, startMonth: 1, startDay: 5,
  };
}

/**
 * A config set to begin at drama school: the school's town, and the first
 * day of its fall term. What the player chose about the town and the day
 * gives way to the school's.
 */
export function atSchool(config: NewSaveConfig): NewSaveConfig {
  const begins = ORIENTATION_2026.begins;
  return {
    ...config,
    school: 'yale-drama',
    startLocationId: YALE_DRAMA.cityId,
    startYear: begins.year, startMonth: begins.month, startDay: begins.day,
  };
}

/**
 * The height and weight creation takes, in centimeters and kilograms: an adult's range, outside which the body is
 * drawn from where they were born. Creation says so where the fields are (from 2026-10-10: until then a figure
 * outside them, or one of the two left blank, was dropped without a word, and feet and inches reached 241 cm).
 */
export const BODY_GIVEN = { heightCm: [120, 230], weightKg: [35, 250] } as const;

/** Whether creation's height and weight are both given and both in range. */
export function bodyGiven(config: Pick<NewSaveConfig, 'heightCm' | 'weightKg'>): boolean {
  const { heightCm: h, weightKg: w } = config;
  return h !== undefined && w !== undefined && h >= BODY_GIVEN.heightCm[0] && h <= BODY_GIVEN.heightCm[1] && w >= BODY_GIVEN.weightKg[0] && w <= BODY_GIVEN.weightKg[1];
}

/**
 * The families a new life can come from, poorest first: the six starting-wealth levels, chosen on Genres & Background
 * (from 2026-10-14). Each sets the money in the bank on the first morning (`WEALTH_PROFILE`) and the means the need
 * assessment reads (`familyOf`).
 */
export const FAMILIES: readonly StartingWealth[] = ['nothing', 'scraping', 'modest', 'comfortable', 'wealthy', 'inherited'];

/**
 * The family the need assessment reads, for a starting wealth: a wealthy family's means, or an inheritance's, rule need
 * out; the four below them don't, and Yale finds need. SLATE's reading of the engine's one rule (`needFor`), which
 * knows a wealthy family and no other.
 */
export const familyOf = (wealth: StartingWealth): NewSaveConfig['family'] => (wealth === 'wealthy' || wealth === 'inherited' ? 'wealthy' : undefined);

/** A config with its family chosen: the money and the means together, so the two can't disagree. */
export const withFamily = (config: NewSaveConfig, wealth: StartingWealth): NewSaveConfig => ({ ...config, wealth, family: familyOf(wealth) });

/**
 * A new life in the game: beginning at drama school, from the family the player chooses, a wealthy one unless they
 * choose another (the one every new life had until 2026-10-14, when the choice came to creation), with the family's
 * money behind them in the bank. The birthplace is the player's to choose, and none is chosen for them (until
 * 2026-09-26 it was New York). The engine's `defaultConfig` stays where it was for saves made by tests and tools, which
 * choose their own town and day.
 */
export function newLifeConfig(): NewSaveConfig {
  // English, natively, until the player says otherwise on Genres & Background (from 2026-10-25, brief 27).
  return atSchool(withFamily({ ...defaultConfig(), homeRegionId: '', birthYear: 2002, languages: ENGLISH_ONLY.map((l) => ({ ...l })) }, 'wealthy'));
}

/**
 * A draft carried back into a new life: what the player chose, at the school, with the family the draft chose and the
 * means that family has. A draft naming no family the game knows comes back wealthy. Until 2026-10-14 every draft came
 * back wealthy, whatever it said.
 */
export function newLifeFrom(draft: Partial<NewSaveConfig>): NewSaveConfig {
  const wealth = FAMILIES.includes(draft.wealth as StartingWealth) ? draft.wealth! : newLifeConfig().wealth;
  // A draft kept before 2026-10-24 may carry `livesWhereBorn`; it's left behind with the field.
  const { livesWhereBorn: _gone, ...kept } = draft as Partial<NewSaveConfig> & { livesWhereBorn?: boolean };
  return atSchool(withFamily({ ...newLifeConfig(), ...kept }, wealth));
}

/**
 * Whether the player picks what they start with on Starting Point: only in a life outside the school, which a test or a
 * tool makes. A life at the school has it from the family chosen with the background. Until 2026-10-14 this read
 * whether a family was set, which every new life's was.
 */
export const choosesWealth = (config: NewSaveConfig) => config.school === undefined;

/** Whether the school's need assessment would find need, by the rule `hasNeed` reads a person by (`needFor`). */
export const findsNeed = (config: NewSaveConfig) => needFor(config.family);

const WEALTH_PROFILE: Record<StartingWealth, { checking: Money; savings: Money; cardLimit: Money; cardBalance: Money; creditScore: number; note: string }> = {
  nothing: { checking: 40_00, savings: 0, cardLimit: 0, cardBalance: 0, creditScore: 520, note: 'Next to nothing to your name, and no savings behind it.' },
  scraping: { checking: 1_240_00, savings: 300_00, cardLimit: 1_500_00, cardBalance: -840_00, creditScore: 610, note: 'Getting by, with a card you’re carrying a balance on.' },
  modest: { checking: 4_800_00, savings: 6_500_00, cardLimit: 6_000_00, cardBalance: -420_00, creditScore: 690, note: 'A small cushion and clean credit.' },
  comfortable: { checking: 18_000_00, savings: 42_000_00, cardLimit: 20_000_00, cardBalance: 0, creditScore: 748, note: 'Genuinely comfortable, with room to take a risk.' },
  wealthy: { checking: 85_000_00, savings: 380_000_00, cardLimit: 60_000_00, cardBalance: 0, creditScore: 795, note: 'Money isn’t the constraint. Time and access are.' },
  inherited: { checking: 240_000_00, savings: 2_400_000_00, cardLimit: 150_000_00, cardBalance: 0, creditScore: 812, note: 'You didn’t earn this, and everyone in the room knows it.' },
};

export function wealthNote(wealth: StartingWealth): string {
  return WEALTH_PROFILE[wealth].note;
}

/**
 * The currency a save that starts in this town keeps its money in: its
 * country's, as a real account would be, or euros where SLATE has no rate for
 * that currency and so could not convert the starting money into it.
 */
export function currencyFor(cityId: string): string {
  const city = CITIES.get(cityId);
  const code = city ? COUNTRIES.get(city.countryId)?.currency : undefined;
  return code && hasRate(code) ? code.toUpperCase() : DEFAULT_LEDGER_CURRENCY;
}

/**
 * A starting-money profile in a save's currency, to the whole unit.
 *
 * The profiles are written in euros, the one currency every save used until
 * schema 89, and are converted at SLATE's rates: "Scraping" in Mosfellsbær is
 * 186,000 krónur in checking rather than 1,240 of a currency nobody there is
 * paid in.
 */
export function wealthIn(wealth: StartingWealth, currency: string): typeof WEALTH_PROFILE[StartingWealth] {
  const p = WEALTH_PROFILE[wealth];
  const convert = (cents: Money): Money => Math.round((exchange(cents, DEFAULT_LEDGER_CURRENCY, currency) ?? cents) / 100) * 100;
  return {
    ...p,
    checking: convert(p.checking),
    savings: convert(p.savings),
    cardLimit: convert(p.cardLimit),
    cardBalance: convert(p.cardBalance),
  };
}

// ---------------------------------------------------------------------------
// Universe construction
// ---------------------------------------------------------------------------

export function emptyUniverse(
  meta: SaveMeta, now: number, zone: string, playerId: string,
): SaveUniverse {
  return {
    meta,
    __idCounter: 0,
    now,
    homeZone: zone,
    currentZone: zone,
    playerId,
    people: {},
    accounts: {}, transactions: [],
    scheduled: [], decisions: {}, notifications: [],
    preferences: {
      timeSpeed: 'live',
    },
    counters: {},
  };
}

export interface BootstrapResult {
  universe: SaveUniverse;
  playerId: string;
}

/**
 * Builds the raw universe object. Systems are wired separately by
 * `createSimulation`, which then runs `populateWorld` to fill it in.
 */
export function createUniverse(slot: 1 | 2 | 3, seed: string, config: NewSaveConfig): BootstrapResult {
  const city = CITIES.require(config.startLocationId);
  // The citizenship chosen on Identity, or for a life made without one the birthplace's (`citizenshipOf`; until
  // 2026-10-24 it was always the birthplace's). A birthplace naming no real country cannot make a person, the same way a
  // home that is not on the map cannot, and nor can a citizenship nobody holds.
  if (!citizenshipFor(config.homeRegionId)) throw new Error(`No country has a place with the id ${config.homeRegionId}.`);
  const citizenshipId = citizenshipOf(config);
  if (!citizenshipId) throw new Error(`Nobody is a citizen of ${config.citizenshipId}.`);
  const zone = city.timeZone;
  const now = instantFromZoned(
    { year: config.startYear, month: config.startMonth, day: config.startDay, hour: 7, minute: 30 },
    zone,
  );

  const playerId = 'person_000001';
  // Stated where the player stated it. Where they said nothing, which the
  // creation screen never lets happen, their pronouns decide.
  const performerTitle = isPerformerTitle(config.performerTitle)
    ? config.performerTitle
    : impliedPerformerTitle(config.pronouns);

  const meta: SaveMeta = {
    id: `save_${slot}_${seed.slice(0, 8)}`,
    slot,
    schemaVersion: SAVE_SCHEMA_VERSION,
    createdAt: now,
    playtimeSeconds: 0,
    seed,
    characterName: `${config.firstName} ${config.lastName}`,
    portrait: config.portrait,
    careerLabel: PERFORMER_NOUN[performerTitle],
    locationLabel: city.name,
    worldDateLabel: '',
    netWorthLabel: '',
    appVersion: APP_VERSION,
    currency: currencyFor(config.startLocationId),
  };

  const universe = emptyUniverse(meta, now, zone, playerId);
  if (config.tutorial) universe.tutorial = { read: [] };
  if (config.tutorial || config.paused) universe.preferences.timeSpeed = 'paused';

  const birthInstant = instantFromZoned(
    { year: config.birthYear, month: config.birthMonth, day: config.birthDay, hour: 3 },
    zone,
  );

  const yearsOld = Math.max(0, (now - birthInstant) / (365.2425 * MS_DAY));

  const player: Person = {
    id: playerId,
    saveId: meta.id,
    isPlayer: true,
    firstName: config.firstName,
    middleName: config.middleName,
    lastName: config.lastName,
    displayName: config.displayName?.trim() || `${config.firstName} ${config.lastName}`,
    portrait: config.portrait,
    pronouns: config.pronouns,
    performerTitle,
    birthInstant,
    // Who they are, kept exactly as they said it. Only the player is asked,
    // and nothing reads it to decide anything.
    raceEthnicity: [...new Set((config.raceEthnicity ?? []).filter((id) => ETHNICITY_BY_ID[id]))],
    ...(config.raceEthnicityOwn?.trim() ? { raceEthnicityOwn: config.raceEthnicityOwn.trim() } : {}),
    homeRegionId: config.homeRegionId,
    citizenshipId,
    // Where they lived before, as they said it, from the first of the month they gave to this morning (from 2026-10-16).
    ...(config.priorResidence && countryOfPlace(config.priorResidence.cityId) ? {
      priorResidence: {
        cityId: config.priorResidence.cityId,
        since: instantFromZoned({ year: config.priorResidence.fromYear, month: config.priorResidence.fromMonth, day: 1, hour: 12 }, zone),
        until: now,
      },
    } : {}),
    ...(config.family ? { family: config.family } : {}),
    currentLocationId: config.startLocationId,
    // Inside the slider's range, and only traits that can be held together:
    // the screen enforces both, and a save built straight from the engine
    // gets the same person the screen would have made.
    personality: cleanPersonality(config.personality),
    personalityTraits: cleanPersonalityTraits(config.personalityTraits),
    // Cleaned by the same rule the engine reads them by, so what is written
    // and what is read can never drift apart.
    genres: known(config.genres, GENRE_BY_ID),
    // What they speak, cleaned by the rule creation holds the list to (`cleanLanguages`, from 2026-10-25), and absent
    // where nothing was said, which reads as English, natively.
    ...(config.languages ? { languages: cleanLanguages(config.languages) } : {}),
    // Kept as the player wrote it, and printed back on their own page. It
    // decides nothing, and the step says so; what they did before, beside it,
    // is the part that does.
    background: config.background,
    // An everyday body, no fitter than the age allows. Until 2026-09-26 what
    // they did before acting set it, from 40 at a desk to 80 for an athlete;
    // fifty was the default's, and every character's now.
    wellbeing: { ...freshWellbeing(), fitness: Math.min(freshWellbeing().fitness, ceilingAt(yearsOld).fitness) },
    // Up this morning, and charged for being awake from the moment the world
    // starts.
    awakeSince: now,
    // And last night is on record as ending then. Without it, the morning the
    // world starts in reads as the end of a night nobody has slept yet: a save
    // that starts before a sound sleeper would be up, and is skipped at once,
    // goes back to bed until the afternoon. With no night on record, its first
    // midnight also used to owe it one, and a player still up then saw their
    // character put to bed while they watched.
    lastSleptAt: now,
    // Woken owing nothing, as the world starts them.
    wokeWithDebt: 0,
    createdAt: now,
  };
  // Their height and weight as they gave them, the life they start with holding it (`settle`), and where they gave
  // none, drawn from where they were born (`drawnBody`). Until 2026-10-12 the drawn one waited for the first midnight
  // (`bodyOf`), so a workout on the first day burned calories nothing counted.
  player.body = bodyGiven(config)
    ? settle({ heightCm: config.heightCm!, weightKg: config.weightKg! }, player, now)
    : drawnBody(seed, player, now);
  universe.people[playerId] = player;
  idAlreadyIssued(universe, 'person', 1);

  return { universe, playerId };
}

