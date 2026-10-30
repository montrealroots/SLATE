import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { FOLDED, SOURCE as OUTLINES } from '../naturalearth/compile.ts';

/**
 * Compiles the weather's stations from the WMO's climatological normals, as each Member's national weather service
 * computed and submitted them and NCEI (the World Data Center for Meteorology) holds them: the 1991-2020 standard
 * normals (register R-0037; the composite files of the primary parameters, accession 0253808 release 6.6), and, for
 * what those lack, the 1961-1990 reference normals (R-0038). For each station: its place, its height, and for each
 * month the mean daily maximum and minimum temperature, the precipitation, the number of days with at least 1 mm, and
 * the hours of sunshine, each only where every month is given.
 *
 * A station's country is the gazetteer's code for the Member that submitted it; where a Member submitted stations in
 * territories that the gazetteer lists apart (France's overseas departments, the United States' islands, the United
 * Kingdom's territories, Antarctica), the station's country is that of the nearest place among the Member's own
 * codes, and any station south of 60°S is Antarctica's.
 */
export const SOURCES_9120 = {
  tmax: { file: 'vendor/wmo/9120/wmo_normals_9120_TMAX.csv', sha256: '09563b636ba36bc76fc6a69747118108245fe97e94e05ec8d2b320efee8cadd9' },
  tmin: { file: 'vendor/wmo/9120/wmo_normals_9120_TMIN.csv', sha256: 'a7ded2f725a8ecea69664f1a44a82e881ce95f370543d6dd21ef7eb193bd48a8' },
  prcp: { file: 'vendor/wmo/9120/wmo_normals_9120_PRCP.csv', sha256: '32b9c09409398005eb20882be58fef4c03486d9a19f07e3ade280877fbc5dbd2' },
  wet: { file: 'vendor/wmo/9120/wmo_normals_9120_DP01.csv', sha256: 'c459cd8ba91bf052e0f3f67cf2946b4ed5ddecce825ea338e2fad25e9db53205' },
  sun: { file: 'vendor/wmo/9120/wmo_normals_9120_TSUN.csv', sha256: '4c8ca3304fcc8cb1f5e184a147d513714fc9adc3be143f21d65bbfff8d22cd08' },
} as const;
export const SOURCES_6190 = {
  normals: { file: 'vendor/wmo/6190/ALLNORMS.DAT.gz', sha256: '7e83b7d7739e0946c49a525a64e3f1cfe022da70116e6e400fd961c0548b8216' },
  stations: { file: 'vendor/wmo/6190/STNMETA.DAT.gz', sha256: '2cbec731f8f6af1273c3d92e865659fcf635b3b9880a2f10b05ae7841a5ff402' },
} as const;
/** The 1981-2010 standard normals (R-0044), as each Member submitted them to NCEI: only Ecuador's give what the others lack. */
export const SOURCES_8110 = {
  EC: { file: 'vendor/wmo/8110/RECOPILACION_DATOS_ECUADOR.csv', sha256: '9a692f7d00e9897d429923a20a058c4ce9dac2f37fc5bc8bed0fb87aefe05bad' },
} as const;
export const SOURCE_MF = { file: 'research/sources/meteofrance-fiches.json', sha256: '82dcf1612da16cb340cc41f2d16fc9569a18ef9d941a640c71669293ec623ae6' } as const;
export const SOURCE_CWA = { file: 'research/sources/cwa-normals.json', sha256: '4d60c0233bfc4e1c3abb789f511450bf8ec4236b68c5effae7038d2fe6c165f3' } as const;
export const SOURCE_METOFFICE = { file: 'research/sources/metoffice-averages.json', sha256: '52f29cefec587865e60655f7631f3814bf0fdcb4fce4115abfe9dbfb3c6149ff' } as const;
/**
 * Normals read by hand from a published table, each with the file it was read from, pinned (they can't be parsed from
 * a scan or a paper's layout): the Bermuda Meteorological Office's Technical Note No. 5, Sunshine in Bermuda (W. A.
 * Macky, 1952; R-0049), its Table 3's average monthly hours of sunshine, 1927-1951, at Fort George, where the recorder
 * stood from 1932 (32°23'N, 64°41'W, 182 feet; the months sum to its stated annual average of 2,588 hours); and
 * Regmi and Adhikary's Solar Energy Potential in Kathmandu Valley (2012; R-0057), its Table 1's mean daily sunshine of
 * 1968-2004 from Nepal's Department of Hydrology and Meteorology, by the month's days (February's 28.25), at the middle
 * of the valley's extent and its mean height as the paper gives them; and the Plan de gestion de la Réserve Naturelle
 * Nationale de Saint-Martin (2009; R-0060), its Tableau 20's monthly means from Météo-France: insolation at Gustavia,
 * Saint-Barthélemy, 1976-1998 (summing to its 3,032 hours), and precipitation at Marigot, Saint-Martin, 1971-2000
 * (summing to its 1,159.6 mm), each at its town as the gazetteer places it, the stations' own places not given; and
 * Meteo Curaçao's Summary of Climatological Normals for Flamingo Airport, Bonaire, 1971-2000 (R-0074), its mean
 * daily maximum and minimum, monthly rainfall and days of at least 1 mm (12°08'N, 68°17'W; no height given).
 */
// Stryker disable all: a table made as the module loads (see the Members' tables); the byte-for-byte test holds it.
export const HAND_READ: readonly { source: { file: string; sha256: string }; station: SourceStation }[] = [
  {
    source: { file: 'vendor/bws/1952_06_01_No5_Sunshine_In_Bermuda.pdf', sha256: 'e040193828cea956651a5f27ac8e47e5ac3dd2746c5b374e17788b28c45949ef' },
    station: { id: 'bws:fort-george:1927-1951', name: 'Fort George', country: 'BM', latitude: 32.3833, longitude: -64.6833, elevation: 55, period: '1927-1951', normals: { sun: [157.0, 153.7, 194.6, 226.3, 254.3, 258.5, 305.4, 278.8, 236.9, 195.9, 174.0, 152.5] } },
  },
  {
    source: { file: 'vendor/dhm/Regmi-Adhikary-2012-Solar-Energy-Potential-Kathmandu.pdf', sha256: 'cdec548eee546558343edc72c1c04e9ab39c66d5fe9d953a4f68b54fb86273ad' },
    station: { id: 'dhm:kathmandu-valley:1968-2004', name: 'Kathmandu valley', country: 'NP', latitude: 27.6782, longitude: 85.3596, elevation: 1350, period: '1968-2004', normals: { sun: [201.5, 209.1, 241.8, 234.0, 238.7, 168.0, 124.0, 151.9, 153.0, 229.4, 222.0, 204.6] } },
  },
  {
    source: { file: 'vendor/rnsm/plan-de-gestion-2009-pg66-113.pdf', sha256: '70d346d2db185a74ab75c6cafe809485caa844e5cc0f530488e497e32b6f67e5' },
    station: { id: 'rnsm:gustavia:1976-1998', name: 'Gustavia', country: 'BL', latitude: 17.8962, longitude: -62.8498, elevation: null, period: '1976-1998', normals: { sun: [261, 236, 266, 261, 257, 257, 264, 270, 235, 250, 232, 243] } },
  },
  {
    source: { file: 'vendor/rnsm/plan-de-gestion-2009-pg66-113.pdf', sha256: '70d346d2db185a74ab75c6cafe809485caa844e5cc0f530488e497e32b6f67e5' },
    station: { id: 'rnsm:marigot:1971-2000', name: 'Marigot', country: 'MF', latitude: 18.0682, longitude: -63.083, elevation: null, period: '1971-2000', normals: { prcp: [68.7, 60.9, 50.3, 80.7, 103.9, 64.2, 70.4, 93.4, 143.2, 156.3, 173.9, 93.8] } },
  },
  {
    source: { file: 'vendor/meteocw/CLIM_SUM_Bon.pdf', sha256: '7d04eb008526c584f9f4f6fda242a9644654d4063e859ba15254b27470d193f4' },
    station: { id: 'meteocw:flamingo:1971-2000', name: 'Flamingo Airport', country: 'BQ', latitude: 12.1333, longitude: -68.2833, elevation: null, period: '1971-2000', normals: { tmax: [29.5, 29.7, 30.0, 30.4, 31.0, 31.2, 31.1, 31.6, 31.9, 31.7, 31.0, 30.0], tmin: [24.4, 24.5, 24.8, 25.4, 26.2, 26.4, 26.2, 26.5, 26.5, 26.3, 25.7, 25.0], prcp: [44.4, 18.3, 13.2, 13.2, 14.8, 14.4, 36.3, 35.0, 37.0, 67.3, 95.9, 73.6], wet: [9.2, 4.4, 2.5, 1.8, 1.7, 2.8, 5.6, 4.4, 5.0, 7.6, 11.5, 10.8] } },
  },
];
// Stryker restore all
export const SOURCE_DWD = { file: 'research/sources/dwd-multi-annual.json', sha256: '185b8472b65a84cfd8b493b732cc6b551bfb45868d72e8ff3704e50fc3ee9b6d' } as const;
export const SOURCE_KT = { file: 'research/sources/dwd-klimatafeln.json', sha256: '13c7692ba29277bc3564ee4366516eabc8824a32d366bf9596660394c666aff6' } as const;
export const SOURCE_WWIS = { file: 'research/sources/wwis-climate.json', sha256: '145b04103a14ec2ee048df87efa03483b87ea359e7a80c378578bd62687c7651' } as const;
export const SOURCE_ANGUILLA = { file: 'research/sources/anguilla-climate.json', sha256: 'ff25c6805b8bde223b8eda33716b52c2a7dd05537a0ae0139ac80085200fdc75' } as const;
export const SOURCE_TONGA = { file: 'research/sources/tonga-climate.json', sha256: 'a4a84177d234a31d4350679c88cfbcc42d45ab0f25bab9a63352332a89873b3c' } as const;
export const SOURCE_GHCND = { file: 'research/sources/ghcnd-daily.json', sha256: 'd82ab4db4600eead59ccd2d7f3da00bbb661550b150edc09b736215e1fecc293' } as const;
export const OUTPUT = 'src/world/weather/stations.json';

export type Param = 'tmax' | 'tmin' | 'prcp' | 'wet' | 'sun';
export const PARAMS: readonly Param[] = ['tmax', 'tmin', 'prcp', 'wet', 'sun'];
export type Months = number[];

export interface Station {
  id: string;
  /** The Member's name for it. */
  name: string;
  /** The gazetteer's town nearest it in its country, within TOWN_KM; null where none is. */
  town: string | null;
  /** The gazetteer's country code. */
  country: string;
  latitude: number;
  longitude: number;
  /** Metres above sea level; null where none is given. */
  elevation: number | null;
  /** The years its normals cover, as "1991-2020"; null where the source gives none. */
  period: string | null;
  normals: Partial<Record<Param, Months>>;
}

// Stryker disable all: tables made as the module loads; Stryker 10.0.0 doesn't load the module again for each mutant of
// them, so none could be seen. The byte-for-byte test holds them (a code changed by hand fails it).
/** The territories a Member may have submitted stations in, beside its own country, by the gazetteer's codes. */
const FRANCE = ['FR', 'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF', 'NC', 'WF', 'TF', 'PF'];
const UNITED_STATES = ['US', 'PR', 'VI', 'GU', 'AS', 'MP', 'UM', 'FM', 'MH', 'PW'];
const UNITED_KINGDOM = ['GB', 'IM', 'JE', 'GG', 'GI', 'BM', 'KY', 'VG', 'AI', 'MS', 'TC', 'FK', 'SH', 'IO', 'PN', 'GS'];

