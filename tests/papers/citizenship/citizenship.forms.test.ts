import { describe, expect, it, vi } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { atBirth, naturalisation, naturalise } from '../../../src/papers/citizenship/citizenship.ts';

/**
 * The forms of 2026-10-30 (citizenship at birth; naturalisation's fee, time and tests), read from a compiled file of
 * the form's shape: no research file carries them yet.
 */
vi.mock('../../../src/papers/citizenship/citizenship.json', () => ({
  default: {
    GB: { years: 5, renounce: false, lapses: false, atBirth: { soil: 'conditional', soilIf: 'a parent settled', descent: 'either parent', descentAbroad: 'one generation' }, fee: { currency: 'GBP', minor: 183900 }, within: { n: 6, unit: 'month' }, test: ['language', 'civics'] },
    MX: { years: 5, renounce: false, lapses: false, test: [] },
    IE: { years: 5, renounce: false, lapses: false, fee: { currency: 'EUR', minor: 95000 } },
    PT: { years: 5, renounce: false, lapses: false, within: { n: 12, unit: 'month' } },
    US: { years: 5, renounce: null, lapses: false, atBirth: { soil: 'unconditional', descent: 'either parent' } },
    CN: { years: 'none', renounce: null, lapses: true, atBirth: { soil: 'none', descent: 'either parent' } },
    NO: { years: 8, renounce: false, lapses: false, fee: { currency: 'NOK', minor: 640000 } },
    GU: { nationalityOf: 'US' },
    SJ: { nationalityOf: 'NO', residenceCounts: false },
  },
}));

describe('the citizenship rules, at birth and on naturalising', () => {
  it("give naturalisation's fee, time and tests where read", () => {
    expect(naturalisation('GB')).toStrictEqual({ years: 5, renounce: false, fee: money('GBP', 183900), within: { n: 6, unit: 'month' }, test: ['language', 'civics'] });
    expect(naturalisation('MX')).toStrictEqual({ years: 5, renounce: false, test: [] });
    expect(naturalisation('IE')).toStrictEqual({ years: 5, renounce: false, fee: money('EUR', 95000) });
    expect(naturalisation('PT')).toStrictEqual({ years: 5, renounce: false, within: { n: 12, unit: 'month' } });
    expect(naturalisation('US')).toStrictEqual({ years: 5, renounce: null });
    expect(naturalisation('GU')).toStrictEqual({ years: 5, renounce: null });
    expect([naturalisation('CN'), naturalisation('SJ'), naturalisation('KP')]).toEqual(['none', 'none', undefined]);
    expect(naturalise(['US'], 'GB')).toEqual({ held: ['US', 'GB'], unsure: [] });
  });

  it('give how citizenship comes at birth, a territory its state\'s', () => {
    expect(atBirth('GB')).toStrictEqual({ soil: 'conditional', soilIf: 'a parent settled', descent: 'either parent', descentAbroad: 'one generation' });
    expect(atBirth('US')).toStrictEqual({ soil: 'unconditional', descent: 'either parent' });
    expect(atBirth('GU')).toBe(atBirth('US'));
    expect(atBirth('CN')).toStrictEqual({ soil: 'none', descent: 'either parent' });
    expect([atBirth('MX'), atBirth('SJ'), atBirth('KP')]).toEqual([undefined, undefined, undefined]);
  });
});
