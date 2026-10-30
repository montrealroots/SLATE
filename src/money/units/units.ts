import { minorUnits, money, rational, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import data from './units.json' with { type: 'json' };

/**
 * The index units fees are set in (src/money/units/units.json, compiled by tools/money/units from the research,
 * register facts money.units.<UNIT>): what one unit is worth in its currency, from the day its publisher says each
 * value applies, each holding until the next (Mexico's UMA from INEGI, Uruguay's UR, set by the Banco Hipotecario, from
 * its INE). A fee of so many units is worth their value on the day it's paid, worked exactly and rounded once to the
 * currency's smallest amount, half to even, as every product of the game's money is; a fiscal code's own rounding to
 * the whole peso, where it sets one, isn't held.
 */

interface Unit {
  readonly fact: string;
  readonly name: string;
  readonly currency: CurrencyCode;
  readonly values: readonly { readonly from: string; readonly value: string }[];
}

const DATA = data as unknown as { units: { readonly [unit: string]: Unit } };

/** Whether the game holds a unit's values. */
export const knowsUnit = (unit: string): boolean => Object.hasOwn(DATA.units, unit);

/** The currency a unit is worth an amount of; none for a unit the game doesn't hold. */
export const unitCurrency = (unit: string): CurrencyCode | undefined => DATA.units[unit]?.currency;

/** A count of a unit (a decimal written out, "8.5") in its currency on a day (YYYY-MM-DD); none before its first value, or for a unit the game doesn't hold. */
export function inUnits(count: string, unit: string, day: string): Money | undefined {
  const u = DATA.units[unit];
  const step = u?.values.findLast((s) => s.from <= day);
  if (step === undefined) return undefined;
  const [c, v] = [rational(count), rational(step.value)];
  const currency = (u as Unit).currency;
  return money(currency, Number(roundHalfEven(10n ** BigInt(minorUnits(currency)) * c.num * v.num, c.den * v.den)));
}
