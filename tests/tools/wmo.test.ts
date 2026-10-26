import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { coverageOf, readTowns } from '../../tools/wmo/build.ts';
import { MODEL, NO_PLACES, OUTPUT as COVERAGE, SETS, TESTS, TOLD, serializeCoverage, weatherCoverage } from '../../tools/wmo/coverage.ts';
import { COMMUNES_MF, COUNTRIES_DWD, COUNTRIES_KT, KT_COUNTRY, MONTH_DAYS, MEMBERS_6190, MEMBERS_9120, MEMBERS_WWIS, OUTPUT, SOURCES_6190, SOURCES_8110, SOURCES_9120, HAND_READ, SOURCE_CWA, SOURCE_DWD, SOURCE_KT, SOURCE_METOFFICE, SOURCE_MF, SOURCE_WWIS, SOURCE_GHCND, SOURCE_ANGUILLA, SOURCE_TONGA, YEARS_GHCND, compileStations, monthValue, parseAnguilla, parseTonga, parseGhcnd, countryOf, distanceKm, nearestTown, parse6190, parse8110, parse9120, parseCwa, parseDwd, parseKlimatafeln, parseMeteoFrance, parseMetOffice, parseWwis, readStations, serialize, TOWN_KM, townPool, type SourceStation } from '../../tools/wmo/compile.ts';

const ROOT = join(import.meta.dirname, '../..');
/** A 1961-1990 station key: region, country, WMO number, national id and its code, 17 columns. */
const K = (k: string) => k.padEnd(17);
const COUNTRIES = new Set(Object.keys(JSON.parse(readFileSync(join(ROOT, 'src/world/gazetteer/countries.json'), 'utf8')) as object));

/** A composite-file line: element, region, ID, WIGOS id, latitude, longitude, elevation, Member, station, 12 months, annual. */
const line9120 = (over: { id?: string; lat?: string; lon?: string; elev?: string; member?: string; name?: string; months?: string[] } = {}) =>
  ['001', '6', over.id ?? '00012345', '0-20000-0-12345 ', over.lat ?? ' 45.000', over.lon ?? '  5.000', over.elev ?? ' 100.0', over.member ?? 'France', over.name ?? 'Lyon', ...(over.months ?? Array.from({ length: 12 }, (_, i) => String(i + 1))), '78'].join(',');
const files9120 = (lines: Partial<Record<'tmax' | 'tmin' | 'prcp' | 'wet' | 'sun', string[]>>) =>
  Object.fromEntries((['tmax', 'tmin', 'prcp', 'wet', 'sun'] as const).map((p) => [p, ['Elem,Rgn,ID,WIGOS,Lat,Lon,Elev,Country,Station,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Annual', ...(lines[p] ?? [])].join('\n')])) as Record<'tmax' | 'tmin' | 'prcp' | 'wet' | 'sun', string>;

/** A 1961-1990 station-metadata record, by column. */
function meta6190(o: { key?: string; lat?: string; lon?: string; elev?: string; pub9?: string; pub9lat?: string; pub9lon?: string; name?: string; pub9name?: string } = {}): string {
  const b = Array(208).fill(' ');
  const put = (at: number, s: string) => [...s].forEach((c, i) => (b[at - 1 + i] = c));
  put(1, o.key ?? K('6FR07480'));
  put(19, o.lat ?? '4543N');
  put(24, o.lon ?? '00501E');
  put(30, o.elev ?? '   240');
  put(36, o.pub9lat ?? '4544N');
  put(41, o.pub9lon ?? '00502E');
  put(47, o.pub9 ?? ' 241');
  put(57, o.name ?? 'LYON BRON');
  put(91, o.pub9name ?? 'LYON/BRON');
  return b.join('').trimEnd();
}
/** A 1961-1990 normals record: key, period, element and statistic, qualifier, twelve months. */
function norm6190(o: { key?: string; period?: string; code?: string; qualifier?: string; months?: string[] } = {}): string {
  const months = o.months ?? Array.from({ length: 12 }, (_, i) => `${i + 1}.0`);
  return `${o.key ?? K('6FR07480')}${o.period ?? '19611990'}1${o.code ?? '0201'}${(o.qualifier ?? '').padEnd(6)}A${months.map((m) => m.padStart(7) + ' ').join('')}`;
}

/** A World Weather Information Service city, as its JSON gives it. */
const city = (o: { id?: number; member?: string; name?: string | null; cityName?: string; lat?: string; lon?: string; raintype?: string; raindef?: string; rainunit?: string; datab?: number | ''; datae?: number | ''; tempb?: number | ''; tempe?: number | ''; months?: Record<string, unknown>[] } = {}) => ({
  cityId: o.id ?? 1,
  cityName: o.cityName ?? 'Lyon',
  stationName: o.name === undefined ? 'Lyon Bron' : o.name,
  cityLatitude: o.lat ?? '45.0',
  cityLongitude: o.lon ?? '5.0',
  member: { memName: o.member ?? 'France' },
  climate: {
    raintype: o.raintype ?? 'Rainfall', raindef: o.raindef ?? '1', rainunit: o.rainunit ?? 'mm',
    datab: o.datab ?? 1991, datae: o.datae ?? 2020, tempb: o.tempb ?? '', tempe: o.tempe ?? '',
    climateMonth: o.months ?? Array.from({ length: 12 }, (_, i) => ({ month: 12 - i, maxTemp: String(12 - i + 10), minTemp: String(12 - i), rainfall: '50.04', raindays: '8' })),
  },
});
const wwis = (...cities: ReturnType<typeof city>[]) => JSON.stringify({ cities });

/** A Météo-France fiche, its sections given as [title, period stated or none, row]. */
const fiche = (o: { head?: string; period?: string; sections?: [string, string | null, string][] } = {}) =>
  [
    'FICHE CLIMATOLOGIQUE;',
    ';',
    `Statistiques  ${o.period ?? '1991-2020'}  et  records;`,
    o.head ?? `GILLOT-AEROPORT (974)      Indicatif : 97418110, alt : 8m, lat : 20°53'31"S, lon : 55°31'43"E;`,
    '',
    ...(o.sections ?? [['Température maximale (Moyenne en °C)', null, '            ;      30.2;      30.3;        30;      29.2;      27.6;      26.2;      25.4;      25.5;        26;        27;      28.3;      29.5;      27.9;']]).flatMap(([title, period, row]) =>
      title.startsWith('Rr') ? [...(period === null ? [] : [`Statistiques établies sur la période ${period};`]), row] : [`${title};`, ...(period === null ? [] : [`Statistiques établies sur la période ${period};`]), row],
    ),
  ].join('\r\n');
const months12 = (v: string[]) => `            ;${v.map((x) => x.padStart(10)).join(';')};    0;`;
const mf = (...stations: { id: string; name?: string; fiche: string | null }[]) => JSON.stringify({ stations: stations.map((s) => ({ properties: { NUM_POSTE: s.id, NOM_USUEL: s.name ?? 'GILLOT-AEROPORT ' }, fiche: s.fiche })) });

