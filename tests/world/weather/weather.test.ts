import { describe, expect, it } from 'vitest';
import { daysFromCivil, daysInMonth, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { findPlace } from '../../../src/world/gazetteer/gazetteer.ts';
import { isLine, t } from '../../../src/core/text/text.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { hourAngleArg, julianCentury, julianDay, sunDeclination } from '../../../src/core/time/sun.ts';
import {
  BORROWED_LINE,
  BORROWED_PART_LINE,
  PARAMS,
  UNDATED_LINE,
  aboutWeather,
  FORECAST,
  LAPSE_PER_M,
  MODEL,
  MODEL_LINE,
  SNOW_AT,
  after,
  dayFrom,
  dayLengthHours,
  drawsOn,
  forecastOf,
  normal,
  normalsOn,
  distanceKm,
  forecastFrom,
  heightCorrection,
  indexStations,
  loadStations,
  nearestIn,
  onDay,
  readStations,
  sourcesFor,
  stationLoader,
  temperatureAt,
  weatherOn,
  type Param,
  type Source,
  type Station,
} from '../../../src/world/weather/weather.ts';

import compiled from '../../../src/world/weather/stations.json';

const SEED = '0123456789abcdef';
const station = (over: Partial<Station> = {}): Station => ({
  id: 'x',
  name: 'X',
  town: 'Lyon',
  country: 'FR',
  latitude: 45,
  longitude: 5,
  elevation: 100,
  period: '1991-2020',
  normals: { tmax: Array(12).fill(20), tmin: Array(12).fill(10), prcp: Array(12).fill(60), wet: Array(12).fill(10), sun: Array(12).fill(200) },
  ...over,
});
const all = (s: Station): Record<Param, Source> => Object.fromEntries((['tmax', 'tmin', 'prcp', 'wet', 'sun'] as const).map((p) => [p, { station: s, km: 0, borrowed: false }])) as Record<Param, Source>;

describe('the stations', () => {
  it('read from the compiled rows, a missing normal left out', () => {
    expect(readStations({ params: ['tmax', 'tmin', 'prcp', 'wet', 'sun'], stations: [['9120:1:w', 'A', 'Lyon', 'FR', 45, 5, null, '1991-2020', [1], null, [2], null, [3]]] })).toEqual([
      { id: '9120:1:w', name: 'A', town: 'Lyon', country: 'FR', latitude: 45, longitude: 5, elevation: null, period: '1991-2020', normals: { tmax: [1], prcp: [2], sun: [3] } },
    ]);
  });
  it('load once; a load that failed is tried again', async () => {
    let calls = 0;
    const load = stationLoader(() => ((calls += 1) === 1 ? Promise.reject(new Error('offline')) : Promise.resolve([station()])));
    await expect(load()).rejects.toThrow('offline');
    expect(await load()).toHaveLength(1);
    expect(load()).toBe(load());
    expect(calls).toBe(2);
    const real = await loadStations();
    expect(real.length).toBe(compiled.stations.length);
    expect(real.length).toBeGreaterThan(11_000);
    expect(loadStations()).toBe(loadStations());
  });
});

describe('the nearest station', () => {
  it('measures great circles on the mean Earth radius', () => {
    expect(distanceKm(51.5074, -0.1278, 48.8566, 2.3522)).toBeCloseTo(343.56, 1);
    expect(distanceKm(0, 0, 0, 180)).toBeCloseTo(Math.PI * 6371.0088, 6);
    expect(distanceKm(10, 10, 10, 10)).toBe(0);
  });
  it('found by its latitude matches the nearest of all, for towns anywhere', async () => {
    const stations = await loadStations();
    const pool = stations.filter((s) => s.normals.prcp !== undefined).sort((a, b) => a.latitude - b.latitude);
    for (let i = 0; i < 400; i += 1) {
      const lat = -89 + ((i * 37) % 178) + (i % 7) / 10;
      const lon = -179 + ((i * 101) % 358);
      const brute = Math.min(...pool.map((s) => distanceKm(lat, lon, s.latitude, s.longitude)));
      expect(nearestIn(pool, lat, lon).km, `${lat},${lon}`).toBe(brute);
    }
    expect(nearestIn([station({ latitude: 10 })], 50, 5).station.latitude).toBe(10);
    expect(nearestIn([station({ latitude: 60 })], 50, 5).station.latitude).toBe(60);
  });
  it('stops searching once a station is further in latitude alone than the nearest found', () => {
    // A thousand stations a tenth of a degree apart on one meridian: the nearest to a town among them is found by
    // looking at a few around its latitude, not all of them (the rule over every place of the map stands on it).
    const stations = Array.from({ length: 1000 }, (_, i) => station({ id: String(i), latitude: -50 + i / 10, longitude: 0 }));
    let read = 0;
    const pool = new Proxy(stations, { get: (target, key, receiver) => (typeof key === 'string' && /^\d+$/.test(key) && (read += 1), Reflect.get(target, key, receiver)) });
    expect(nearestIn(pool, 0.04, 0).station.id).toBe('500');
    expect(read).toBeLessThan(20);
  });
  it('comes from the town\'s own country, 1991-2020 first, then 1961-1990, else borrowed from abroad', () => {
    const recent = station({ id: 'recent', country: 'FR', latitude: 40, period: '1991-2020', normals: { tmax: [1] } });
    const older = station({ id: 'older', country: 'FR', latitude: 45.1, period: '1961-1990', normals: { tmax: [1], tmin: [1] } });
    const abroad = station({ id: 'abroad', country: 'IT', latitude: 45, normals: { tmax: [1], tmin: [1], prcp: [1], wet: [1], sun: [1] } });
    const index = indexStations([recent, older, abroad]);
    const s = sourcesFor({ country: 'FR', latitude: 45, longitude: 5 }, index);
    expect([s.tmax.station.id, s.tmin.station.id, s.prcp.station.id, s.prcp.borrowed, s.tmax.borrowed]).toEqual(['recent', 'older', 'abroad', true, false]);
    expect(s.tmax.km).toBeCloseTo(distanceKm(45, 5, 40, 5), 9);
    // The pools are kept: asking again reads the same.
    const pool = index.pools.get('FR|tmin');
    expect(sourcesFor({ country: 'FR', latitude: 45, longitude: 5 }, index).tmin.station.id).toBe('older');
    expect(index.pools.size).toBe(5);
    expect(index.pools.get('FR|tmin')).toBe(pool);
  });
});

describe('a normal on a day', () => {
  const months = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  it('is the month\'s at its middle, and between two months by how near each is', () => {
    expect(onDay(months, 2026, 1, 16)).toBe(0);
    expect(onDay(months, 2026, 4, 15.5)).toBe(90);
    expect(onDay(months, 2026, 2, 14.5)).toBe(31);
    // Halfway from mid-January to mid-February.
    // January 31st is 15 days past January's middle (the 16th), of the 30.5 to February's (the 14.5th of 28).
    expect(onDay(months, 2026, 1, 31)).toBeCloseTo(31 * (30.5 / 31 - 0.5), 9);
    expect(onDay([0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 2026, 2, 1)).toBeCloseTo(10 * (1 + 0.5 / 28 - 0.5), 9);
  });
  it('wraps from December to January', () => {
    const wrap = [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(onDay(wrap, 2026, 12, 16)).toBe(0);
    expect(onDay(wrap, 2027, 1, 16)).toBe(100);
    expect(onDay(wrap, 2026, 12, 31)).toBeCloseTo(100 * (15 / 31), 6);
    expect(onDay(wrap, 2027, 1, 1)).toBeCloseTo(100 * (1 - 15 / 31), 6);
  });
});

describe('heights and daylight', () => {
  it('carries a temperature from the station\'s height to the town\'s at 6.5 °C a kilometre, where both are known', () => {
    expect(LAPSE_PER_M).toBe(0.0065);
    expect(heightCorrection(station({ elevation: 1000 }), { elevation: 0 })).toBeCloseTo(6.5, 9);
    expect(heightCorrection(station({ elevation: 0 }), { elevation: 2000 })).toBeCloseTo(-13, 9);
    expect(heightCorrection(station({ elevation: null }), { elevation: 500 })).toBe(0);
    expect(heightCorrection(station({ elevation: 50 }), { elevation: null })).toBe(0);
  });
  it('counts the hours the sun is up', () => {
    const june = daysFromCivil(2026, 6, 21) * SECONDS_PER_DAY;
    expect(dayLengthHours(0, june)).toBeGreaterThan(12);
    expect(dayLengthHours(0, june)).toBeLessThan(12.2);
    expect(dayLengthHours(51.5, june)).toBeCloseTo(16.6, 0);
    expect(dayLengthHours(78, june)).toBe(24);
    expect(dayLengthHours(-78, june)).toBe(0);
  });
});

describe('a day\'s weather', () => {
  it('is the same for the same seed, station and day, and differs otherwise', () => {
    const s = all(station());
    const day = { year: 2026, month: 8, day: 24 };
    expect(weatherOn(SEED, { latitude: 45, elevation: 100 }, s, day)).toEqual(weatherOn(SEED, { latitude: 45, elevation: 100 }, s, day));
    const days = Array.from({ length: 20 }, (_, i) => weatherOn(SEED, { latitude: 45, elevation: 100 }, s, after(day, i)));
    expect(new Set(days.map((d) => d.high)).size).toBeGreaterThan(10);
    expect(weatherOn('fedcba9876543210', { latitude: 45, elevation: 100 }, s, day)).not.toEqual(weatherOn(SEED, { latitude: 45, elevation: 100 }, s, day));
  });
  it('comes back, over thirty years, to the normals it\'s drawn around', () => {
    const tmax = [5, 7, 11, 15, 19, 23, 26, 25, 21, 16, 10, 6];
    const tmin = [-2, -1, 2, 5, 9, 13, 15, 15, 11, 7, 3, 0];
    const prcp = [80, 60, 70, 65, 75, 60, 50, 55, 70, 90, 95, 85];
    const wet = [12, 10, 11, 10, 11, 8, 7, 7, 9, 12, 13, 12];
    const sun = [70, 95, 140, 180, 210, 240, 260, 240, 180, 120, 75, 60];
    const s = all(station({ normals: { tmax, tmin, prcp, wet, sun } }));
    for (const month of [1, 4, 7, 10]) {
      let high = 0;
      let low = 0;
      let wetDays = 0;
      let rain = 0;
      let n = 0;
      for (let year = 1991; year <= 2020; year += 1) {
        for (let day = 1; day <= daysInMonth(year, month); day += 1) {
          const w = weatherOn(SEED, { latitude: 45, elevation: 100 }, s, { year, month, day });
          high += w.high;
          low += w.low;
          rain += w.precipitation;
          if (w.precipitation > 0 || w.condition === 'rain' || w.condition === 'snow') wetDays += 1;
          n += 1;
          expect(w.high - w.low).toBeGreaterThanOrEqual(0.5 - 1e-9);
        }
      }
      // The month's normal is its middle's; the month's days run either side, so the mean sits near it, not on it.
      const mid = (m: number[]) => (m[month - 1] as number) * 0.75 + ((m[(month + 10) % 12] as number) + (m[month % 12] as number)) * 0.125;
      expect(Math.abs(high / n - mid(tmax)), `high ${month}`).toBeLessThan(0.35);
      expect(Math.abs(low / n - mid(tmin)), `low ${month}`).toBeLessThan(0.35);
      expect(Math.abs(wetDays / 30 - mid(wet)) / mid(wet), `wet ${month}`).toBeLessThan(0.08);
      expect(Math.abs(rain / 30 - mid(prcp)) / mid(prcp), `rain ${month}`).toBeLessThan(0.12);
    }
  });
  it('snows only at or below the rain-snow threshold, and clears or clouds over by the sunshine normal', () => {
    expect(SNOW_AT).toBe(1);
    const cold = all(station({ normals: { tmax: Array(12).fill(-5), tmin: Array(12).fill(-12), prcp: Array(12).fill(40), wet: Array(12).fill(15), sun: Array(12).fill(100) } }));
    const warm = all(station({ normals: { tmax: Array(12).fill(25), tmin: Array(12).fill(15), prcp: Array(12).fill(40), wet: Array(12).fill(15), sun: Array(12).fill(100) } }));
    const kinds = (s: Record<Param, Source>) => new Set(Array.from({ length: 200 }, (_, i) => weatherOn(SEED, { latitude: 45, elevation: 100 }, s, after({ year: 2026, month: 1, day: 1 }, i)).condition));
    expect(kinds(cold).has('snow')).toBe(true);
    expect(kinds(cold).has('rain')).toBe(false);
    expect(kinds(warm).has('snow')).toBe(false);
    const sunny = all(station({ normals: { tmax: Array(12).fill(25), tmin: Array(12).fill(15), prcp: Array(12).fill(0), wet: Array(12).fill(0), sun: Array(12).fill(400) } }));
    const grey = all(station({ normals: { tmax: Array(12).fill(10), tmin: Array(12).fill(5), prcp: Array(12).fill(0), wet: Array(12).fill(0), sun: Array(12).fill(0) } }));
    const count = (s: Record<Param, Source>, c: string) => Array.from({ length: 365 }, (_, i) => weatherOn(SEED, { latitude: 30, elevation: 100 }, s, after({ year: 2026, month: 1, day: 1 }, i)).condition).filter((x) => x === c).length;
    // Cloudiness spreads about its mean (0 under a full sunshine normal, 1 under none), so most days, not all, follow it.
    expect(count(sunny, 'clear')).toBeGreaterThan(250);
    expect(count(grey, 'overcast')).toBeGreaterThan(280);
    expect(count(sunny, 'rain') + count(grey, 'rain')).toBe(0);
    // A month always wet stays wet; and the arctic winter's no-sunshine month is overcast.
    const always = all(station({ normals: { tmax: Array(12).fill(20), tmin: Array(12).fill(10), prcp: Array(12).fill(300), wet: Array(12).fill(31), sun: Array(12).fill(0) } }));
    expect(weatherOn(SEED, { latitude: 0, elevation: 0 }, always, { year: 2026, month: 1, day: 5 }).condition).toBe('rain');
    expect(weatherOn(SEED, { latitude: 80, elevation: 0 }, grey, { year: 2026, month: 12, day: 21 }).condition).toBe('overcast');
  });
  it('swings more where the normal daily range is wider, within its bounds', () => {
    expect(MODEL).toMatchObject({ spread: 0.3, spreadLeast: 1, spreadMost: 4 });
    const sd = (tmax: number, tmin: number) => {
      const s = all(station({ normals: { tmax: Array(12).fill(tmax), tmin: Array(12).fill(tmin), prcp: Array(12).fill(0), wet: Array(12).fill(0), sun: Array(12).fill(200) } }));
      const highs = Array.from({ length: 2000 }, (_, i) => weatherOn(SEED, { latitude: 45, elevation: 100 }, s, after({ year: 2000, month: 1, day: 1 }, i)).high - tmax);
      return Math.sqrt(highs.reduce((a, h) => a + h * h, 0) / highs.length);
    };
    expect(sd(30, 28)).toBeCloseTo(1, 0);
    expect(sd(30, 20)).toBeCloseTo(3, 0);
    expect(sd(30, 0)).toBeCloseTo(4, 0);
  });
});

describe('the forecast', () => {
  it('gives the next five days, off by an error that grows with the days ahead', () => {
    expect(FORECAST).toEqual({ error: 0.6, growth: 0.4, miss: 0.06 });
    const s = all(station());
    const errors = [0, 0, 0, 0, 0];
    let rainWrong = 0;
    for (let i = 0; i < 400; i += 1) {
      const today = after({ year: 2026, month: 1, day: 1 }, i);
      const f = forecastFrom(SEED, { latitude: 45, elevation: 100 }, s, today);
      expect(f).toHaveLength(5);
      f.forEach((d, k) => {
        const actual = weatherOn(SEED, { latitude: 45, elevation: 100 }, s, after(today, k + 1));
        errors[k] = (errors[k] as number) + Math.abs(d.high - actual.high);
        if ((d.condition === 'rain') !== (actual.condition === 'rain')) rainWrong += 1;
        expect(d.high - d.low).toBeGreaterThanOrEqual(0.5 - 1e-9);
      });
    }
    expect((errors[4] as number) > (errors[0] as number) * 3).toBe(true);
    expect(rainWrong).toBeGreaterThan(0);
    expect(rainWrong).toBeLessThan(400 * 5 * 0.2);
  });
  it("draws each day's error and miss from its own decider, by the day it's issued and the days ahead", () => {
    const s = all(station());
    const today = { year: 2026, month: 6, day: 1 };
    const issued = daysFromCivil(2026, 6, 1);
    const f = forecastFrom(SEED, { latitude: 45, elevation: 100 }, s, today);
    f.forEach((day, k) => {
      const d = draws(seedFromText(SEED), 'weather.forecast', 'x', issued, k + 1);
      expect(day).toEqual(forecastOf(weatherOn(SEED, { latitude: 45, elevation: 100 }, s, after(today, k + 1)), k + 1, normal(d.float(), d.float()), d.float()));
    });
  });
});

describe('the temperature through the day', () => {
  const today = { low: 10, high: 20, sunrise: 6 * 3600, noon: 12 * 3600 };
  it('is the low at sunrise, the high three hours past noon, and falls to the next low at the next sunrise', () => {
    expect(temperatureAt(6 * 3600, today, 12, { high: 18, peak: 15 * 3600 })).toBe(10);
    expect(temperatureAt(15 * 3600, today, 12, { high: 18, peak: 15 * 3600 })).toBe(20);
    expect(temperatureAt(10.5 * 3600, today, 12, { high: 18, peak: 15 * 3600 })).toBeCloseTo(10 + 10 * Math.sin(Math.PI / 4), 9);
    expect(temperatureAt(24 * 3600 - 1, today, 12, { high: 18, peak: 15 * 3600 })).toBeGreaterThan(12);
    // Before sunrise it's still last night, falling from yesterday's high.
    expect(temperatureAt(0, today, 12, { high: 18, peak: 15 * 3600 })).toBeCloseTo(18 - 8 * Math.sin((Math.PI / 2) * (9 / 15)), 9);
    expect(temperatureAt(6 * 3600 - 1, today, 12, { high: 18, peak: 15 * 3600 })).toBeCloseTo(10, 2);
    // The high follows the sun's highest: half an hour later, so is the high.
    expect(temperatureAt(15.5 * 3600, { ...today, noon: 12.5 * 3600 }, 12, { high: 18, peak: 15 * 3600 })).toBe(20);
  });
  it('rises and falls on its curve between them', () => {
    const y = { high: 18, peak: 15 * 3600 };
    expect(temperatureAt(9 * 3600, today, 12, y)).toBeCloseTo(10 + 10 * Math.sin((Math.PI / 2) * (3 / 9)), 9);
    expect(temperatureAt(20 * 3600, today, 12, y)).toBeCloseTo(20 - 8 * Math.sin((Math.PI / 2) * (5 / 15)), 9);
    expect(temperatureAt(3 * 3600, today, 12, y)).toBeCloseTo(18 - 8 * Math.sin((Math.PI / 2) * (12 / 15)), 9);
  });
  it('without a sunrise, has its low at six and its high at three', () => {
    const polar = { low: -20, high: -15, noon: 12 * 3600 };
    expect(temperatureAt(6 * 3600, polar, -21, { high: -14, peak: 15 * 3600 })).toBe(-20);
    expect(temperatureAt(15 * 3600, polar, -21, { high: -14, peak: 15 * 3600 })).toBe(-15);
    // Whatever its noon.
    expect(temperatureAt(15 * 3600, { ...polar, noon: 12.5 * 3600 }, -21, { high: -14, peak: 15 * 3600 })).toBe(-15);
  });
});

describe('the weather at real towns', () => {
  it('reads each town\'s nearest station of its own country, and says where it has none', async () => {
    const index = indexStations(await loadStations());
    const ny = sourcesFor((await findPlace('US', '5128581')) as never, index);
    expect([ny.tmax.station.name, ny.tmax.station.period, ny.tmax.borrowed]).toEqual(['NEW_YORK_CNTRL_PK_TWR', '1991-2020', false]);
    // Monaco publishes all but its sunshine (Météo-France's station there), the Vatican none.
    const mc = (await findPlace('MC', '2993458')) as never;
    const monaco = sourcesFor(mc, index);
    expect([monaco.tmax.station.name, monaco.tmax.station.country, monaco.tmax.borrowed, monaco.sun.station.country, monaco.sun.borrowed]).toEqual(['MONACO', 'MC', false, 'FR', true]);
    expect(aboutWeather(mc, monaco)).toBe(t(BORROWED_PART_LINE, { country: 'Monaco', place: monaco.sun.station.town as string, placeCountry: 'France' }));
    const va = (await findPlace('VA', '6691831')) as never;
    const vatican = sourcesFor(va, index);
    expect(PARAMS.every((p) => vatican[p].borrowed && vatican[p].station.country === 'IT')).toBe(true);
    expect(aboutWeather(va, vatican)).toBe(t(BORROWED_LINE, { country: 'Vatican', place: vatican.wet.station.town ?? vatican.wet.station.name, placeCountry: 'Italy' }));
  });
});

describe('the steps of a day', () => {
  it('name the lines that tell the player where the weather comes from', () => {
    const lines = [MODEL_LINE, UNDATED_LINE, BORROWED_LINE, BORROWED_PART_LINE];
    expect(lines).toEqual(['weather.model', 'weather.model-undated', 'weather.borrowed', 'weather.borrowed-part']);
    expect(lines.every(isLine)).toBe(true);
  });
  it("tells where the weather comes from: the station abroad of the first normal borrowed, else the high's and its years", () => {
    const home = station({ town: 'Lyon', period: '1991-2020' });
    const abroad = station({ id: 'y', name: 'GENEVE-COINTRIN', town: null, country: 'CH' });
    const from = (over: Partial<Record<Param, Station>>) => Object.fromEntries(PARAMS.map((p) => [p, { station: over[p] ?? home, km: 0, borrowed: (over[p] ?? home).country !== 'FR' }])) as Record<Param, Source>;
    expect(aboutWeather({ country: 'FR' }, from({}))).toBe(t(MODEL_LINE, { place: 'Lyon', years: '1991 to 2020' }));
    expect(aboutWeather({ country: 'FR' }, from({ tmax: station({ town: null, name: 'BRON', period: null }) }))).toBe(t(UNDATED_LINE, { place: 'BRON' }));
    expect(aboutWeather({ country: 'FR' }, from({ wet: abroad, sun: station({ id: 'z', town: 'Turin', country: 'IT' }) }))).toBe(t(BORROWED_PART_LINE, { country: 'France', place: 'GENEVE-COINTRIN', placeCountry: 'Switzerland' }));
    expect(aboutWeather({ country: 'FR' }, from(Object.fromEntries(PARAMS.map((p) => [p, { ...abroad, town: 'Geneva' }]))))).toBe(t(BORROWED_LINE, { country: 'France', place: 'Geneva', placeCountry: 'Switzerland' }));
  });
  it("a normal day: the month's normals on the day, carried to the town's height, and its chances", () => {
    const s = all(station({ elevation: 300, normals: { tmax: Array(12).fill(20), tmin: Array(12).fill(10), prcp: Array(12).fill(60), wet: Array(12).fill(10), sun: Array(12).fill(150) } }));
    const n = normalsOn({ latitude: 45, elevation: 100 }, s, { year: 2026, month: 4, day: 15 });
    const possible = dayLengthHours(45, daysFromCivil(2026, 4, 15) * SECONDS_PER_DAY) * 30;
    expect(n).toEqual({ high: 20 + 1.3, low: 10 + 1.3, wetChance: 10 / 30, perWetDay: 6, dryShare: (150 / possible) / (1 - 10 / 30) });
    // A month with no wet days falls nothing; one always wet lets every dry day's sun through; sunshine past the
    // possible is all of it; a polar night has none.
    const dry = all(station({ normals: { ...station().normals, wet: Array(12).fill(0), sun: Array(12).fill(10_000) } }));
    expect(normalsOn({ latitude: 45, elevation: 100 }, dry, { year: 2026, month: 4, day: 15 })).toMatchObject({ wetChance: 0, perWetDay: 0, dryShare: 1 });
    const soaked = all(station({ normals: { ...station().normals, wet: Array(12).fill(35) } }));
    expect(normalsOn({ latitude: 45, elevation: 100 }, soaked, { year: 2026, month: 4, day: 15 })).toMatchObject({ wetChance: 1, dryShare: 1 });
    const sunless = all(station({ normals: { ...station().normals, wet: Array(12).fill(35), sun: Array(12).fill(0) } }));
    expect(normalsOn({ latitude: 45, elevation: 100 }, sunless, { year: 2026, month: 4, day: 15 }).dryShare).toBe(1);
    expect(normalsOn({ latitude: 85, elevation: 100 }, s, { year: 2026, month: 12, day: 21 }).dryShare).toBe(0);
  });
  it("the draws: keyed by each normal's station and the day, the days before's departures the same draws as theirs", () => {
    const a = station({ id: 'a' });
    const b = station({ id: 'b' });
    const src = { ...all(a), sun: { station: b, km: 0, borrowed: false } };
    const d = drawsOn(SEED, src, 20_000);
    expect(drawsOn(SEED, src, 20_000)).toEqual(d);
    expect(drawsOn(SEED, src, 19_999).z[0]).toBe(d.z[1]);
    expect(drawsOn(SEED, src, 19_998).z[0]).toBe(d.z[2]);
    expect(drawsOn(SEED, { ...src, wet: { station: b, km: 0, borrowed: false } }, 20_000).wet).not.toBe(d.wet);
    expect(drawsOn(SEED, { ...src, tmax: { station: b, km: 0, borrowed: false } }, 20_000).z).not.toEqual(d.z);
    expect(drawsOn(SEED, { ...src, sun: { station: a, km: 0, borrowed: false } }, 20_000).cloud).not.toBe(d.cloud);
    expect(d.wet).not.toBe(d.amount);
    // Each draw comes from its own decider.
    const rain = draws(seedFromText(SEED), 'weather.rain', 'a', 20_000);
    const temperature = draws(seedFromText(SEED), 'weather.temperature', 'a', 20_000);
    const cloud = draws(seedFromText(SEED), 'weather.cloud', 'b', 20_000);
    expect([d.wet, d.amount, d.z[0], d.cloud]).toEqual([rain.float(), rain.float(), normal(temperature.float(), temperature.float()), normal(cloud.float(), cloud.float())]);
    expect([normal(0, 0) === 0, normal(1 - Math.exp(-0.5), 0), normal(1 - Math.exp(-0.5), 0.5)]).toEqual([true, 1, -1]);
    expect(normal(1 - Math.exp(-2), 0.25)).toBeCloseTo(0, 12);
  });
  it("a dry day: its normals with the day's departure and a dry day's lift, under the sky its sunshine implies", () => {
    const n = { high: 20, low: 10, wetChance: 0.25, perWetDay: 8, dryShare: 0.5 };
    const spread = 0.3 * 10;
    const dep = (z: [number, number, number]) => (spread * (0.6 * z[0] + 0.3 * z[1] + 0.1 * z[2])) / Math.hypot(0.6, 0.3, 0.1);
    const z: [number, number, number] = [1, -0.5, 0.25];
    const round = (x: number) => Math.round(x * 10) / 10;
    expect(dayFrom(n, { wet: 0.25, amount: 0.5, z, cloud: 0 })).toEqual({ high: round(20 + dep(z) + 2 * 0.25), low: round(10 + dep(z) - 0.25), precipitation: 0, condition: 'partly-cloudy' });
    expect(dayFrom(n, { wet: 0.9, amount: 0.5, z: [0, 0, 0], cloud: -1 }).condition).toBe('clear');
    expect(dayFrom(n, { wet: 0.9, amount: 0.5, z: [0, 0, 0], cloud: (0.25 - 0.5) / 0.35 }).condition).toBe('partly-cloudy');
    expect(dayFrom(n, { wet: 0.9, amount: 0.5, z: [0, 0, 0], cloud: (0.65 - 0.5) / 0.35 - 1e-9 }).condition).toBe('partly-cloudy');
    expect(dayFrom(n, { wet: 0.9, amount: 0.5, z: [0, 0, 0], cloud: (0.65 - 0.5) / 0.35 + 1e-9 }).condition).toBe('overcast');
    expect(dayFrom(n, { wet: 0.9, amount: 0.5, z: [0, 0, 0], cloud: (0.25 - 0.5) / 0.35 - 1e-9 }).condition).toBe('clear');
  });
  it('a wet day: an exponential fall about the mean, cooler by day and milder by night, snow at or below 1 °C', () => {
    const n = { high: 20, low: 10, wetChance: 0.25, perWetDay: 8, dryShare: 0.5 };
    const round = (x: number) => Math.round(x * 10) / 10;
    expect(dayFrom(n, { wet: 0.1, amount: 1 - Math.exp(-1), z: [0, 0, 0], cloud: 5 })).toEqual({ high: round(20 - 2 * 0.75), low: round(10 + 0.75), precipitation: 8, condition: 'rain' });
    expect(dayFrom(n, { wet: 0.1, amount: 0, z: [0, 0, 0], cloud: 0 }).precipitation).toBe(0);
    // A wet day's high is 1.5 under its normal here and its low 0.75 over: a mean of exactly 1.0 snows, 1.1 rains.
    const freezing = { ...n, high: 3, low: -0.25 };
    expect(dayFrom(freezing, { wet: 0.1, amount: 0.5, z: [0, 0, 0], cloud: 0 })).toMatchObject({ high: 1.5, low: 0.5, condition: 'snow' });
    expect(dayFrom({ ...freezing, high: 3.2 }, { wet: 0.1, amount: 0.5, z: [0, 0, 0], cloud: 0 })).toMatchObject({ high: 1.7, low: 0.5, condition: 'rain' });
    // The low never comes within half a degree of the high.
    expect(dayFrom({ ...n, high: 10, low: 12, wetChance: 0 }, { wet: 0.9, amount: 0, z: [0, 0, 0], cloud: 0 })).toMatchObject({ high: 10, low: 9.5 });
  });
  it('the swing: three tenths of the day\'s normal range, at least 1 and at most 4 °C', () => {
    const at = (high: number, low: number) => dayFrom({ high, low, wetChance: 0, perWetDay: 0, dryShare: 1 }, { wet: 0.5, amount: 0, z: [1, 0, 0], cloud: 0 }).high - high;
    const unit = 0.6 / Math.hypot(0.6, 0.3, 0.1);
    expect(at(20, 10)).toBeCloseTo(Math.round(3 * unit * 10) / 10, 9);
    expect(at(20, 19)).toBeCloseTo(Math.round(1 * unit * 10) / 10, 9);
    expect(at(40, 0)).toBeCloseTo(Math.round(4 * unit * 10) / 10, 9);
  });
  it('a forecast: off by an error that grows by the day, and on a miss wrong about the rain', () => {
    const dry = { high: 20, low: 10, precipitation: 0, condition: 'clear' as const };
    const wet = { high: 20, low: 10, precipitation: 5, condition: 'rain' as const };
    expect(forecastOf(dry, 1, 1, 0.5)).toEqual({ high: 20.6, low: 10.6, precipitation: 0, condition: 'clear' });
    expect(forecastOf(dry, 3, -1, 0.5)).toEqual({ high: 18.6, low: 8.6, precipitation: 0, condition: 'clear' });
    expect(forecastOf(dry, 2, 0, 0.11)).toEqual({ high: 20, low: 10, precipitation: 0, condition: 'rain' });
    expect(forecastOf(dry, 2, 0, 0.12)).toEqual({ high: 20, low: 10, precipitation: 0, condition: 'clear' });
    expect(forecastOf({ ...dry, high: 1, low: 0 }, 1, 0, 0)).toMatchObject({ condition: 'snow' });
    // A miss on a dry day snows where the day's mean is at or below 1 °C, its mean and not its range.
    expect(forecastOf({ ...dry, high: 3, low: -1 }, 1, 0, 0)).toMatchObject({ condition: 'snow' });
    expect(forecastOf({ ...dry, high: 3.2, low: -1 }, 1, 0, 0)).toMatchObject({ condition: 'rain' });
    expect(forecastOf(wet, 1, 0, 0.01)).toEqual({ high: 20, low: 10, precipitation: 0, condition: 'overcast' });
    expect(forecastOf(wet, 1, 0, 0.5)).toEqual(wet);
    expect(forecastOf({ high: 20, low: 19.9, precipitation: 0, condition: 'clear' }, 1, 0, 0.5)).toMatchObject({ high: 20, low: 19.5 });
  });
  it('the days after and before a date, across a year', () => {
    expect(after({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(after({ year: 2027, month: 1, day: 1 }, -1)).toEqual({ year: 2026, month: 12, day: 31 });
  });
  it("the day length at the day's middle", () => {
    const start = daysFromCivil(2026, 3, 21) * SECONDS_PER_DAY;
    const arg = hourAngleArg(65, sunDeclination(julianCentury(julianDay(start + 43_200))));
    expect(dayLengthHours(65, start)).toBe((2 * ((Math.acos(arg) * 180) / Math.PI)) / 15);
  });
});
