import { draws, seedFromText } from '../../core/rng/rng.ts';
import { t, type LineId } from '../../core/text/text.ts';
import { civilFromDays, daysFromCivil, daysInMonth, SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { countryName, type CountryCode } from '../gazetteer/gazetteer.ts';
import { hourAngleArg, julianCentury, julianDay, sunDeclination } from '../../core/time/sun.ts';

/**
 * The weather (BUILD-ORDER layer 2, KEEP entries 18 and 19): each town's climate read from the WMO's climatological
 * normals of a station (register R-0037, R-0038), and the day's weather drawn around them, a pure function of the
 * life's seed, the station and the day, so it's the same however the day is reached.
 *
 * Each of a station's normals (the mean daily maximum and minimum temperature, the precipitation, the days with at
 * least 1 mm, the hours of sunshine) comes from the nearest station that has it: one of the town's own country's of
 * 1991-2020 if there is one, else of 1961-1990, else (where the country has none of its own) the nearest anywhere,
 * which the player is told. Temperatures are carried to the town's height at the standard atmosphere's 6.5 °C a
 * kilometre (R-0039). How a day departs from its normals is the game's own model (R-0041), said so where it's shown;
 * precipitation falls as snow at or below 1.0 °C (R-0040).
 */
export type Param = 'tmax' | 'tmin' | 'prcp' | 'wet' | 'sun';
export const PARAMS: readonly Param[] = ['tmax', 'tmin', 'prcp', 'wet', 'sun'];

export interface Station {
  id: string;
  name: string;
  /** The town nearest it in its country, by which the player is told of it; null where none is near. */
  town: string | null;
  country: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  period: string | null;
  normals: Partial<Record<Param, readonly number[]>>;
}

type Row = [string, string, string | null, string, number, number, number | null, string | null, ...(number[] | null)[]];

/** The compiled stations (tools/wmo/), read into records. */
export function readStations(data: { params: readonly string[]; stations: readonly unknown[] }): Station[] {
  return (data.stations as Row[]).map(([id, name, town, country, latitude, longitude, elevation, period, ...values]) => ({
    id,
    name,
    town,
    country,
    latitude,
    longitude,
    elevation,
    period,
    normals: Object.fromEntries(PARAMS.flatMap((p, i) => (values[i] === null ? [] : [[p, values[i]]]))),
  }));
}

/** A loader that fetches the stations once and shares them; a fetch that failed is tried again the next time. */
export function stationLoader(load: () => Promise<Station[]>): () => Promise<Station[]> {
  let pending: Promise<Station[]> | undefined;
  return () => {
    if (pending === undefined) {
      pending = load();
      pending.catch(() => {
        pending = undefined;
      });
    }
    return pending;
  };
}

export const loadStations = stationLoader(async () => readStations((await import('./stations.json')).default as { params: string[]; stations: unknown[] }));

const RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** The great-circle distance, in kilometres, on the mean Earth radius. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Source {
  station: Station;
  km: number;
  /** True when the station is in another country, the town's own having none with this normal. */
  borrowed: boolean;
}

/** The stations, pooled for the nearest search: by country and normal, each pool in order of latitude. */
export interface StationIndex {
  stations: readonly Station[];
  pools: Map<string, Station[]>;
}

export const indexStations = (stations: readonly Station[]): StationIndex => ({ stations, pools: new Map() });

/** The pool a town's normal is read from: its country's of 1991-2020, else its country's of any period, else any. */
function poolFor(index: StationIndex, country: string, p: Param): Station[] {
  const key = `${country}|${p}`;
  let pool = index.pools.get(key);
  if (pool === undefined) {
    const having = index.stations.filter((s) => s.normals[p] !== undefined);
    const own = having.filter((s) => s.country === country);
    const recent = own.filter((s) => s.period === '1991-2020');
    pool = (recent.length > 0 ? recent : own.length > 0 ? own : having).sort((a, b) => a.latitude - b.latitude);
    index.pools.set(key, pool);
  }
  return pool;
}

/** The nearest station of a pool in order of latitude, searched outward from the town's latitude. */
export function nearestIn(pool: readonly Station[], latitude: number, longitude: number): { station: Station; km: number } {
  let lo = 0;
  let hi = pool.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    // Stryker disable next-line EqualityOperator: a station at exactly the latitude is looked at from either side.
    if ((pool[mid] as Station).latitude < latitude) lo = mid + 1;
    else hi = mid;
  }
  let best = { station: pool[Math.min(lo, pool.length - 1)] as Station, km: Infinity };
  // A degree of latitude in kilometres: no two points further apart in latitude are nearer than this.
  const perDegree = (Math.PI / 180) * RADIUS_KM;
  const consider = (i: number) => {
    const s = pool[i] as Station;
    const km = distanceKm(latitude, longitude, s.latitude, s.longitude);
    // Stryker disable next-line EqualityOperator: two stations exactly as near are either of them.
    if (km < best.km) best = { station: s, km };
    // Stryker disable next-line EqualityOperator: a station exactly as far in latitude alone as the best can't be nearer.
    return Math.abs(s.latitude - latitude) * perDegree <= best.km;
  };
  for (let i = lo; i < pool.length && consider(i); i += 1);
  for (let i = lo - 1; i >= 0 && consider(i); i -= 1);
  return best;
}