/** The 1991-2020 composite files' country names, each with the codes its stations may be in (the first its own). */
export const MEMBERS_9120: Readonly<Record<string, readonly string[]>> = {
  Algeria: ['DZ'], Antigua_and_Barbuda: ['AG'], Argentina: ['AR'], Armenia: ['AM'], Australia: ['AU', 'CX', 'CC', 'NF', 'HM'],
  Austria: ['AT'], Bahamas: ['BS'], Bahrain: ['BH'], Bangladesh: ['BD'], Barbados: ['BB'], Belarus: ['BY'], Belgium: ['BE'],
  Belize: ['BZ'], Benin: ['BJ'], Bermuda: ['BM'], Bosnia_and_Herzegovina: ['BA'], Bosnia_and_Herzegovina_Srpska: ['BA'], Brazil: ['BR'],
  Brunei_Darussalam: ['BN'], Bulgaria: ['BG'], Burkina_Faso: ['BF'], Cabo_Verde_Republic: ['CV'], Cameroon: ['CM'], Canada: ['CA'],
  Cayman_Islands: ['KY'], Central_African_Republic: ['CF'], Chile: ['CL'], China: ['CN'], Colombia: ['CO'], Costa_Rica: ['CR'],
  "Cote_d'Ivoire": ['CI'], Croatia: ['HR'], 'Curacao_a._S._Maarten': ['CW', 'SX'], Cyprus: ['CY'], Czech_Republic: ['CZ'],
  'Dem._Rep._Congo': ['CD'], Denmark: ['DK'], Denmark_Faroe_Islands: ['FO'], Denmark_Greenland: ['GL'], Dominica: ['DM'],
  Dominican_Republic: ['DO'], Ecuador: ['EC'], Egypt: ['EG'], El_Salvador: ['SV'], Estonia: ['EE'], Fiji: ['FJ'], Finland: ['FI', 'AX'],
  'Fr._Polynesia': ['PF'], France: FRANCE, Gambia: ['GM'], Georgia: ['GE'], Germany: ['DE'], Ghana: ['GH'], Grenada: ['GD'],
  Guatemala: ['GT'], Guinea: ['GN'], Guinea_Bissau: ['GW'], Guyana: ['GY'], Hong_Kong_China: ['HK'], Hungary: ['HU'], Iceland: ['IS'],
  India: ['IN'], Indonesia: ['ID'], Iran: ['IR'], Iraq: ['IQ'], Ireland: ['IE'], Israel: ['IL'], Italy: ['IT'], Jamaica: ['JM'],
  Japan: ['JP'], Kazakhstan: ['KZ'], Kiribati: ['KI'], Kyrgyzstan: ['KG'], Laos: ['LA'], Latvia: ['LV'], Libya: ['LY'],
  Luxembourg: ['LU'], Macau_China: ['MO'], Madagascar: ['MG'], Malaysia: ['MY'], Maldives: ['MV'], Mali: ['ML'], Mauritania: ['MR'],
  Mauritius: ['MU'], Mexico: ['MX'], Moldova: ['MD'], Mongolia: ['MN'], Montenegro: ['ME'], Morocco: ['MA', 'EH'], Myanmar: ['MM'],
  Nepal: ['NP'], Netherlands: ['NL'], New_Zealand: ['NZ', 'CK', 'NU', 'TK'], Niger: ['NE'], Nigeria: ['NG'], Norway: ['NO', 'SJ', 'BV'],
  Oman: ['OM'], Pakistan: ['PK'], Paraguay: ['PY'], Peru: ['PE'], Philippines: ['PH'], Poland: ['PL'], 'Rep._Korea': ['KR'],
  Romania: ['RO'], 'Russian_Federation_(In_Asia)': ['RU'], 'Russian_Federation_(In_Europe)': ['RU'], Rwanda: ['RW'], Saint_Lucia: ['LC'],
  Samoa: ['WS'], Saudi_Arabia: ['SA'], Senegal: ['SN'], Serbia: ['RS', 'XK'], Seychelles: ['SC'], Singapore: ['SG'], Slovakia: ['SK'],
  Slovenia: ['SI'], Solomon_Islands: ['SB'], South_Africa: ['ZA'], Spain: ['ES'], Sri_Lanka: ['LK'], 'St._Kitts_and_Nevis': ['KN'],
  Sudan: ['SD', 'SS'], Suriname: ['SR'], Sweden: ['SE'], Switzerland: ['CH', 'LI'], Syria: ['SY'], Tanzania: ['TZ'], Thailand: ['TH'],
  Togo: ['TG'], Trinidad_and_Tobago: ['TT'], Tunisia: ['TN'], Turkiye: ['TR'], Turkmenistan: ['TM'], Tuvalu: ['TV'], Ukraine: ['UA'],
  United_Arab_Emirates: ['AE'], United_Kingdom: UNITED_KINGDOM, United_States: UNITED_STATES, Uruguay: ['UY'], Uzbekistan: ['UZ'],
  Venezuela: ['VE'], Zambia: ['ZM'],
};

/**
 * The 1961-1990 normals' own country codes (NCDC's, not ISO's: CTRYCOD1.TXT), each with the codes its stations may be in.
 * RA's and RE's (Russia's) include stations of the Soviet Union's in what are now other countries (Leninabad, now
 * Khujand, Termez, Kushka, Nikolaev and others); compileStations' check gives each the country whose town it lies by.
 */
export const MEMBERS_6190: Readonly<Record<string, readonly string[]>> = {
  AH: ['AF'], AB: ['AL'], AL: ['DZ'], AN: ['AO'], AG: ['AR'], AA: ['AQ'], AR: ['AM'], AU: ['AU', 'CX', 'CC', 'NF', 'HM'], AS: ['AQ'],
  OS: ['AT'], AJ: ['AZ'], BA: ['BS'], B1: ['BH'], BL: ['BY'], BX: ['BE'], B2: ['BZ'], B3: ['BJ'], BH: ['BA'], BZ: ['BR'], BP: ['BN'],
  BU: ['BG'], KM: ['CM'], CN: ['CA'], CV: ['CV'], TE: ['TD'], CH: ['CL'], AC: ['AQ'], PC: ['CN'], CO: ['CO'], C1: ['CO'], CS: ['CR'],
  HR: ['HR'], CU: ['CU'], CY: ['CY'], CZ: ['CZ'], DN: ['DK', 'FO'], D1: ['DJ'], DO: ['DM'], DR: ['DO'], EQ: ['EC'], UB: ['EG'], SV: ['SV'],
  E1: ['ER'], ES: ['EE'], EJ: ['FJ'], FI: ['FI', 'AX'], FR: ['FR'], GP: ['GP', 'MQ'], FG: ['GF'], F1: ['RE', 'YT', 'TF'], FP: ['PF'],
  GN: ['GA'], GA: ['GE'], DL: ['DE'], GR: ['GR'], GL: ['GL'], GW: ['GN'], BG: ['GY'], HO: ['HN'], HK: ['HK'], HU: ['HU'], IL: ['IS'],
  IN: ['IN'], IR: ['IR'], IE: ['IE'], IS: ['IL'], IY: ['IT'], IV: ['CI'], JP: ['JP'], AP: ['AQ'], TJ: ['JO'], KS: ['KZ'], KZ: ['KZ'],
  KN: ['KE'], K1: ['KP'], KO: ['KR'], KW: ['KW'], KY: ['KG'], LA: ['LA'], LV: ['LV'], LB: ['LB'], LU: ['LT'], LX: ['LU'], MG: ['MG'],
  MW: ['MW'], MS: ['MY'], MV: ['MV'], M1: ['ML'], ML: ['MT'], MA: ['MU'], MX: ['MX'], MD: ['MD'], MO: ['MN'], FM: ['MA', 'EH'],
  MM: ['MM'], NL: ['NL'], NA: ['CW', 'AW', 'SX', 'BQ'], NC: ['NC'], NZ: ['NZ', 'CK', 'NU', 'TK'], NK: ['NI'], NG: ['NE'], NI: ['NG'],
  NO: ['NO', 'SJ', 'BV'], OM: ['OM'], PK: ['PK'], PY: ['PY'], PR: ['PE'], PH: ['PH'], PL: ['PL'], PO: ['PT'], PA: ['PT'], QR: ['QA'],
  RO: ['RO'], RA: ['RU'], RE: ['RU'], RW: ['RW'], SD: ['SA'], SG: ['SN'], SC: ['SC'], SL: ['SL'], SR: ['SG'], S1: ['SK'], S2: ['SI'],
  SO: ['SB'], UA: ['ZA'], SP: ['ES'], SA: ['ES'], S3: ['LK'], SU: ['SD', 'SS'], SN: ['SE'], SW: ['CH', 'LI'], SY: ['SY'], TK: ['TJ'],
  TN: ['TZ'], TH: ['TH'], MC: ['MK'], TG: ['TG'], TD: ['TT'], TS: ['TN'], TU: ['TR'], TX: ['TM'], UP: ['UA'], UE: ['AE'],
  UK: UNITED_KINGDOM, US: UNITED_STATES, AM: ['AQ'], U1: UNITED_STATES, UY: ['UY'], UZ: ['UZ'], VN: ['VE'], YG: ['RS', 'ME', 'XK'],
  ZA: ['ZM'], ZI: ['ZW'],
};

