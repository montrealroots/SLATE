import { SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './credit.json' with { type: 'json' };

/**
 * Each country's credit records (src/money/credit/credit.json, compiled by tools/money/credit from the research, register
 * facts money.credit.<CC>): the bureau or registry that keeps them, how many days after its due date a payment is
 * reported late, and how many years a late payment stays. A holder's record is the late payments marked on it, each in
 * the country whose bureau keeps it and until the day its keeping ends. Where no source states the days to report, they
 * are the game's reading, the bureau's next monthly update, and marked so (`game`). A country where no bureau or
 * registry keeps a record (`none`) marks nothing, and the player is told so; one whose records the game doesn't know
 * marks nothing either, and the player is told that. Where the record lifts a late payment once it's paid, its mark
 * lifts the country's days after the payment (`clears`), and stays its years while unpaid.
 *
 * What a lender makes of a record is its own: no bureau or bank publishes how it scores one. The game's reading, said to
 * the player as the game's: a record with nothing on it stands at 1000, the best, and each late payment still kept takes
 * 250 from it, down to 0. A card priced within a range prices a holder by it (src/money/cards, `priced`).
 */

export interface Kept {
  readonly bureau: string;
  readonly report: number;
  readonly keep: number;
  /** The days to report are the game's reading (the bureau's next monthly update), no source stating them. */
  readonly game?: true;
  /** The days after a late payment is paid that its mark lifts, where the record lifts it then. */
  readonly clears?: number;
}

/** A country where no bureau or registry keeps a person's record of credit. */
export interface None {
  readonly none: true;
}

export type Record = Kept | None;

export interface CreditSlice {
  /** Each late payment marked: where the record lifts it once paid, the debt it's for and how long after paying it lifts. */
  marks: { country: string; at: number; until: number; debt?: string; lift?: number }[];
}

export const CREDIT_START: CreditSlice = { marks: [] };

const DATA = data as unknown as { countries: { [code: string]: Record } };

/** Whether the game knows a country's credit records, kept or shown to be none. */
export const keepsCredit = (country: CountryCode) => Object.hasOwn(DATA.countries, country);

/** A country's record keeping, where the game knows it. */
export const creditIn = (country: CountryCode): Record | undefined => DATA.countries[country];

/** A country's bureau and its terms, where one keeps a record. */
const kept = (country: string): Kept | undefined => {
  const r = DATA.countries[country];
  return r === undefined || 'none' in r ? undefined : r;
};

/** The days after a due date a late payment is reported in a country, where a bureau keeps a record. */
export const reportAfter = (country: string): number | undefined => kept(country)?.report;

/** What one late payment kept on the record takes from the best standing, the game's reading. */
export const MARK = 250;

/**
 * Marks a late payment on the record, kept the country's years from now, and, where the record lifts it once paid,
 * tied to its debt; nothing where no bureau keeps one, or the game doesn't know.
 */
export function record(credit: CreditSlice, country: string, at: number, debt: string): void {
  const keeping = kept(country);
  if (keeping === undefined) return;
  const until = at + Math.round(keeping.keep * 365.25 * SECONDS_PER_DAY);
  credit.marks.push(keeping.clears === undefined ? { country, at, until } : { country, at, until, debt, lift: keeping.clears * SECONDS_PER_DAY });
}

/** A late payment paid: its mark lifts as many days later as the record says, where the record lifts it once paid. */
export function clear(credit: CreditSlice, debt: string, at: number): void {
  for (const m of credit.marks) if (m.debt === debt) m.until = Math.min(m.until, at + (m.lift as number));
}

/** The record's standing at a moment, from 0 to 1000: 1000 less a mark's worth for each still kept, the game's reading. */
export const standingOf = (credit: CreditSlice, now: number): number => Math.max(0, 1000 - MARK * credit.marks.filter((m) => m.at <= now && now < m.until).length);

export const UNKEPT_LINE = 'credit.unkept';
export const NONE_LINE = 'credit.none';

/** What the player is told about a country where no bureau keeps a record, or whose records the game doesn't know. Nothing otherwise. */
export function aboutCredit(country: CountryCode): string | undefined {
  const r = DATA.countries[country];
  if (r === undefined) return t(UNKEPT_LINE, { country: countryName(country) });
  return 'none' in r ? t(NONE_LINE, { country: countryName(country) }) : undefined;
}