/** Where each of a town's normals is read from. */
export function sourcesFor(place: { country: string; latitude: number; longitude: number }, index: StationIndex): Record<Param, Source> {
  return Object.fromEntries(
    PARAMS.map((p) => {
      const { station, km } = nearestIn(poolFor(index, place.country, p), place.latitude, place.longitude);
      return [p, { station, km, borrowed: station.country !== place.country }];
    }),
  ) as Record<Param, Source>;
}

/** The standard atmosphere's fall of temperature with height, in °C a metre (R-0039). */
export const LAPSE_PER_M = 6.5 / 1000;

/** The temperature correction from a station's height to a town's, where both are known. */
export function heightCorrection(station: Station, place: { elevation: number | null }): number {
  return station.elevation === null || place.elevation === null ? 0 : (station.elevation - place.elevation) * LAPSE_PER_M;
}

/**
 * A normal on a given day: each month's value stands at its middle, and a day between two middles takes the share of
 * each it's nearer to (December's and January's meeting across the new year).
 */
export function onDay(months: readonly number[], year: number, month: number, day: number): number {
  // Where the day falls, in months from the middle of January.
  const x = month - 1 + (day - 0.5) / daysInMonth(year, month) - 0.5;
  const i = Math.floor(x);
  const a = months[(i + 12) % 12] as number;
  const b = months[(i + 13) % 12] as number;
  return a + (b - a) * (x - i);
}

/** The hours the sun is up on a day at a latitude (NOAA's formulas, R-0004): 24 in a polar day, 0 in a polar night. */
export function dayLengthHours(latitude: number, dayStart: number): number {
  const arg = hourAngleArg(latitude, sunDeclination(julianCentury(julianDay(dayStart + SECONDS_PER_DAY / 2))));
  // Stryker disable next-line EqualityOperator: at exactly ±1 the formula below gives 24 and 0 hours just the same.
  if (arg <= -1) return 24;
  // Stryker disable next-line EqualityOperator: as above.
  if (arg >= 1) return 0;
  return (2 * ((Math.acos(arg) * 180) / Math.PI)) / 15;
}

export type Condition = 'clear' | 'partly-cloudy' | 'overcast' | 'rain' | 'snow';

export interface DayWeather {
  /** The day's high and low, °C. */
  high: number;
  low: number;
  /** Precipitation, mm (0 on a dry day). */
  precipitation: number;
  condition: Condition;
}

/** The game's own model of a day around its normals (R-0041): the day-to-day swing, its spread over days, the clouds. */
export const MODEL = {
  /** The standard deviation of a day's departure from its normal temperature, as a share of the day's normal range. */
  spread: 0.3,
  /** And never less than this, nor more than this, °C. */
  spreadLeast: 1,
  spreadMost: 4,
  /** How a day's departure carries over: its own draw, yesterday's, the day before's. */
  carry: [0.6, 0.3, 0.1],
  /** How much cooler a wet day's high and warmer a wet night's low run than a dry one's, °C. */
  wetHigh: 2,
  wetLow: 1,
  /** The cloudiness of a dry day: how widely it varies around what the sunshine normal implies. */
  cloudSpread: 0.35,
  /** The cloudiness below which a dry day is clear, and above which it's overcast. */
  clear: 0.25,
  overcast: 0.65,
} as const;

/** What the player is told of where the weather comes from: the game's own model around a station's averages. */
export const MODEL_LINE: LineId = 'weather.model';
/** And where the averages don't say their years. */
export const UNDATED_LINE: LineId = 'weather.model-undated';
/** And where the town's country publishes none, the station abroad it follows. */
export const BORROWED_LINE: LineId = 'weather.borrowed';
/** And where it publishes some and not others, the station abroad the others follow. */
export const BORROWED_PART_LINE: LineId = 'weather.borrowed-part';

/**
 * What the player is told of where a town's weather comes from: the station abroad that the first of its normals the
 * town's country doesn't publish is read from; else the station its high is read from, and the years its averages
 * cover. A station is named by the town nearest it, or where none is near by its own name.
 */
