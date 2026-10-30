import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { inUnits, knowsUnit, unitCurrency } from '../../../src/money/units/units.ts';

describe('units', () => {
  it("give a count of a unit in its currency on a day, from its publisher's values", () => {
    expect([knowsUnit('UMA'), knowsUnit('UR'), unitCurrency('UMA'), unitCurrency('UR')]).toEqual([true, true, 'MXN', 'UYU']);
    // Nayarit's 8.5 UMA on INEGI's 2026 value, 117.31: 997.135 pesos, half to even at the centavo.
    expect(inUnits('8.5', 'UMA', '2026-10-30')).toStrictEqual(money('MXN', 99_714));
    expect(inUnits('4.90', 'UMA', '2026-10-30')).toStrictEqual(money('MXN', 57_482));
    // A value holds from the day its publisher gives until the next: 2026's from 1 February, 2016's from 28 January.
    expect(inUnits('1', 'UMA', '2026-02-01')).toStrictEqual(money('MXN', 11_731));
    expect(inUnits('1', 'UMA', '2026-01-31')).toStrictEqual(money('MXN', 11_314));
    expect(inUnits('6', 'UMA', '2016-01-28')).toStrictEqual(money('MXN', 43_824));
    expect(inUnits('1', 'UMA', '2016-01-27')).toBeUndefined();
    // The UR of each month: September 2026's 1,940.77, January 2024's 1,638.35 from the first of the month.
    expect(inUnits('1.25', 'UR', '2026-10-30')).toStrictEqual(money('UYU', 242_596));
    expect(inUnits('1.25', 'UR', '2024-01-01')).toStrictEqual(money('UYU', 204_794));
    expect(inUnits('1', 'UR', '2023-12-31')).toBeUndefined();
  });

  it('round as the unit\'s own law says where it says', () => {
    // The Northern Territory's 10 revenue units at 2026-27's $1.49 are $14.90, rounded down to the dollar (s 3(2)).
    expect(inUnits('10', 'NTRU', '2026-10-30')).toStrictEqual(money('AUD', 1400));
    expect(inUnits('100', 'NTRU', '2026-10-30')).toStrictEqual(money('AUD', 14_900));
    expect(inUnits('141', 'NTRU', '2026-10-30')).toStrictEqual(money('AUD', 21_000));
    // Victoria's fee unit has no rounding of its own: 19.15 units at $17.27 is $330.7205, to the cent half to even.
    expect(inUnits('19.15', 'VFU', '2026-10-30')).toStrictEqual(money('AUD', 33_072));
  });

  it("give nothing for a unit the game doesn't hold", () => {
    expect([knowsUnit('UF'), unitCurrency('UF'), inUnits('1', 'UF', '2026-10-30')]).toEqual([false, undefined, undefined]);
    expect(knowsUnit('toString')).toBe(false);
  });
});
