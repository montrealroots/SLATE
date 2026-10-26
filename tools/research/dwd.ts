import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reads the Deutscher Wetterdienst's climatological monthly means for stations worldwide (its Climate Data Center,
 * observations_global/CLIMAT/multi_annual): the mean daily maximum and minimum temperature, the precipitation and the
 * sunshine, for 1961-1990 (mostly WMO Publication No. 847, else the national services' own publications or their
 * CLIMAT reports) and for 1991-2020, with the list of the stations' places. Kept whole, each file as published, with
 * the date read.
 */
export const BASE = 'https://opendata.dwd.de/climate_environment/CDC';
export const PARAMETERS = {
  tmax: 'air_temperature_mean_of_daily_max',
  tmin: 'air_temperature_mean_of_daily_min',
  prcp: 'precipitation_total',
  sun: 'sunshine_duration',
} as const;
export const PERIODS = ['1961_1990', '1991_2020'] as const;
export const fileUrl = (parameter: string, period: string) => `${BASE}/observations_global/CLIMAT/multi_annual/${parameter}/${period}.txt`;
export const STATIONS = `${BASE}/help/stations_list_CLIMAT_data.txt`;
export const OUTPUT = 'research/sources/dwd-multi-annual.json';

async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
    // The files are Latin-1.
    if (res?.ok === true) return new TextDecoder('latin1').decode(await res.arrayBuffer());
    if (attempt === 4) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'dwd.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const files: Record<string, Record<string, string>> = {};
  for (const [param, name] of Object.entries(PARAMETERS)) {
    files[param] = {};
    for (const period of PERIODS) (files[param] as Record<string, string>)[period] = await get(fileUrl(name, period));
  }
  const stations = await get(STATIONS);
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'Deutscher Wetterdienst, Climate Data Center: climatological monthly means for stations worldwide', url: fileUrl('{parameter}', '{period}'), stationsUrl: STATIONS, read, files, stations })}\n`);
  console.log(`${Object.keys(PARAMETERS).length * PERIODS.length} files and the station list -> ${OUTPUT}`);
}
