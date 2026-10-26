import { describe, expect, it } from 'vitest';
import tzdb from '../../../src/core/time/tzdb.json';
import type { TzData } from '../../../src/core/time/tzdb-types.ts';
import { zoneHistory } from '../../../src/core/time/zones.ts';

/**
 * A second, independent oracle: the ICU time zones built into Node (tz 2025b in Node 22.22.0), at every transition and
 * every 37 days from 1970 to 2037. ICU's data is older than the release the engine reads, so the zones IANA has changed
 * since 2025b differ, each for the reason its release notes give (register R-0005); every other zone must agree.
 */
const data = tzdb as TzData;
export const CHANGED_SINCE_2025B: Record<string, string> = {
  'America/Vancouver': '2026b: British Columbia moved to permanent -07 (modelled from 2026-11-01)',
  'America/Edmonton': '2026c: Alberta moved to permanent -06 (modelled from 2026-11-01)',
  'America/Inuvik': '2026d: the Northwest Territories stay on -06 (modelled from 2026-11-01)',
  'America/Winnipeg': '2026e: Manitoba moves to permanent -05 (modelled from 2026-11-01)',
  'Africa/Casablanca': '2026c: Morocco moves to permanent +00 on 2026-09-20',
  'Africa/El_Aaiun': '2026c: Western Sahara follows Morocco',
  'Europe/Chisinau': '2026a: Moldova has used EU transition times since 2022',
  'America/Tijuana': '2025c: Baja California followed California’s DST in 1953 and 1961 to 1975',
  'Asia/Tehran': '2026d: Iran’s 1979-05-26 spring forward was at 00:00, not 24:00',
  'America/Bogota': '2026d: Colombia’s 1992-05-02 spring forward was at 00:00, not 24:00',
};

const formats = new Map<string, Intl.DateTimeFormat>();
function icuOffset(zone: string, t: number): number {
  let f = formats.get(zone);
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    formats.set(zone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(t * 1000)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p['year'] as number, (p['month'] as number) - 1, p['day'] as number, p['hour'] as number, p['minute'] as number, p['second'] as number) / 1000 - t;
}

const LO = Date.UTC(1970, 0, 1) / 1000;
const HI = Date.UTC(2038, 0, 1) / 1000;

describe('every zone, against the ICU time zones in Node', () => {
  it('runs on the ICU data the exceptions were read against', () => {
    expect(process.versions.tz).toBe('2025b');
  });
  it.each(Object.keys(data.zones))('%s', (zone) => {
    const h = zoneHistory(data, data.zones[zone] as TzData['zones'][string]);
    const offsetAt = (t: number) => h.transitions.filter((x) => x.at <= t).at(-1)?.utoff ?? h.initial.utoff;
    const points = new Set([LO]);
    for (const x of h.transitions) if (x.at >= LO && x.at < HI) points.add(x.at).add(x.at - 1);
    for (let t = LO; t < HI; t += 37 * 86_400) points.add(t);
    const differs = [...points].some((t) => offsetAt(t) !== icuOffset(zone, t));
    expect(differs).toBe(zone in CHANGED_SINCE_2025B);
  });
});