/** The World Weather Information Service's Members (its cities' member.memName), each with the codes its cities may be in. */
export const MEMBERS_WWIS: Readonly<Record<string, readonly string[]>> = {
  'Afghanistan': ['AF'], 'Algeria': ['DZ'], 'Angola': ['AO'], 'Antigua and Barbuda': ['AG'], 'Argentina': ['AR'],
  'Armenia': ['AM'], 'Australia': ['AU', 'CX', 'CC', 'NF', 'HM'], 'Austria': ['AT'], 'Azerbaijan': ['AZ'],
  'Bahamas': ['BS'], 'Bahrain': ['BH'], 'Bangladesh': ['BD'], 'Belarus': ['BY'], 'Belgium': ['BE'], 'Belize': ['BZ'],
  'Benin': ['BJ'], 'Bhutan': ['BT'], 'Bosnia and Herzegovina': ['BA'], 'Botswana': ['BW'], 'Brazil': ['BR'],
  'British Caribbean Territories': ['KY', 'AI', 'VG', 'MS', 'TC'], 'Brunei Darussalam': ['BN'], 'Bulgaria': ['BG'],
  'Burkina Faso': ['BF'], 'Burundi': ['BI'], 'Cabo Verde': ['CV'], 'Cambodia': ['KH'], 'Cameroon': ['CM'],
  'Canada': ['CA'], 'Chad': ['TD'], 'Chile': ['CL'], 'China': ['CN'], 'Colombia': ['CO'], 'Comoros': ['KM'],
  'Costa Rica': ['CR'], 'Croatia': ['HR'], 'Cuba': ['CU'], 'Curaçao and Sint Maarten': ['CW', 'SX', 'AW', 'BQ'],
  'Cyprus': ['CY'], 'Czechia': ['CZ'], "Côte d'Ivoire": ['CI'], "Democratic People's Republic of Korea": ['KP'],
  'Denmark': ['DK', 'FO', 'GL'], 'Djibouti': ['DJ'], 'Dominica': ['DM'], 'Dominican Republic': ['DO'],
  'Ecuador': ['EC'], 'Egypt': ['EG'], 'El Salvador': ['SV'], 'Eritrea': ['ER'], 'Estonia': ['EE'], 'Eswatini': ['SZ'],
  'Ethiopia': ['ET'], 'Fiji': ['FJ'], 'Finland': ['FI', 'AX'], 'France': FRANCE, 'France - Guadeloupe': ['GP'],
  'France - Guiana': ['GF'], 'France - La Réunion': ['RE'], 'France - Martinique': ['MQ'], 'France - Mayotte': ['YT'],
  'France - Saint-Barthélemy': ['BL'], 'France - Saint-Martin': ['MF'], 'France - Saint-Pierre-et-Miquelon': ['PM'],
  'France - Wallis-et-Futuna': ['WF'], 'French Polynesia': ['PF'], 'Gabon': ['GA'], 'Gambia (The)': ['GM'],
  'Georgia': ['GE'], 'Germany': ['DE'], 'Ghana': ['GH'], 'Greece': ['GR'], 'Guatemala': ['GT'], 'Guinea': ['GN'],
  'Guinea-Bissau': ['GW'], 'Guyana': ['GY'], 'Haiti': ['HT'], 'Honduras': ['HN'], 'Hong Kong, China': ['HK'],
  'Hungary': ['HU'], 'Iceland': ['IS'], 'India': ['IN'], 'Indonesia': ['ID'], 'Iran (Islamic Republic of)': ['IR'],
  'Iraq': ['IQ'], 'Ireland': ['IE'], 'Israel': ['IL'], 'Italy': ['IT'], 'Jamaica': ['JM'], 'Japan': ['JP'],
  'Jordan': ['JO'], 'Kazakhstan': ['KZ'], 'Kenya': ['KE'], 'Kuwait': ['KW'], 'Kyrgyzstan': ['KG'],
  "Lao People's Democratic Republic": ['LA'], 'Latvia': ['LV'], 'Lebanon': ['LB'], 'Lesotho': ['LS'],
  'Libya (State of)': ['LY'], 'Lithuania': ['LT'], 'Luxembourg': ['LU'], 'Macao, China': ['MO'], 'Madagascar': ['MG'],
  'Malawi': ['MW'], 'Malaysia': ['MY'], 'Maldives': ['MV'], 'Mali': ['ML'], 'Malta': ['MT'], 'Mauritius': ['MU'],
  'Mexico': ['MX'], 'Mongolia': ['MN'], 'Montenegro': ['ME'], 'Morocco': ['MA', 'EH'], 'Mozambique': ['MZ'],
  'Myanmar': ['MM'], 'Namibia': ['NA'], 'Nepal': ['NP'],
  'Netherlands (Kingdom of the)': ['NL', 'AW', 'BQ', 'CW', 'SX'], 'New Caledonia': ['NC'],
  'New Zealand': ['NZ', 'CK', 'NU', 'TK'], 'Nicaragua': ['NI'], 'Niger': ['NE'], 'Nigeria': ['NG'],
  'North Macedonia': ['MK'], 'Norway': ['NO', 'SJ', 'BV'], 'Oman': ['OM'], 'Pakistan': ['PK'], 'Panama': ['PA'],
  'Papua New Guinea': ['PG'], 'Paraguay': ['PY'], 'Peru': ['PE'], 'Philippines': ['PH'], 'Poland': ['PL'],
  'Portugal': ['PT'], 'Portugal - Madeira': ['PT'], 'Qatar': ['QA'], 'Republic of Korea': ['KR'],
  'Republic of Moldova': ['MD'], 'Romania': ['RO'], 'Russian Federation': ['RU'], 'Rwanda': ['RW'],
  'Saint Lucia': ['LC'], 'Samoa': ['WS'], 'Saudi Arabia': ['SA'], 'Senegal': ['SN'], 'Serbia': ['RS', 'XK'],
  'Seychelles': ['SC'], 'Sierra Leone': ['SL'], 'Singapore': ['SG'], 'Slovakia': ['SK'], 'Slovenia': ['SI'],
  'Solomon Islands': ['SB'], 'Somalia': ['SO'], 'South Africa': ['ZA'], 'South Sudan': ['SS'], 'Spain': ['ES'],
  'Spain - Canary Islands': ['ES'], 'Spain - Ceuta': ['ES'], 'Spain - Melilla': ['ES'], 'Sri Lanka': ['LK'],
  'Sudan': ['SD', 'SS'], 'Suriname': ['SR'], 'Sweden': ['SE'], 'Switzerland': ['CH', 'LI'],
  'Syrian Arab Republic': ['SY'], 'Tajikistan': ['TJ'], 'Thailand': ['TH'], 'Togo': ['TG'],
  'Trinidad and Tobago': ['TT'], 'Tunisia': ['TN'], 'Turkmenistan': ['TM'], 'Türkiye': ['TR'], 'UK - Bermuda': ['BM'],
  'UK - Guernsey': ['GG'], 'UK - Isle of Man': ['IM'], 'UK - Jersey': ['JE'], 'Uganda': ['UG'], 'Ukraine': ['UA'],
  'United Arab Emirates': ['AE'], 'United Kingdom of Great Britain and Northern Ireland': UNITED_KINGDOM,
  'United Republic of Tanzania': ['TZ'], 'United States of America': UNITED_STATES, 'Uruguay': ['UY'],
  'Uzbekistan': ['UZ'], 'Vanuatu': ['VU'], 'Venezuela, Bolivarian Republic of': ['VE'], 'Viet Nam': ['VN'],
  'Zambia': ['ZM'], 'Zimbabwe': ['ZW'],
};

/** The Deutscher Wetterdienst's stations' countries (its station list's Country), each with the codes its stations may be in. */
export const COUNTRIES_DWD: Readonly<Record<string, readonly string[]>> = {
  'Afghanistan': ['AF'], 'Albania': ['AL'], 'Algeria': ['DZ'], 'Angola': ['AO'], 'Antarctica': ['AQ'],
  'Argentina': ['AR'], 'Armenia': ['AM'], 'Aruba': ['AW'], 'Ascension Island': ['SH'],
  'Australia': ['AU', 'CX', 'CC', 'NF', 'HM'], 'Austria': ['AT'], 'Azerbaijan': ['AZ'], 'Bahamas': ['BS'],
  'Bahrain': ['BH'], 'Bangladesh': ['BD'], 'Barbados': ['BB'], 'Belarus': ['BY'], 'Belgium': ['BE'], 'Belize': ['BZ'],
  'Benin': ['BJ'], 'Bermuda': ['BM'], 'Bolivia': ['BO'], 'Bosnia and Herzegovina': ['BA'], 'Botswana': ['BW'],
  'Brazil': ['BR'], 'Brunei': ['BN'], 'Bulgaria': ['BG'], 'Burkina Faso': ['BF'], 'Burundi': ['BI'],
  'Cabo Verde': ['CV'], 'Cambodia': ['KH'], 'Cameroon': ['CM'], 'Canada': ['CA'], 'Caroline Islands': ['FM', 'PW'],
  'Cayman Islands': ['KY'], 'Central African Republic': ['CF'], 'Chad': ['TD'], 'Chile': ['CL'], 'China': ['CN'],
  'Colombia': ['CO'], 'Comoros': ['KM'], 'Cook Islands': ['CK'], 'Costa Rica': ['CR'], "Cote d'Ivoire": ['CI'],
  'Croatia': ['HR'], 'Cuba': ['CU'], 'Curacao': ['CW'], 'Cyprus': ['CY'], 'Czech Republic': ['CZ'],
  'Dem. Republic of the Congo': ['CD'], 'Denmark': ['DK'], 'Djibouti': ['DJ'], 'Dominican Republic': ['DO'],
  'Ecuador': ['EC'], 'Egypt': ['EG'], 'El Salvador': ['SV'], 'Equatorial Guinea': ['GQ'], 'Eritrea': ['ER'],
  'Estonia': ['EE'], 'Ethiopia': ['ET'], 'Faroe Islands': ['FO'], 'Fiji': ['FJ'], 'Finland': ['FI', 'AX'],
  'France': FRANCE, 'French Guiana': ['GF'], 'French Polynesia': ['PF'], 'Gabon': ['GA'], 'Gambia': ['GM'],
  'Georgia': ['GE'], 'Germany': ['DE'], 'Ghana': ['GH'], 'Gibraltar': ['GI'], 'Greece': ['GR'], 'Greenland': ['GL'],
  'Guadeloupe': ['GP'], 'Guam': ['GU'], 'Guatemala': ['GT'], 'Guinea': ['GN'], 'Guinea-Bissau': ['GW'],
  'Guyana': ['GY'], 'Haiti': ['HT'], 'Honduras': ['HN'], 'Hungary': ['HU'], 'Iceland': ['IS'], 'India': ['IN'],
  'Indonesia': ['ID'], 'Iran (Islamic Rep. of)': ['IR'], 'Iraq': ['IQ'], 'Ireland': ['IE'], 'Israel': ['IL'],
  'Italy': ['IT'], 'Jamaica': ['JM'], 'Japan': ['JP'], 'Jordan': ['JO'], 'Kazakhstan': ['KZ'], 'Kenya': ['KE'],
  'Kiribati': ['KI'], "Korea, Dem. People's Rep.": ['KP'], 'Kuwait': ['KW'], 'Kyrgyzstan': ['KG'],
  "Lao People's Dem. Rep.": ['LA'], 'Latvia': ['LV'], 'Lebanon': ['LB'], 'Liberia': ['LR'], 'Libya': ['LY'],
  'Lithuania': ['LT'], 'Luxembourg': ['LU'], 'Madagascar': ['MG'], 'Malawi': ['MW'], 'Malaysia': ['MY'],
  'Maldives': ['MV'], 'Mali': ['ML'], 'Malta': ['MT'], 'Mariana Islands': ['MP', 'GU'], 'Marshall Islands': ['MH'],
  'Martinique': ['MQ'], 'Mauritania': ['MR'], 'Mauritius': ['MU'], 'Mexico': ['MX'], 'Moldova, Rep. Of': ['MD'],
  'Mongolia': ['MN'], 'Montenegro': ['ME'], 'Morocco': ['MA', 'EH'], 'Mozambique': ['MZ'], 'Myanmar': ['MM'],
  'Namibia': ['NA'], 'Nepal': ['NP'], 'Netherlands': ['NL', 'AW', 'BQ', 'CW', 'SX'], 'New Caledonia': ['NC'],
  'New Zealand': ['NZ', 'CK', 'NU', 'TK'], 'Nicaragua': ['NI'], 'Niger': ['NE'], 'Nigeria': ['NG'],
  'North Macedonia, Rep. Of': ['MK'], 'Norway': ['NO', 'SJ', 'BV'], 'Oman': ['OM'], 'Pakistan': ['PK'],
  'Palau': ['PW'], 'Papua New Guinea': ['PG'], 'Paraguay': ['PY'], 'Peru': ['PE'], 'Philippines': ['PH'],
  'Pitcairn Island': ['PN'], 'Poland': ['PL'], 'Portugal': ['PT'], 'Puerto Rico': ['PR'], 'Qatar': ['QA'],
  'Republic of China, Taiwan': ['TW'], 'Republic of Korea': ['KR'], 'Republic of the Congo': ['CG'], 'Romania': ['RO'],
  'Russian Federation': ['RU'], 'Rwanda': ['RW'], 'Salomon Islands': ['SB'], 'Samoa': ['WS'], 'Saudi Arabia': ['SA'],
  'Senegal': ['SN'], 'Serbia': ['RS', 'XK'], 'Seychelles': ['SC'], 'Sierra Leone': ['SL'], 'Singapore': ['SG'],
  'Slovakia': ['SK'], 'Slovenia': ['SI'], 'Somalia': ['SO'], 'South Africa': ['ZA'], 'South Sudan': ['SS'],
  'Spain': ['ES'], 'Sri Lanka': ['LK'], 'St. Maarten': ['SX', 'MF'], 'Sudan': ['SD'], 'Suriname': ['SR'],
  'Sweden': ['SE'], 'Switzerland': ['CH', 'LI'], 'Syrian Arab Rep.': ['SY'], 'São Tomé and Príncipe': ['ST'],
  'Tajikistan': ['TJ'], 'Tanzania': ['TZ'], 'Thailand': ['TH'], 'Timor-Leste (East Timor)': ['TL'], 'Togo': ['TG'],
  'Tokelau': ['TK'], 'Tonga': ['TO'], 'Trinidad and Tobago': ['TT'], 'Tunisia': ['TN'], 'Turkey': ['TR'],
  'Turkmenistan': ['TM'], 'Tuvalu': ['TV'], 'Uganda': ['UG'], 'Ukraine': ['UA'], 'United Arab. Emirates': ['AE'],
  'United Kingdom of Great Britain and N.-Ireland': UNITED_KINGDOM, 'United States of America': UNITED_STATES,
  'Uruguay': ['UY'], 'Uzbekistan': ['UZ'], 'Vanuatu': ['VU'], 'Venezuela': ['VE'], 'Viet Nam': ['VN'],
  'Wake Island': ['UM'], 'Wallis': ['WF'], 'Yemen': ['YE'], 'Zambia': ['ZM'], 'Zimbabwe': ['ZW'],
};