describe('the station compiler', () => {
  it('reproduces the stations the engine reads, byte for byte, from the WMO\'s files', () => {
    const stations = readStations(ROOT, readTowns(ROOT));
    expect(serialize(stations)).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    // And the weather's coverage matrix from them, the gazetteer and the register.
    expect(coverageOf(ROOT, stations)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
  }, 120_000);
  it('counts a country researched where its own stations give every normal, else blocked where the register says why, else pending', () => {
    const st = (id: string, country: string, params: string[]) => ({ id, name: id, town: null, country, latitude: 0, longitude: 0, elevation: null, period: null, normals: Object.fromEntries(params.map((p) => [p, [1]])) });
    const stations = [st('9120:1', 'FR', ['tmax', 'tmin', 'prcp']), st('mf:2', 'FR', ['wet', 'sun']), st('wwis:3', 'MC', ['tmax']), st('8110:4', 'EC', ['sun']), st('6190:5', 'EC', ['tmax', 'tmin', 'prcp', 'wet'])];
    const rows = weatherCoverage(['FR', 'MC', 'VA', 'AN', 'EC'], new Set(['FR', 'MC', 'VA', 'EC']), stations, new Map([['MC', 'R-0099']]));
    expect(rows).toEqual([
      { key: 'FR', status: 'researched', register: ['R-0037', 'R-0039', 'R-0040', 'R-0043'], tests: TESTS },
      { key: 'MC', status: 'blocked', register: ['R-0039', 'R-0040', 'R-0042', 'R-0099'], tests: [...TESTS, TOLD] },
      { key: 'VA', status: 'pending', missing: ['tmax', 'tmin', 'prcp', 'wet', 'sun'] },
      { key: 'AN', status: 'proven', tests: [NO_PLACES] },
      { key: 'EC', status: 'researched', register: ['R-0038', 'R-0039', 'R-0040', 'R-0044'], tests: TESTS },
    ]);
    expect(TOLD).toBe("tests/world/weather/weather.test.ts::the weather at real towns > reads each town's nearest station of its own country, and says where it has none");
    expect([SETS, MODEL]).toEqual([{ '9120': 'R-0037', '6190': 'R-0038', '8110': 'R-0044', mf: 'R-0043', cwa: 'R-0045', metoffice: 'R-0048', bws: 'R-0049', dhm: 'R-0057', rnsm: 'R-0060', meteocw: 'R-0074', anguilla: 'R-0075', tms: 'R-0076', dwd: 'R-0062', kt: 'R-0063', wwis: 'R-0042', ghcnd: 'R-0073' }, ['R-0039', 'R-0040']]);
    // A station is of a set by its id's start up to the colon, not by a likeness.
    expect(weatherCoverage(['FR'], new Set(['FR']), [st('9120x:1', 'FR', ['tmax', 'tmin', 'prcp', 'wet', 'sun'])], new Map())[0]).toMatchObject({ register: ['R-0039', 'R-0040'] });
    expect(serializeCoverage([{ key: 'AN', status: 'proven', tests: ['t'] }])).toBe('{\n "engine": "world.weather",\n "axis": "country",\n "rows": [\n  {\n   "key": "AN",\n   "status": "proven",\n   "tests": [\n    "t"\n   ]\n  }\n ]\n}\n');
  });
  it('knows every Member of every set, by codes the gazetteer lists', () => {
    for (const codes of [...Object.values(MEMBERS_9120), ...Object.values(MEMBERS_6190), ...Object.values(MEMBERS_WWIS), ...Object.values(COUNTRIES_DWD), ...Object.values(COUNTRIES_KT), Object.values(KT_COUNTRY), Object.values(COMMUNES_MF), Object.keys(SOURCES_8110)]) for (const c of codes) expect(COUNTRIES.has(c), c).toBe(true);
    expect(Object.keys(MEMBERS_9120)).toHaveLength(142);
    expect(MEMBERS_6190['VN']).toEqual(['VE']);
    expect(Object.keys(MEMBERS_WWIS)).toHaveLength(190);
    expect(MEMBERS_WWIS['UK - Bermuda']).toEqual(['BM']);
  });
  it('measures great circles', () => {
    expect(distanceKm(51.5074, -0.1278, 48.8566, 2.3522)).toBeCloseTo(343.56, 1);
    expect(distanceKm(0, 0, 0, 180)).toBeCloseTo(Math.PI * 6371.0088, 6);
  });
  it('places a station in the Member\'s country, among several at the nearest town\'s, and in Antarctica south of 60°S', () => {
    const towns = [{ name: 'T', country: 'RE', latitude: -21, longitude: 55.5 }, { name: 'T', country: 'FR', latitude: 45, longitude: 5 }, { name: 'T', country: 'IT', latitude: -21, longitude: 55.6 }];
    const pool = townPool(towns, ['FR', 'RE']);
    expect(pool.map((t) => t.country)).toEqual(['RE', 'FR']);
    expect(countryOf(['FR', 'RE'], -21.1, 55.5, pool)).toBe('RE');
    expect(countryOf(['FR', 'RE'], 44, 5, pool)).toBe('FR');
    expect(countryOf(['FR'], -21.1, 55.5, pool)).toBe('FR');
    expect(countryOf(['AU', 'CX'], -61, 100, pool)).toBe('AQ');
    expect(countryOf(['AU'], -60, 100, pool)).toBe('AU');
    expect(countryOf(['CW', 'SX'], 12, -69, [])).toBe('CW');
  });
  it('finds the nearest town by its latitude as the nearest of all would', () => {
    const towns = readTowns(ROOT).filter((_, i) => i % 50 === 0);
    const pool = townPool(towns, [...new Set(towns.map((t) => t.country))]);
    for (let i = 0; i < 200; i += 1) {
      const lat = -60 + ((i * 37) % 140) + (i % 7) / 10;
      const lon = -179 + ((i * 101) % 358);
      const brute = Math.min(...pool.map((t) => distanceKm(lat, lon, t.latitude, t.longitude)));
      const got = nearestTown(pool, lat, lon) as { latitude: number; longitude: number };
      expect(distanceKm(lat, lon, got.latitude, got.longitude), `${lat},${lon}`).toBe(brute);
    }
    expect(nearestTown([], 0, 0)).toBeUndefined();
    expect(nearestTown([{ name: 'T', country: 'A', latitude: 10, longitude: 0 }], 50, 0)?.country).toBe('A');
    expect(nearestTown([{ name: 'T', country: 'A', latitude: 60, longitude: 0 }], 50, 0)?.country).toBe('A');
  });
  it('reads the 1991-2020 files, keeping a normal only where every month has one, and no station without a place', () => {
    const s = parse9120(files9120({
      tmax: [line9120(), line9120({ id: '00099999', name: 'Nowhere', lat: '-98.600', lon: '-986.600' }), line9120({ id: '00011111', name: 'Gappy', months: ['1', '2', '-99.9', '4', '5', '6', '7', '8', '9', '10', '11', '12'] })],
      prcp: [line9120({ months: Array(12).fill('70.04') })],
      wet: [line9120({ elev: '-999.9', name: 'Other', lat: '40.000', lon: '-91.000' })],
    }));
    expect([...s.keys()]).toEqual(['00012345|0-20000-0-12345|Lyon', '00011111|0-20000-0-12345|Gappy', '00012345|0-20000-0-12345|Other']);
    expect(s.get('00012345|0-20000-0-12345|Lyon')).toEqual({ member: 'France', name: 'Lyon', latitude: 45, longitude: 5, elevation: 100, normals: { tmax: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], prcp: Array(12).fill(70) } });
    expect(s.get('00011111|0-20000-0-12345|Gappy')?.normals).toEqual({});
    expect(s.get('00012345|0-20000-0-12345|Other')).toMatchObject({ elevation: null, latitude: 40, longitude: -91 });
    expect(parse9120(files9120({ tmax: [line9120({ lat: '90.5' })], prcp: [line9120({ lon: '-180.5' })] })).size).toBe(0);
    // A line of nothing but spaces is no station.
    expect(parse9120(files9120({ tmax: ['   ', line9120()] })).size).toBe(1);
    expect(parse9120(files9120({ tmax: [line9120({ lat: '-90' }), line9120({ name: 'E', lon: '180' })] })).size).toBe(2);
  });
  it('refuses a 1991-2020 line or Member it doesn\'t know', () => {
    expect(() => parse9120(files9120({ tmax: [`${line9120()},x`] }))).toThrow("a 1991-2020 line the compiler doesn't know");
    expect(() => parse9120(files9120({ sun: [line9120({ member: 'Atlantis' })] }))).toThrow("a 1991-2020 Member the compiler doesn't know: Atlantis");
  });
  it('reads the 1961-1990 files: the Member\'s coordinates or else Publication No. 9\'s, the parameters by element and statistic', () => {
    const stations = [
      meta6190(),
      meta6190({ key: K('6FR07481'), lat: '     ', lon: '      ', elev: '      ', pub9lat: '1030S', pub9lon: '06015W', pub9: '  12', name: '', pub9name: 'SOUTH  PLACE' }),
      meta6190({ key: K('6FR07482'), lat: '     ', lon: '      ', pub9lat: '     ', pub9lon: '      ', elev: '      ', pub9: '    ' }),
    ].join('\n');
    const normals = [
      norm6190(),
      norm6190({ code: '0301', months: Array(12).fill('-2.5') }),
      norm6190({ code: '0615', months: ['88888.8', '8888888', '-9797.9', '-97979', '1', '2', '3', '4', '5', '6', '7', '8'] }),
      norm6190({ code: '9515', qualifier: '0.1', months: Array(12).fill('20') }),
      norm6190({ code: '9515', qualifier: '1.0', months: Array(12).fill('10') }),
      norm6190({ code: '1544', months: Array(12).fill('150') }),
      norm6190({ code: '0101', months: Array(12).fill('9') }),
      norm6190({ key: K('6FR07481'), code: '4044', months: Array(12).fill('180') }),
      norm6190({ key: K('6FR07481'), code: '0201', period: '19511980', months: Array(12).fill('20') }),
      norm6190({ key: K('6FR07481'), code: '0201', period: '19611990', months: Array(12).fill('21') }),
      norm6190({ key: K('6FR07481'), code: '0201', period: '19711990', months: Array(12).fill('22') }),
      norm6190({ key: K('6FR07481'), code: '0301', months: [...Array(11).fill('5'), '-9999.9'] }),
      norm6190({ key: K('6FR07481'), code: '0615', months: [...Array(11).fill('5'), '-99999'] }),
      norm6190({ key: K('6FR07481'), code: '0615', period: '19651990', months: [...Array(11).fill('5'), '-9999'] }),
      norm6190({ key: K('6FR07481'), code: '0615', period: '19651990', months: [...Array(11).fill('5'), ''] }),
      norm6190({ key: K('6FR07482') }),
      norm6190({ key: K('6FR09999') }),
    ].join('\n');
    const s = parse6190(normals, stations);
    expect([...s.keys()]).toEqual([K('6FR07480'), K('6FR07481')]);
    expect(s.get(K('6FR07480'))).toMatchObject({ member: 'FR', name: 'LYON BRON', elevation: 240, normals: { tmax: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tmin: Array(12).fill(-2.5), prcp: [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8], wet: Array(12).fill(10), sun: Array(12).fill(150) } });
    expect(s.get(K('6FR07480'))?.latitude).toBeCloseTo(45 + 43 / 60, 9);
    expect(s.get(K('6FR07480'))?.longitude).toBeCloseTo(5 + 1 / 60, 9);
    const south = s.get(K('6FR07481'));
    expect(south).toMatchObject({ name: 'SOUTH PLACE', elevation: 12, normals: { sun: Array(12).fill(180), tmax: Array(12).fill(21) } });
    expect(south?.normals.tmin).toBeUndefined();
    expect(south?.normals.prcp).toBeUndefined();
    expect(south?.latitude).toBeCloseTo(-10.5, 9);
    expect(south?.longitude).toBeCloseTo(-(60 + 15 / 60), 9);
    // A period other than 1961-1990 stands only where there's none of 1961-1990, and the first of 1961-1990 stays.
    const other = parse6190(norm6190({ period: '19511980', months: Array(12).fill('7') }), meta6190());
    expect(other.get(K('6FR07480'))?.normals.tmax).toEqual(Array(12).fill(7));
    const twice = parse6190([norm6190({ months: Array(12).fill('1') }), norm6190({ months: Array(12).fill('2') })].join('\n'), meta6190());
    expect(twice.get(K('6FR07480'))?.normals.tmax).toEqual(Array(12).fill(1));
    const elevation = parse6190(norm6190(), meta6190({ elev: '      ', pub9: '    ' }));
    expect(elevation.get(K('6FR07480'))?.elevation).toBeNull();
    expect(() => parse6190('', meta6190({ key: K('6ZZ07480') }))).toThrow("a 1961-1990 Member the compiler doesn't know: ZZ");
    // Lines of nothing but spaces are no record; a coordinate missing its degrees or its minutes isn't given; a station
    // with no latitude or no longitude can't be placed.
    expect(parse6190(`   \n${norm6190()}\n  `, `  \n${meta6190()}`).size).toBe(1);
    const half = (o: Parameters<typeof meta6190>[0]) => parse6190(norm6190(), meta6190({ pub9lat: '     ', pub9lon: '      ', ...o })).size;
    expect([half({ lat: '  43N' }), half({ lat: '45  N' }), half({ lon: '   01E' }), half({ lon: '005  E' })]).toEqual([0, 0, 0, 0]);
    expect([half({ lat: '     ' }), half({ lon: '      ' }), half({})]).toEqual([0, 0, 1]);
  });
  it("reads the World Weather Information Service's cities: every month or none, the rain days only of at least 1 mm", () => {
    const s = parseWwis(wwis(city()));
    expect(s.get('1')).toEqual({ member: 'France', name: 'Lyon Bron', latitude: 45, longitude: 5, elevation: null, period: '1991-2020', normals: { tmax: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22], tmin: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], prcp: Array(12).fill(50), wet: Array(12).fill(8) } });
    expect(parseWwis(wwis(city({ raindef: '1.0' }))).get('1')?.normals.wet).toEqual(Array(12).fill(8));
    expect(parseWwis(wwis(city({ raindef: '0.1' }))).get('1')?.normals.wet).toBeUndefined();
    expect(parseWwis(wwis(city({ raindef: '' }))).get('1')?.normals.wet).toBeUndefined();
    // Precipitation counts as rainfall or "PPT", in millimetres; nothing else is read as it.
    expect(parseWwis(wwis(city({ raintype: 'PPT' }))).get('1')?.normals.prcp).toEqual(Array(12).fill(50));
    expect(Object.keys(parseWwis(wwis(city({ raintype: 'N/A' }))).get('1')?.normals ?? {})).toEqual(['tmax', 'tmin']);
    expect(Object.keys(parseWwis(wwis(city({ rainunit: 'in' }))).get('1')?.normals ?? {})).toEqual(['tmax', 'tmin']);
    // A trace is none; a month missing, empty, "NULL" or absent takes the parameter away.
    const m = (over: Record<string, unknown>) => Array.from({ length: 12 }, (_, i) => ({ month: i + 1, maxTemp: '20', minTemp: '10', rainfall: 'TR', raindays: '1', ...(i === 3 ? over : {}) }));
    expect(parseWwis(wwis(city({ months: m({}) }))).get('1')?.normals.prcp).toEqual(Array(12).fill(0));
    expect(parseWwis(wwis(city({ months: m({ maxTemp: null }) }))).get('1')?.normals.tmax).toBeUndefined();
    expect(parseWwis(wwis(city({ months: m({ minTemp: '' }) }))).get('1')?.normals.tmin).toBeUndefined();
    expect(parseWwis(wwis(city({ months: m({ raindays: 'NULL' }) }))).get('1')?.normals.wet).toBeUndefined();
    expect(parseWwis(wwis(city({ months: m({ maxTemp: '  ' }) }))).get('1')?.normals.tmax).toBeUndefined();
    expect(parseWwis(wwis(city({ months: m({}).slice(1) }))).get('1')?.normals).toEqual({});
    // The period is the climate's, else the temperature's, else none; the station's name, else the city's.
    expect(parseWwis(wwis(city({ datab: '', datae: '', tempb: 1981, tempe: 2010 }))).get('1')?.period).toBe('1981-2010');
    expect(parseWwis(wwis(city({ datab: 1971, datae: '', tempb: 1981, tempe: '' }))).get('1')?.period).toBeNull();
    expect(parseWwis(wwis(city({ datab: '', datae: 2000 }))).get('1')?.period).toBeNull();
    expect(parseWwis(wwis(city({ datab: '', datae: '', tempb: '', tempe: 2010 }))).get('1')?.period).toBeNull();
    expect(parseWwis(wwis(city({ name: null, cityName: ' Lyon ' }))).get('1')?.name).toBe('Lyon');
    expect(parseWwis(wwis(city({ name: null }), city({ id: 2, name: '  ' }))).get('2')?.name).toBe('Lyon');
    expect(parseWwis(wwis(city({ name: null }))).get('1')?.name).toBe('Lyon');
    // A city with no place on Earth is left out; a Member it doesn't know is refused.
    expect(parseWwis(wwis(city({ lat: '' }), city({ id: 2, lon: 'x' }))).size).toBe(0);
    expect(() => parseWwis(wwis(city({ member: 'Atlantis' })))).toThrow("a World Weather Information Service Member the compiler doesn't know: Atlantis");
  });
  it("reads Météo-France's fiches: its place and height, each section's period, a count of days of \".\" as none", () => {
    const sections: [string, string | null, string][] = [
      ['Température maximale (Moyenne en °C)', null, months12(Array(12).fill('30'))],
      ['Température minimale (Moyenne en °C)', '1997-2010', months12(Array(12).fill('20.04'))],
      ['Précipitations : Hauteur moyenne mensuelle (mm)', null, months12(Array(12).fill('100'))],
      ['Rr >=  1 mm', null, `Rr >=  1 mm ;${['10', '.', ...Array(10).fill('5')].map((x) => x.padStart(10)).join(';')};    0;`],
      ["Durée d'insolation (Moyenne en heures)", null, 'Données non disponibles;'],
    ];
    const [a, b, ...rest] = parseMeteoFrance(mf({ id: '97418110', fiche: fiche({ sections }) }));
    expect(rest).toEqual([]);
    expect(a).toEqual({ id: 'mf:97418110:1991-2020', name: 'GILLOT-AEROPORT', country: 'RE', latitude: -20.8919, longitude: 55.5286, elevation: 8, period: '1991-2020', normals: { tmax: Array(12).fill(30), prcp: Array(12).fill(100), wet: [10, 0, ...Array(10).fill(5)] } });
    expect(b).toMatchObject({ id: 'mf:97418110:1997-2010', period: '1997-2010', normals: { tmin: Array(12).fill(20) } });
    // The wet days' period is stated on the line above them.
    expect(parseMeteoFrance(mf({ id: '97418110', fiche: fiche({ sections: [['Rr >=  1 mm', '2004-2020', sections[3]?.[2] as string]] }) }))[0]?.period).toBe('2004-2020');
    // A mean of "." or a row short of months isn't one; a fiche with nothing read is no station; a station without a fiche is none.
    const one = (row: string) => parseMeteoFrance(mf({ id: '97418110', fiche: fiche({ sections: [['Température maximale (Moyenne en °C)', null, row]] }) }));
    expect(one(months12(['.', ...Array(11).fill('30')]))).toEqual([]);
    expect(one(months12(['', ...Array(11).fill('30')]))).toEqual([]);
    expect(one(months12(Array(11).fill('30')).replace(/;\s*0;$/, ';'))).toEqual([]);
    expect(one('Données non disponibles;')).toEqual([]);
    expect(parseMeteoFrance(mf({ id: '97418110', fiche: null }))).toEqual([]);
    // The country by the longest start of the number that fits; Antarctica south of 60°S; west and south negative.
    const at = (id: string, head?: string) => parseMeteoFrance(mf({ id, fiche: fiche(head === undefined ? {} : { head }) }))[0];
    expect([at('97123001')?.country, at('97101015')?.country, at('99138001')?.country, at('98411001')?.country]).toEqual(['BL', 'GP', 'MC', 'TF']);
    expect(at('98404003', `DUMONT D'URVILLE      Indicatif : 98404003, alt : 42m, lat : 66°39'48"S, lon : 140°00'05"E;`)?.country).toBe('AQ');
    expect(at('98404003', `X      Indicatif : 98404003, alt : 42m, lat : 60°00'00"S, lon : 140°00'05"E;`)?.country).toBe('TF');
    expect(at('97101015', `LE RAIZET AERO (971)      Indicatif : 97101015, alt : 11m, lat : 16°15'50"N, lon : 61°30'58"O;`)).toMatchObject({ latitude: 16.2639, longitude: -61.5161 });
    expect(at('97101015', `X      Indicatif : 97101015, alt : -2m, lat : 16°15'50"N, lon : 61°30'58"W;`)).toMatchObject({ longitude: -61.5161, elevation: -2 });
    expect(() => at('12345678')).toThrow("a Météo-France station the compiler can't place: 12345678");
    expect(() => at('97101015', 'X      Indicatif : 97101015, alt : 11m, lat : 16N, lon : 61W;')).toThrow("a Météo-France fiche the compiler can't read: 97101015");
    expect(() => at('97101015', `X      Indicatif : 97101015, alt : 11m, lat : 16°15'50"N, lon : 61°30'58";`)).toThrow("can't read");
    expect(() => at('97101015', 'nothing')).toThrow("can't read");
    expect(() => parseMeteoFrance(mf({ id: '97101015', fiche: fiche({ period: '1991' }) }))).toThrow("can't read");
    // Either coordinate unreadable; anything about the degrees but spaces makes them unreadable.
    expect(() => at('97101015', `X      Indicatif : 97101015, alt : 11m, lat : 16N, lon : 61°30'58"W;`)).toThrow("can't read");
    expect(() => at('97101015', `X      Indicatif : 97101015, alt : 11m, lat : x16°15'50"N, lon : 61°30'58"W;`)).toThrow("can't read");
    expect(() => at('97101015', `X      Indicatif : 97101015, alt : 11m, lat : 16°15'50"N, lon : 61°30'58"Wx;`)).toThrow("can't read");
    expect(at('97101015', `X      Indicatif : 97101015, alt : 11m, lat : 16°15'50"N, lon : 61°30'58"W ;`)).toMatchObject({ longitude: -61.5161 });
    // Lines ended either way, blank lines anywhere; a line under a title that isn't a row of months isn't read as one,
    // nor is a row short of months.
    const spaced = fiche({ sections: [['Température maximale (Moyenne en °C)', null, months12(Array(12).fill('30'))]] }).replace(/\r\n/g, '\n   \n\n');
    expect(parseMeteoFrance(mf({ id: '97418110', fiche: spaced }))[0]?.normals).toEqual({ tmax: Array(12).fill(30) });
    expect(one(`Date        ;${Array(12).fill('1').join(';')};    0;`)).toEqual([]);
    expect(one('            ;      30;      30;      30')).toEqual([]);
    // A title on the fiche's last line has no row under it.
    expect(parseMeteoFrance(mf({ id: '97418110', fiche: `${fiche({ sections: [] })}\r\nTempérature maximale (Moyenne en °C);` }))).toEqual([]);
  });
  it("reads the CWA's monthly means: each row's station the one of its name open on the period's last day", () => {
    const row = (name: string, period: string, v: string[]) => `<tr><th scope="row" headers="loc">${name}</th>${v.map((x, i) => `<td headers="m${i}">${x}</td>`).join('')}<td headers="item">0</td><td headers="period">${period}</td></tr>`;
    const station = (id: string, name: string, start: string, end: string | null, lat = '25.04') => ({ StationID: id, StationNameEN: name, StationAltitude: '5.3', StationLatitude: lat, StationLongitude: '121.51', StationStartDate: start, StationEndDate: end });
    const json = (pages: Record<string, string>, list = [station('466920', 'TAIPEI', '1896-08-11', null), station('466921', 'TAIPEI', '1992-02-01', '1997-09-01', '25.03'), station('467440', 'KAOHSIUNG', '1931-04-01', '2022-01-24', '22.57'), station('467441', 'Kaohsiung', '2022-01-24', null, '22.73'), station('467570', 'HSINCHU', '1938-01-01', '2020-12-31')]) =>
      JSON.stringify({ pages: { meantxmax: '', meantxmin: '', precp: '', precpday: '', sunshine: '', ...pages }, stations: { cwaopendata: { resources: { resource: { data: { stationsStatus: { station: list } } } } } } });
    const twelve = (x: string) => Array(12).fill(x) as string[];
    const out = parseCwa(json({ meantxmax: row('Taipei', '1991~2020', twelve('25.04')) + '\n' + row('Kaohsiung', '1991~2020', twelve('29')), sunshine: row('Taipei', '1994~2020', twelve('120')), precpday: row('Taipei', '1991~2020', twelve('12')), precp: row('Taipei', '1991~2020', ['x', ...twelve('1').slice(1)]) }));
    expect(out).toEqual([
      { id: 'cwa:466920:1991-2020', name: 'Taipei', country: 'TW', latitude: 25.04, longitude: 121.51, elevation: 5.3, period: '1991-2020', normals: { tmax: twelve('25').map(Number) } },
      { id: 'cwa:467440:1991-2020', name: 'Kaohsiung', country: 'TW', latitude: 22.57, longitude: 121.51, elevation: 5.3, period: '1991-2020', normals: { tmax: twelve('29').map(Number) } },
      { id: 'cwa:466920:1994-2020', name: 'Taipei', country: 'TW', latitude: 25.04, longitude: 121.51, elevation: 5.3, period: '1994-2020', normals: { sun: twelve('120').map(Number) } },
    ]);
    // A station closed on the period's last day, or opened after it, isn't the one; a name the list hasn't is refused.
    expect(() => parseCwa(json({ meantxmax: row('Hsinchu', '1991~2020', twelve('1')) }))).toThrow("a CWA station the compiler can't find: Hsinchu");
    expect(() => parseCwa(json({ meantxmax: row('Taipei', '1991~2020', twelve('1')) }, [station('466921', 'TAIPEI', '2021-01-01', null)]))).toThrow("can't find: Taipei");
    expect(parseCwa(json({ meantxmax: row('Taipei', '1991~2020', twelve('1')) }, [station('466921', 'TAIPEI', '2020-12-31', '2021-01-01')]))[0]?.id).toBe('cwa:466921:1991-2020');
    // A row without its station's name or its period is none; a month missing takes the parameter away.
    expect(parseCwa(json({ meantxmax: row('Taipei', '1991-2020', twelve('1')) + row('', '1991~2020', twelve('1')).replace('headers="loc">', 'headers="x">') }))).toEqual([]);
    expect(parseCwa(json({ meantxmax: row('Taipei', '1991~2020', twelve('1')).replace('<td headers="m11">1</td>', '') }))).toEqual([]);
  });
  it("averages Anguilla's rainfall over 1991-2020: the years given, where they're 80% of the thirty, in millimetres", () => {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    // Two tables, each a column a year and its decade's average; January lacks `missing` years of 1991-2020.
    const tables = (missing: number) => {
      const table = (years: number[]) => [
        ['', 'Table 3.1.1-R3'],
        ['', 'Month', ...years.map(String), 'Avg. monthly'],
        ...MONTHS.map((month, m) => ['', month, ...years.map((y) => (m === 0 ? (y >= 2001 && y < 2001 + missing ? '-' : y === 1990 ? '100' : '2') : m === 1 && y === 1995 ? '1.5 ' : '1')), '999']),
        ['', 'Total', ...years.map(() => '50'), '999'],
      ];
      return JSON.stringify({ tables: { a: table(Array.from({ length: 16 }, (_, i) => 1990 + i)), b: table(Array.from({ length: 15 }, (_, i) => 2006 + i)) } });
    };
    expect(parseAnguilla(tables(6))).toEqual([
      { id: 'anguilla:clayton-j-lloyd:1991-2020', name: 'Clayton J. Lloyd International Airport', country: 'AI', latitude: 18.21704, longitude: -63.05783, elevation: null, period: '1991-2020', normals: { prcp: [50.8, 25.8, ...Array(10).fill(25.4)] } },
    ]);
    expect(() => parseAnguilla(tables(7))).toThrow("Anguilla's rainfall no longer gives every month of 1991-2020");
  });
  it("reads Tonga's sheets: a row a month, its name before it or above it, the period the sheet ends with", () => {
    const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const sheet = (o: { heading?: string; above?: boolean; months?: number; footer?: string } = {}) =>
      [
        `         CLIMATOLOGICAL INFORMATION – ${o.heading ?? 'FUA’AMOTU AIRPORT'}   `,
        '                MAXIMUM       MINIMUM           (mm)         [>0.1mm]',
        '                (1982- 2009)   (1982- 2009)   (1980-2009)    (1990-2016)',
        ...MONTHS.slice(0, o.months ?? 12).flatMap((m, i) => {
          const values = `   ${(29 + i / 10).toFixed(1)}          ${(-1 - i / 10).toFixed(1)}           ${(100 + i).toFixed(1)}             17`;
          return o.above === true ? [m, '', values] : [`${m}${values}`, ''];
        }),
        o.footer ?? '  Climatological information is based on monthly averages for the 30-year period 1981- 2010',
      ].join('\n');
    const json = (...texts: string[]) => JSON.stringify({ sheets: texts.map((text, i) => ({ wmo: `9179${i}`, latitude: -21.23, longitude: -175.15, text })) });
    const twelve = (f: (i: number) => number) => Array.from({ length: 12 }, (_, i) => Math.round(f(i) * 10) / 10);
    expect(parseTonga(json(sheet(), sheet({ heading: 'MATA’AHO AIRPORT', above: true, footer: 'period 1982-2009' })))).toEqual([
      { id: 'tms:91790:1981-2010', name: 'FUA’AMOTU AIRPORT', country: 'TO', latitude: -21.23, longitude: -175.15, elevation: null, period: '1981-2010', normals: { tmax: twelve((i) => 29 + i / 10), tmin: twelve((i) => -1 - i / 10), prcp: twelve((i) => 100 + i) } },
      { id: 'tms:91791:1982-2009', name: 'MATA’AHO AIRPORT', country: 'TO', latitude: -21.23, longitude: -175.15, elevation: null, period: '1982-2009', normals: { tmax: twelve((i) => 29 + i / 10), tmin: twelve((i) => -1 - i / 10), prcp: twelve((i) => 100 + i) } },
    ]);
    // A month short, no heading, no period: the sheet can't be read.
    for (const bad of [sheet({ months: 11 }), sheet().replace('INFORMATION –', 'INFORMATION'), sheet({ footer: '' }).replace(/\(\d{4}- ?\d{4}\)/g, '')]) expect(() => parseTonga(json(bad))).toThrow("a Tonga sheet the compiler can't read: 91790");
  });
  it("reads the Met Office's averages: each normal from the most recent period that gives every month of it", () => {
    const table = (period: string, rows: string[][], head = ['Month', 'Maximum temperature (°C)', 'Minimum temperature (°C)', 'Days of air frost (days)', 'Sunshine (hours)', 'Rainfall (mm)', 'Days of rainfall ≥1&nbsp;mm (days)']) =>
      `<h3><span>Station:</span> Jersey: Airport, ${period}</h3><p>Climate period: 1991-2020 1981-2010</p><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const months = (cells: string[]) => Array.from({ length: 12 }, (_, i) => [`M${i}`, ...cells]);
    const json = (tables: string) => JSON.stringify({ stations: [{ geohash: 'gbwryn0cm', country: 'JE', name: 'Jersey: Airport', latitude: 49.208, longitude: -2.196, tables }] });
    const out = parseMetOffice(json(table('1991-2020', months(['20.04', '–', '1', '–', '80', '12'])) + table('1981-2010', months(['19', '10', '1', '150', '70', '11'])) + table('1971-2000', months(['18', '9', '1', '140', '60', '10']))));
    expect(out).toEqual([
      { id: 'metoffice:gbwryn0cm:1991-2020', name: 'Jersey: Airport', country: 'JE', latitude: 49.208, longitude: -2.196, elevation: null, period: '1991-2020', normals: { tmax: Array(12).fill(20), prcp: Array(12).fill(80), wet: Array(12).fill(12) } },
      { id: 'metoffice:gbwryn0cm:1981-2010', name: 'Jersey: Airport', country: 'JE', latitude: 49.208, longitude: -2.196, elevation: null, period: '1981-2010', normals: { tmin: Array(12).fill(10), sun: Array(12).fill(150) } },
    ]);
    // A table without its station's heading, a column it doesn't hold, a month short: none read.
    expect(parseMetOffice(json(table('1991-2020', months(['1', '1', '1', '1', '1', '1'])).replace('Station:', 'Place:')))).toEqual([]);
    expect(parseMetOffice(json(table('1991-2020', months(['1']), ['Month', 'Wind (knots)'])))).toEqual([]);
    expect(parseMetOffice(json(table('1991-2020', months(['1', '1', '1', '1', '1', '1']).slice(1))))).toEqual([]);
    expect(parseMetOffice(json(table('1991-2020', [...months(['1', '1', '1', '1', '1']).map((r, i) => (i === 4 ? r.slice(0, 2) : [...r, '1']))])))[0]?.normals).toEqual({ tmax: Array(12).fill(1) });
    // Tags with attributes, cells padded and wrapped; an empty month is none; text after the last table is no table.
    const dressed = `<p>Station:</p>\n <b>Jersey: Airport</b>, 1981-2010<table class="t"><thead><tr><th scope="col">Month</th><th>Sunshine (hours)</th><th>Rainfall (mm)</th></tr></thead><tbody>${Array.from({ length: 12 }, (_, i) => `<tr class="r"><td>M${i}</td><td class="c"> <span>150</span> </td><td>${i === 3 ? '' : '70'}</td></tr>`).join('')}</tbody></table><p>Station: Jersey: Airport, 1971-2000</p>`;
    expect(parseMetOffice(json(dressed))).toEqual([{ id: 'metoffice:gbwryn0cm:1981-2010', name: 'Jersey: Airport', country: 'JE', latitude: 49.208, longitude: -2.196, elevation: null, period: '1981-2010', normals: { sun: Array(12).fill(150) } }]);
    // A month of only spaces is none too; a heading's tags are no part of its words.
    expect(parseMetOffice(json(dressed.replace('<td></td>', '<td> </td>').replace('<th>Sunshine (hours)</th>', '<th><b>Sun</b>shine (hours)</th>')))[0]?.normals).toEqual({ sun: Array(12).fill(150) });
  });
  it("reads the Deutscher Wetterdienst's worldwide normals: each station by its WMO number in the list, once for each period", () => {
    const head = 'Station;Jan;Feb;Mrz;Apr;Mai;Jun;Jul;Aug;Sep;Okt;Nov;Dez';
    const row = (id: string, v: string) => `${id};${Array(12).fill(v).join(';')}`;
    const json = (files: Record<string, Record<string, string[]>>, stations: string[]) => JSON.stringify({ files: Object.fromEntries(['tmax', 'tmin', 'prcp', 'sun'].map((p) => [p, Object.fromEntries(Object.entries(files[p] ?? {}).map(([k, rows]) => [k, [head, ...rows, ''].join('\r\n')]))])), stations: ['WMO-StationID;StationName;Latitude;Longitude;Height;Country', ...stations].join('\r\n') });
    const list = ['98429;Manila;14.52;121.0;15;Philippines', '98444;Legazpi;13.13;123.73;;Philippines', '42293;unknown;;;;', '99999;Nowhere;10;;5;Philippines'];
    const out = parseDwd(json({ sun: { '1961_1990': [row('98429', '200.04'), row('98444', '180'), row('42293', '1'), row('99999', '1'), row('11111', '1')], '1991_2020': [row('98429', '210'), `98444;${Array(11).fill('1').join(';')};`] }, tmax: { '1961_1990': [row(' 98429 ', '30')] } }, list));
    expect(out).toEqual([
      { id: 'dwd:98429:1961-1990', name: 'Manila', member: 'Philippines', country: '', latitude: 14.52, longitude: 121, elevation: 15, period: '1961-1990', normals: { tmax: Array(12).fill(30), sun: Array(12).fill(200) } },
      { id: 'dwd:98444:1961-1990', name: 'Legazpi', member: 'Philippines', country: '', latitude: 13.13, longitude: 123.73, elevation: null, period: '1961-1990', normals: { sun: Array(12).fill(180) } },
      { id: 'dwd:98429:1991-2020', name: 'Manila', member: 'Philippines', country: '', latitude: 14.52, longitude: 121, elevation: 15, period: '1991-2020', normals: { sun: Array(12).fill(210) } },
    ]);
    expect(parseDwd(json({ sun: { '1961_1990': [`98429;${Array(11).fill('1').join(';')}`, `98444;x;${Array(11).fill('1').join(';')}`] } }, list))).toEqual([]);
    expect(() => parseDwd(json({ sun: { '1961_1990': [row('12345', '1')] } }, ['12345;X;1;1;1;Atlantis']))).toThrow("a Deutscher Wetterdienst country the compiler doesn't know: Atlantis");
    expect(COUNTRIES_DWD['Republic of China, Taiwan']).toEqual(['TW']);
  });
  it("reads the Deutscher Wetterdienst's Klimatafeln: each row's months and its own years, the sunshine by the month's days", () => {
    const page = 'https://www.dwd.de/DE/leistungen/klimadatenwelt/asien/ae/china/china_node.html';
    const row = (label: string, v: string[], from = '1961', to = '1990') => `${label}${' '.repeat(10)}${v.join('    ')}  9,9   ${from}   ${to}`;
    const text = (rows: string[], title = 'Macau (Magao) / Volksrepublik China', place = "22° 12' N, geographische Länge: 113° 33' E", height = 'Stationshöhe: 65 m über NHN') =>
      [`Klimatafel von ${title}`, `Koordinaten: geographische Breite: ${place}                   ${height}`, '', 'LUFTTEMPERATUR', ...rows].join('\n');
    const json = (tables: { url?: string; page?: string; text: string }[]) => JSON.stringify({ tables: tables.map((t) => ({ url: 'https://www.dwd.de/DWD/klima/beratung/ak/ak_450110_kt.pdf', page, ...t })) });
    const twelve = (x: string) => Array(12).fill(x) as string[];
    const out = parseKlimatafeln(json([{ text: text([
      row('Mittl. tägl. Maximum [°C]', twelve('17,5')),
      row('Mittl. tägl. Minimum [°C]', twelve('-1,8')),
      row('Mittl. Monats-/Jahressumme [mm]', ['2.031,4', ...twelve('30,2').slice(1)]),
      row('Zahl der Tage mit ≥ 1,0 mm Niederschlag', twelve('4,0'), '1931'),
      row('Zahl der Tage mit ≥ 0,1 mm Niederschlag', twelve('6,0')),
      'SONNENSCHEIN',
      row('Mittl. Tagessumme [Std.]', twelve('4'), '1978'),
      row('Mittl. Tagesmittel [°C]', twelve('14,5')),
    ]) }]));
    expect(out).toEqual([
      { id: 'kt:45011:1961-1990', name: 'Macau (Magao)', member: 'china', country: '', latitude: 22.2, longitude: 113.55, elevation: 65, period: '1961-1990', normals: { tmax: twelve('17.5').map(Number), tmin: twelve('-1.8').map(Number), prcp: [2031.4, ...Array(11).fill(30.2)] } },
      { id: 'kt:45011:1931-1990', name: 'Macau (Magao)', member: 'china', country: '', latitude: 22.2, longitude: 113.55, elevation: 65, period: '1931-1990', normals: { wet: Array(12).fill(4) } },
      { id: 'kt:45011:1978-1990', name: 'Macau (Magao)', member: 'china', country: '', latitude: 22.2, longitude: 113.55, elevation: 65, period: '1978-1990', normals: { sun: MONTH_DAYS.map((d) => Math.round(4 * d * 10) / 10) } },
    ]);
    expect(MONTH_DAYS).toEqual([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
    // South and west are negative; an empty title takes the WMO number; no height, none; a row missing a month, its
    // years or a number isn't read; a blank table is no station.
    const one = (rows: string[], ...a: Parameters<typeof text> extends [unknown, ...infer R] ? R : never) => parseKlimatafeln(json([{ text: text(rows, ...a) }]));
    expect(one([row('Mittl. tägl. Maximum [°C]', twelve('1'))], '/', "33° 57' S, geographische Länge: 18° 36' W", 'Stationshöhe:')[0]).toMatchObject({ name: 'WMO 45011', latitude: -33.95, longitude: -18.6, elevation: null });
    expect(one([row('Mittl. tägl. Maximum [°C]', twelve('1').slice(1))])).toEqual([]);
    expect(one([row('Mittl. tägl. Maximum [°C]', twelve('1'), '19x1')])).toEqual([]);
    expect(one([row('Mittl. tägl. Maximum [°C]', twelve('1'), '1961', '19')])).toEqual([]);
    expect(one([row('Mittl. tägl. Maximum [°C]', ['--', ...twelve('1').slice(1)])])).toEqual([]);
    expect(one([row('Mittl. tägl. Maximum [°C]', ['1,2,3', ...twelve('1').slice(1)])])).toEqual([]);
    // Years that aren't four digits, before or after; a cell more than a row's; a row indented as the text sets it.
    for (const [from, to] of [['x1961', '1990'], ['19611', '1990'], ['1961', 'x1990'], ['1961', '19901']]) expect(one([row('Mittl. tägl. Maximum [°C]', twelve('1'), from, to)])).toEqual([]);
    expect(one([`${row('Mittl. tägl. Maximum [°C]', twelve('1'))} 7`])).toEqual([]);
    expect(one([`   ${row('Mittl. tägl. Maximum [°C]', twelve('1,25'))}`])[0]?.normals).toEqual({ tmax: Array(12).fill(1.3) });
    // A title of one part, its spaces after it not the name's; an empty title, the WMO number.
    expect(one([row('Mittl. tägl. Maximum [°C]', twelve('1'))], 'Lonely Island   ')[0]?.name).toBe('Lonely Island');
    expect(one([row('Mittl. tägl. Maximum [°C]', twelve('1'))], '')[0]?.name).toBe('WMO 45011');
    expect(one([`Mittl. tägl. Maximum [°C]x  ${twelve('1').join('  ')}  1  1961  1990`])).toEqual([]);
    expect(parseKlimatafeln(json([{ text: 'Klimatafel von /\nKoordinaten: geographische Breite: , geographische Länge:' }]))).toEqual([]);
    expect(() => parseKlimatafeln(json([{ url: 'https://www.dwd.de/x.pdf', text: text([]) }]))).toThrow("a Klimatafel the compiler can't read: https://www.dwd.de/x.pdf");
    expect(() => parseKlimatafeln(json([{ text: 'nothing' }]))).toThrow("a Klimatafel the compiler can't read");
    expect(() => parseKlimatafeln(json([{ page: 'https://www.dwd.de/x/atlantis/atlantis_node.html', text: text([]) }]))).toThrow("a Klimatafel country the compiler doesn't know: atlantis");
    expect(KT_COUNTRY).toEqual({ '45011': 'MO' });
  });
  it('reads a 1981-2010 template: each station by its WMO number, its place in degrees, minutes and seconds', () => {
    const csv = [
      'Station_Name,INGUINCHO,,',
      'WMO_Number,Latitude,Longitude,Station_Height',
      '84045,0|15|27.13|N,78|24|28.94|W,3140.0',
      'WMO_Number,Parameter_Code,Calculation_Name,Calculation_Code,January',
      `84045,8,Sum,4,${Array(12).fill('150.04').join(',')},1800`,
      `84045,8,NOY,98,${Array(12).fill('30').join(',')},30`,
      `84045,3,Mean,1,${Array(11).fill('20').join(',')},,240`,
      `84045,9,Mean,1,${Array(12).fill('20').join(',')},240`,
      'Station_Name,LA TOLA',
      'WMO_Number,Latitude,Longitude,Station_Height',
      '84046,0|10|00|S,78|00|00|E,',
      `84046,1,Sum,4,${Array(12).fill('x').join(',')},0`,
      `84047,1,Sum,4,${Array(12).fill('1').join(',')},12`,
      'Station_Name,ELSEWHERE',
      'WMO_Number,Latitude,Longitude,Station_Height',
      '84048,0|10|00|S,78|00|00|E,',
      `84048,1,Sum,4,${Array(12).fill('1').join(',')},12`,
      `84048,2,Count,5,${Array(12).fill('3').join(',')}`,
      `84048,3,Mean,1,${Array(6).fill('3').join(',')}`,
    ].join('\r\n');
    expect(parse8110('EC', csv)).toEqual([
      { id: '8110:EC:84045', name: 'INGUINCHO', country: 'EC', latitude: 0.2575, longitude: -78.408, elevation: 3140, period: '1981-2010', normals: { sun: Array(12).fill(150) } },
      { id: '8110:EC:84048', name: 'ELSEWHERE', country: 'EC', latitude: -0.1667, longitude: 78, elevation: null, period: '1981-2010', normals: { prcp: Array(12).fill(1), wet: Array(12).fill(3) } },
    ]);
    // Lines ended either way, fields padded; a station before any name has none.
    const bare = ['WMO_Number , Latitude,Longitude,Station_Height', ' 84049 , 0|10|00|S ,78|00|00|E, 12 ', `84049, 1 ,Sum,4,${Array(12).fill(' 2 ').join(',')},24`].join('\n');
    expect(parse8110('EC', bare)).toEqual([{ id: '8110:EC:84049', name: '', country: 'EC', latitude: -0.1667, longitude: 78, elevation: 12, period: '1981-2010', normals: { prcp: Array(12).fill(2) } }]);
  });
  it("makes a month's value from its days by WMO-No. 1203's rules: none where 11 are missing or 5 in a row, a sum none where any is", () => {
    const missing = (at: number[]) => Array.from({ length: 31 }, (_, i) => (at.includes(i) ? null : 1));
    expect(monthValue('tmax', [1, 2, null, 3])).toBe(2);
    expect(monthValue('tmin', missing([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]))).toBe(1);
    expect(monthValue('tmin', missing([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]))).toBeNull();
    expect(monthValue('tmax', missing([0, 1, 2, 3]))).toBe(1);
    expect(monthValue('tmax', missing([0, 1, 2, 3, 4]))).toBeNull();
    expect(monthValue('tmax', missing([26, 27, 28, 29, 30]))).toBeNull();
    // Four in a row, then another four: no run of five.
    expect(monthValue('tmax', missing([0, 1, 2, 3, 5, 6, 7, 8]))).toBe(1);
    expect(monthValue('prcp', [1, 2, 3])).toBe(6);
    expect(monthValue('prcp', [1, null, 3])).toBeNull();
    // A count is the share of the days observed with at least 1 mm.
    expect(monthValue('wet', [0, 1, 0.9, 2, null])).toBe(0.5);
  });
  it("averages NOAA's daily records: each parameter over the longest period whose every month has values of 80% of its years", () => {
    // Each day of a span of years, a line of the record, or none.
    const days = (from: number, to: number, day: (year: number, month: number, date: number) => string | null) => {
      const out: string[] = [];
      for (let t = Date.UTC(from, 0, 1); t <= Date.UTC(to, 11, 31); t += 86_400_000) {
        const d = new Date(t);
        const line = day(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        if (line !== null) out.push(`${d.toISOString().slice(0, 10)};${line}`);
      }
      return out;
    };
    const station = (id: string, name: string, lines: string[]) => ({ id, country: 'PN', name, latitude: -25.067, longitude: -130.1, elevation: 265, days: lines.join('\n') });
    expect(YEARS_GHCND).toEqual([1991, 2020]);
    const full = days(1991, 2020, (year, month, date) => {
      // A day's maximum flagged by the quality check counts as none.
      if (year === 1991 && month === 0 && date === 1) return '10;,,S;9999;,G,S;0;,,S';
      return `${date === 1 ? 9 : 10};D,,S;${(month + 10) * 10};,,S;${month * 10};,,S`;
    });
    // Temperatures only from 2001 to 2015; precipitation in all but six years, the most a period of thirty may lack.
    const part = days(1991, 2020, (year) => `${year >= 1995 && year <= 2000 ? '' : '10'};,,G;${year >= 2001 && year <= 2015 ? '250' : ''};,,G;;`);
    // Precipitation lacking seven years (1995 to 2001): 2002-2020 is the longest period that begins and ends with a year it has.
    const gap = days(1991, 2020, (year) => (year >= 1995 && year <= 2001 ? null : '0;,,S;;;;'));
    const json = JSON.stringify({ stations: [station('PC000919640', 'PITCAIRN ISLAND C, PC', full), station('KUM00040572', 'SOUTH DOLPHIN, KU', part), station('VQC00672551', 'VI E END', gap), station('NONE', 'NONE', days(1991, 2020, () => ';;;;;'))] });
    const out = parseGhcnd(json);
    expect(out.map((s) => [s.id, s.name, Object.keys(s.normals)])).toEqual([
      ['ghcnd:PC000919640:1991-2020', 'PITCAIRN ISLAND C', ['tmax', 'tmin', 'prcp', 'wet']],
      ['ghcnd:KUM00040572:2001-2015', 'SOUTH DOLPHIN', ['tmax']],
      ['ghcnd:KUM00040572:1991-2020', 'SOUTH DOLPHIN', ['prcp', 'wet']],
      ['ghcnd:VQC00672551:2002-2020', 'VI E END', ['prcp', 'wet']],
    ]);
    const [pn, , ku, vi] = out;
    expect(pn).toMatchObject({ country: 'PN', latitude: -25.067, longitude: -130.1, elevation: 265, period: '1991-2020' });
    expect(pn?.normals.tmax).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(pn?.normals.tmin).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    // Each month's sum, February's over its leap years; the first of each month's 0.9 mm isn't a day of 1 mm.
    expect(pn?.normals.prcp).toEqual([30.9, 28.2, 30.9, 29.9, 30.9, 29.9, 30.9, 30.9, 29.9, 30.9, 29.9, 30.9]);
    expect(pn?.normals.wet).toEqual([30, 27.3, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30]);
    expect(out[1]?.normals.tmax).toEqual(Array(12).fill(25));
    expect(ku?.normals.wet).toEqual(MONTH_DAYS.map((d) => Math.round(d * 10) / 10));
    expect(vi?.normals).toEqual({ prcp: Array(12).fill(0), wet: Array(12).fill(0) });
  });
  it("fills what each country lacks in order: the WMO's sets, then 1981-2010, then a national service's, the Deutscher Wetterdienst's, and the World Weather Information Service's", () => {
    const st = (id: string, country: string, normals: SourceStation['normals']): SourceStation => ({ id, name: id, country, latitude: 0, longitude: 0, elevation: null, period: '1981-2010', normals });
    const s9120 = parse9120(files9120({ tmax: [line9120()] }));
    const out = compileStations(s9120, new Map(), [st('8110:FR:1', 'FR', { tmax: [1], sun: [2] }), st('8110:EC:2', 'EC', { sun: [3] })], [st('mf:1', 'FR', { sun: [4], wet: [5] }), st('mf:2', 'EC', { tmin: [6] })], [{ ...st('dwd:3:1991-2020', '', { tmin: [7], prcp: [8] }), member: 'Ecuador' }], [], parseWwis(wwis(city({ id: 7, lat: '45.00004', lon: '5.00006' }))), [st('ghcnd:9:2001-2020', 'EC', { prcp: [9], wet: [10] })], []);
    expect(out.map((s) => [s.id, s.normals])).toEqual([
      ['8110:EC:2', { sun: [3] }],
      ['8110:FR:1', { sun: [2] }],
      ['9120:00012345:0-20000-0-12345', { tmax: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }],
      ['dwd:3:1991-2020', { prcp: [8] }],
      ['ghcnd:9:2001-2020', { wet: [10] }],
      ['mf:1', { wet: [5] }],
      ['mf:2', { tmin: [6] }],
      ['wwis:7', { tmin: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], prcp: Array(12).fill(50) }],
    ]);
    expect(out.find((s) => s.id === 'wwis:7')).toMatchObject({ country: 'FR', latitude: 45, longitude: 5.0001, elevation: null, period: '1991-2020', name: 'Lyon Bron', town: null });
  });
  it('keeps every station with a normal, its country resolved and its coordinates rounded, in order of id', () => {
    const s9120 = parse9120(files9120({ tmax: [line9120()], prcp: [line9120({ id: '00000001', name: 'Empty', months: Array(12).fill('-99.9') })] }));
    const s6190 = parse6190([norm6190(), norm6190({ key: K('6UK03772'), code: '0201' })].join('\n'), [meta6190(), meta6190({ key: K('6UK03772'), lat: '4927N', lon: '00235W' })].join('\n'));
    const stations = compileStations(s9120, s6190, [], [], [], [], new Map(), [], [{ name: 'St Peter Port', country: 'GG', latitude: 49.45, longitude: -2.55 }, { name: 'London', country: 'GB', latitude: 51.5, longitude: -0.1 }, { name: 'Lyon', country: 'FR', latitude: 45.72, longitude: 5 }]);
    expect(compileStations(new Map(), parse6190(norm6190({ key: '6FR07480   12345A' }), meta6190({ key: '6FR07480   12345A' })), [], [], [], [], new Map(), [], [])[0]?.id).toBe('6190:6FR07480:12345A');
    // Each named by the town nearest it in its own country, within 50 km (the 1991-2020 Lyon is 80 km from the town).
    expect(TOWN_KM).toBe(50);
    expect(stations.map((s) => [s.id, s.country, s.period, s.town])).toEqual([
      ['6190:6FR07480', 'FR', '1961-1990', 'Lyon'],
      ['6190:6UK03772', 'GG', '1961-1990', 'St Peter Port'],
      ['9120:00012345:0-20000-0-12345', 'FR', '1991-2020', null],
    ]);
    expect(stations[0]?.latitude).toBe(45.7167);
    expect(stations[0]?.longitude).toBe(5.0167);
    const text = serialize(stations.slice(2));
    expect(text).toBe(`${JSON.stringify({ params: ['tmax', 'tmin', 'prcp', 'wet', 'sun'], stations: [['9120:00012345:0-20000-0-12345', 'Lyon', null, 'FR', 45, 5, 100, '1991-2020', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], null, null, null, null]] })}\n`);
  });
  it('refuses a file that isn\'t the one the register cites', () => {
    const files = [...Object.values(SOURCES_9120), ...Object.values(SOURCES_6190), ...Object.values(SOURCES_8110), SOURCE_MF, SOURCE_CWA, SOURCE_METOFFICE, ...HAND_READ.map((h) => h.source), SOURCE_ANGUILLA, SOURCE_TONGA, SOURCE_DWD, SOURCE_KT, SOURCE_WWIS, SOURCE_GHCND];
    for (const target of files) {
      const root = mkdtempSync(join(tmpdir(), 'slate-wmo-'));
      for (const dir of ['vendor/wmo/9120', 'vendor/wmo/6190', 'vendor/wmo/8110', 'vendor/bws', 'vendor/dhm', 'vendor/rnsm', 'vendor/meteocw', 'research/sources']) mkdirSync(join(root, dir), { recursive: true });
      for (const f of files) copyFileSync(join(ROOT, f.file), join(root, f.file));
      writeFileSync(join(root, target.file), target.file.endsWith('.gz') ? gzipSync('changed') : 'changed');
      expect(() => readStations(root, []), target.file).toThrow(`${target.file} is not the file the register cites (sha256 `);
    }
  });
});