export function aboutWeather(place: { country: string }, sources: Record<Param, Source>): string {
  const borrowed = PARAMS.filter((p) => sources[p].borrowed);
  const first = borrowed[0];
  if (first !== undefined) {
    const s = sources[first].station;
    return t(borrowed.length === PARAMS.length ? BORROWED_LINE : BORROWED_PART_LINE, {
      country: countryName(place.country as CountryCode),
      place: s.town ?? s.name,
      placeCountry: countryName(s.country as CountryCode),
    });
  }
  const s = sources.tmax.station;
  return s.period === null ? t(UNDATED_LINE, { place: s.town ?? s.name }) : t(MODEL_LINE, { place: s.town ?? s.name, years: s.period.replace('-', ' to ') });
}

/** The temperature at or below which precipitation falls as snow, °C (R-0040: the 50% rain-snow threshold). */
export const SNOW_AT = 1.0;

/** A standard normal draw from two uniform ones (Box-Muller). */
export const normal = (u1: number, u2: number) => Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);

/** The date some days after (or before) another. */
export const after = (date: { year: number; month: number; day: number }, n: number) => civilFromDays(daysFromCivil(date.year, date.month, date.day) + n);

/** A day's normals at a town: its high and low carried to the town's height, its chance of rain, and what a dry day's sky is. */
export interface DayNormals {
  high: number;
  low: number;
  /** The chance of at least 1 mm: the month's wet days over its days. */
  wetChance: number;
  /** The mean fall on a wet day, mm: the month's precipitation over its wet days. */
  perWetDay: number;
  /** The share of a dry day's possible sunshine its sky lets through, from the month's sunshine normal. */
  dryShare: number;
}

export function normalsOn(place: { latitude: number; elevation: number | null }, sources: Record<Param, Source>, date: { year: number; month: number; day: number }): DayNormals {
  const at = (p: Param) => onDay(sources[p].station.normals[p] as number[], date.year, date.month, date.day);
  const length = daysInMonth(date.year, date.month);
  const wetChance = Math.min(1, at('wet') / length);
  const possible = dayLengthHours(place.latitude, daysFromCivil(date.year, date.month, date.day) * SECONDS_PER_DAY) * length;
  // The month's sunshine falls on its dry days; a month of polar night has none to fall.
  const sunshine = possible > 0 ? Math.min(1, at('sun') / possible) : 0;
  return {
    high: at('tmax') + heightCorrection(sources.tmax.station, place),
    low: at('tmin') + heightCorrection(sources.tmin.station, place),
    wetChance,
    perWetDay: at('wet') > 0 ? at('prcp') / at('wet') : 0,
    dryShare: wetChance < 1 ? Math.min(1, sunshine / (1 - wetChance)) : 1,
  };
}

/** A day's draws: whether it's wet and how much falls, the departures of it and the two days before, its clouds. */
export interface DayDraws {
  wet: number;
  amount: number;
  /** Standard normal departures: this day's, the day before's, and the day before that's. */
  z: [number, number, number];
  cloud: number;
}

/** A day's draws, keyed by the life's seed, each normal's station and the day, so towns sharing a station share a day. */
export function drawsOn(seed: string, sources: Record<Param, Source>, days: number): DayDraws {
  const s = seedFromText(seed);
  const rain = draws(s, 'weather.rain', sources.wet.station.id, days);
  const z = (day: number) => {
    const d = draws(s, 'weather.temperature', sources.tmax.station.id, day);
    return normal(d.float(), d.float());
  };
  const c = draws(s, 'weather.cloud', sources.sun.station.id, days);
  return { wet: rain.float(), amount: rain.float(), z: [z(days), z(days - 1), z(days - 2)], cloud: normal(c.float(), c.float()) };
}

const one = (n: number) => Math.round(n * 10) / 10;