/** The Deutscher Wetterdienst's Klimatafeln, by the country page that lists them, each with the codes its stations may be in. */
export const COUNTRIES_KT: Readonly<Record<string, readonly string[]>> = {
  'aegypten': ['EG'], 'aequatorial_guinea': ['GQ'], 'aethopien': ['ET'], 'afghanistan': ['AF'], 'albanien': ['AL'],
  'algerien': ['DZ'], 'angola': ['AO'], 'antillen': ['CW', 'SX', 'BQ', 'AW'], 'argentinien': ['AR'],
  'armenien': ['AM'], 'aserbaidschan': ['AZ'], 'australien': ['AU', 'CX', 'CC', 'NF', 'HM'], 'bahamas': ['BS'],
  'bahrain': ['BH'], 'bangladesch': ['BD'], 'belgien': ['BE'], 'belize': ['BZ'], 'benin': ['BJ'], 'bolivien': ['BO'],
  'bosnien_herzeg': ['BA'], 'botsuana': ['BW'], 'brasilien': ['BR'], 'brunei': ['BN'], 'bulgarien': ['BG'],
  'burkina': ['BF'], 'burundi': ['BI'], 'chile': ['CL'], 'china': ['CN', 'HK', 'MO'], 'chinataiwan': ['TW'],
  'costarica': ['CR'], 'daenemark': ['DK', 'FO'], 'deutschland': ['DE'], 'dominikansiche': ['DO'], 'dschibuti': ['DJ'],
  'ecuador': ['EC'], 'elfenbeinkueste': ['CI'], 'elsalvador': ['SV'], 'eritrea': ['ER'], 'estland': ['EE'],
  'fidschi': ['FJ'], 'finnland': ['FI', 'AX'], 'frankreich': FRANCE, 'gabun': ['GA'], 'gambia': ['GM'],
  'georgien': ['GE'], 'ghana': ['GH'], 'griechenland': ['GR'], 'groenland': ['GL'], 'grossbritannien': UNITED_KINGDOM,
  'guatemala': ['GT'], 'guinea': ['GN'], 'guinea_bissau': ['GW'], 'guyana': ['GY'], 'honduras': ['HN'],
  'indische_union': ['IN'], 'indonesien': ['ID'], 'irak': ['IQ'], 'iran': ['IR'], 'irland': ['IE'], 'island': ['IS'],
  'israel': ['IL'], 'italien': ['IT'], 'jamaika': ['JM'], 'japan': ['JP'], 'jemen': ['YE'], 'jordanien': ['JO'],
  'kambodscha': ['KH'], 'kamerun': ['CM'], 'kanada': ['CA'], 'kapverden': ['CV'], 'katar': ['QA'], 'kenia': ['KE'],
  'kirbati': ['KI'], 'kirgisistan': ['KG'], 'kolumbien': ['CO'], 'kongo': ['CG'], 'kongo_dr': ['CD'],
  'korea_n': ['KP'], 'korea_s': ['KR'], 'kroatien': ['HR'], 'kuba': ['CU'], 'kuwait': ['KW'], 'laos': ['LA'],
  'lettland': ['LV'], 'libanon': ['LB'], 'liberia': ['LR'], 'libyen': ['LY'], 'litauen': ['LT'], 'luxemburg': ['LU'],
  'madagaskar': ['MG'], 'malawi': ['MW'], 'malaysia': ['MY'], 'malediven': ['MV'], 'mali': ['ML'], 'malta': ['MT'],
  'marokko': ['MA', 'EH'], 'marshall': ['MH'], 'mauretanien': ['MR'], 'mauritius': ['MU'], 'mazedonien': ['MK'],
  'mexiko': ['MX'], 'mikronesien': ['FM'], 'moldawien': ['MD'], 'mongolei': ['MN'], 'montenegro': ['ME'],
  'mosambik': ['MZ'], 'myammar': ['MM'], 'namibia': ['NA'], 'nepal': ['NP'], 'neuseeland': ['NZ', 'CK', 'NU', 'TK'],
  'nicaragua': ['NI'], 'niederlande': ['NL'], 'niger': ['NE'], 'nigeria': ['NG'], 'norwegen': ['NO', 'SJ', 'BV'],
  'oesterreich': ['AT'], 'oman': ['OM'], 'ost-timor': ['TL'], 'pakistan': ['PK'], 'palau': ['PW'], 'panama': ['PA'],
  'papua-neu': ['PG'], 'paraguay': ['PY'], 'peru': ['PE'], 'philippinen': ['PH'], 'polen': ['PL'], 'portugal': ['PT'],
  'puertorico': ['PR'], 'ruanda': ['RW'], 'rumaenien': ['RO'], 'russ_foederation': ['RU'],
  'russische_foederation_eu': ['RU'], 'salomonen': ['SB'], 'sambia': ['ZM'], 'samoa': ['WS'], 'saotome': ['ST'],
  'schweden': ['SE'], 'schweiz': ['CH', 'LI'], 'senegal': ['SN'], 'serbien': ['RS', 'XK'], 'seychellen': ['SC'],
  'sierra_leone': ['SL'], 'simbabwe': ['ZW'], 'singapur': ['SG'], 'slowakei': ['SK'], 'slowenien': ['SI'],
  'somalia': ['SO'], 'spanien': ['ES'], 'sri_lanka': ['LK'], 'sudan': ['SD', 'SS'], 'suedafrika': ['ZA'],
  'surinam': ['SR'], 'syrien': ['SY'], 'tadschikistan': ['TJ'], 'tansania': ['TZ'], 'thailand': ['TH'], 'togo': ['TG'],
  'trinidad_tobago': ['TT'], 'tschad': ['TD'], 'tschech_rep': ['CZ'], 'tuerkei': ['TR'], 'tunesien': ['TN'],
  'turkmenistan': ['TM'], 'tuvalu': ['TV'], 'uganda': ['UG'], 'ukraine': ['UA'], 'ungarn': ['HU'], 'uruguay': ['UY'],
  'usa': UNITED_STATES, 'usbekistan': ['UZ'], 'vae': ['AE'], 'venezuela': ['VE'], 'vietnam': ['VN'],
  'weissrussland': ['BY'], 'westsahara': ['EH'], 'zentralafrika': ['CF'], 'zypern': ['CY'],
};

/**
 * Klimatafeln whose station the nearest town would place across a border, their places given only to the minute:
 * Macao's (WMO 45011; WMO block 45 is Hong Kong's and Macao's), which the nearest town puts in Zhuhai.
 */
export const KT_COUNTRY: Readonly<Record<string, string>> = { '45011': 'MO' };

/**
 * The 1991-2020 files' stations of a country name whose WMO block is another country's, by the name and the block:
 * NCEI's name the Republic of the Congo's (block 644: Pointe-Noire, Brazzaville, Mpouya, Impfondo and others)
 * Dem._Rep._Congo, as they do the Democratic Republic's. Mpouya stands on the Congo's bank nearer a town of the
 * Democratic Republic's, so its place alone wouldn't say. (An ID isn't always a WMO number: Peru's are its own.)
 */
export const BLOCKS_9120: Readonly<Record<string, string>> = { 'Dem._Rep._Congo|644': 'CG' };

/**
 * The countries no Member's normals in the WMO's sets speak for, their own service's standing for them: Taiwan's
 * Central Weather Administration (R-0045). A station another Member files that lies in one is left out: China's files
 * hold eight in Taiwan, which would stand before the CWA's (Taipei's temperatures read from Taoyuan's of 1961-1990,
 * 31 km off, rather than Taipei's own of 1991-2020).
 */
export const NO_MEMBER: readonly string[] = ['TW'];

// Stryker restore all

export interface Town {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

const RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** The great-circle distance, in kilometres, on the mean Earth radius. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The towns of some countries, in order of latitude, for the nearest search. */
export function townPool(towns: readonly Town[], codes: readonly string[]): Town[] {
  return towns.filter((t) => codes.includes(t.country)).sort((a, b) => a.latitude - b.latitude);
}

/** The nearest town of a pool in order of latitude, searched outward from the latitude; undefined in an empty pool. */
export function nearestTown(pool: readonly Town[], latitude: number, longitude: number): Town | undefined {
  let lo = 0;
  let hi = pool.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    // Stryker disable next-line EqualityOperator: a town at exactly the latitude is looked at from either side.
    if ((pool[mid] as Town).latitude < latitude) lo = mid + 1;
    else hi = mid;
  }
  let best: { town: Town; km: number } | undefined;
  // A degree of latitude in kilometres: no two points further apart in latitude are nearer than this.
  const perDegree = (Math.PI / 180) * RADIUS_KM;
  const consider = (i: number) => {
    const t = pool[i] as Town;
    const km = distanceKm(latitude, longitude, t.latitude, t.longitude);
    // Stryker disable next-line EqualityOperator: two towns exactly as near are either of them.
    if (best === undefined || km < best.km) best = { town: t, km };
    // Stryker disable next-line EqualityOperator: a town exactly as far in latitude alone as the best can't be nearer.
    return Math.abs(t.latitude - latitude) * perDegree <= best.km;
  };
  for (let i = lo; i < pool.length && consider(i); i += 1);
  for (let i = lo - 1; i >= 0 && consider(i); i -= 1);
  return best?.town;
}

/** How near a town must be to a station for the station to be named by it, km. */
export const TOWN_KM = 50;

/** A station as a source gives it, before it's named by its town. */
export type SourceStation = Omit<Station, 'town'>;

