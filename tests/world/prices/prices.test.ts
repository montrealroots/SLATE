import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES, currencyOf, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutPrices, keepsPrices, priceIn, priceLevel, UNKEPT_LINE } from '../../../src/world/prices/prices.ts';
import levels from '../../../src/world/prices/levels.json';

describe('the prices', () => {
  it("are the World Bank's levels, or carried from its benchmark, in each country's own currency", () => {
    expect(COUNTRY_CODES.filter(keepsPrices)).toEqual(Object.keys(levels));
    expect(priceLevel('US')).toEqual({ ppp: '1', year: 2025 });
    expect(priceLevel('QA')).toEqual({ ppp: '2.75548696215787', year: 2024 });
    expect(priceLevel('KP')).toBeUndefined();
    // Every country with a level has a currency to price in.
    expect(COUNTRY_CODES.filter((c) => keepsPrices(c) && currencyOf(c) === undefined)).toEqual([]);
    expect(priceIn('US', '10')).toEqual(money('USD', 1000));
    // 10 × 103.33658 yen, to the whole yen; 10 × 0.183187259430518 dinars, to the fils; 12.5 × 0.414616944167498 euros, to the cent.
    expect(priceIn('JP', '10')).toEqual(money('JPY', 1033));
    expect(priceIn('KW', '10')).toEqual(money('KWD', 1832));
    expect(priceIn('BG', '12.5')).toEqual(money('EUR', 518));
    expect(priceIn('CH', '1000')).toEqual(money('CHF', 106554));
    // Carried from the benchmark: Argentina's 661.287794234474 pesos to the dollar.
    expect(priceLevel('AR')).toEqual({ ppp: '661.287794234474', year: 2025 });
    expect(priceIn('AR', '10')).toEqual(money('ARS', 661288));
    // A territory with no level of its own keeps its neighbour's, in its own currency (the owner's ruling): Gibraltar's pound at par.
    expect(priceLevel('LI')).toEqual(priceLevel('CH'));
    expect(priceIn('GI', '10')).toEqual(money('GIP', Number(priceIn('GB', '10')?.minor)));
    // Carried from the Program's own benchmark, which the World Bank's indicators leave out: Taiwan's.
    expect(priceLevel('TW')?.year).toBe(2025);
    expect(priceIn('TW', '1')?.currency).toBe('TWD');
    // Half a cent goes to the even cent.
    expect([priceIn('US', '0.005'), priceIn('US', '0.015'), priceIn('US', '0')]).toEqual([money('USD', 0), money('USD', 2), money('USD', 0)]);
    expect(priceIn('KP', '10')).toBeUndefined();
    expect(priceIn('AQ', '10')).toBeUndefined();
  });
  it("tell the player where a country's aren't kept", () => {
    expect(UNKEPT_LINE).toBe('prices.unkept');
    expect(aboutPrices('KP')).toBe(t(UNKEPT_LINE, { country: 'North Korea' }));
    expect(aboutPrices('KP')).toBe("What things cost in North Korea isn't known to this game yet, so nothing there has a price.");
    expect(aboutPrices('US')).toBeUndefined();
  });
  it('at every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        const price = priceIn(p.country, '1');
        expect(price === undefined ? undefined : price.currency, p.id).toBe(keepsPrices(p.country) ? currencyOf(p.country) : undefined);
        expect(aboutPrices(p.country) === undefined, p.id).toBe(keepsPrices(p.country));
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
