import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { aboutMeans, FAMILIES, meansOf, SAVINGS_UNKEPT_LINE, UNKEPT_LINE } from '../../../src/money/means/means.ts';
import data from '../../../src/money/means/means.json';

describe('means', () => {
  it("give each family's first morning, from its band of the country's adults", () => {
    expect(FAMILIES).toEqual(['nothing', 'scraping', 'modest', 'comfortable', 'wealthy', 'inherited']);
    // Norway: no survey read gives deposits by wealth band, so nothing in savings, and the player told so; its bottom
    // fifth's net wealth below nothing is a debt.
    const no = data.countries.NO;
    expect(meansOf('NO', 'modest')).toStrictEqual({ checking: money('NOK', no.families.modest.checking), savings: money('NOK', 0), debt: money('NOK', 0), year: 2024 });
    expect(meansOf('NO', 'nothing')?.debt).toStrictEqual(money('NOK', no.families.nothing.debt));
    expect(aboutMeans('NO')).toBe(t(SAVINGS_UNKEPT_LINE, { country: 'Norway' }));
    expect(aboutMeans('NO')).toBe("What a family in Norway keeps in the bank isn't known to this game yet, so it gives nothing in savings.");
    // The United States: the Fed's Distributional Financial Accounts, the middle fifth half in the bottom half's band
    // (11,498 dollars a household) and half in the next 40%'s (94,153): 52,825.50.
    expect(meansOf('US', 'modest')?.savings).toStrictEqual(money('USD', 5_282_550));
    expect(aboutMeans('US')).toBeUndefined();
    // Hungary's survey is published in euros, its WID figures in forints.
    expect([meansOf('HU', 'modest')?.savings.currency, meansOf('HU', 'modest')?.checking.currency]).toEqual(['EUR', 'HUF']);
    expect(meansOf('US', 'inherited')?.checking.currency).toBe('USD');
    // Each family up the bands has more a month, in every country the game knows.
    for (const [code, m] of Object.entries(data.countries)) {
      const months = FAMILIES.map((f) => m.families[f].checking);
      expect(months, code).toEqual([...months].sort((a, b) => a - b));
    }
  });

  it("tell the player what the game doesn't know", () => {
    expect([UNKEPT_LINE, SAVINGS_UNKEPT_LINE]).toEqual(['means.unkept', 'means.savings-unkept']);
    // The Vatican: the database gives none of its figures.
    expect(meansOf('VA', 'modest')).toBeUndefined();
    expect(aboutMeans('VA')).toBe(t(UNKEPT_LINE, { country: 'Vatican' }));
    expect(aboutMeans('VA')).toBe("What a family in Vatican has to give isn't known to this game yet.");
  });
});
