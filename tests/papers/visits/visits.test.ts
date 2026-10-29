import { describe, expect, it } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/papers/visits/visits.json';
import { aboutVisits, keepsVisits, UNKEPT_LINE, visit } from '../../../src/papers/visits/visits.ts';

describe('visits', () => {
  it("ask each country's own, or the list it shares, of each passport", () => {
    expect(COUNTRY_CODES.filter(keepsVisits)).toEqual(Object.keys(data.countries).sort());
    expect([keepsVisits('FR'), keepsVisits('AQ')]).toEqual([true, false]);
    // The EU's common list: free movement inside, 90 days in 180 for Annex II, a visa for Annex I and everyone else.
    expect(visit('DE', 'FR')).toStrictEqual({ entry: 'free' });
    expect(visit('US', 'FR')).toStrictEqual({ entry: 'free', days: 90, within: 180 });
    expect(visit('IN', 'FR')).toStrictEqual({ entry: 'visa' });
    expect(visit('AF', 'NO')).toStrictEqual(visit('AF', 'DE'));
    // A citizen of the destination, or of the state whose nationality its people hold, is home.
    expect([visit('FR', 'FR'), visit('GP', 'FR'), visit('GU', 'US'), visit('US', 'GU'), visit('PR', 'VI')]).toEqual(['home', 'home', 'home', 'home', 'home']);
    // The list names a territory's own passport where it treats it apart from its state's; otherwise it is its state's.
    expect([visit('GB', 'US'), visit('JE', 'US'), visit('AI', 'US'), visit('BM', 'US')]).toStrictEqual([{ entry: 'eta', days: 90 }, { entry: 'eta', days: 90 }, { entry: 'visa' }, { entry: 'free' }]);
    expect(visit('GL', 'US')).toStrictEqual(visit('DK', 'US'));
    // Guam keeps the United States' list with its own waiver on top.
    expect([visit('MY', 'GU'), visit('MY', 'US'), visit('JP', 'GU'), visit('CN', 'GU')]).toStrictEqual([{ entry: 'eta', days: 45 }, { entry: 'visa' }, { entry: 'eta', days: 90 }, { entry: 'visa' }]);
    // A stay counted in months, and a list with no limit for its neighbours.
    expect([visit('US', 'GB'), visit('IE', 'GB'), visit('AU', 'NZ'), visit('NZ', 'AU')]).toStrictEqual([{ entry: 'eta', months: 6 }, { entry: 'free' }, { entry: 'free' }, { entry: 'free' }]);
    expect(visit('US', 'AQ')).toBeUndefined();
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('visits.unkept');
    expect(aboutVisits('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutVisits('AQ')).toBe("What Antarctica asks of a visitor isn't known to this game yet.");
    expect(aboutVisits('FR')).toBeUndefined();
  });
});
