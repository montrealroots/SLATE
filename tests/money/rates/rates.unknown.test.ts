import { describe, expect, it, vi } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { aboutRate, exchangeOn, knowsRate, rateOn, UNKEPT_LINE } from '../../../src/money/rates/rates.ts';

/**
 * A currency of the map whose rate the game doesn't hold, on the compiled form: every place's currency has a rate since
 * North Korea's won was read on 2026-10-30, so the research can't show one (CI's run 504 of 2026-10-31 left the unknown
 * currency's three mutants alive). Here the rates hold the euro alone.
 */
vi.mock('../../../src/money/rates/rates.json', () => ({
  default: { currencies: { EUR: { fact: 'money.rates.EUR', rates: [{ from: '2025-12-31', perUSD: '0.851' }] } } },
}));

describe('the exchange rates', () => {
  it("exchange nothing for a currency they don't hold, and tell the player so", () => {
    expect([knowsRate('JPY'), knowsRate('EUR'), knowsRate('USD')]).toEqual([false, true, true]);
    expect(rateOn('JPY', '2026-03-01')).toBeUndefined();
    expect(exchangeOn(money('USD', 100), 'JPY', '2026-03-01')).toBeUndefined();
    expect(aboutRate('JP')).toBe(t(UNKEPT_LINE, { country: 'Japan' }));
    expect(aboutRate('FR')).toBeUndefined();
  });
});
