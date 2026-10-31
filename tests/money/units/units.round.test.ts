import { describe, expect, it, vi } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { inUnits } from '../../../src/money/units/units.ts';

/** A law's rounding step that isn't the whole unit of money, held on the compiled form (the research's own is the NT's $1). */
vi.mock('../../../src/money/units/units.json', () => ({
  default: {
    units: {
      AA: { fact: 'f', name: 'a', currency: 'AUD', values: [{ from: '2026-01-01', value: '1.49' }], roundDown: '0.05' },
      BB: { fact: 'f', name: 'b', currency: 'AUD', values: [{ from: '2026-01-01', value: '1.49' }], roundDown: '5' },
    },
  },
}));

describe('units', () => {
  it("round down to the law's own step, a part of the unit of money or many of it", () => {
    // 10 units at $1.49 are $14.90: down to five cents, $14.90; down to five dollars, $10.
    expect(inUnits('10', 'AA', '2026-10-30')).toStrictEqual(money('AUD', 1490));
    expect(inUnits('11', 'AA', '2026-10-30')).toStrictEqual(money('AUD', 1635));
    expect(inUnits('10', 'BB', '2026-10-30')).toStrictEqual(money('AUD', 1000));
  });
});
