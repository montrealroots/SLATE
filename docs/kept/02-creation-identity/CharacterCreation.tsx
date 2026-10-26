/**
 * SLATE — character creation.
 *
 * Identity, Dispositions & Traits, Genres & Background, Starting Point and
 * Review, then Begin. The third step was Interests & Background until
 * 2026-10-10, when the owner removed the interests and the question with them.
 * Progress is written to a draft on every change, so a closed tab or a dropped
 * connection never costs the setup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Slot } from '@/engine/persistence/adapter';
import {
  APP_VERSION, BODY_GIVEN, FAMILIES, bodyGiven, choosesWealth, currencyFor, findsNeed, newLifeConfig, newLifeFrom, wealthIn, wealthNote, withFamily,
  type NewSaveConfig, type StartingWealth,
} from '@/engine/world/bootstrap';
import { LocationPicker } from './LocationPicker';
import { PortraitPicker } from './PortraitPicker';
import {
  CITIES, COUNTRIES, REGIONS, countryOfPlace, isCountryLoaded, loadCountryCities,
} from '@/engine/content/geography';
import type { City } from '@/engine/content/geography';
import { RATES_NOTE } from '@/engine/content/currency';
import { foodAt } from '@/engine/systems/spending';
import { CARRIES_A_BALANCE, scoreIsANumberIn, scoreWord } from '@/engine/systems/credit';
import { formatMoney } from '@/engine/core/money';
import { banksFor, startingBank } from '@/engine/systems/banking';
import { banksIn } from '@/engine/content/banks';
import { feesToGraduation, homeAccountRefusal, homeBankOf, isoOfPlace, splitOf, whatFollows, type Split } from '@/engine/systems/homeaccount';
import { OPENING } from '@/engine/content/bankopening';
import { SAVE_SCHEMA_VERSION } from '@/engine/domain/model';
import { formatPeople } from '@/engine/world/place';
import { ageOnDate, formatDate, instantFromZoned, zoneAbbreviation } from '@/engine/core/time';
import { citizenshipFor, citizenshipOf, citizenships, isCitizenship } from '@/engine/domain/citizenship';
import {
  ETHNICITIES, ETHNICITY_NOTE, ETHNICITY_OTHER, describeEthnicity,
} from '@/engine/content/ethnicity';
import { FILM_GENRES, type Genre } from '@/engine/content/film-genres';
import { genresRead } from '@/engine/systems/enjoyment';
import { PERFORMER_NOUN, PERFORMER_TITLES, settledTitle, type PerformerTitle } from '@/engine/core/performer';
import type { Personality } from '@/engine/domain/model';
import {
  MAX_PERSONALITY_TRAITS, PERSONALITY_GROUPS, PERSONALITY_TRAIT_BY_ID,
  conflictingPersonalityTraits, personalityTraitPairs,
} from '@/engine/content/personality-traits';
import { AXIS_MAX, AXIS_MIN, personalityOf } from '@/engine/systems/personality';
import { YALE_DRAMA } from '@/engine/content/school';
import { termAccount } from '@/engine/systems/school';
import { bodyUnits } from '@/engine/systems/body';
import { outOf, said } from '@/ui/looks/words';
import { spokenList } from '@/engine/core/text';
import {
  ENGLISH, ENGLISH_ONLY, LANGUAGES_MOST, LANGUAGE_LEVELS, LEVEL_LABEL, SPOKEN, languagesProblems, spokenName,
  type LanguageLevel, type SpokenLanguage,
} from '@/engine/content/languages';

/**
 * How far back the last year a character can be born in sits from the year
 * the save begins.
 *
 * The line is drawn on the year, not on the age. A birthday later in the year
 * than the start date leaves somebody seventeen when the save opens, and that
 * is fine: the picker and the rule say the same thing, which is that 2008 is
 * as recent as a birth year gets against a save that begins in 2026.
 */
export const BIRTH_YEARS_BEFORE_START = 18;

/**
 * The last year somebody can be born in and still start this save: eighteen
 * years before it begins, or twenty-one for a life that begins at drama
 * school, whose MFA asks for a bachelor's degree (`content/school.ts`).
 * Drawn on the year there too, for the same reason.
 */
export function latestBirthYear(config: Pick<NewSaveConfig, 'startYear' | 'school'>): number {
  return config.startYear - (config.school ? YALE_DRAMA.minimumAge : BIRTH_YEARS_BEFORE_START);
}

const STEPS = ['Identity', 'Dispositions & Traits', 'Genres & Background', 'Starting Point', 'Review'] as const;

/**
 * Which step is which, by name rather than by number.
 *
 * The numbers used to be written out in six places — the union type, both
 * arrows, the Continue test, and every branch of the form — so adding a step
 * meant finding all of them and one of them was always missed.
 */
const STEP = Object.fromEntries(STEPS.map((label, index) => [label, index])) as
  Record<typeof STEPS[number], number>;
const LAST_STEP = STEPS.length - 1;
type StepIndex = number;

const DRAFT_KEY = (slot: Slot) => `slate.draft.${slot}`;

const WEALTH: StartingWealth[] = ['nothing', 'scraping', 'modest', 'comfortable', 'wealthy', 'inherited'];
/**
 * A wealth level, or the family that has it, as a select and Review name it, in the words of its note (`WEALTH_PROFILE`).
 * Until 2026-10-19 (brief 15) the label was the id capitalized, so Review said "Family Nothing, Need Found".
 */
const WEALTH_LABEL: Record<StartingWealth, string> = {
  nothing: 'Next To Nothing', scraping: 'Scraping By', modest: 'Modest', comfortable: 'Comfortable', wealthy: 'Wealthy', inherited: 'Inherited Wealth',
};
const wealthLabel = (w: StartingWealth): string => WEALTH_LABEL[w];

/** The seven sliders, each with the word for either end. */
const PERSONALITY_AXES: { key: keyof Personality; label: string; low: string; high: string }[] = [
  { key: 'openness', label: 'Openness', low: 'Conventional', high: 'Experimental' },
  { key: 'conscientiousness', label: 'Conscientiousness', low: 'Loose', high: 'Meticulous' },
  { key: 'extraversion', label: 'Extraversion', low: 'Reserved', high: 'Outgoing' },
  { key: 'agreeableness', label: 'Agreeableness', low: 'Blunt', high: 'Accommodating' },
  { key: 'emotionalStability', label: 'Emotional Stability', low: 'Volatile', high: 'Steady' },
  { key: 'ambition', label: 'Ambition', low: 'Content', high: 'Driven' },
  { key: 'riskTolerance', label: 'Risk Tolerance', low: 'Cautious', high: 'Reckless' },
];

export function CharacterCreation({
  slot, onCancel, onStart,
}: {
  slot: Slot;
  onCancel: () => void;
  onStart: (config: NewSaveConfig) => void;
}) {
  const [step, setStep] = useState<StepIndex>(0);
  const [config, setConfig] = useState<NewSaveConfig>(() => loadDraft(slot) ?? newLifeConfig());
  const [restored] = useState(() => loadDraft(slot) !== null);

  // Persist on every change. Losing the page must not lose the setup.
  useEffect(() => { saveDraft(slot, config); }, [slot, config]);

  // A restored draft can name towns too small to be bundled. Fetch the
  // countries they belong to so the names, and the validation, come back:
  // the tick re-renders the step, and the validation below looks again.
  const [, setResolved] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const wanted = new Set(
      [config.startLocationId, config.homeRegionId]
        .map(countryOfPlace)
        .filter((id): id is string => id !== undefined && !isCountryLoaded(id)),
    );
    if (wanted.size === 0) return;
    void Promise.all([...wanted].map((id) => loadCountryCities(id).catch(() => 0)))
      .then(() => { if (!cancelled) setResolved((n) => n + 1); });
    return () => { cancelled = true; };
  }, [config.startLocationId, config.homeRegionId]);

  const set = useCallback(<K extends keyof NewSaveConfig>(key: K, value: NewSaveConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);

  // Worked out on every render, not memoized on the config: validate reads the
  // town registry, which a country arriving changes without the config
  // changing, and the tick above re-renders when one does.
  const issues = validate(config, step);
  const canAdvance = issues.length === 0;

  // Continue was at the foot of the last step, so without this the next step
  // opens at its foot too, and the player reads it backwards. Which ancestor
  // actually scrolls differs by layout — the body here, .main in the game —
  // so the top of the form is asked into view rather than any one container.
  const top = useRef<HTMLDivElement | null>(null);
  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); }, [step]);

  const start = () => {
    clearDraft(slot);
    onStart(config);
  };

  return (
    <div className="main" ref={top}>
      <div className="creation">
        <div className="row-between" style={{ marginBottom: 'var(--s5)' }}>
          <div className="row gap-2">
            <span role="img" aria-label="SLATE" style={{ fontSize: 22 }}>🎬</span>
            <div>
              <div className="eyebrow">Slot {slot}</div>
              <h1 style={{ fontSize: 'var(--size-lg)' }}>Who Are You Going To Be?</h1>
              <p className="muted small" style={{ marginTop: 2 }}>
                SLATE is a life simulator. Here you create the {billedAs(config).toLowerCase()} you’ll play.
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        </div>

        {restored && step === 0 && (
          <div className="callout callout-info" style={{ marginBottom: 'var(--s5)' }}>
            You’d started filling this in before, so it’s back the way you left it.
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'var(--s2)' }} onClick={() => setConfig(newLifeConfig())}>
              Start Over
            </button>
          </div>
        )}

        <div className="creation-steps" role="list">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className="creation-step"
              role="listitem"
              data-state={index === step ? 'active' : index < step ? 'done' : 'waiting'}
            >
              {/* Where a name wraps, it breaks after the ampersand, never before. */}
              {label.replace(' & ', '\u00A0& ')}
            </div>
          ))}
        </div>

        {step === STEP.Identity && <IdentityStep config={config} set={set} setConfig={setConfig} />}
        {step === STEP['Dispositions & Traits'] && <PersonalityStep config={config} setConfig={setConfig} />}
        {step === STEP['Genres & Background'] && <PersonalStep config={config} set={set} setConfig={setConfig} />}
        {step === STEP['Starting Point'] && <StartingPointStep config={config} set={set} setConfig={setConfig} />}
        {step === STEP.Review && <ReviewStep config={config} setConfig={setConfig} />}

        {issues.length > 0 && (
          <div className="callout callout-warning" style={{ marginTop: 'var(--s5)' }}>
            <ul style={{ margin: 0, paddingLeft: 'var(--s4)' }}>
              {issues.map((issue) => <li key={issue} className="small">{issue}</li>)}
            </ul>
          </div>
        )}

        <div className="row-between" style={{ marginTop: 'var(--s6)' }}>
          <button
            className="btn"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </button>

          {step < LAST_STEP ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep((s) => Math.min(LAST_STEP, s + 1))}
              disabled={!canAdvance}
            >
              Continue
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={start} disabled={!canAdvance}>
              Begin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * How old they are on the morning the save starts.
 *
 * Through the engine's own definition rather than subtracting years, which
 * was out by one for anybody whose birthday falls after the start date.
 */
