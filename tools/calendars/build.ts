import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SECONDS_PER_DAY } from '../../src/core/time/calendar.ts';
import { CALENDARS, compileCalendars, hkoChinese, OUTPUT, serialize, type CalendarDay, type CalendarId } from './compile.ts';

/** The Hong Kong Observatory's tables, as the research tool fetched them. */
export const HKO = 'research/sources/hko-lunar.json';

/** Each calendar's day: the Chinese from the Hong Kong Observatory's tables (the file the register cites), the others from ICU. */
export function calendarDay(root: string): (calendar: CalendarId, days: number) => CalendarDay {
  const icu = icuDay();
  const raw = readFileSync(join(root, HKO));
  const entry = (JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as { entries: { id: string; value?: { hko?: { sha256: string } } }[] }).entries.find((e) => e.id === 'R-0106');
  if (createHash('sha256').update(raw).digest('hex') !== entry?.value?.hko?.sha256) throw new Error(`${HKO} isn't the file R-0106 cites`);
  const chinese = hkoChinese((JSON.parse(raw.toString('utf8')) as { tables: Record<string, string> }).tables);
  return (calendar, days) => (calendar === 'chinese' ? (chinese.get(days) as CalendarDay) : icu(calendar, days));
}

/** ICU's day in each calendar (Node's own ICU, whose version the register cites): the Hebrew month by its name. */
export function icuDay(): (calendar: CalendarId, days: number) => CalendarDay {
  const formats = new Map(
    CALENDARS.map((c) => [c, new Intl.DateTimeFormat(`en-u-ca-${c}`, { timeZone: 'UTC', year: 'numeric', month: c === 'hebrew' ? 'long' : 'numeric', day: 'numeric' })]),
  );
  return (calendar, days) => {
    const parts = (formats.get(calendar) as Intl.DateTimeFormat).formatToParts(new Date(days * SECONDS_PER_DAY * 1000));
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    return { year: (part('relatedYear') ?? part('year')) as string, month: part('month') as string, day: Number(part('day')) };
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'build.ts')) {
  if (process.versions.icu !== '77.1') throw new Error(`the calendars are compiled from ICU 77.1, not ${process.versions.icu}`);
  const root = resolve(import.meta.dirname, '../..');
  const calendars = compileCalendars(calendarDay(root));
  writeFileSync(join(root, OUTPUT), serialize(calendars));
  console.log(`Calendars: ${CALENDARS.map((c) => `${c} ${Object.keys(calendars[c]).length} months`).join(', ')} -> ${OUTPUT}`);
}
