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
    // Australia's rules reach its external territories (the au list); Aruba asks the Kingdom's other Dutch passports for
    // its permit, though they share the Netherlands' nationality.
    expect([work('NZ', 'CX'), work('US', 'NF'), work('AU', 'CC')]).toStrictEqual([{ right: 'free' }, work('US', 'AU'), 'home']);
    const aruban = { right: 'permit', route: 'Vergunning tot tijdelijk verblijf met toestemming om arbeid te verrichten' };
    expect([work('NL', 'AW'), work('CW', 'AW'), work('NL', 'CW'), work('AW', 'AW')]).toStrictEqual([aruban, aruban, 'home', 'home']);
    // A British territory asks Britain's and the other territories' passports for its permit; Montserrat keeps the OECS's
    // free movement before its own.
    const virgin = { right: 'permit', route: 'Work permit (Labour Code 2010)' };
    expect([work('GB', 'VG'), work('BM', 'VG'), work('VG', 'VG'), work('DM', 'MS'), work('GB', 'MS')]).toStrictEqual([
      virgin,
      virgin,
      'home',
      { right: 'free' },
      { right: 'permit', route: 'Work permit (Labour Department)' },
    ]);
    // Saint-Pierre-et-Miquelon asks even the EU's citizens for a work authorisation, a performer's three months excepted;
    // the French are home. The TAAF ask the French too.
    expect([work('DE', 'PM'), work('FR', 'PM'), work('RE', 'TF')]).toStrictEqual([
      { right: 'permit', route: 'Autorisation provisoire de travail (emploi direct)', days: 90 },
      'home',
      { right: 'permit', route: 'Autorisation du préfet, administrateur supérieur des TAAF' },
    ]);
    // Albania lets the EU's, the United States' and its neighbours' citizens work as its own; Serbia a performer 90 days in
    // 180 without the single permit; Belarus keeps the EAEU's free labour market.
    expect([work('FR', 'AL'), work('US', 'AL'), work('RS', 'AL'), work('IN', 'AL')]).toStrictEqual([
      { right: 'free' },
      { right: 'free' },
      { right: 'free' },
      { right: 'permit', route: 'Leje unike për kategori të veçanta' },
    ]);
    expect([work('US', 'RS'), work('RU', 'BY'), work('DE', 'UA')]).toStrictEqual([
      { right: 'permit', route: 'Jedinstvena dozvola', days: 90, within: 180 },
      { right: 'free' },
      { right: 'free' },
    ]);
    // ECOWAS's twelve work in each other's countries as nationals (the ecowas list); Niger, gone from it, asks a Nigerian
    // for its contract visa as it asks anyone.
    const nigerien = { right: 'permit', route: 'Visa du contrat de travail (service public de l’emploi)' };
    expect([work('NG', 'GN'), work('GH', 'BJ'), work('US', 'GN'), work('NG', 'NE'), work('US', 'NE')]).toStrictEqual([
      { right: 'free' },
      { right: 'free' },
      { right: 'permit', route: 'Permis de travail (service public d’emploi)' },
      nigerien,
      nigerien,
    ]);
    // A citizen of the destination, or of the state whose nationality its people hold, is home, even where the list names
    // that state's passport (France's, in the eea list); and in a territory of their own state that the list doesn't name.
    expect([work('DE', 'DE'), work('GP', 'FR'), work('JE', 'JE'), work('GP', 'GP'), work('GU', 'US'), work('US', 'GU'), work('PR', 'GU')]).toEqual(['home', 'home', 'home', 'home', 'home', 'home', 'home']);
    expect(work('US', 'AQ')).toBeUndefined();
    // Corrected from the permit research (2026-11-01): Finland's artists' 90 days in 180, the Netherlands' six weeks in
    // thirteen, St Helena's 182 days in a year, Austria's eight weeks of a production; and Botswana, the Central African
    // Republic and Libya, whose rules it found, ask every foreign worker for their permit.
    expect([work('US', 'FI'), work('US', 'NL'), work('US', 'SH'), work('US', 'AT')]).toMatchObject([{ days: 90, within: 180 }, { days: 42, within: 91 }, { days: 182, within: 365 }, { days: 56 }]);
    expect([keepsWork('BW'), keepsWork('CF'), keepsWork('LY'), keepsWork('SA'), keepsWork('TG')]).toEqual([true, true, true, false, false]);
    expect([work('US', 'BW'), work('FR', 'CF'), work('EG', 'LY')]).toStrictEqual([
      { right: 'permit', route: 'Work permit (Employment of Non-Citizens Act), with the residence permit' },
      { right: 'permit', route: "Visa du contrat de travail (the Minister in charge of Employment's visa on the contract or letter of engagement of a non-Central African worker; Code du travail, loi n° 09.004, art. 100)" },
      { right: 'permit', route: 'Permit for recruiting foreign labour (Ministry of Labour and Rehabilitation), then an entry visa for residence and work (Decree No. 212 of 2009; Labour Relations Law No. 12 of 2010)' },
    ]);
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('work.unkept');
    expect(aboutWork('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutWork('AQ')).toBe("What Antarctica asks of a performer from abroad isn't known to this game yet.");
    expect(aboutWork('DE')).toBeUndefined();
  });
});
