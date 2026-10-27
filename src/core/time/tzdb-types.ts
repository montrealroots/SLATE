/** The time zone database as the compiler writes it (tools/tzdb/compile.ts) and the engine reads it. Seconds throughout. */

/** A day of a month: a fixed day, the last given weekday, or the first weekday on or after / on or before a day. */
export type TzOn =
  | { kind: 'dom'; day: number }
  | { kind: 'last'; weekday: number }
  | { kind: 'geq'; weekday: number; day: number }
  | { kind: 'leq'; weekday: number; day: number };

/** w: the wall clock in effect; s: local standard time; u: universal time. */
export type TzAtType = 'w' | 's' | 'u';

export interface TzRule {
  from: number;
  /** The last year the rule applies; null for no end ("max"). */
  to: number | null;
  /** 1 to 12. */
  month: number;
  on: TzOn;
  at: number;
  atType: TzAtType;
  save: number;
  isdst: boolean;
  letters: string;
}

export interface TzUntil {
  year: number;
  month: number;
  on: TzOn;
  at: number;
  atType: TzAtType;
}

export interface TzZoneLine {
  stdoff: number;
  rule: { kind: 'none' } | { kind: 'fixed'; save: number; isdst: boolean } | { kind: 'named'; name: string };
  format: string;
  /** Absent on a zone's last line, which runs on with no end. */
  until?: TzUntil;
}

export interface TzData {
  version: string;
  rules: Record<string, TzRule[]>;
  zones: Record<string, TzZoneLine[]>;
  /** An alias, by the zone it names. */
  links: Record<string, string>;
}