/** A day's weather from its normals and its draws. */
export function dayFrom(n: DayNormals, d: DayDraws): DayWeather {
  const wet = d.wet < n.wetChance;
  const [w0, w1, w2] = MODEL.carry;
  const spread = Math.min(MODEL.spreadMost, Math.max(MODEL.spreadLeast, MODEL.spread * (n.high - n.low)));
  const departure = (spread * (w0 * d.z[0] + w1 * d.z[1] + w2 * d.z[2])) / Math.hypot(w0, w1, w2);
  // A wet day's high runs cooler and its low warmer, and a dry day's the other way, so the month keeps its normals.
  const high = n.high + departure + (wet ? -MODEL.wetHigh * (1 - n.wetChance) : MODEL.wetHigh * n.wetChance);
  const low = Math.min(high - 0.5, n.low + departure + (wet ? MODEL.wetLow * (1 - n.wetChance) : -MODEL.wetLow * n.wetChance));
  if (wet) {
    // An exponential fall about the month's mean for a wet day.
    // (Plus zero, so a draw of exactly nothing reads 0, never -0.)
    const precipitation = one(-n.perWetDay * Math.log(1 - d.amount)) + 0;
    return { high: one(high), low: one(low), precipitation, condition: (high + low) / 2 <= SNOW_AT ? 'snow' : 'rain' };
  }
  const cloudiness = 1 - n.dryShare + MODEL.cloudSpread * d.cloud;
  // Stryker disable next-line EqualityOperator: a cloudiness of exactly a threshold is either side of it.
  return { high: one(high), low: one(low), precipitation: 0, condition: cloudiness < MODEL.clear ? 'clear' : cloudiness < MODEL.overcast ? 'partly-cloudy' : 'overcast' };
}

/** A day's weather at a town, from its sources, the life's seed, and the town's local date. */
export function weatherOn(seed: string, place: { latitude: number; elevation: number | null }, sources: Record<Param, Source>, date: { year: number; month: number; day: number }): DayWeather {
  return dayFrom(normalsOn(place, sources, date), drawsOn(seed, sources, daysFromCivil(date.year, date.month, date.day)));
}

/** The game's own model of a forecast (R-0041): how far a forecast of a day ahead is off, growing with the days. */
export const FORECAST = {
  /** The standard deviation of a forecast high or low's error, °C: this much a day ahead, and this much more each day. */
  error: 0.6,
  growth: 0.4,
  /** The chance a forecast gets a day's rain wrong, each day ahead. */
  miss: 0.06,
} as const;

/** A forecast of a day from what it will be: off by an error of the given draw, and wrong about rain on a miss. */
export function forecastOf(actual: DayWeather, ahead: number, error: number, miss: number): DayWeather {
  const off = (FORECAST.error + FORECAST.growth * (ahead - 1)) * error;
  const high = one(actual.high + off);
  const low = one(Math.min(high - 0.5, actual.low + off));
  if (miss >= FORECAST.miss * ahead) return { high, low, precipitation: actual.precipitation, condition: actual.condition };
  // A miss: a wet day forecast dry under cloud, a dry day forecast wet.
  if (actual.precipitation > 0) return { high, low, precipitation: 0, condition: 'overcast' };
  return { high, low, precipitation: 0, condition: (high + low) / 2 <= SNOW_AT ? 'snow' : 'rain' };
}

/** The five days after today as forecast today. */
export function forecastFrom(seed: string, place: { latitude: number; elevation: number | null }, sources: Record<Param, Source>, today: { year: number; month: number; day: number }): DayWeather[] {
  const s = seedFromText(seed);
  const issued = daysFromCivil(today.year, today.month, today.day);
  return [1, 2, 3, 4, 5].map((ahead) => {
    const d = draws(s, 'weather.forecast', sources.tmax.station.id, issued, ahead);
    return forecastOf(weatherOn(seed, place, sources, after(today, ahead)), ahead, normal(d.float(), d.float()), d.float());
  });
}

/**
 * The temperature at a moment of the day, the game's own curve between the day's low and high (R-0041): the low at
 * sunrise, the high three hours after the sun's highest, falling from there to the next day's low at the next
 * sunrise. Times are seconds into the local day; where the sun neither rises nor sets, the low comes at 06:00 and the
 * high at 15:00.
 */
export function temperatureAt(seconds: number, today: { low: number; high: number; sunrise?: number; noon: number }, tomorrowLow: number, yesterday: { high: number; peak: number }): number {
  const sunrise = today.sunrise ?? 6 * 3600;
  const peak = today.sunrise === undefined ? 15 * 3600 : today.noon + 3 * 3600;
  const ease = (f: number) => Math.sin((Math.PI / 2) * f);
  // Stryker disable next-line EqualityOperator: the curve is continuous, so a moment of exactly sunrise is either side.
  if (seconds < sunrise) {
    // Still last night: falling from yesterday's high to today's low.
    return yesterday.high - (yesterday.high - today.low) * ease((seconds + SECONDS_PER_DAY - yesterday.peak) / (sunrise + SECONDS_PER_DAY - yesterday.peak));
  }
  // Stryker disable next-line EqualityOperator: as above, at exactly the peak.
  if (seconds < peak) return today.low + (today.high - today.low) * ease((seconds - sunrise) / (peak - sunrise));
  return today.high - (today.high - tomorrowLow) * ease((seconds - peak) / (sunrise + SECONDS_PER_DAY - peak));
}
