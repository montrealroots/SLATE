import { describe, expect, it } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/papers/work/work.json';
import { aboutWork, keepsWork, UNKEPT_LINE, work } from '../../../src/papers/work/work.ts';

describe('work', () => {
  it("ask each country's own, or the list it shares, of each passport", () => {
    expect(COUNTRY_CODES.filter(keepsWork)).toEqual(Object.keys(data.countries).sort());
    expect([keepsWork('DE'), keepsWork('AQ')]).toEqual([true, false]);
    // The EEA's free movement inside Germany; everyone else the German route, with the guest engagement's 90 days in a year.
    const german = { right: 'permit', route: 'Aufenthaltserlaubnis zur Beschäftigung (Kultur und Unterhaltung, § 25 BeschV)', days: 90, within: 365 };
    expect([work('FR', 'DE'), work('CH', 'DE'), work('US', 'DE'), work('IN', 'DE')]).toStrictEqual([{ right: 'free' }, { right: 'free' }, german, german]);
    // A territory's passport meets its state's rule unless the list names it (Greenland is Denmark's).
    expect(work('GL', 'DE')).toStrictEqual(work('DK', 'DE'));
    // The Compact states work freely in the United States; everyone else needs the O-1 petition, with no days without it.
    expect([work('PW', 'US'), work('MH', 'US'), work('GB', 'US')]).toStrictEqual([
      { right: 'free' },
      { right: 'free' },
      { right: 'permit', route: 'O-1 (extraordinary ability in the arts, or extraordinary achievement in motion pictures or television)' },
    ]);
    // The Common Travel Area: Irish citizens free in the United Kingdom; others the Creative Worker visa, or 30 days of permitted engagements.
    expect([work('IE', 'GB'), work('US', 'GB')]).toStrictEqual([{ right: 'free' }, { right: 'permit', route: 'Temporary Work – Creative Worker visa', days: 30 }]);
    // The United States' rules in its territories.
    expect([work('PW', 'GU'), work('GB', 'PR')]).toStrictEqual([work('PW', 'US'), work('GB', 'US')]);
    // France's in its departments, with free movement there; a performer's three months without the talent card.
    const french = { right: 'permit', route: 'Carte de séjour « talent – profession artistique et culturelle »', days: 90 };
    expect([work('DE', 'GP'), work('US', 'GP'), work('US', 'FR')]).toStrictEqual([{ right: 'free' }, french, french]);
    // Croatia's OECD artists work a short stay without a paper, a Guam passport as the United States'; Liechtenstein asks
    // even the EEA's citizens for a permit, with a service's 90 days a year, others' eight in 90.
    const croatian = { right: 'permit', route: 'Dozvola za boravak i rad' };
    expect([work('US', 'HR'), work('GU', 'HR'), work('IN', 'HR')]).toStrictEqual([{ ...croatian, days: 90, within: 180 }, { ...croatian, days: 90, within: 180 }, croatian]);
    expect([work('DE', 'LI'), work('GL', 'LI'), work('IN', 'LI'), work('LI', 'DE')]).toStrictEqual([
      { right: 'permit', route: 'Kurzaufenthaltsbewilligung (Art. 15 PFZG)', days: 90, within: 365 },
      { right: 'permit', route: 'Kurzaufenthaltsbewilligung (Art. 15 PFZG)', days: 90, within: 365 },
      { right: 'permit', route: 'Kurzaufenthaltsbewilligung (Art. 25 AuG)', days: 8, within: 90 },
      { right: 'free' },
    ]);
    // Hong Kong and Macao keep their own control: a passport of China's nationality isn't home there when the list names it.
    const macanese = { right: 'permit', route: 'Autorização de permanência na qualidade de trabalhador não residente', days: 45, within: 180 };
    expect([work('CN', 'MO'), work('HK', 'MO'), work('MO', 'HK')]).toStrictEqual([macanese, macanese, { right: 'permit', route: 'Employment visa', days: 14 }]);
    // A citizen of the destination, or of the state whose nationality its people hold, is home, even where the list names
    // that state's passport (France's, in the eea list); and in a territory of their own state that the list doesn't name.
    expect([work('DE', 'DE'), work('GP', 'FR'), work('JE', 'JE'), work('GP', 'GP'), work('GU', 'US'), work('US', 'GU'), work('PR', 'GU')]).toEqual(['home', 'home', 'home', 'home', 'home', 'home', 'home']);
    expect(work('US', 'AQ')).toBeUndefined();
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('work.unkept');
    expect(aboutWork('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutWork('AQ')).toBe("What Antarctica asks of a performer from abroad isn't known to this game yet.");
    expect(aboutWork('DE')).toBeUndefined();
  });
});
