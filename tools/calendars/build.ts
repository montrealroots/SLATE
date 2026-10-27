import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SECONDS_PER_DAY } from '../../src/core/time/calendar.ts';
import { CALENDARS, compileCalendars, OUTPUT, serialize, type CalendarDay, type CalendarId } from './compile.ts';

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
  const calendars = compileCalendars(icuDay());
  writeFileSync(join(root, OUTPUT), serialize(calendars));
  console.log(`Calendars: ${CALENDARS.map((c) => `${c} ${Object.keys(calendars[c]).length} months`).join(', ')} -> ${OUTPUT}`);
}
