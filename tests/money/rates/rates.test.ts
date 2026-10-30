import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { aboutRate, exchangeOn, knowsRate, rateOn, UNKEPT_LINE } from '../../../src/money/rates/rates.ts';
import data from '../../../src/money/rates/rates.json';

describe('rates', () => {
  it("give each currency's rate against the dollar on a day, from the rates its source gives", () => {
    const eur = data.currencies.EUR;
    expect(eur.fact).toBe('money.rates.EUR');
    // Each rate holds from its day until the next; none before the first.
    expect(rateOn('EUR', '2025-12-30')).toBeUndefined();
    expect(rateOn('EUR', '2025-12-31')).toStrictEqual({ currency: 'EUR', perUSD: '0.851', asOf: '2025-12-31', source: 'money.rates.EUR' });
    expect(rateOn('EUR', '2026-03-30')).toStrictEqual({ currency: 'EUR', perUSD: '0.851', asOf: '2025-12-31', source: 'money.rates.EUR' });
    expect(rateOn('EUR', '2026-03-31')).toStrictEqual({ currency: 'EUR', perUSD: '0.87', asOf: '2026-03-31', source: 'money.rates.EUR' });
    expect(rateOn('EUR', '2031-01-01')?.asOf).toBe(eur.rates.at(-1)?.from);
    expect([knowsRate('EUR'), knowsRate('JPY')]).toEqual([true, true]);
    // An amount in another currency is an estimate, through the dollar.
    expect(exchangeOn(money('EUR', 85_100), 'USD', '2026-01-01')).toStrictEqual({ money: money('USD', 100_000), estimate: true, from: rateOn('EUR', '2026-01-01'), to: rateOn('USD', '2026-01-01') });
    expect(exchangeOn(money('USD', 100), 'EUR', '2025-12-30')).toBeUndefined();
    expect(exchangeOn(money('EUR', 100), 'USD', '2025-12-30')).toBeUndefined();
  });

  it('keep the dollar as the unit', () => {
    expect(rateOn('USD', '2026-05-01')).toStrictEqual({ currency: 'USD', perUSD: '1', asOf: '2026-05-01', source: 'the unit' });
    expect(knowsRate('USD')).toBe(true);
    expect(exchangeOn(money('USD', 1234), 'USD', '1990-01-01')?.money).toStrictEqual(money('USD', 1234));
    expect(aboutRate('US')).toBeUndefined();
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('rates.unkept');
    expect(aboutRate('FR')).toBeUndefined();
    // A country with no currency of its own, and one whose currency's rate isn't kept.
    expect(aboutRate('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutRate('AQ')).toBe("What Antarctica's money is worth in other currencies isn't known to this game yet.");
    // North Korea's won: the UN's operational rate, 110 to the dollar from 15 January 2026 (the UN Treasury's export
    // starts there; until 2026-10-30 the won was blocked); before that day nothing exchanges into it.
    expect([knowsRate('KPW'), aboutRate('KP'), rateOn('KPW', '2026-01-14'), exchangeOn(money('USD', 100), 'KPW', '2026-01-14')]).toStrictEqual([true, undefined, undefined, undefined]);
    expect(exchangeOn(money('USD', 100), 'KPW', '2026-01-15')?.money).toStrictEqual(money('KPW', 11_000));
  });
});