function ageAtStart(config: NewSaveConfig): number {
  return ageOnDate(
    { year: config.birthYear, month: config.birthMonth, day: config.birthDay },
    { year: config.startYear, month: config.startMonth, day: config.startDay },
  );
}

/**
 * Height and weight, in the units of where they will live (`bodyUnits`, the rule the person look reads): feet, inches
 * and pounds in the United States, centimeters and kilograms everywhere else. The step comes after Identity, so a
 * birthplace is chosen by then, and with it, for a life outside the school, the town. Until 2026-10-14 these were the
 * units of where they were born, and a London-born student at Yale typed centimeters here and read feet on her own
 * page. Left blank, the body is drawn from the birth country's adult averages (`systems/body.ts`).
 */
function BodyFields({ config, setConfig }: { config: NewSaveConfig; setConfig: (f: (c: NewSaveConfig) => NewSaveConfig) => void }) {
  const { imperial } = bodyUnits(config.startLocationId);
  const cm = config.heightCm;
  const kg = config.weightKg;
  // Whole inches first, then feet and the inches over (from 2026-10-10: until then 9 feet read back as 8 feet 12 inches,
  // the centimeters' rounding falling just under the foot).
  const allInches = cm ? Math.round(cm / 2.54) : undefined;
  const feet = allInches !== undefined ? Math.floor(allInches / 12) : undefined;
  const inches = allInches !== undefined ? allInches % 12 : undefined;
  const feetAndInches = (n: number) => `${Math.floor(n / 12)}′${n % 12}″`;
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const setHeight = (value: number | undefined) => setConfig((c) => ({ ...c, heightCm: value && value > 0 ? Math.round(value * 10) / 10 : undefined }));
  const setWeight = (value: number | undefined) => setConfig((c) => ({ ...c, weightKg: value && value > 0 ? Math.round(value * 10) / 10 : undefined }));
  return (
    <>
      <div className="field-row">
        {imperial ? (
          <>
            <div className="field">
              <label htmlFor="height-ft">Height (Feet)</label>
              <input id="height-ft" type="number" min={4} max={7} value={feet ?? ''} onChange={(e) => { const f = num(e.target.value); setHeight(f === undefined ? undefined : (f * 12 + (inches ?? 0)) * 2.54); }} />
            </div>
            <div className="field">
              <label htmlFor="height-in">Inches</label>
              <input id="height-in" type="number" min={0} max={11} value={inches ?? ''} onChange={(e) => { const i = num(e.target.value) ?? 0; setHeight(((feet ?? 5) * 12 + i) * 2.54); }} />
            </div>
            <div className="field">
              <label htmlFor="weight-lb">Weight (Pounds)</label>
              <input id="weight-lb" type="number" min={80} max={550} value={kg ? Math.round(kg / 0.45359237) : ''} onChange={(e) => { const lb = num(e.target.value); setWeight(lb === undefined ? undefined : lb * 0.45359237); }} />
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="height-cm">Height (Centimeters)</label>
              <input id="height-cm" type="number" min={120} max={230} value={cm ?? ''} onChange={(e) => setHeight(num(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="weight-kg">Weight (Kilograms)</label>
              <input id="weight-kg" type="number" min={35} max={250} value={kg ?? ''} onChange={(e) => setWeight(num(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="bmi">Body Mass Index</label>
              <input id="bmi" type="text" readOnly value={cm && kg ? (kg / (cm / 100) ** 2).toFixed(1) : ''} placeholder="From height and weight" />
            </div>
          </>
        )}
      </div>
      {(cm !== undefined || kg !== undefined) && !bodyGiven(config) && (
        <p className="xs" role="status" style={{ marginTop: 'var(--s2)', color: 'var(--warning)' }}>
          {cm === undefined || kg === undefined
            ? 'Enter both, or neither. With only one, SLATE picks your height and weight at random, around the averages where you were born.'
            : imperial
              ? `That’s out of range, so SLATE will pick your height and weight instead. Use a height from ${feetAndInches(Math.ceil(BODY_GIVEN.heightCm[0] / 2.54))} to ${feetAndInches(Math.floor(BODY_GIVEN.heightCm[1] / 2.54))} and a weight from ${Math.ceil(BODY_GIVEN.weightKg[0] / 0.45359237)} to ${Math.floor(BODY_GIVEN.weightKg[1] / 0.45359237)} pounds.`
              : `That’s out of range, so SLATE will pick your height and weight instead. Use a height from ${BODY_GIVEN.heightCm[0]} to ${BODY_GIVEN.heightCm[1]} centimeters and a weight from ${BODY_GIVEN.weightKg[0]} to ${BODY_GIVEN.weightKg[1]} kilograms.`}
        </p>
      )}
      <p className="xs dim" style={{ marginTop: 'var(--s2)' }}>Leave them blank and SLATE picks them at random, around the averages where you were born.{imperial && cm && kg ? ` That’s a body mass index of ${(kg / (cm / 100) ** 2).toFixed(1)}.` : ''} Once you’re playing, your weight changes with what you eat and how active you are. A heavier body is more likely to develop diabetes, high blood pressure and arthritis over the years, at published rates, and a weight far from the middle either way makes a long life less likely.</p>
    </>
  );
}

/**
 * The word this character is billed with: settled by their pronouns where
 * their pronouns settle it, and otherwise the one they picked. Undefined only
 * while somebody on they/them has not picked yet, which the Identity step
 * will not let past.
 */
function titleOf(config: NewSaveConfig): PerformerTitle | undefined {
  return settledTitle(config.pronouns) ?? config.performerTitle;
}

/** The same, as a word, and both words while it is still open. */
function billedAs(config: NewSaveConfig): string {
  const title = titleOf(config);
  return title ? PERFORMER_NOUN[title] : 'Actor Or Actress';
}

type Setter = <K extends keyof NewSaveConfig>(key: K, value: NewSaveConfig[K]) => void;

/**
 * The citizenship chosen, by name, or nothing until one is (from 2026-10-24, brief 27: until then the country somebody
 * born where the config said was a citizen of, since creation didn't ask).
 */
export function citizenshipName(config: Pick<NewSaveConfig, 'citizenshipId'>): string | undefined {
  return isCitizenship(config.citizenshipId) ? COUNTRIES.get(config.citizenshipId!)?.name : undefined;
}

/** The citizenship a place of birth suggests, by id and name, for Same As Your Place Of Birth. */
export function suggestedCitizenship(config: Pick<NewSaveConfig, 'homeRegionId'>): { id: string; name: string } | undefined {
  const id = config.homeRegionId ? citizenshipFor(config.homeRegionId) : undefined;
  const name = id ? COUNTRIES.get(id)?.name : undefined;
  return id && name ? { id, name } : undefined;
}

/** Every citizenship a person can hold, by name, for the picker. */
const CITIZENSHIP_CHOICES = citizenships().map((id) => ({ id, name: COUNTRIES.get(id)!.name })).sort((a, b) => a.name.localeCompare(b.name));

function IdentityStep({ config, set, setConfig }: {
  config: NewSaveConfig;
  set: Setter;
  setConfig: React.Dispatch<React.SetStateAction<NewSaveConfig>>;
}) {
  const settled = settledTitle(config.pronouns);
  const suggested = suggestedCitizenship(config);

  return (
    <div className="card">
      <div className="panel-head">
        <div>
          <h2>Identity</h2>
          <p className="muted small">Your legal name is the one on your documents. What people call you can be different.</p>
        </div>
      </div>

      <div className="identity-top">
        <PortraitPicker
          portrait={config.portrait}
          name={[config.firstName, config.lastName].filter(Boolean).join(' ')}
          onChange={(portrait) => set('portrait', portrait)}
        />

        <div className="identity-fields">
          <div className="field-row">
            <div className="field">
              <label htmlFor="first">First Name</label>
              <input id="first" type="text" value={config.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="middle">Middle Name (Optional)</label>
              <input id="middle" type="text" value={config.middleName ?? ''} onChange={(e) => set('middleName', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="last">Last Name</label>
              <input id="last" type="text" value={config.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="display">Preferred Name</label>
              <input
                id="display" type="text"
                placeholder={`${config.firstName} ${config.lastName}`}
                value={config.displayName ?? ''}
                onChange={(e) => set('displayName', e.target.value)}
              />
              <p className="xs dim" style={{ marginTop: 4 }}>What people actually call you day to day.</p>
            </div>
            <div className="field">
              <label htmlFor="pronouns">Pronouns</label>
              <select
                id="pronouns"
                value={config.pronouns}
                onChange={(e) => {
                  const pronouns = e.target.value;
                  // The title is written into the config, so it has to move
                  // with the pronouns: settled where they settle it, and
                  // cleared where they do not, so a pick made under they/them
                  // cannot survive behind he/him.
                  setConfig((c) => ({ ...c, pronouns, performerTitle: settledTitle(pronouns) }));
                }}
              >
                <option value="she/her">She/Her</option>
                <option value="he/him">He/Him</option>
                <option value="they/them">They/Them</option>
              </select>
            </div>
          </div>

          {/* A row of its own: beside the pronouns it wraps into half a
              column, and the note under it runs eight lines deep. */}
          <div className="field-row">
            <div className="field">
              <span className="label" id="billed-as">Billed As</span>
              {settled ? (
                <>
                  <output className="settled-title" htmlFor="pronouns" aria-labelledby="billed-as">{PERFORMER_NOUN[settled]}</output>
                  <p className="xs dim" style={{ marginTop: 4 }}>
                    Your pronouns decide this, so there’s nothing to pick. Change your pronouns and it
                    changes too.
                  </p>
                </>
              ) : (
                <>
                  <div className="row gap-2" role="group" aria-label="Billed As">
                    {PERFORMER_TITLES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="trait grow"
                        aria-pressed={config.performerTitle === option}
                        onClick={() => set('performerTitle', option)}
                      >
                        <div className="trait-name">{PERFORMER_NOUN[option]}</div>
                      </button>
                    ))}
                  </div>
                  <p className="xs dim" style={{ marginTop: 4 }}>
                    With They/Them, you choose. Actor and Actress are two words for the same craft, and neither
                    counts for more. The game calls you by the one you pick, and at school you’re cast in parts
                    written for it, or for anyone.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <hr className="divider" />

      <div className="field">
        <span className="label">Race Or Ethnicity (Optional)</span>
        <div className="trait-grid" role="group" aria-label="Race Or Ethnicity">
          {ETHNICITIES.map((one) => {
            const on = config.raceEthnicity.includes(one.id);
            return (
              <button
                key={one.id}
                type="button"
                className="trait"
                aria-pressed={on}
                onClick={() => set(
                  'raceEthnicity',
                  on
                    ? config.raceEthnicity.filter((id) => id !== one.id)
                    : [...config.raceEthnicity, one.id],
                )}
              >
                <div className="trait-name">{one.label}</div>
              </button>
            );
          })}
        </div>
        {config.raceEthnicity.includes(ETHNICITY_OTHER) && (
          <div className="field" style={{ marginTop: 'var(--s3)' }}>
            <label htmlFor="ethnicity-own">In Your Own Words</label>
            <input
              id="ethnicity-own" type="text"
              placeholder="However you’d say it"
              value={config.raceEthnicityOwn ?? ''}
              onChange={(e) => set('raceEthnicityOwn', e.target.value)}
            />
          </div>
        )}
        <p className="xs dim" style={{ marginTop: 'var(--s2)' }}>{ETHNICITY_NOTE}</p>
      </div>

      <hr className="divider" />

      <div className="field-row">
        <div className="field">
          <label htmlFor="birth-year">Year Of Birth</label>
          <input
            id="birth-year" type="number" min={1940} max={latestBirthYear(config)}
            value={config.birthYear}
            onChange={(e) => set('birthYear', Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="birth-month">Month</label>
          <select id="birth-month" value={config.birthMonth} onChange={(e) => set('birthMonth', Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="birth-day">Day</label>
          <input
            id="birth-day" type="number" min={1} max={daysInMonth(config.birthYear, config.birthMonth)}
            value={config.birthDay}
            onChange={(e) => set('birthDay', Number(e.target.value))}
          />
        </div>
      </div>

      {/* Height and weight were asked here until 2026-10-10, when the owner moved them to Starting Point. */}

      <hr className="divider" />

      <div className="panel-head">
        <div>
          <h3>Place Of Birth</h3>
          <p className="muted small">
            Where you were born, which isn’t always where you live now. It’s what you tell people when they
            ask. It doesn’t decide your citizenship or where you lived before Yale: you say those yourself.
          </p>
        </div>
      </div>

      <LocationPicker
        idPrefix="born"
        cityId={config.homeRegionId}
        // Where you were born. A life outside the School that lived there carries Where You Live with it, read from the
        // two places themselves (until 2026-10-24 from `livesWhereBorn`, retired by brief 27).
        onPick={(picked) => setConfig((c) => (c.school
          ? { ...c, homeRegionId: picked.id }
          : { ...c, homeRegionId: picked.id, ...(c.startLocationId === c.homeRegionId ? { startLocationId: picked.id } : {}) }))}
      />

      {/* Asked from 2026-10-24 (brief 27): until then the place of birth decided it and this said so back. */}
      <div className="field" style={{ marginTop: 'var(--s4)' }}>
        <label htmlFor="citizenship">Citizenship</label>
        <select
          id="citizenship"
          value={isCitizenship(config.citizenshipId) ? config.citizenshipId : ''}
          onChange={(e) => setConfig((c) => ({ ...c, citizenshipId: e.target.value || undefined }))}
        >
          <option value="">Choose A Country</option>
          {CITIZENSHIP_CHOICES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {suggested && suggested.id !== config.citizenshipId && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--s2)' }} onClick={() => set('citizenshipId', suggested.id)}>
            Same As Your Place Of Birth: {suggested.name}
          </button>
        )}
        <p className="xs dim" style={{ marginTop: 4 }}>
          The country whose citizen you are. It decides the passport you start with, whether you need a visa and
          permission to work in America, how America taxes you, and which banks keep an account for you.
        </p>
        {suggested?.id === 'us' && isCitizenship(config.citizenshipId) && config.citizenshipId !== 'us' && (
          <p className="xs" style={{ marginTop: 4 }}>
            Nearly everyone born in the United States is a US citizen from birth (the Fourteenth Amendment). Choose
            another country only if that’s true of you.
          </p>
        )}
      </div>

      <div className="callout">
        You’ll be <strong>{ageAtStart(config)}</strong> when you start.
      </div>
    </div>
  );
}

/** A place written the way somebody would say it out loud. */
function placeLine(city: City): string {
  const region = REGIONS.get(city.parentId)?.name;
  const country = COUNTRIES.get(city.countryId)?.name;
  return [city.name, region, region === country ? undefined : country]
    .filter(Boolean).join(', ');
}

/**
 * A place as Review's summary writes it: the town and the country. The full
 * line, region included, is on the steps that chose it; on Review it ran too
 * long for the Starting Point card and broke over two lines.
 */
function shortPlace(city: City): string {
  const country = COUNTRIES.get(city.countryId)?.name;
  return [city.name, country === city.name ? undefined : country].filter(Boolean).join(', ');
}

/**
 * Why a trait can't be picked right now, or undefined when it can, or is
 * already held and can be put down. A trait it clashes with comes first,
 * because putting one of those down is the way to it; being full comes second.
 */
export function blockedTraitReason(held: readonly string[], id: string): string | undefined {
  if (held.includes(id)) return undefined;
  const conflicts = conflictingPersonalityTraits(held, id);
  if (conflicts.length > 0) {
    return `It clashes with ${spokenList(conflicts.map((c) => PERSONALITY_TRAIT_BY_ID[c]?.name ?? c))}, which you’ve picked.`;
  }
  if (held.length >= MAX_PERSONALITY_TRAITS) return `You already have ${said(MAX_PERSONALITY_TRAITS, 'trait')}, the most you can pick.`;
  return undefined;
}

/**
 * Who they are, before what they like: the seven dispositions and up to four
 * traits.
 *
 * Its own step, Dispositions & Traits, ahead of Genres & Background,
 * because it is the part of the character chosen as a disposition, and the
 * page says which parts of it do something and which are only kept.
 */
function PersonalityStep({ config, setConfig }: {
  config: NewSaveConfig;
  setConfig: React.Dispatch<React.SetStateAction<NewSaveConfig>>;
}) {
  const held = config.personalityTraits;

  const toggle = (id: string) => {
    setConfig((c) => {
      const now = c.personalityTraits;
      if (now.includes(id)) return { ...c, personalityTraits: now.filter((t) => t !== id) };
      if (now.length >= MAX_PERSONALITY_TRAITS) return c;
      if (conflictingPersonalityTraits(now, id).length > 0) return c;
      return { ...c, personalityTraits: [...now, id] };
    });
  };

  return (
    <div className="col gap-5">
      <div className="card">
        <div className="panel-head">
          <div>
            <h2>Dispositions</h2>
            {/* What each moves, as the systems read it (from 2026-10-17, brief 14, a list where it was one paragraph):
                stress's gain and recovery (`personality.ts`), the night (`life.ts`), the card's autopay over 65
                (`credit.ts`), and how a day is taken (`enjoyment.ts`: a house watching, new work, a rehearsal, either way by the lean). */}
            <p className="muted small">
              Your temperament, not your talent. Each one changes a part of your life:
            </p>
            <ul className="muted small" style={{ margin: 'var(--s1) 0 0', paddingLeft: 'var(--s4)' }}>
              <li>Emotional Stability: how fast stress builds and clears, and how much Composure you start with.</li>
              <li>Conscientiousness: how well you sleep, and how much Discipline you start with.</li>
              <li>Ambition: how fast stress builds, from work and from money alike.</li>
              <li>Risk Tolerance: above {CARRIES_A_BALANCE}, your card’s autopay starts out paying only the minimum, so you carry a balance.</li>
              <li>Extraversion: whether performing in front of people, an audience or your class, raises your stress or eases it.</li>
              <li>Openness: whether rehearsing new work, a festival’s new play or a Cabaret piece, lifts your morale or lowers it.</li>
              <li>Agreeableness: whether a day of rehearsal lifts your morale or lowers it.</li>
            </ul>
            <p className="muted small" style={{ marginTop: 'var(--s2)' }}>
              Apart from your starting Composure and Discipline, none of these makes you a better or worse actor.
              Composure is one of the abilities your performances are judged on.
            </p>
          </div>
        </div>
        {PERSONALITY_AXES.map((axis) => (
          <div key={axis.key} className="field">
            <div className="row-between">
              <label htmlFor={`p-${axis.key}`} style={{ marginBottom: 0 }}>{axis.label}</label>
              <span className="mono small">{config.personality[axis.key]}</span>
            </div>
            <input
              id={`p-${axis.key}`} type="range" min={AXIS_MIN} max={AXIS_MAX}
              value={config.personality[axis.key]}
              onChange={(e) => setConfig((c) => ({
                ...c,
                personality: { ...c.personality, [axis.key]: Number(e.target.value) },
              }))}
            />
            <div className="row-between xs dim">
              <span>{axis.low}</span><span>{axis.high}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="panel-head">
          <div>
            <h2>Traits</h2>
            {/* Until 2026-10-13 this said Keeps Accounts changed how much of the work’s costs could be
                deducted, and stopped there, where no played life has a cost of the work (`recordJobCost`
                has no caller) and the trait’s own look said it decided nothing now. From then until
                2026-10-14 it said that deduction decided nothing for a student; the owner had the
                knob (`receipts`) go that day, and Keeps Accounts moves how a slight cuts alone. */}
            <p className="muted small">
              Pick up to four. Traits come in opposing pairs, and you can’t have both of a pair. Between them,
              they change:
            </p>
            <ul className="muted small" style={{ margin: 'var(--s1) 0 0', paddingLeft: 'var(--s4)' }}>
              <li>how fast stress builds and clears;</li>
              <li>how well you sleep, and how much a night restores;</li>
              <li>how soon you need a shower;</li>
              <li>how far your morale swings;</li>
              <li>how hard an illness hits;</li>
              <li>how sharp you are in the morning or the evening;</li>
              <li>which part of preparing a scene goes furthest;</li>
              <li>how you warm to classmates, and how much a slight from one hurts;</li>
              {/* Until 2026-10-21 (brief 20) this said Generous moved how much a meal lifts you as well: Generous moves what
                  food costs and how fast you warm to a classmate, and declares no `mealMood`. */}
              <li>and, for Frugal, Spender and Generous, what your food costs, and for Frugal and Spender how much a meal lifts you.</li>
            </ul>
            <p className="muted small" style={{ marginTop: 'var(--s2)' }}>
              A trait’s description and cost describe the whole person, but the game uses only the effects above.
              Once you’re playing, open a trait on your Player Profile to see exactly what it changes.
            </p>
          </div>
          <span className="chip chip-accent">{held.length} / {MAX_PERSONALITY_TRAITS}</span>
        </div>

        {PERSONALITY_GROUPS.map((group) => (
          <div key={group} style={{ marginBottom: 'var(--s4)' }}>
            <div className="eyebrow" style={{ marginBottom: 'var(--s2)' }}>{group}</div>
            {/* A row per opposing pair. One flowing grid would wrap a pair
                across two rows at some widths and the opposition would stop
                being visible, which is the only reason the order exists. */}
            {personalityTraitPairs(group).map((pair) => (
              <div className="trait-pair" key={pair[0]!.id}>
                {pair.map((trait) => {
                  const selected = held.includes(trait.id);
                  // A trait that can't be picked says why, on the trait.
                  const why = blockedTraitReason(held, trait.id);
                  return (
                    <button
                      key={trait.id}
                      type="button"
                      className="trait"
                      aria-pressed={selected}
                      disabled={why !== undefined}
                      onClick={() => toggle(trait.id)}
                    >
                      <div className="trait-name">{trait.name}</div>
                      <div className="trait-desc">{trait.description}</div>
                      <div className="xs dim" style={{ marginTop: 4 }}>{trait.cost}</div>
                      {why && <div className="trait-why">{why}</div>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonalStep({
  config, set, setConfig,
}: {
  config: NewSaveConfig;
  set: Setter;
  setConfig: React.Dispatch<React.SetStateAction<NewSaveConfig>>;
}) {
  const toggleGenre = (genre: string) => {
    setConfig((c) => ({
      ...c,
      genres: c.genres.includes(genre)
        ? c.genres.filter((g) => g !== genre)
        : [...c.genres, genre],
    }));
  };

  // Take the whole list at once, or put it back.
  const setAll = (options: readonly Genre[], on: boolean) => {
    setConfig((c) => {
      const ids = options.map((o) => o.id);
      const rest = c.genres.filter((id) => !ids.includes(id));
      return { ...c, genres: on ? [...rest, ...ids] : rest };
    });
  };

  // Which of them something reads (`genresRead`, from 2026-10-09: the School's plays' kinds, and from 2026-10-24 the
  // career's projects' too): the rest are said back, and the chip says so.
  const read = genresRead();
  const Chips = ({ options, chosen, onToggle, moves }: {
    options: readonly Genre[];
    chosen: readonly string[];
    onToggle: (id: string) => void;
    moves: ReadonlySet<string>;
  }) => (
    <div className="chip-row" style={{ gap: 'var(--s2)' }}>
      {options.map((option) => {
        const on = chosen.includes(option.id);
        return (
          <button
            key={option.id}
            className="chip"
            style={on
              ? { background: 'var(--accent-dim)', color: 'var(--accent-strong)', borderColor: 'var(--accent-line)' }
              : undefined}
            aria-pressed={on}
            title={moves.has(option.id) ? undefined : 'Shown on your Player Profile; no play or project here is of its kind'}
            onClick={() => onToggle(option.id)}
          >
            {option.label}{moves.has(option.id) ? '' : <span className="dim" aria-label=", shown on your Player Profile only"> ·</span>}
          </button>
        );
      })}
    </div>
  );

  const AllOrNothing = ({ options, chosen }: {
    options: readonly Genre[];
    chosen: readonly string[];
  }) => {
    const every = options.every((o) => chosen.includes(o.id));
    return (
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setAll(options, !every)}
      >
        {every ? 'Clear These' : 'Select All'}
      </button>
    );
  };

  return (
    <div className="col gap-5">
      <div className="card">
        <div className="panel-head">
          <div>
            <h2>Genres</h2>
            <p className="muted small">
              The films you love: pick as many as are true. Rehearsing or performing a play in a genre you
              love, a comedy or a tragedy, or a day’s work on a project of its kind, lifts your morale and eases your
              stress, though it doesn’t make you any better at it. A genre marked · is in no play or project here, so
              it’s only shown on your Player Profile.
            </p>
          </div>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <span className="chip chip-accent">{config.genres.length} Chosen</span>
            <AllOrNothing options={FILM_GENRES} chosen={config.genres} />
          </div>
        </div>
        <Chips options={FILM_GENRES} chosen={config.genres} onToggle={toggleGenre} moves={read} />
      </div>

      {/*
        One box of free text, said back on their page and deciding nothing.
        Beside it until 2026-09-26 was Before Acting, a choice that set the
        fitness they started with and the day job they fell back on; it went
        with the job engine, when the owner kept SLATE to acting.
      */}
      <div className="card">
        <div className="panel-head">
          <div>
            <h2>Background</h2>
            <p className="muted small">Who you were before you arrived.</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="background">In Your Own Words</label>
          <textarea
            id="background" value={config.background}
            onChange={(e) => set('background', e.target.value)}
            placeholder="A sentence about your life before now. It’s shown on your Player Profile from the first morning, and changes nothing in the game."
          />
        </div>
      </div>

      <LanguagesCard config={config} setConfig={setConfig} />

      {config.school && <FamilyChoice config={config} setConfig={setConfig} />}
    </div>
  );
}

/**
 * The languages they speak, each with how well (from 2026-10-25, the owner's brief 27, Part 7: "Languages and accents").
 * English always, at native or fluent, and up to five more, each from the game's list of real languages (`SPOKEN`). A part
 * written for a character who speaks one of them as well as English reads it (`systems/speaking.ts`), and the résumé lists
 * them. Until then creation asked nothing of it, and every life spoke English alone.
 */
export function LanguagesCard({ config, setConfig }: { config: NewSaveConfig; setConfig: React.Dispatch<React.SetStateAction<NewSaveConfig>> }) {
  const list: readonly SpokenLanguage[] = config.languages ?? ENGLISH_ONLY;
  const setList = (next: SpokenLanguage[]) => setConfig((c) => ({ ...c, languages: next }));
  const unused = SPOKEN.filter((x) => !list.some((l) => l.id === x.id));
  return (
    <div className="card">
      <div className="panel-head">
        <div>
          <h2>Languages</h2>
          <p className="muted small">
            The languages you speak, and how well. Your training and every part in the game are in English. Some parts
            are written for a character who speaks another language too. If you speak it fluently or natively, you’re
            ready for it. If you speak it conversationally, the part takes more preparation. If you don’t speak it, you
            can’t be put up for it. Your résumé lists your languages.
          </p>
        </div>
        <span className="chip chip-accent">{`${list.length} Listed`}</span>
      </div>
      <div className="col gap-3">
        {list.map((l, i) => {
          const name = spokenName(l.id) ?? l.id;
          return (
            <div key={l.id} className="row gap-2" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor={`language-${i}`}>{name}</label>
                <select
                  id={`language-${i}`}
                  value={l.level}
                  onChange={(e) => setList(list.map((x) => (x.id === l.id ? { ...x, level: e.target.value as LanguageLevel } : x)))}
                >
                  {LANGUAGE_LEVELS.filter((level) => l.id !== ENGLISH || level !== 'conversational').map((level) => <option key={level} value={level}>{LEVEL_LABEL[level]}</option>)}
                </select>
              </div>
              {l.id !== ENGLISH && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setList(list.filter((x) => x.id !== l.id))}>{`Remove ${name}`}</button>
              )}
            </div>
          );
        })}
        {list.length < LANGUAGES_MOST && (
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="language-add">Add A Language</label>
            <select id="language-add" value="" onChange={(e) => { if (e.target.value) setList([...list, { id: e.target.value, level: 'fluent' }]); }}>
              <option value="">Choose A Language</option>
              {unused.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        )}
        <p className="xs dim" style={{ margin: 0 }}>
          Native is a language you grew up speaking. Fluent is one you’re at ease in. Conversational is one you can hold a
          conversation in. Mark at least one as native.
        </p>
      </div>
    </div>
  );
}

/**
 * The family they come from, beside the background (from 2026-10-14): the six starting-wealth levels (`FAMILIES`), each
 * the money in their name on the first morning (`wealthIn`) and the means Yale's need assessment reads (`withFamily`,
 * `findsNeed`, the rule `hasNeed` reads). Until then no screen asked, and every new life's family was wealthy, so no
 * player could reach the living-expense scholarship, conversion to grant aid, or the aid a leave returns.
 */
function FamilyChoice({ config, setConfig }: { config: NewSaveConfig; setConfig: React.Dispatch<React.SetStateAction<NewSaveConfig>> }) {
  const cur = currencyFor(config.startLocationId);
  const wealth = wealthIn(config.wealth, cur);
  const whole = (cents: number) => formatMoney(cents, cur, { cents: false });
  const aided = termAccount(cur);
  const card = wealth.cardLimit > 0
    ? `, and a card with a ${whole(wealth.cardLimit)} limit and ${wealth.cardBalance < 0 ? `${whole(-wealth.cardBalance)} owed on it` : 'nothing owed on it'}`
    : ', and no card';
  return (
    <div className="card">
      <div className="panel-head">
        <div>
          <h2>Your Family</h2>
          {/* Until 2026-10-20 (brief 17) "whether Yale’s needs assessment finds you need aid", need said twice; the
              callout below says what Yale finds in the same words. */}
          <p className="muted small">The family you come from decides the money in your name on the first morning, and whether Yale finds that you need aid.</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="family">The Family You Come From</label>
        <select id="family" value={config.wealth} onChange={(e) => setConfig((c) => withFamily(c, e.target.value as StartingWealth))}>
          {FAMILIES.map((w) => <option key={w} value={w}>{wealthLabel(w)}</option>)}
        </select>
      </div>
      {/* The money first, then what Yale finds, then what aid asks later (from 2026-10-20, brief 16, section 7): until then
          one paragraph, six sentences where Yale found need. */}
      <div className="callout">
        <p style={{ margin: '0 0 var(--s2)' }}>{wealthNote(config.wealth)} {`You start with ${whole(wealth.checking)} in checking and ${whole(wealth.savings)} in savings${card}.`}</p>
        {findsNeed(config) ? (
          <>
            <p style={{ margin: '0 0 var(--s2)' }}>{`Yale finds that you need aid. Its living-expense scholarship of ${formatMoney(aided.livingScholarship, cur)} a term pays for that term’s Yale Health plan, ${formatMoney(aided.healthPlan, cur)}, and puts the rest, ${formatMoney(aided.refund, cur)}, into your bank each fall and spring.`}</p>
            <p style={{ margin: 0 }}>If you miss work-study hours while you’re ill, you can convert them to grant aid. If you take a leave in the middle of a term, you give back part of the scholarship.</p>
          </>
        ) : (
          <p style={{ margin: 0 }}>{`Yale finds that you don’t need aid, given your family’s means, so there’s no aid for living costs. The term’s Yale Health plan, ${formatMoney(aided.healthPlan, cur)}, comes out of your bank each fall and spring.`}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Starting Point — where you are standing on day one, and what is in your
 * name.
 */
export function StartingPointStep({ config, set, setConfig }: {
  config: NewSaveConfig;
  set: Setter;
  setConfig: React.Dispatch<React.SetStateAction<NewSaveConfig>>;
}) {
  const city = CITIES.get(config.startLocationId);
  const cur = currencyFor(config.startLocationId);
  const wealth = wealthIn(config.wealth, cur);
  const country = city ? COUNTRIES.get(city.countryId) : undefined;
  const currencyOfCountry = country?.currency.toUpperCase() ?? cur;
  const countryCurrencyName = country ? `the ${country.currencyName.toLowerCase()}` : "the local money";
  // The money as it opens: with savings kept at a bank at home, split as `populateWorld` splits it (from 2026-10-16).
  const home = homeBankOf(config);
  const split = splitOf(wealth, cur, home, config.savingsAtHome, home ? feesToGraduation(config, home) : 0);
  const money = (cents: number) => formatMoney(cents, cur, { cents: cents % 100 !== 0 });

  return (
    <div className="col gap-5">
      {/* First on the page, at the owner's word (2026-10-10). */}
      <div className="card">
        <div className="panel-head">
          <div>
            <h2>Your Body</h2>
            <p className="muted small">Your height and weight on the first morning. {bodyUnits(config.startLocationId).why}</p>
          </div>
        </div>
        <BodyFields config={config} setConfig={setConfig} />
      </div>
      <div className="card">
        <div className="panel-head">
          <div>
            <h2>{config.school ? 'Where It Begins' : 'Where You Live'}</h2>
            <p className="muted small">
              {config.school
                ? `You’re a first-year in the ${YALE_DRAMA.degree} in ${YALE_DRAMA.program} at the ${YALE_DRAMA.name}, one of ${YALE_DRAMA.classSize} actors admitted this year: among the strongest of them, but not ahead of everyone.`
                : 'Where you are decides what things cost and whose holidays you keep.'}
            </p>
            {config.school && (
              <p className="muted small">
                You arrive in {city?.name ?? 'New Haven'} on {formatDate(instantFromZoned({ year: config.startYear, month: config.startMonth, day: config.startDay, hour: 12 }, city?.timeZone ?? 'America/New_York'), city?.timeZone ?? 'America/New_York')}, the first day of the fall term. Tuition is covered, as it is for every student.
              </p>
            )}
          </div>
        </div>

        {/* A life outside the School, which a test or a tool makes, picks where it lives. Until 2026-10-24 (brief 27) an
            I Still Live Where I Was Born box carried the birthplace here first (`livesWhereBorn`, retired). */}
        {!config.school && (
          <LocationPicker
            idPrefix="live"
            cityId={config.startLocationId}
            onPick={(picked) => set('startLocationId', picked.id)}
          />
        )}

        {city && (
          <div className="grid grid-3" style={{ marginTop: 'var(--s4)' }}>
            <div className="stat">
              <span className="stat-label">Population</span>
              <span className="stat-value">{formatPeople(city.population)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Time Zone</span>
              <span className="stat-value" style={{ fontSize: 'var(--size-md)' }}>{zoneAbbreviation(Date.UTC(config.startYear, config.startMonth - 1, config.startDay, 12), city.timeZone)}</span>
              <span className="stat-note">{city.timeZone}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Cost Of Living</span>
              <span className="stat-value">{city.costOfLivingIndex}</span>
              <span className="stat-note">A hundred is the United States’ price level</span>
            </div>
          </div>
        )}
      </div>

      {/* Month By Month, the month's food, stood here until the owner took it off this screen on 2026-10-10. */}

      <div className="card">
        <div className="panel-head">
          <div>
            <h2>Your Money</h2>
            <p className="muted small">The money in your own name on the first morning.</p>
            <p className="muted small">
              {/* The currency named after what it is (from 2026-10-20, brief 17): until then "kept in the dollar (USD), the
                  currency where you start", a currency's name where its money would be said. */}
              {cur === currencyOfCountry
                ? `Your money is kept in the currency where you start, ${countryCurrencyName} (${cur}), and stays in it wherever you go. ${RATES_NOTE}`
                : `Your money is kept in euros, because the game has no exchange rate for ${countryCurrencyName} (${currencyOfCountry}).`}
            </p>
          </div>
        </div>
        {choosesWealth(config) && (
          <>
            <div className="field">
              <label htmlFor="wealth">What You Are Starting With</label>
              <select id="wealth" value={config.wealth} onChange={(e) => set('wealth', e.target.value as StartingWealth)}>
                {WEALTH.map((w) => <option key={w} value={w}>{wealthLabel(w)}</option>)}
              </select>
            </div>
            <div className="callout">{wealthNote(config.wealth)}</div>
          </>
        )}
        <BankChoice config={config} set={set} />
        <div className="grid grid-3" style={{ marginTop: 'var(--s4)' }}>
          <div className="stat">
            <span className="stat-label">Checking</span>
            <span className="stat-value mono">{money(split.checking)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Savings</span>
            <span className="stat-value mono">{money(split.savings)}</span>
          </div>
          {home && split.homeCurrent > 0 && (
            <div className="stat">
              <span className="stat-label">{home.current.name} At {home.name}</span>
              <span className="stat-value mono">{formatMoney(split.homeCurrentHeld, home.currency)}</span>
              <span className="stat-note">About {money(split.homeCurrent)} at an estimated exchange rate</span>
            </div>
          )}
          {home && split.homeSavings > 0 && (
            <div className="stat">
              <span className="stat-label">Savings At {home.name}</span>
              <span className="stat-value mono">{formatMoney(split.homeSavingsHeld, home.currency)}</span>
              <span className="stat-note">About {money(split.homeSavings)} at an estimated exchange rate</span>
            </div>
          )}
          <div className="stat">
            <span className="stat-label">Credit Record</span>
            <span className="stat-value mono">{scoreIsANumberIn(config.startLocationId) ? wealth.creditScore : scoreWord(wealth.creditScore)}</span>
          </div>
          {/* The card the save opens with, and what it carries in: until 2026-09-27 creation never said. */}
          {wealth.cardLimit > 0 && (
            <div className="stat">
              <span className="stat-label">Credit Card</span>
              <span className="stat-value mono">{formatMoney(wealth.cardLimit, cur, { cents: false })} Limit</span>
              {wealth.cardBalance < 0 && <span className="stat-note">{formatMoney(-wealth.cardBalance, cur, { cents: false })} owed on it already</span>}
            </div>
          )}
        </div>
        {/* What Yale pays in and takes each term. It stood in Month By Month beside the food until the owner took the
            food off this screen on 2026-10-10. Until 2026-10-20 (brief 17) the one without aid said "Tuition is
            covered", which Where It Begins says above it, that the plan's fee "goes each term" without saying from
            where, and that aid "goes by need" after Genres & Background had said Yale found none. */}
        {config.school && (
          <div className="callout" style={{ marginTop: 'var(--s4)' }}>
            {findsNeed(config)
              ? `The school pays ${formatMoney(termAccount(cur).refund, cur)} into your bank at the start of each term, fall and spring, after your Yale Health plan.`
              : `Each fall and spring, ${formatMoney(termAccount(cur, false).healthPlan, cur)} comes out of your bank for that term’s Yale Health plan, and there’s no aid for living costs.`}
          </div>
        )}
      </div>
      {config.school && <BeforeYale config={config} setConfig={setConfig} split={split} />}
    </div>
  );
}

/**
 * Before Yale (from 2026-10-16): where they lived just before, and an account they kept there. The place of birth is
 * Identity's and grants nothing here; "I Lived Where I Was Born" is the player saying so, never SLATE inferring it. Each
 * bank there is offered or refused by the rule `populateWorld` opens by (`homeAccountRefusal`), with what follows.
 */
export function BeforeYale({ config, setConfig, split }: { config: NewSaveConfig; setConfig: React.Dispatch<React.SetStateAction<NewSaveConfig>>; split: Split }) {
  const prior = config.priorResidence;
  const place = prior ? CITIES.get(prior.cityId) : undefined;
  const iso = prior ? isoOfPlace(prior.cityId) : undefined;
  // Living in America before: the rule's second step, said before any bank is.
  const inAmerica = prior !== undefined && iso !== undefined && iso === isoOfPlace(config.startLocationId);
  const here = homeAccountRefusal(config, undefined);
  const banks = iso ? banksIn(iso) : [];
  const offered = banks.filter((b) => homeAccountRefusal(config, b.id) === undefined);
  const refused = banks.filter((b) => !offered.includes(b));
  const home = homeBankOf(config);
  const usBank = startingBank(config.startLocationId, config.bankId, citizenshipOf(config) === 'us');
  const live = (cityId: string, fromYear: number, fromMonth: number) => setConfig((c) => ({ ...c, priorResidence: { cityId, fromYear, fromMonth }, homeBankId: undefined }));

  return (
    <div className="card">
      <div className="panel-head">
        <div>
          <h2>Before Yale</h2>
          <p className="muted small">
            If you lived outside America just before Yale, say where, and whether you kept a bank account there. A bank keeps an account open only for a customer who lived and banked in its country. Being born there doesn’t count.
          </p>
        </div>
      </div>
      <label className="check" htmlFor="lived-born">
        <input
          id="lived-born"
          type="checkbox"
          checked={prior !== undefined && prior.cityId === config.homeRegionId}
          onChange={(e) => (e.target.checked
            ? live(config.homeRegionId, config.birthYear, config.birthMonth)
            : setConfig((c) => ({ ...c, priorResidence: undefined, homeBankId: undefined })))}
        />
        <span>I Lived Where I Was Born</span>
      </label>
      <fieldset className="field" style={{ marginTop: 'var(--s3)' }}>
        <legend>Where You Lived</legend>
        <LocationPicker idPrefix="before" cityId={prior?.cityId ?? ''} map={false} onPick={(picked) => live(picked.id, prior?.fromYear ?? config.birthYear, prior?.fromMonth ?? config.birthMonth)} />
      </fieldset>
      {prior && (
        <>
          <div className="row gap-3" style={{ marginTop: 'var(--s3)', alignItems: 'flex-end' }}>
            <div className="field">
              <label htmlFor="before-month">Since</label>
              <select id="before-month" value={prior.fromMonth} onChange={(e) => live(prior.cityId, prior.fromYear, Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="before-year">Year</label>
              <input id="before-year" type="number" value={prior.fromYear} min={config.birthYear} max={config.startYear} onChange={(e) => live(prior.cityId, Number(e.target.value), prior.fromMonth)} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfig((c) => ({ ...c, priorResidence: undefined, homeBankId: undefined }))}>Clear</button>
          </div>
          <p className="small muted" style={{ margin: 'var(--s2) 0 0' }}>{place ? placeLine(place) : prior.cityId}, from {MONTHS[prior.fromMonth - 1]} {prior.fromYear} to the day you arrive.</p>
        </>
      )}
      {inAmerica && <p className="small muted">{here}</p>}
      {prior && !inAmerica && (
        <>
          <label className="check" htmlFor="kept-account" style={{ marginTop: 'var(--s3)' }}>
            <input
              id="kept-account"
              type="checkbox"
              checked={config.homeBankId !== undefined}
              disabled={offered.length === 0}
              onChange={(e) => setConfig((c) => ({ ...c, homeBankId: e.target.checked ? offered[0]?.id : undefined }))}
            />
            <span>I Kept An Account There</span>
          </label>
          {config.homeBankId !== undefined && (
            <div className="field">
              <label htmlFor="home-bank">Your Bank There</label>
              <select id="home-bank" value={config.homeBankId} onChange={(e) => setConfig((c) => ({ ...c, homeBankId: e.target.value }))}>
                {banks.map((b) => <option key={b.id} value={b.id} disabled={!offered.includes(b)}>{b.name}</option>)}
              </select>
            </div>
          )}
          {refused.length > 0 && (
            <ul className="small muted" style={{ margin: 'var(--s2) 0 0', paddingLeft: 'var(--s4)' }}>
              {refused.map((b) => <li key={b.id}>{b.name}: {homeAccountRefusal(config, b.id)}</li>)}
            </ul>
          )}
          {home && (
            <>
              <div className="callout" style={{ marginTop: 'var(--s3)' }}>
                {whatFollows(config, home.id).join(' ')} You told {home.name} on its tax self-certification form that you live in America.
              </div>
              {usBank && (
                <fieldset className="field" style={{ marginTop: 'var(--s3)' }}>
                  <legend>Your Savings</legend>
                  <label className="row gap-2 small">
                    <input type="radio" name="home-savings" checked={config.savingsAtHome !== false} onChange={() => setConfig((c) => ({ ...c, savingsAtHome: true }))} />
                    <span>Kept At {home.name}{split.homeSavings > 0 ? `: ${formatMoney(split.homeSavingsHeld, home.currency)} In ${home.savings.name}` : ''}</span>
                  </label>
                  <label className="row gap-2 small">
                    <input type="radio" name="home-savings" checked={config.savingsAtHome === false} onChange={() => setConfig((c) => ({ ...c, savingsAtHome: false }))} />
                    <span>Moved To {usBank.name}</span>
                  </label>
                  <p className="small muted" style={{ margin: 'var(--s2) 0 0' }}>
                    {/* Said of the choice made, and of what the account opens with (from 2026-10-19, brief 15: until
                        then “Your savings stay where you saved them” beside Moved To too, and “opens with nothing in
                        it” above the stat and the sentence that gave it its fees; `splitOf` sets both). */}
                    {config.savingsAtHome !== false ? `Your savings stay at ${home.name}.` : `Your savings move to ${usBank.name}.`} Your everyday money is in your account here, and your card stays with {usBank.name}.{split.homeCurrent > 0 ? '' : ` Your ${home.current.name} opens with nothing in it.`}
                  </p>
                </fieldset>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The bank the money is kept at: the real banks of the country they live in
 * (`content/banks.ts`), the first of them unless another is picked. What
 * each account is called there, what savings pays and what the current
 * account costs, as the bank publishes them.
 */
function BankChoice({ config, set }: { config: NewSaveConfig; set: <K extends keyof NewSaveConfig>(key: K, value: NewSaveConfig[K]) => void }) {
  // Not a US citizen, a student on an F-1: the banks that open for them (`startingBank`, from 2026-10-10; read from the
  // birthplace until 2026-10-24, when brief 27 made the citizenship the player's choice).
  const usPerson = citizenshipOf(config) === 'us';
  const banks = banksFor(config.startLocationId).filter((b) => usPerson || !OPENING[b.id]?.usPersonsOnly);
  const bank = startingBank(config.startLocationId, config.bankId, usPerson);
  if (!bank) {
    return <p className="small muted" style={{ marginTop: 'var(--s3)' }}>SLATE has no bank on record where you live, so your money is in a plain checking account.</p>;
  }
  const fee = bank.current.monthlyFee;
  const bankMoney = (cents: number) => formatMoney(cents, bank.currency, { cents: false });
  return (
    <div className="field" style={{ marginTop: 'var(--s4)' }}>
      <label htmlFor="bank">Your Bank</label>
      <select id="bank" value={bank.id} onChange={(e) => set('bankId', e.target.value)}>
        {/* The dearest current account first, the cheapest last. */}
        {[...banks].sort((a, b) => (b.current.monthlyFee ?? 0) - (a.current.monthlyFee ?? 0)).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <p className="small muted" style={{ margin: 'var(--s2) 0 0' }}>
        {bank.current.name}{fee ? `, ${bankMoney(fee)} a month${bank.current.waiver ? ' unless waived' : ''}` : ', no monthly fee'}.
        {' '}{bank.savings.name}{bank.savings.rate ? `, ${(bank.savings.rate * 100).toFixed(2)}% a year${bank.savings.estimate ? ' (estimated)' : ''}` : ', no published rate'}.
      </p>
    </div>
  );
}

/**
 * What a month here costs, before the save exists: Review's Going Out A Month.
 *
 * Every figure is the engine's own price of a day's food (`foodAt`) for the
 * town and the start date, at the money traits' knob (`spending`), as the
 * clock buys it at the start of each day (`foodOf`), for 365/12 days, so the
 * line and the first month of play can't disagree. Until 2026-10-13 this
 * named a sum, `costsAt`, that didn't exist. Starting Point showed it as a
 * card, Month By Month, with the food a day and a meal, until the owner took
 * it off that screen on 2026-10-10.
 *
 * It was what a month paid too, until 2026-09-26: the day job, its employer's
 * rate, the tax withheld and the tips. The job engine went, and nothing comes
 * in now. Rent and bills went with the home on 2026-10-09, and so did choosing
 * where to sleep: what goes out a month is the food.
 */
function monthOf(config: NewSaveConfig, cur: string) {
  const at = Date.UTC(config.startYear, config.startMonth - 1, config.startDay, 12);
  const costs = foodAt(config.startLocationId, cur, at);
  const spending = personalityOf({ personality: config.personality, personalityTraits: config.personalityTraits }, 'spending');
  const food = Math.round(costs.day * spending * 365 / 12);
  return { at, costs, spending, food, out: food };
}

export function ReviewStep({ config, setConfig }: { config: NewSaveConfig; setConfig: (f: (c: NewSaveConfig) => NewSaveConfig) => void }) {
  const city = CITIES.get(config.startLocationId);
  const birthplace = CITIES.get(config.homeRegionId);
  const age = ageAtStart(config);
  const cur = currencyFor(config.startLocationId);
  const wealth = wealthIn(config.wealth, cur);
  const month = monthOf(config, cur);
  const home = homeBankOf(config);
  const split = splitOf(wealth, cur, home, config.savingsAtHome, home ? feesToGraduation(config, home) : 0);
  const money = (cents: number) => formatMoney(cents, cur, { cents: cents % 100 !== 0 });

  return (
    <div className="col gap-5">
      <div className="card">
        <div className="center" style={{ padding: 'var(--s4) 0' }}>
          {config.portrait && (
            <img
              className="headshot headshot-xl"
              src={config.portrait}
              alt={`Headshot for ${config.firstName} ${config.lastName}`}
              style={{ margin: '0 auto var(--s4)' }}
            />
          )}
          <div className="eyebrow">Ready To Begin</div>
          <h1 style={{ fontSize: 'var(--size-2xl)', margin: 'var(--s2) 0' }}>
            {config.displayName?.trim() || `${config.firstName} ${config.lastName}`}
          </h1>
          <p className="muted">
            {age} · {billedAs(config)} · {city?.name}
          </p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>Identity</div>
          <Line label="Legal Name" value={[config.firstName, config.middleName, config.lastName].filter(Boolean).join(' ')} />
          <Line label="Pronouns" value={pronounsLabel(config.pronouns)} />
          <Line label="Billed As" value={billedAs(config)} />
          <Line
            label="Race Or Ethnicity"
            value={describeEthnicity(config.raceEthnicity, config.raceEthnicityOwn)}
          />
          <Line label="Born" value={`${MONTHS[config.birthMonth - 1]} ${config.birthDay}, ${config.birthYear}`} />
          <Line label="Place Of Birth" value={birthplace ? shortPlace(birthplace) : '—'} />
          <Line label="Citizenship" value={citizenshipName(config) ?? '—'} />
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>Starting Point</div>
          {config.school && <Line label="School" value={`${YALE_DRAMA.degree} in ${YALE_DRAMA.program}, class of ${config.startYear + 3}`} />}
          <Line label="Where You Live" value={city ? shortPlace(city) : '—'} />
          <Line label="Bank" value={startingBank(config.startLocationId, config.bankId, citizenshipOf(config) === 'us')?.name ?? 'None On Record'} />
          <Line label="Checking" value={money(split.checking)} />
          <Line label="Savings" value={money(split.savings)} />
          {/* What was said on Before Yale, and the bank kept there (from 2026-10-16). */}
          {/* Since the month and year Before Yale took, in a value's case (from 2026-10-20, brief 17): until then
              ", Since 2008", the year alone and a capital in the middle of the line. */}
          {config.school && config.priorResidence && (
            <Line label="Before Yale" value={`${CITIES.get(config.priorResidence.cityId) ? shortPlace(CITIES.get(config.priorResidence.cityId)!) : config.priorResidence.cityId}, since ${MONTHS[config.priorResidence.fromMonth - 1]} ${config.priorResidence.fromYear}`} />
          )}
          {home && (
            <Line label="Home Bank" value={split.homeSavings > 0 ? `${home.name}, ${formatMoney(split.homeSavingsHeld, home.currency)} In ${home.savings.name}` : `${home.name}, ${home.current.name}`} />
          )}
          <Line label="Credit Record" value={scoreIsANumberIn(config.startLocationId) ? String(wealth.creditScore) : scoreWord(wealth.creditScore)} />
          {/* The limit, then what's owed, as Starting Point's Credit Card says them (from 2026-10-20, brief 17): until then
              "$913 owed of $1,630", and "$0 owed of" a card with nothing on it. */}
          {wealth.cardLimit > 0 && (
            <Line label="Card" value={`${formatMoney(wealth.cardLimit, cur, { cents: false })} limit, ${wealth.cardBalance < 0 ? `${formatMoney(-wealth.cardBalance, cur, { cents: false })} owed` : 'nothing owed'}`} />
          )}
          <Line label="Food Each Month" value={formatMoney(month.out, cur, { cents: false })} />
        </div>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>Dispositions &amp; Traits</div>
        {PERSONALITY_AXES.map((axis) => (
          <Line key={axis.key} label={axis.label} value={outOf(config.personality[axis.key])} />
        ))}
        <div style={{ marginTop: 'var(--s3)' }}>
          {config.personalityTraits.length === 0 ? (
            <p className="muted small">
              You haven’t picked any traits. That’s fine: the dispositions above still shape your stress, your
              sleep, your morale and your card.
            </p>
          ) : (
            <div className="col gap-3">
              {config.personalityTraits.map((id) => {
                const trait = PERSONALITY_TRAIT_BY_ID[id];
                if (!trait) return null;
                return (
                  <div key={id}>
                    <div className="strong small">{trait.name}</div>
                    <div className="xs muted">{trait.description}</div>
                    <div className="xs dim" style={{ marginTop: 2 }}>{trait.cost}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>Genres &amp; Background</div>
        <Line label="Genres" value={namesOf(FILM_GENRES, config.genres)} />
        <Line label="Languages" value={(config.languages ?? ENGLISH_ONLY).map((l) => `${spokenName(l.id) ?? l.id} (${LEVEL_LABEL[l.level]})`).join(', ')} />
        {config.school && <Line label="Family" value={`${wealthLabel(config.wealth)}, ${findsNeed(config) ? 'Need Found' : 'No Need Found'}`} />}
        {/* A sentence of the player's own, so it is set as one, not squeezed
            into the right-hand column a line gives a value. */}
        {config.background.trim() ? (
          <div style={{ padding: '3px 0' }}>
            <span className="small muted">In Your Own Words</span>
            <p className="small" style={{ margin: '2px 0 0' }}>{config.background.trim()}</p>
          </div>
        ) : (
          <Line label="In Your Own Words" value="—" />
        )}
      </div>

      {/*
        The guide, or not (from 2026-10-12): a player who knows SLATE isn't walked through seventeen chapters again.
        Either way every chapter and the reference stay there to read.
      */}
      <fieldset className="card">
        <legend className="eyebrow">The Guide</legend>
        <label className="row gap-2 small" style={{ alignItems: 'flex-start', padding: 'var(--s1) 0' }}>
          <input type="radio" name="guide" checked={config.tutorial !== false} onChange={() => setConfig((c) => ({ ...c, tutorial: true }))} />
          <span><strong>Guide Me Through It.</strong> The game opens a part at a time, each with a short chapter of the guide that explains it. Recommended if you’re new.</span>
        </label>
        <label className="row gap-2 small" style={{ alignItems: 'flex-start', padding: 'var(--s1) 0' }}>
          <input type="radio" name="guide" checked={config.tutorial === false} onChange={() => setConfig((c) => ({ ...c, tutorial: false }))} />
          <span><strong>I Know SLATE.</strong> Everything is open from the start. The guide’s chapters and How This Works are there whenever you want them.</span>
        </label>
      </fieldset>

      {/* The life opens with the clock paused, guided or not (`SlateApp`'s createSave, `paused: true`): until 2026-10-17
          this said the world starts running once it begins. Until 2026-10-20 (brief 17) I Know SLATE said the clock
          starts paused too, as if Guide Me's didn't, a line above this saying it of both; and this said what's on the
          calendar "happens whether you’re watching or not", where Play stops at each commitment and pauses
          (`halt` in `game-context.tsx`). */}
      <div className="callout callout-accent">
        Your life starts with the clock paused. Once you press Play, a minute passes in the game for every real
        minute, and the clock pauses itself at each commitment to ask what you want to do.
      </div>
    </div>
  );
}

/** The chosen ones, in the order the list offers them, or an em dash. */
function namesOf(all: readonly Genre[], chosen: readonly string[]): string {
  const named = all.filter((one) => chosen.includes(one.id)).map((one) => one.label);
  return named.length > 0 ? named.join(', ') : '—';
}

/**
 * One line of Review: the label on the left, kept on one line, and the value
 * against the right edge, wrapping there if it must. The label used to shrink
 * with the value, so a long place broke "Where You Live" over two lines and
 * sat its own two lines in the middle of the card.
 */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="row-between" style={{ padding: '3px 0', gap: 'var(--s3)', alignItems: 'baseline' }}>
      <span className="small muted" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
      <span className="small strong" style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/** Pronouns as a label writes them: "They/Them", "She/Her". */
function pronounsLabel(pronouns: string): string {
  return pronouns.split('/').map((one) => one.charAt(0).toUpperCase() + one.slice(1)).join('/');
}

// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** The days in a month of a year, February's 29 in a leap year. */
export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

export function validate(config: NewSaveConfig, step: StepIndex): string[] {
  const issues: string[] = [];
  if (step === STEP.Identity) {
    if (!config.firstName.trim()) issues.push('Enter a first name.');
    if (!config.lastName.trim()) issues.push('Enter a last name.');
    if (!titleOf(config)) {
      issues.push('Choose whether you’re billed as an actor or an actress.');
    }
    const age = ageAtStart(config);
    // The year, not the age. A birth year at the cap can still leave somebody
    // seventeen when the save opens, and that is a life this game will run.
    if (config.birthYear > latestBirthYear(config)) {
      issues.push(`Your character can’t be born after ${latestBirthYear(config)}.`);
    }

    if (age > 95) issues.push('Your character would be over 95 at the start. Choose a later year of birth.');
    // A day the month has (from 2026-10-13: until then any day to 31 passed, and 31 February became 3 March).
    if (!Number.isInteger(config.birthDay) || config.birthDay < 1 || config.birthDay > daysInMonth(config.birthYear, config.birthMonth)) issues.push(`${MONTHS[config.birthMonth - 1]} ${config.birthYear} has no day ${config.birthDay}.`);
    if (!CITIES.get(config.homeRegionId)) issues.push('Choose the town or city you were born in.');
    if (!isCitizenship(config.citizenshipId)) issues.push('Choose your citizenship.');
  }
  // What they speak (from 2026-10-25, brief 27): English at native or fluent, each language once, one of them native.
  if (step === STEP['Genres & Background']) issues.push(...languagesProblems(config.languages ?? ENGLISH_ONLY));
  if (step === STEP['Starting Point']) {
    if (!CITIES.get(config.startLocationId)) issues.push('Choose the town or city you live in.');
    // Nothing on the page sets the start date; this guards a draft that came in wrong.
    if (config.startDay < 1 || config.startDay > 28) issues.push('This saved draft has a start date SLATE can’t use. Go back to Identity and press Start Over.');
    // Before Yale (from 2026-10-16): a time that can have been, and a bank the rule offers, or none.
    const prior = config.priorResidence;
    if (prior) {
      const since = prior.fromYear * 12 + prior.fromMonth;
      if (!Number.isInteger(prior.fromYear) || prior.fromMonth < 1 || prior.fromMonth > 12) issues.push('Choose the month and year you moved there.');
      else if (since < config.birthYear * 12 + config.birthMonth) issues.push('You can’t have moved there before you were born.');
      else if (since > config.startYear * 12 + config.startMonth) issues.push('That’s after you arrive at Yale. Choose an earlier month.');
    }
    if (config.homeBankId !== undefined) {
      const refused = homeAccountRefusal(config, config.homeBankId);
      if (refused) issues.push(refused);
    }
  }
  return issues;
}

/**
 * The build a draft was written by.
 *
 * A half-filled form is a convenience, not a save, and it must never outrank
 * the game it is being filled in for. An unstamped draft written before an
 * update was merged straight over the current defaults, so a brand new save
 * silently came out with the old build's settings and none of the update in
 * it. Drafts now carry the build they came from and are discarded when it
 * moves on.
 */
const DRAFT_BUILD = `${APP_VERSION}/${SAVE_SCHEMA_VERSION}`;

interface StoredDraft {
  build: string;
  config: NewSaveConfig;
}

function loadDraft(slot: Slot): NewSaveConfig | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(slot));
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredDraft>;

    // Written by an older build, or by one that predates the stamp entirely.
    if (stored?.build !== DRAFT_BUILD || !stored.config) {
      localStorage.removeItem(DRAFT_KEY(slot));
      return null;
    }

    const merged = newLifeFrom(stored.config);

    // A town small enough not to be bundled is not resolvable until its
    // country has been fetched, which has not happened yet on a cold start.
    // Losing the whole draft over that threw away a filled-in form because
    // somebody was from a village, so the id is kept whenever the country it
    // names is real, and CharacterCreation pulls that country in. An id whose
    // country does not exist is a lost cause, and the birthplace is asked again.
    if (!countryOfPlace(merged.homeRegionId)) merged.homeRegionId = '';

    return merged;
  } catch {
    return null;
  }
}

function saveDraft(slot: Slot, config: NewSaveConfig): void {
  try {
    const stored: StoredDraft = { build: DRAFT_BUILD, config };
    localStorage.setItem(DRAFT_KEY(slot), JSON.stringify(stored));
  } catch {
    /* storage full or unavailable; the draft is a convenience */
  }
}

function clearDraft(slot: Slot): void {
  try {
    localStorage.removeItem(DRAFT_KEY(slot));
  } catch {
    /* nothing to do */
  }
}
