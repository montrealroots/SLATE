import { SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './credit.json' with { type: 'json' };

/**
 * Each country's credit records (src/money/credit/credit.json, compiled by tools/money/credit from the research, register
 * facts money.credit.<CC>): the bureau or registry that keeps them, how many days after its due date a payment is
 * reported late, and how many years a late payment stays. A holder's record is the late payments marked on it, each in
 * the country whose bureau keeps it and until the day its keeping ends. Where no source states the days to report, they
 * are the game's reading, the bureau's next monthly update, and marked so (`game`). A country whose records the game
 * doesn't keep marks nothing, and the player is told.
 *
 * What a lender makes of a record is its own: no bureau or bank publishes how it scores one. The game's reading, said to
 * the player as the game's: a record with nothing on it stands at 1000, the best, and each late payment still kept takes
 * 250 from it, down to 0. A card priced within a range prices a holder by it (src/money/cards, `priced`).
 */

export interface Record {
  readonly bureau: string;
  readonly report: number;
  readonly keep: number;
  /** The days to report are the game's reading (the bureau's next monthly update), no source stating them. */
  readonly game?: true;
}

export interface CreditSlice {
  marks: { country: string; at: number; until: number }[];
}

export const CREDIT_START: CreditSlice = { marks: [] };

const DATA = data as unknown as { countries: { [code: string]: Record } };

/** Whether the game keeps a country's credit records. */
export const keepsCredit = (country: CountryCode) => Object.hasOwn(DATA.countries, country);

/** A country's record keeping, where the game keeps it. */
export const creditIn = (country: CountryCode): Record | undefined => DATA.countries[country];

/** The days after a due date a late payment is reported in a country, where the game keeps its records. */
export const reportAfter = (country: string): number | undefined => DATA.countries[country]?.report;

/** What one late payment kept on the record takes from the best standing, the game's reading. */
export const MARK = 250;

/** Marks a late payment on the record, kept the country's years from now; nothing where the game doesn't keep its records. */
export function record(credit: CreditSlice, country: string, at: number): void {
  const keeping = DATA.countries[country];
  if (keeping === undefined) return;
  credit.marks.push({ country, at, until: at + Math.round(keeping.keep * 365.25 * SECONDS_PER_DAY) });
}

/** The record's standing at a moment, from 0 to 1000: 1000 less a mark's worth for each still kept, the game's reading. */
export const standingOf = (credit: CreditSlice, now: number): number => Math.max(0, 1000 - MARK * credit.marks.filter((m) => m.at <= now && now < m.until).length);

export const UNKEPT_LINE = 'credit.unkept';

/** What the player is told about a country whose credit records the game doesn't keep. Nothing otherwise. */
export const aboutCredit = (country: CountryCode): string | undefined => (keepsCredit(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