/** The station's country: Antarctica south of 60°S; else the Member's own code, or among its several the nearest town's. */
export function countryOf(codes: readonly string[], latitude: number, longitude: number, pool: readonly Town[]): string {
  if (latitude < -60) return 'AQ';
  if (codes.length === 1) return codes[0] as string;
  return nearestTown(pool, latitude, longitude)?.country ?? (codes[0] as string);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The 1991-2020 composite files: stations by their identity (ID, WIGOS id and name), each parameter's twelve months. */
export function parse9120(files: Record<Param, string>): Map<string, { member: string; name: string; latitude: number; longitude: number; elevation: number | null; normals: Partial<Record<Param, Months>> }> {
  const out = new Map<string, { member: string; name: string; latitude: number; longitude: number; elevation: number | null; normals: Partial<Record<Param, Months>> }>();
  for (const param of PARAMS) {
    const lines = files[param].split(/\r?\n/).filter((l) => l.trim() !== '');
    for (const line of lines.slice(1)) {
      const f = line.split(',').map((x) => x.trim());
      if (f.length !== 22) throw new Error(`a 1991-2020 line the compiler doesn't know: ${line}`);
      const [, , id, wigos, lat, lon, elev, member, name] = f as [string, string, string, string, string, string, string, string, string];
      if (!Object.hasOwn(MEMBERS_9120, member)) throw new Error(`a 1991-2020 Member the compiler doesn't know: ${member}`);
      const key = `${id}|${wigos}|${name}`;
      const values = f.slice(9, 21).map(Number);
      // A station given no place on Earth (the placeholder -98.6, -986.6 that one of Rwanda's stations and two of Guyana's carry) can stand for no town.
      if (Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180) continue;
      const station = out.get(key) ?? { member, name, latitude: Number(lat), longitude: Number(lon), elevation: elev === '-999.9' ? null : Number(elev), normals: {} };
      // The composite files mark a month with no normal -99.9; a parameter is kept only where every month has one.
      if (values.every((v) => Number.isFinite(v) && v !== -99.9)) station.normals[param] = values.map(round1);
      out.set(key, station);
    }
  }
  return out;
}

/** A latitude or longitude written as degrees, minutes and a hemisphere letter. */
function dms(deg: string, min: string, hemisphere: string, negative: string): number | null {
  if (deg.trim() === '' || min.trim() === '') return null;
  const v = Number(deg) + Number(min) / 60;
  return hemisphere === negative ? -v : v;
}

/** The 1961-1990 normals' element, statistic and qualifier for each parameter (DATA_FMT.TXT, Tables 6 to 8). */
const ELEMENTS_6190: Readonly<Record<string, Param>> = { '0201': 'tmax', '0301': 'tmin', '0615': 'prcp', '1544': 'sun', '4044': 'sun' };

/** The 1961-1990 normals: stations from STNMETA.DAT, the parameters from ALLNORMS.DAT, the 1961-1990 period's first. */
export function parse6190(normals: string, stations: string) {
  const meta = new Map<string, { member: string; name: string; latitude: number; longitude: number; pub9: [number, number]; elevation: number | null }>();
  for (const line of stations.split(/\r?\n/).filter((l) => l.trim() !== '')) {
    const key = line.slice(0, 17);
    const member = line.slice(1, 3);
    if (!Object.hasOwn(MEMBERS_6190, member)) throw new Error(`a 1961-1990 Member the compiler doesn't know: ${member}`);
    // The Member's own coordinates where it gave them, else those of WMO Publication No. 9; and Publication No. 9's
    // where it gave them, else the Member's, for a station the Member's place puts outside its country (Malawi's own
    // coordinates are all north of the equator, Publication No. 9's south).
    const pub9Lat = dms(line.slice(35, 37), line.slice(37, 39), line[39] as string, 'S');
    const pub9Lon = dms(line.slice(40, 43), line.slice(43, 45), line[45] as string, 'W');
    const lat = dms(line.slice(18, 20), line.slice(20, 22), line[22] as string, 'S') ?? pub9Lat;
    const lon = dms(line.slice(23, 26), line.slice(26, 28), line[28] as string, 'W') ?? pub9Lon;
    const own = line.slice(29, 35).trim();
    const pub9 = line.slice(46, 50).trim();
    const elevation = own !== '' ? Number(own) : pub9 !== '' ? Number(pub9) : null;
    const name = (line.slice(56, 90).trim() || line.slice(90, 136).trim()).replace(/\s+/g, ' ');
    if (lat !== null && lon !== null) meta.set(key, { member, name, latitude: lat, longitude: lon, pub9: [pub9Lat ?? lat, pub9Lon ?? lon], elevation });
  }
  const out = new Map<string, { member: string; name: string; latitude: number; longitude: number; pub9: [number, number]; elevation: number | null; normals: Partial<Record<Param, Months>>; standard: Partial<Record<Param, boolean>> }>();
  for (const line of normals.split(/\r?\n/)) {
    const key = line.slice(0, 17);
    const m = meta.get(key);
    if (m === undefined) continue;
    const code = line.slice(26, 30);
    const qualifier = line.slice(30, 36).trim();
    // Days with precipitation of at least a threshold (element 95, statistic 15): only the 1 mm threshold, as 1991-2020's.
    const param = code === '9515' ? (qualifier === '1.0' ? 'wet' : undefined) : ELEMENTS_6190[code];
    if (param === undefined) continue;
    const values = Array.from({ length: 12 }, (_, i) => line.slice(37 + 8 * i, 44 + 8 * i).trim());
    // -9999.9, -99999 and -9999 are missing; 88888.8, 8888888, -9797.9 and -97979 a trace, read as none.
    if (values.some((v) => v === '' || v === '-9999.9' || v === '-99999' || v === '-9999')) continue;
    const numbers = values.map((v) => (['88888.8', '8888888', '-9797.9', '-97979'].includes(v) ? 0 : Number(v)));
    const station = out.get(key) ?? { ...m, normals: {}, standard: {} };
    const standard = line.slice(17, 25) === '19611990';
    // The first record of the 1961-1990 period stands; another period's only where there's none of 1961-1990.
    if (station.normals[param] === undefined || (standard && station.standard[param] !== true)) {
      station.normals[param] = numbers.map(round1);
      station.standard[param] = standard;
    }
    out.set(key, station);
  }
  return out;
}

/** A month's figure as the World Weather Information Service gives it: a trace is none; nothing, "" or "NULL" is missing. */
function wwisValue(v: unknown): number | null {
  if (v === 'TR') return 0;
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * The World Weather Information Service's cities (R-0042): each Member's own figures for its cities, the mean daily
 * maximum and minimum temperature, the rainfall (or precipitation) in millimetres and the rain days, each kept only
 * where every month has one; the rain days only where a rain day is defined as at least 1 mm, as the WMO's normals
 * count them. It gives no sunshine, and no height.
 */
export function parseWwis(json: string) {
  const data = JSON.parse(json) as { cities: { cityId: number; cityName: string; stationName: string | null; cityLatitude: string; cityLongitude: string; member: { memName: string }; climate: { raintype: string; raindef: string; rainunit: string; datab: number | ''; datae: number | ''; tempb: number | ''; tempe: number | ''; climateMonth: { month: number; maxTemp: unknown; minTemp: unknown; rainfall: unknown; raindays: unknown }[] } }[] };
  const out = new Map<string, { member: string; name: string; latitude: number; longitude: number; elevation: null; period: string | null; normals: Partial<Record<Param, Months>> }>();
  for (const c of data.cities) {
    const member = c.member.memName;
    if (!Object.hasOwn(MEMBERS_WWIS, member)) throw new Error(`a World Weather Information Service Member the compiler doesn't know: ${member}`);
    const latitude = wwisValue(c.cityLatitude);
    const longitude = wwisValue(c.cityLongitude);
    if (latitude === null || longitude === null) continue;
    const cl = c.climate;
    const months = Array.from({ length: 12 }, (_, i) => cl.climateMonth.find((m) => m.month === i + 1));
    const series = (key: 'maxTemp' | 'minTemp' | 'rainfall' | 'raindays') => {
      const values = months.map((m) => (m === undefined ? null : wwisValue(m[key])));
      return values.every((v) => v !== null) ? (values as number[]).map(round1) : undefined;
    };
    const rain = (cl.raintype === 'Rainfall' || cl.raintype === 'PPT') && cl.rainunit === 'mm';
    const normals: Partial<Record<Param, Months>> = {};
    const add = (p: Param, v: Months | undefined) => {
      if (v !== undefined) normals[p] = v;
    };
    add('tmax', series('maxTemp'));
    add('tmin', series('minTemp'));
    if (rain) add('prcp', series('rainfall'));
    if (rain && Number(cl.raindef) === 1) add('wet', series('raindays'));
    const period = cl.datab !== '' && cl.datae !== '' ? `${cl.datab}-${cl.datae}` : cl.tempb !== '' && cl.tempe !== '' ? `${cl.tempb}-${cl.tempe}` : null;
    out.set(String(c.cityId), { member, name: (c.stationName ?? '').trim() || c.cityName.trim(), latitude, longitude, elevation: null, period, normals });
  }
  return out;
}

/** The 1981-2010 normals template's parameter codes (its Parameters sheet) for the stations' normals. */
const PARAMETERS_8110: Readonly<Record<string, Param>> = { '1': 'prcp', '2': 'wet', '3': 'tmax', '4': 'tmin', '8': 'sun' };

/**
 * A Member's 1981-2010 normals in the WMO's single-station template, written out as CSV: for each station its name, its
 * WMO number, latitude and longitude as degrees|minutes|seconds|hemisphere and its height, then each parameter's row
 * of twelve months, kept only where every month has one.
 */
export function parse8110(country: string, csv: string): SourceStation[] {
  const out = new Map<string, SourceStation>();
  let name = '';
  const lines = csv.split(/\r?\n/).map((l) => l.split(',').map((f) => f.trim()));
  const dms = (v: string) => {
    const [d, m, sec, h] = v.split('|');
    const n = Number(d) + Number(m) / 60 + Number(sec) / 3600;
    return h === 'S' || h === 'W' ? -n : n;
  };
  for (const [i, f] of lines.entries()) {
    if (f[0] === 'Station_Name') name = f[1] as string;
    if (f[1] === 'Latitude') {
      const [wmo, lat, lon, height] = lines[i + 1] as [string, string, string, string];
      out.set(wmo, { id: `8110:${country}:${wmo}`, name, country, latitude: Math.round(dms(lat) * 1e4) / 1e4, longitude: Math.round(dms(lon) * 1e4) / 1e4, elevation: height === '' ? null : Number(height), period: '1981-2010', normals: {} });
    }
    const param = PARAMETERS_8110[f[1] as string];
    const station = out.get(f[0] as string);
    if (param !== undefined && station !== undefined && f[2] !== 'NOY') {
      const values = f.slice(4, 16);
      if (values.length === 12 && values.every((v) => v !== '' && Number.isFinite(Number(v)))) station.normals[param] = values.map((v) => round1(Number(v)));
    }
  }
  return [...out.values()].filter((s) => Object.keys(s.normals).length > 0);
}

/** Météo-France's stations' countries, by the start of the station's number (its commune's code): the longest that fits. */
export const COMMUNES_MF: Readonly<Record<string, string>> = {
  '971': 'GP', '97123': 'BL', '97127': 'MF', '972': 'MQ', '973': 'GF', '974': 'RE', '975': 'PM', '984': 'TF', '985': 'YT',
  '986': 'WF', '987': 'PF', '988': 'NC', '99130': 'AD', '99138': 'MC',
};

/** A fiche's latitude or longitude, as 20°53'31"S. */
function ficheDms(text: string): number | null {
  const m = /^(\d+)°(\d+)'(\d+)"([NSEWO])$/.exec(text.trim());
  if (m === null) return null;
  const v = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return m[4] === 'S' || m[4] === 'W' || m[4] === 'O' ? -v : v;
}

/** The sections of a fiche the stations read, by their title or, for the wet days, their row. */
const SECTIONS_MF: readonly [Param, string][] = [
  ['tmax', 'Température maximale (Moyenne en °C)'],
  ['tmin', 'Température minimale (Moyenne en °C)'],
  ['prcp', 'Précipitations : Hauteur moyenne mensuelle (mm)'],
  ['wet', 'Rr >= 1 mm'],
  ['sun', "Durée d'insolation (Moyenne en heures)"],
];

/**
 * Météo-France's climatological fiches (R-0043): each station's statistics of 1991-2020 (or of the period it has),
 * with its height and place. A section gives the period it covers where that isn't the fiche's own, so a station is
 * kept once for each period, with the normals of that period. A count of days of "." is none.
 */
export function parseMeteoFrance(json: string): SourceStation[] {
  const data = JSON.parse(json) as { stations: { properties: { NUM_POSTE: string; NOM_USUEL: string }; fiche: string | null }[] };
  const out: SourceStation[] = [];
  for (const { properties, fiche } of data.stations) {
    if (fiche === null) continue;
    const id = properties.NUM_POSTE;
    const prefix = Object.keys(COMMUNES_MF).filter((k) => id.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    if (prefix === undefined) throw new Error(`a Météo-France station the compiler can't place: ${id}`);
    const lines = fiche.split(/\r?\n/).filter((l) => l.trim() !== '');
    // Stryker disable next-line StringLiteral: a line missing reads as no match, as any text not the pattern would.
    const head = /alt : (-?\d+)m, lat : ([^,]+), lon : ([^;]+);/.exec(lines[3] ?? '');
    // Stryker disable next-line StringLiteral: as above.
    const own = /Statistiques\s+(\d{4}-\d{4})\s+et\s+records/.exec(lines[2] ?? '');
    if (head === null || own === null) throw new Error(`a Météo-France fiche the compiler can't read: ${id}`);
    const latitude = ficheDms(head[2] as string);
    const longitude = ficheDms(head[3] as string);
    if (latitude === null || longitude === null) throw new Error(`a Météo-France fiche the compiler can't read: ${id}`);
    const byPeriod = new Map<string, Partial<Record<Param, Months>>>();
    const field = (l: string) => (l.split(';')[0] as string).trim().replace(/\s+/g, ' ');
    // A section's period, where it states one on the line given: "Statistiques établies sur la période 1997-2010".
    // Stryker disable next-line StringLiteral: as above.
    const stated = (line: string | undefined) => /Statistiques établies sur la période (\d{4}-\d{4})/.exec(line ?? '')?.[1];
    for (const [param, title] of SECTIONS_MF) {
      const at = lines.findIndex((l) => field(l) === title);
      // Stryker disable next-line ConditionalExpression,EqualityOperator: a section missing finds no row of months either way (the wet days' line is undefined, the others' the fiche's first).
      if (at < 0) continue;
      let period = own[1] as string;
      let row: string | undefined;
      if (param === 'wet') {
        // The wet days' row is their own line, under the period of the count of days it belongs to.
        row = lines[at];
        period = stated(lines[at - 1]) ?? period;
      } else {
        // Under the title, the period where it's stated, then the row of months, its first field empty.
        const i = stated(lines[at + 1]) === undefined ? at + 1 : at + 2;
        period = stated(lines[at + 1]) ?? period;
        const next = lines[i];
        if (next !== undefined && field(next) === '') row = next;
      }
      if (row === undefined) continue;
      const cells = row.split(';').slice(1, 13).map((c) => c.trim());
      // Number gives a "." none, as it's no number; an empty cell would read 0, and isn't one either.
      const values = cells.map((c) => (c === '.' && param === 'wet' ? 0 : c === '' ? NaN : Number(c)));
      if (cells.length !== 12 || !values.every(Number.isFinite)) continue;
      const normals = byPeriod.get(period) ?? {};
      normals[param] = values.map(round1);
      byPeriod.set(period, normals);
    }
    const country = latitude < -60 ? 'AQ' : (COMMUNES_MF[prefix] as string);
    for (const [period, normals] of byPeriod) {
      out.push({ id: `mf:${id}:${period}`, name: properties.NOM_USUEL.trim(), country, latitude: Math.round(latitude * 1e4) / 1e4, longitude: Math.round(longitude * 1e4) / 1e4, elevation: Number(head[1]), period, normals });
    }
  }
  return out;
}

/** The CWA's tables the stations read; its days with at least 0.1 mm aren't days of at least 1 mm, and aren't read. */
const ITEMS_CWA: readonly [Param, string][] = [
  ['tmax', 'meantxmax'],
  ['tmin', 'meantxmin'],
  ['prcp', 'precp'],
  ['sun', 'sunshine'],
];

/**
 * Taiwan's Central Weather Administration's monthly means (R-0045): each table's rows by the station's English name,
 * twelve months and the period. A name is the station of the CWA's list of that name that was open on the period's
 * last day (Kaohsiung's, the old station's, as the table notes). Kept once for each period, as Météo-France's are.
 */
export function parseCwa(json: string): SourceStation[] {
  const data = JSON.parse(json) as { pages: Record<string, string>; stations: { cwaopendata: { resources: { resource: { data: { stationsStatus: { station: { StationID: string; StationNameEN: string; StationAltitude: string; StationLatitude: string; StationLongitude: string; StationStartDate: string; StationEndDate: string | null }[] } } } } } } };
  const list = data.stations.cwaopendata.resources.resource.data.stationsStatus.station;
  const out = new Map<string, SourceStation>();
  for (const [param, item] of ITEMS_CWA) {
    for (const row of (data.pages[item] as string).split('</tr>')) {
      const name = /headers="loc">([^<]*)</.exec(row)?.[1];
      const period = /headers="period">(\d{4})~(\d{4})</.exec(row);
      if (name === undefined || period === null) continue;
      const last = `${period[2] as string}-12-31`;
      const station = list.find((s) => s.StationNameEN.toLowerCase() === name.toLowerCase() && s.StationStartDate <= last && (s.StationEndDate === null || s.StationEndDate > last));
      if (station === undefined) throw new Error(`a CWA station the compiler can't find: ${name}`);
      const values = Array.from({ length: 12 }, (_, i) => Number(new RegExp(`headers="m${i}">([^<]*)<`).exec(row)?.[1] ?? NaN));
      if (!values.every(Number.isFinite)) continue;
      const years = `${period[1] as string}-${period[2] as string}`;
      const id = `cwa:${station.StationID}:${years}`;
      const s = out.get(id) ?? { id, name, country: 'TW', latitude: Number(station.StationLatitude), longitude: Number(station.StationLongitude), elevation: Number(station.StationAltitude), period: years, normals: {} };
      s.normals[param] = values.map(round1);
      out.set(id, s);
    }
  }
  return [...out.values()];
}

/** The Met Office's columns the stations read, by the start of their heading. */
const COLUMNS_METOFFICE: readonly [Param, string][] = [
  ['tmax', 'Maximum temperature'],
  ['tmin', 'Minimum temperature'],
  ['sun', 'Sunshine'],
  ['prcp', 'Rainfall'],
  ['wet', 'Days of rainfall ≥1'],
];

/**
 * The Met Office's location-specific long-term averages (R-0048): each station's tables by climate period, most recent
 * first, each headed "Station: name, period"; each normal is taken from the most recent period that gives all twelve
 * months of it ("–" is none).
 */
export function parseMetOffice(json: string): SourceStation[] {
  const data = JSON.parse(json) as { stations: { geohash: string; country: string; name: string; latitude: number; longitude: number; tables: string }[] };
  const out: SourceStation[] = [];
  for (const st of data.stations) {
    const byPeriod = new Map<string, Partial<Record<Param, Months>>>();
    // Each table's text before it, its tags taken out, names its period last: "Station: Jersey: Airport, 1981-2010".
    const text = (html: string) => html.replace(/<[^>]*>/g, '');
    const parts = st.tables.split(/<\/table>/);
    for (const part of parts) {
      const [before, table] = part.split(/<table\b/) as [string, string | undefined];
      const period = [...text(before).matchAll(/Station:[^,]*, (\d{4}-\d{4})/g)].at(-1)?.[1];
      if (period === undefined || table === undefined) continue;
      const cells = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((c) => text(c[1] as string).trim());
      const header = cells(table, 'th');
      const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => cells(r[1] as string, 'td')).filter((r) => r.length > 0);
      for (const [param, heading] of COLUMNS_METOFFICE) {
        const col = header.findIndex((h) => h.startsWith(heading));
        if ([...byPeriod.values()].some((n) => n[param] !== undefined)) continue;
        // A month of "–" or nothing has none (Number reads both as no number but for "", which would read 0).
        const values = rows.slice(0, 12).map((r) => (r[col] === '' ? NaN : Number(r[col])));
        if (values.length !== 12 || !values.every(Number.isFinite)) continue;
        const normals = byPeriod.get(period) ?? {};
        normals[param] = values.map(round1);
        byPeriod.set(period, normals);
      }
    }
    for (const [period, normals] of byPeriod) {
      out.push({ id: `metoffice:${st.geohash}:${period}`, name: st.name, country: st.country, latitude: st.latitude, longitude: st.longitude, elevation: null, period, normals });
    }
  }
  return out;
}

/**
 * The Deutscher Wetterdienst's climatological monthly means for stations worldwide (R-0062): for each parameter and
 * period, a row per station of its WMO number and twelve months ("" where a month has none), and the list of stations
 * with their place, height and country. A station is kept once for each period, with the normals of that period; one
 * the list gives no place is left out.
 */
export function parseDwd(json: string): (SourceStation & { member: string })[] {
  const data = JSON.parse(json) as { files: Record<string, Record<string, string>>; stations: string };
  const list = new Map(
    data.stations
      .split('\n')
      .map((l) => l.split(';').map((f) => f.trim()))
      .filter((f) => f.length === 6 && f[2] !== '' && f[3] !== '')
      .map((f) => [f[0] as string, f]),
  );
  const out = new Map<string, SourceStation & { member: string }>();
  for (const param of ['tmax', 'tmin', 'prcp', 'sun'] as const) {
    for (const [file, text] of Object.entries(data.files[param] as Record<string, string>)) {
      const period = file.replace('_', '-');
      for (const row of text.split('\n')) {
        const f = row.split(';').map((x) => x.trim());
        const st = list.get(f[0] as string);
        const values = f.slice(1, 13);
        if (st === undefined || values.length !== 12 || !values.every((v) => v !== '' && Number.isFinite(Number(v)))) continue;
        const [wmo, name, lat, lon, height, member] = st as [string, string, string, string, string, string];
        if (!Object.hasOwn(COUNTRIES_DWD, member)) throw new Error(`a Deutscher Wetterdienst country the compiler doesn't know: ${member}`);
        const id = `dwd:${wmo}:${period}`;
        const s = out.get(id) ?? { id, name, member, country: '', latitude: Number(lat), longitude: Number(lon), elevation: height === '' ? null : Number(height), period, normals: {} };
        s.normals[param] = values.map((v) => round1(Number(v)));
        out.set(id, s);
      }
    }
  }
  return [...out.values()];
}

/** A Klimatafel's rows the stations read, by their label; its sunshine is a mean daily sum, made the month's by its days. */
const ROWS_KT: readonly [Param, string][] = [
  ['tmax', 'Mittl. tägl. Maximum [°C]'],
  ['tmin', 'Mittl. tägl. Minimum [°C]'],
  ['prcp', 'Mittl. Monats-/Jahressumme [mm]'],
  ['wet', 'Zahl der Tage mit ≥ 1,0 mm Niederschlag'],
  ['sun', 'Mittl. Tagessumme [Std.]'],
];
/** A month's mean number of days, February's over the leap years' cycle. */
export const MONTH_DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A Klimatafel's number, as 2.031,4: the point groups thousands, the comma marks decimals. */
const ktNumber = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'));

/**
 * The Deutscher Wetterdienst's Klimatafeln (R-0063), as their text: the station's name in the title ("Klimatafel von
 * Macau (Magao) / Volksrepublik China"; some titles are empty), its place to the minute and its height, and each
 * row's twelve months, the year and the years it covers; its country by the index page that lists it. A station is
 * kept once for each period, with that period's rows.
 */
export function parseKlimatafeln(json: string): (SourceStation & { member: string })[] {
  const data = JSON.parse(json) as { tables: { page: string; url: string; text: string }[] };
  const out = new Map<string, SourceStation & { member: string }>();
  for (const { page, url, text } of data.tables) {
    const wmo = /ak_(\d+)\d_kt\.pdf/.exec(url)?.[1];
    const title = /Klimatafel von (.*?)\s*$/m.exec(text);
    const place = /Breite: (\d+)° (\d+)' ([NS]), geographische Länge: (\d+)° (\d+)' ([EW])/.exec(text);
    if (wmo === undefined || title === null) throw new Error(`a Klimatafel the compiler can't read: ${url}`);
    // Some tables are published blank, without even a place.
    if (place === null) continue;
    const member = page.split('/').at(-2) as string;
    if (!Object.hasOwn(COUNTRIES_KT, member)) throw new Error(`a Klimatafel country the compiler doesn't know: ${member}`);
    // The station's name is the title's first part; where the title is empty (a bare "/"), its WMO number.
    const first = (title[1] as string).split(' / ')[0] as string;
    const name = first === '' || first === '/' ? `WMO ${wmo}` : first;
    const deg = (d: string, m: string, h: string, negative: string) => (h === negative ? -1 : 1) * Math.round((Number(d) + Number(m) / 60) * 1e4) / 1e4;
    const height = /Stationshöhe: (-?\d+) m/.exec(text)?.[1];
    for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
      // A row: its label, then twelve months, the year, and the first and last years it covers.
      const row = ROWS_KT.find(([, label]) => line.startsWith(`${label} `));
      if (row === undefined) continue;
      const [param, label] = row;
      const cells = line.slice(label.length).trim().split(/\s+/);
      if (cells.length !== 15 || !/^\d{4}$/.test(cells[13] as string) || !/^\d{4}$/.test(cells[14] as string)) continue;
      const values = cells.slice(0, 12).map(ktNumber);
      if (!values.every(Number.isFinite)) continue;
      const period = `${cells[13] as string}-${cells[14] as string}`;
      const id = `kt:${wmo}:${period}`;
      const s = out.get(id) ?? { id, name, member, country: '', latitude: deg(place[1] as string, place[2] as string, place[3] as string, 'S'), longitude: deg(place[4] as string, place[5] as string, place[6] as string, 'W'), elevation: height === undefined ? null : Number(height), period, normals: {} };
      s.normals[param] = values.map((v, i) => round1(param === 'sun' ? v * (MONTH_DAYS[i] as number) : v));
      out.set(id, s);
    }
  }
  return [...out.values()];
}

/** The years a station's daily records are read over: 1991 to 2020, the climatological standard normal's. */
export const YEARS_GHCND = [1991, 2020] as const;
const DAILY_GHCND: readonly [Param, 'tmax' | 'tmin' | 'prcp'][] = [
  ['tmax', 'tmax'],
  ['tmin', 'tmin'],
  ['prcp', 'prcp'],
  ['wet', 'prcp'],
];

/**
 * A month's value from its days' (WMO-No. 1203, 4.3.1 and 4.4.1): none where 11 or more days are missing or 5 or more
 * in a row, and for a sum, none where any is; a mean's is the days' mean, a sum's their sum, a count's (days of at
 * least 1 mm) the share of the days observed.
 */
export function monthValue(param: Param, days: readonly (number | null)[]): number | null {
  const missing = days.filter((d) => d === null).length;
  let run = 0;
  let longest = 0;
  for (const d of days) {
    run = d === null ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  if (missing >= 11 || longest >= 5 || (param === 'prcp' && missing > 0)) return null;
  const seen = days.filter((d) => d !== null);
  if (param === 'wet') return seen.filter((d) => d >= 1).length / seen.length;
  const sum = seen.reduce((a, b) => a + b, 0);
  return param === 'prcp' ? sum : sum / seen.length;
}

/**
 * NOAA NCEI's GHCN-Daily records (R-0073), each station's days of 1991 to 2020 as "date;precipitation;flags;maximum;
 * flags;minimum;flags" in tenths of a millimetre and of a degree, averaged by WMO-No. 1203's rules: a day counts where
 * its quality flag (the flags' second) is blank; a month by monthValue; a month's average is the mean of its valid
 * values (a count's mean share times the month's days, February's 28.25) where they are of at least 80% of the
 * averaging period's years (4.3.2 and 4.4.2). Each parameter's period is the longest of at least ten years (an average,
 * as chapter 3 defines it: over any period), from a year with a month of it to another, whose every month is averaged
 * so, the latest of the longest; 1991-2020,
 * the climatological standard normal, where the records allow it. A station is kept once for each period, with the
 * parameters of that period.
 */
export function parseGhcnd(json: string): SourceStation[] {
  const data = JSON.parse(json) as { stations: { id: string; country: string; name: string; latitude: number; longitude: number; elevation: number; days: string }[] };
  const [first, last] = YEARS_GHCND;
  // Every period of ten years or more, longest first, then latest.
  // Stryker disable next-line ArrayDeclaration: an entry that is no period of the years is skipped as one no record fills.
  const periods: [number, number][] = [];
  // Stryker disable next-line ArithmeticOperator: a longer first length only adds lengths no period of the years can have.
  for (let length = last - first + 1; length >= 10; length -= 1) for (let to = last; to - length + 1 >= first; to -= 1) periods.push([to - length + 1, to]);
  const out: SourceStation[] = [];
  for (const st of data.stations) {
    const daily = { tmax: new Map<string, number>(), tmin: new Map<string, number>(), prcp: new Map<string, number>() };
    for (const line of st.days.split('\n')) {
      const [date, prcp, prcpFlags, tmax, tmaxFlags, tmin, tminFlags] = line.split(';') as [string, string, string, string, string, string, string];
      for (const [element, value, flags] of [['prcp', prcp, prcpFlags], ['tmax', tmax, tmaxFlags], ['tmin', tmin, tminFlags]] as const) {
        if (value !== '' && flags.split(',')[1] === '') daily[element].set(date, Number(value) / 10);
      }
    }
    const byPeriod = new Map<string, Partial<Record<Param, Months>>>();
    for (const [param, element] of DAILY_GHCND) {
      // Each month's value in each year, null where it has none.
      const months = MONTH_DAYS.map((_, m) =>
        Array.from({ length: last - first + 1 }, (_, i) => {
          const year = first + i;
          const length = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
          return monthValue(param, Array.from({ length }, (_, d) => daily[element].get(`${year}-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`) ?? null));
        }),
      );
      for (const [from, to] of periods) {
        // A period begins and ends with a year it has a month of.
        if (months.every((years) => years[from - first] === null) || months.every((years) => years[to - first] === null)) continue;
        const normal = months.map((years, m) => {
          const values = years.slice(from - first, to - first + 1).filter((v) => v !== null);
          if (values.length * 5 < (to - from + 1) * 4) return NaN;
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          return round1(param === 'wet' ? mean * (MONTH_DAYS[m] as number) : mean);
        });
        if (!normal.every(Number.isFinite)) continue;
        const period = `${from}-${to}`;
        byPeriod.set(period, { ...byPeriod.get(period), [param]: normal });
        break;
      }
    }
    for (const [period, normals] of byPeriod) {
      out.push({ id: `ghcnd:${st.id}:${period}`, name: st.name.replace(/, [A-Z]{2}$/, ''), country: st.country, latitude: st.latitude, longitude: st.longitude, elevation: st.elevation, period, normals });
    }
  }
  return out;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The Anguilla Statistics Department's rainfall tables (R-0075): each month's rainfall in inches, a column for each
 * year ("-" where none), from the Meteorological Office at Clayton J. Lloyd International Airport. Its average for
 * 1991-2020 is each month's mean over the years that have it, where they are at least 80% of the thirty (WMO-No. 1203,
 * 4.4.2), in millimetres; the station at The Valley, as the gazetteer places it, the tables not giving its place.
 */
export function parseAnguilla(json: string): SourceStation[] {
  const data = JSON.parse(json) as { tables: Record<string, string[][]> };
  const byYear = MONTHS_EN.map(() => new Map<number, number>());
  for (const rows of Object.values(data.tables)) {
    const head = rows.find((r) => r[1] === 'Month') as string[];
    for (const row of rows) {
      const m = MONTHS_EN.indexOf(row[1] as string);
      if (m < 0) continue;
      head.forEach((year, col) => {
        // A cell the row lacks, or one not a number ("-"), is no value; a column not a year's is outside 1991-2020.
        const value = String(row[col]).trim();
        if (value !== '' && Number.isFinite(Number(value))) (byYear[m] as Map<number, number>).set(Number(year), Number(value));
      });
    }
  }
  const prcp = byYear.map((years) => {
    const values = [...years].filter(([year]) => year >= 1991 && year <= 2020).map(([, v]) => v);
    return values.length * 5 < 30 * 4 ? NaN : round1((values.reduce((a, b) => a + b, 0) / values.length) * 25.4);
  });
  if (!prcp.every(Number.isFinite)) throw new Error('Anguilla\'s rainfall no longer gives every month of 1991-2020');
  return [{ id: 'anguilla:clayton-j-lloyd:1991-2020', name: 'Clayton J. Lloyd International Airport', country: 'AI', latitude: 18.21704, longitude: -63.05783, elevation: null, period: '1991-2020', normals: { prcp } }];
}

/**
 * The Tonga Meteorological Service's climatological information (R-0076), each sheet's text: its station in its
 * heading ("CLIMATOLOGICAL INFORMATION – FUA'AMOTU AIRPORT"), a row a month of its mean daily maximum and minimum,
 * mean total rainfall and rain days (of more than 0.1 mm, not the 1 mm the engine counts, so not read), the month's
 * name before the row or on the line above it, and its period last; its place from the Bureau of Meteorology's list.
 */
export function parseTonga(json: string): SourceStation[] {
  const data = JSON.parse(json) as { sheets: { wmo: string; latitude: number; longitude: number; text: string }[] };
  return data.sheets.map(({ wmo, latitude, longitude, text }) => {
    const rows = [...text.matchAll(/^[A-Z]+\s+(-?\d+\.\d)\s+(-?\d+\.\d)\s+(\d+\.\d)\s+\d+\s*$/gm)];
    const years = [...text.matchAll(/(\d{4})- ?(\d{4})/g)].at(-1);
    const name = /INFORMATION – (.*?)\s*$/m.exec(text)?.[1];
    if (rows.length !== 12 || years === undefined || name === undefined) throw new Error(`a Tonga sheet the compiler can't read: ${wmo}`);
    const period = `${years[1] as string}-${years[2] as string}`;
    const col = (i: number) => rows.map((r) => Number(r[i]));
    return { id: `tms:${wmo}:${period}`, name, country: 'TO', latitude, longitude, elevation: null, period, normals: { tmax: col(1), tmin: col(2), prcp: col(3) } };
  });
}

/** A vendored file, checked against its pinned hash (a gzipped one's as NCEI serves it, unzipped). */
function pinned(root: string, file: string, sha256: string, encoding: 'utf8' | 'latin1'): string {
  const raw = readFileSync(join(root, file));
  const bytes = file.endsWith('.gz') ? gunzipSync(raw) : raw;
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== sha256) throw new Error(`${file} is not the file the register cites (sha256 ${sha})`);
  return bytes.toString(encoding);
}

/** A ring of an outline, as [longitude, latitude] points. */
type Ring = readonly (readonly [number, number])[];
/** Each country's outlines at 1:110m, by the gazetteer's code, as Natural Earth draws them. */
export type Outlines = ReadonlyMap<string, readonly Ring[]>;

/** Whether a place lies inside a country's outlines (the even-odd rule, over every ring). */
export function inOutline(rings: readonly Ring[], latitude: number, longitude: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i] as readonly [number, number];
      const [xj, yj] = ring[j] as readonly [number, number];
      if (yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** The distance from a place to an outline's nearest edge, km, on a plane about the place (near enough at this scale). */
export function outlineKm(rings: readonly Ring[], latitude: number, longitude: number): number {
  const k = Math.cos(rad(latitude));
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 1) {
      const [x1, y1] = ring[i - 1] as readonly [number, number];
      const [x2, y2] = ring[i] as readonly [number, number];
      const [ax, ay, dx, dy] = [(x1 - longitude) * k, y1 - latitude, (x2 - x1) * k, y2 - y1];
      // The point of the edge nearest the place, as a share of the edge from its start.
      // An edge of one point (two the same in a row) is that point.
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return (best * Math.PI * RADIUS_KM) / 180;
}

/**
 * How near a town of its own country a station must be to stand in it, km, where it's not within BORDER_KM of one of
 * its Member's outlines: the Republic of the Congo's Dolisie, which NCEI's file gives the Democratic Republic's, is 112
 * km from the Democratic Republic's nearest town.
 */
export const NEAR_KM = 100;
/**
 * How near an outline of its Member's a station must be to stand in it, km: the outlines at 1:110m draw a border tens
 * of kilometres off (Karesuando, on the Swedish bank of the border river, lies outside Sweden's); the former Soviet
 * Union's stations filed as Russia's lie 126 km and more from Russia's, China's in Taiwan 181 km and more from China's.
 */
export const BORDER_KM = 50;

/** Natural Earth's countries, as the map compiles them, by the gazetteer's code. */
export function readOutlines(geojson: string): Outlines {
  const data = JSON.parse(geojson) as { features: { properties: { ISO_A2_EH: string; ADM0_A3: string }; geometry: { type: 'Polygon'; coordinates: [number, number][][] } | { type: 'MultiPolygon'; coordinates: [number, number][][][] } }[] };
  const out = new Map<string, [number, number][][]>();
  for (const { properties, geometry } of data.features) {
    const code = properties.ISO_A2_EH === '-99' ? (FOLDED[properties.ADM0_A3] as string) : properties.ISO_A2_EH;
    out.set(code, [...(out.get(code) ?? []), ...(geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat())]);
  }
  return out;
}

/**
 * Every station of both sets that has a parameter, its country resolved against the gazetteer's towns, and every one
 * checked to lie in the country it's filed under: within NEAR_KM of a town of that country, or inside an outline of
 * one of its Member's countries, or in Antarctica south of 60°S. One that doesn't is placed by another record of it
 * where one puts it in its country (the other coordinates of its 1961-1990 line, the WMO's other set's of its number);
 * else it's given the country whose town lies within NEAR_KM (NCEI's Congo-Brazzaville stations labelled the
 * Democratic Republic, the Soviet Union's stations in the 1961-1990 file filed as Russia's, China's in Taiwan); else,
 * where another country's outline holds it, the compile stops with why, for a person to decide. A station in no
 * outline and near no town is left as filed: the outlines at 1:110m don't draw the small islands that most such
 * stations stand on, so the check can't tell an island from the sea.
 */
export function compileStations(
  s9120: ReturnType<typeof parse9120>,
  s6190: ReturnType<typeof parse6190>,
  s8110: readonly SourceStation[],
  national: readonly SourceStation[],
  dwd: readonly (SourceStation & { member: string })[],
  klimatafeln: readonly (SourceStation & { member: string })[],
  sWwis: ReturnType<typeof parseWwis>,
  ghcnd: readonly SourceStation[],
  towns: readonly Town[],
  outlines: Outlines = new Map(),
): Station[] {
  const pools = new Map<string, Town[]>();
  const pool = (codes: readonly string[]) => {
    const key = codes.join();
    const cached = pools.get(key) ?? townPool(towns, codes);
    pools.set(key, cached);
    return cached;
  };
  const near = (t: Town | undefined, latitude: number, longitude: number) => t !== undefined && distanceKm(latitude, longitude, t.latitude, t.longitude) <= NEAR_KM;
  const all = [...towns].sort((a, b) => a.latitude - b.latitude);
  // The places of each WMO number in the WMO's two sets, as another record of a station of that number.
  const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
  const records = new Map<string, [number, number][]>();
  const record = (wmo: string | undefined, [lat, lon]: [number, number]) => {
    if (wmo !== undefined && wmo !== '99999') records.set(wmo, [...(records.get(wmo) ?? []), [round4(lat), round4(lon)]]);
  };
  // A WMO number: a 1991-2020 ID's last five digits; a 1961-1990 key's five after its region and Member, where nothing
  // follows them (a national number after them is the Member's own, and stations that share the five are several).
  const wmo9120 = (key: string) => /^000(\d{5})\|/.exec(key)?.[1];
  const wmo6190 = (key: string) => /^\d..(\d{5})\s*$/.exec(key)?.[1];
  for (const [key, s] of s9120) record(wmo9120(key), [s.latitude, s.longitude]);
  for (const [key, s] of s6190) {
    record(wmo6190(key), [s.latitude, s.longitude]);
    record(wmo6190(key), s.pub9);
  }
  const placed = (id: string, codes: readonly string[], latitude: number, longitude: number, others: readonly [number, number][] = []) => {
    for (const [lat, lon] of [[latitude, longitude] as [number, number], ...others]) {
      const country = countryOf(codes, lat, lon, pool(codes));
      const own = (c: string) => inOutline(outlines.get(c) ?? [], lat, lon) || outlineKm(outlines.get(c) ?? [], lat, lon) <= BORDER_KM;
      if (country === 'AQ' || near(nearestTown(pool([country]), lat, lon), lat, lon) || codes.some(own)) return { country, latitude: lat, longitude: lon };
    }
    const town = nearestTown(all, latitude, longitude);
    if (near(town, latitude, longitude)) return NO_MEMBER.includes((town as Town).country) ? null : { country: (town as Town).country, latitude, longitude };
    const holder = [...outlines].find(([, rings]) => inOutline(rings, latitude, longitude));
    if (holder !== undefined) throw new Error(`${id} lies in ${holder[0]}'s outline, near no town, filed under ${codes.join(' or ')}: a station the compiler can't place`);
    return { country: countryOf(codes, latitude, longitude, pool(codes)), latitude, longitude };
  };
  const checked = (s: SourceStation, codes: readonly string[], others?: readonly [number, number][]): SourceStation[] => {
    const place = placed(s.id, codes, s.latitude, s.longitude, others);
    return place === null ? [] : [{ ...s, ...place }];
  };
  const out: SourceStation[] = [];
  for (const [key, s] of s9120) {
    if (Object.keys(s.normals).length === 0) continue;
    const [id, wigos] = key.split('|') as [string, string];
    const block = BLOCKS_9120[`${s.member}|${(wmo9120(key) ?? '').slice(0, 3)}`];
    out.push(...checked({ id: `9120:${id}:${wigos}`, name: s.name, country: '', latitude: s.latitude, longitude: s.longitude, elevation: s.elevation, period: '1991-2020', normals: s.normals }, block === undefined ? (MEMBERS_9120[s.member] as readonly string[]) : [block], records.get(wmo9120(key) as string)));
  }
  // A 1961-1990 station is only read with a normal of its own, so every one has one.
  for (const [key, s] of s6190) {
    const stations = checked({ id: `6190:${key.trim().replace(/\s+/g, ':')}`, name: s.name, country: '', latitude: s.latitude, longitude: s.longitude, elevation: s.elevation, period: '1961-1990', normals: s.normals }, MEMBERS_6190[s.member] as readonly string[], [s.pub9, ...(records.get(wmo6190(key) as string) ?? [])]);
    out.push(...stations.map((st) => ({ ...st, latitude: round4(st.latitude), longitude: round4(st.longitude) })));
  }
  // A 1981-2010 station, then a national service's own, then the Deutscher Wetterdienst's normals and its Klimatafeln,
  // then a World Weather Information Service city, then an average of NOAA's daily records, stands only for what its
  // country has from none of the sets before.
  const fill = (stations: readonly SourceStation[]) => {
    const has = new Set(out.flatMap((s) => Object.keys(s.normals).map((p) => `${s.country}|${p}`)));
    for (const s of stations) {
      const normals = Object.fromEntries(Object.entries(s.normals).filter(([p]) => !has.has(`${s.country}|${p}`)));
      if (Object.keys(normals).length > 0) out.push({ ...s, normals });
    }
  };
  const own = (s: SourceStation) => checked(s, [s.country]);
  fill(s8110.flatMap(own));
  fill(national.flatMap(own));
  fill(dwd.flatMap(({ member, ...s }) => checked(s, COUNTRIES_DWD[member] as readonly string[])));
  fill(
    klimatafeln.flatMap(({ member, ...s }) => {
      const country = KT_COUNTRY[s.id.split(':')[1] as string];
      return checked(s, country === undefined ? (COUNTRIES_KT[member] as readonly string[]) : [country]);
    }),
  );
  fill([...sWwis].flatMap(([id, s]) => checked({ id: `wwis:${id}`, name: s.name, country: '', latitude: round4(s.latitude), longitude: round4(s.longitude), elevation: null, period: s.period, normals: s.normals }, MEMBERS_WWIS[s.member] as readonly string[])));
  fill(ghcnd.flatMap(own));
  // Each station named for the player by the town nearest it in its own country, where one is near.
  const named = out.map((s) => {
    const t = nearestTown(pool([s.country]), s.latitude, s.longitude);
    // Stryker disable next-line EqualityOperator: a town exactly 50 km off is near enough or not, either way.
    return { ...s, town: t !== undefined && distanceKm(s.latitude, s.longitude, t.latitude, t.longitude) <= TOWN_KM ? t.name : null };
  });
  return named.sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function readStations(root: string, towns: readonly Town[]): Station[] {
  const files = Object.fromEntries(PARAMS.map((p) => [p, pinned(root, SOURCES_9120[p].file, SOURCES_9120[p].sha256, 'utf8')])) as Record<Param, string>;
  const normals = pinned(root, SOURCES_6190.normals.file, SOURCES_6190.normals.sha256, 'latin1');
  const stations = pinned(root, SOURCES_6190.stations.file, SOURCES_6190.stations.sha256, 'latin1');
  const national = [...parseMeteoFrance(pinned(root, SOURCE_MF.file, SOURCE_MF.sha256, 'utf8')), ...parseCwa(pinned(root, SOURCE_CWA.file, SOURCE_CWA.sha256, 'utf8')), ...parseMetOffice(pinned(root, SOURCE_METOFFICE.file, SOURCE_METOFFICE.sha256, 'utf8')), ...parseAnguilla(pinned(root, SOURCE_ANGUILLA.file, SOURCE_ANGUILLA.sha256, 'utf8')), ...parseTonga(pinned(root, SOURCE_TONGA.file, SOURCE_TONGA.sha256, 'utf8'))];
  // Each file read by hand is checked, though nothing is read from it here.
  for (const { source, station } of HAND_READ) {
    pinned(root, source.file, source.sha256, 'latin1');
    national.push(station);
  }
  const wwis = pinned(root, SOURCE_WWIS.file, SOURCE_WWIS.sha256, 'utf8');
  const s8110 = Object.entries(SOURCES_8110).flatMap(([country, f]) => parse8110(country, pinned(root, f.file, f.sha256, 'latin1')));
  const outlines = readOutlines(pinned(root, OUTLINES.file, OUTLINES.sha256, 'utf8'));
  return compileStations(parse9120(files), parse6190(normals, stations), s8110, national, parseDwd(pinned(root, SOURCE_DWD.file, SOURCE_DWD.sha256, 'utf8')), parseKlimatafeln(pinned(root, SOURCE_KT.file, SOURCE_KT.sha256, 'utf8')), parseWwis(wwis), parseGhcnd(pinned(root, SOURCE_GHCND.file, SOURCE_GHCND.sha256, 'utf8')), towns, outlines);
}

/** Compact: a station per array (id, name, town, country, latitude, longitude, height, period), its parameters as twelve months or null, in PARAMS' order. */
export const serialize = (stations: readonly Station[]) =>
  `${JSON.stringify({ params: PARAMS, stations: stations.map((s) => [s.id, s.name, s.town, s.country, s.latitude, s.longitude, s.elevation, s.period, ...PARAMS.map((p) => s.normals[p] ?? null)]) })}\n`;
