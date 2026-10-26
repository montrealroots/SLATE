import { draws, seedFromText, type Decider, type Draws } from '../rng/rng.ts';

/**
 * The simulation frame: one life's state, the commands that change it, the things scheduled to happen in it, the
 * passage of time that brings them about, and the notices it leaves for the player.
 *
 * A life is plain data (so it saves and reopens as it was) in two parts: the frame's own (the seed, the moment, what's
 * scheduled, the notices) and the slices each engine above keeps. Everything that changes a life is declared here
 * first, with what it reads and what it writes, and is held to that: reading a slice it didn't declare, or changing
 * one it doesn't write, stops it. That declaration is where the feature matrix finds each command's readers.
 */

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Something scheduled: at an instant (seconds UT), of a declared kind, with its own data. */
export interface Item {
  readonly id: number;
  readonly at: number;
  readonly kind: string;
  readonly data: Json;
}

/** A notice left for the player, of a declared kind, at the moment it was left. */
export interface Notice {
  readonly id: number;
  readonly at: number;
  readonly kind: string;
  readonly data: Json;
  readonly read: boolean;
}

export interface Frame {
  /** The life's seed, as sixteen hex digits. */
  readonly seed: string;
  /** The moment the life has reached, in seconds UT. */
  readonly now: number;
  /** The id the next item or notice takes. */
  readonly next: number;
  readonly schedule: readonly Item[];
  readonly notices: readonly Notice[];
}

export interface Life<S extends object = Record<string, unknown>> {
  readonly frame: Frame;
  readonly slices: S;
}

/** The frame's own parts a declaration can name beside the slices. */
export type Part = 'schedule' | 'notices';
type Name<S> = (keyof S & string) | Part;

export interface Access<S> {
  /** The slices (and frame parts) it reads. */
  readonly reads: readonly Name<S>[];
  /** The slices (and frame parts) it changes; it may read them too. */
  readonly writes: readonly Name<S>[];
}

/** What a command or a happening can do besides changing its slices. */
export interface Context {
  /** The moment it happens. */
  readonly now: number;
  /** Draws keyed by the life's seed, the decider and the keys. */
  draws(decider: Decider, ...keys: readonly (string | number)[]): Draws;
  /** What's scheduled, earliest first (reads the schedule). */
  items(): readonly Item[];
  /** Schedules an item of a declared kind, now or later; its id (writes the schedule). */
  schedule(kind: string, at: number, data?: Json): number;
  /** Takes an item off the schedule (writes the schedule). */
  cancel(id: number): void;
  /** The notices, oldest first (reads the notices). */
  notices(): readonly Notice[];
  /** Leaves a notice of a declared kind; its id (writes the notices). */
  notify(kind: string, data?: Json): number;
  /** Marks a notice read (writes the notices). */
  markRead(id: number): void;
}

export interface Command<S, A extends Json = Json> extends Access<S> {
  readonly id: string;
  run(slices: S, args: A, context: Context): void;
}

/**
 * A kind of scheduled item. One that wants the player is a commitment: time stops at it and it stays on the schedule
 * until a command deals with it. Any other happens when its moment comes, and is gone.
 */
export type Kind<S> =
  | { readonly kind: string; readonly wants: true }
  | (Access<S> & { readonly kind: string; readonly wants: false; happen(slices: S, item: Item, context: Context): void });

const commands = new Map<string, Command<never, never>>();
const kinds = new Map<string, Kind<never>>();
const noticeKinds = new Set<string>();

const isPlain = (v: object) => [Object.prototype, null].includes(Object.getPrototypeOf(v));

/** Holds a value to plain data (what a life is saved as), naming where it isn't. */
export function assertJson(value: unknown, path: string): asserts value is Json {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  // Number.isFinite takes nothing but a number.
  if (Number.isFinite(value)) return;
  if (typeof value === 'object' && (Array.isArray(value) || isPlain(value))) {
    for (const [k, v] of Object.entries(value)) assertJson(v, `${path}.${k}`);
    return;
  }
  throw new TypeError(`${path} is not plain data`);
}

const isTime = (t: number) => Number.isSafeInteger(t);

function declare<S>(what: string, access: Access<S>): void {
  for (const n of [...access.reads, ...access.writes]) if (typeof n !== 'string' || n === '') throw new TypeError(`${what} names a slice that isn't a name`);
}

/** Declares a command, with what it reads and writes. Its id is its own. */
export function defineCommand<S, A extends Json = Json>(command: Command<S, A>): Command<S, A> {
  if (commands.has(command.id)) throw new Error(`the command ${command.id} is declared twice`);
  declare(command.id, command);
  commands.set(command.id, command as unknown as Command<never, never>);
  return command;
}

/** Declares a kind of scheduled item. */
export function defineKind<S>(kind: Kind<S>): Kind<S> {
  if (kinds.has(kind.kind)) throw new Error(`the kind ${kind.kind} is declared twice`);
  if (!kind.wants) declare(kind.kind, kind);
  kinds.set(kind.kind, kind as Kind<never>);
  return kind;
}

/** Declares a kind of notice. */
export function defineNotice(kind: string): string {
  if (noticeKinds.has(kind)) throw new Error(`the notice ${kind} is declared twice`);
  noticeKinds.add(kind);
  return kind;
}

/** Every command declared, with what it reads and writes: the matrix's index. */
export function commandIndex(): { id: string; reads: readonly string[]; writes: readonly string[] }[] {
  return [...commands.values()].map(({ id, reads, writes }) => ({ id, reads, writes }));
}

/** A new life at a moment, with its seed and its engines' slices. */
export function begin<S extends object>(seed: string, now: number, slices: S): Life<S> {
  seedFromText(seed);
  if (!isTime(now)) throw new RangeError(`a moment is a whole number of seconds (${now})`);
  assertJson(slices, 'slices');
  return { frame: { seed, now, next: 1, schedule: [], notices: [] }, slices: structuredClone(slices) };
}

/** A value that can be read and not changed: any change names who tried, and what. */
function readOnly(value: unknown, who: string, slice: string): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const refuse = (): never => {
    throw new Error(`${who} changes ${slice}, which it doesn't declare it writes`);
  };
  return new Proxy(value, {
    get: (t, p) => readOnly(Reflect.get(t, p), who, slice),
    set: refuse,
    defineProperty: refuse,
    deleteProperty: refuse,
  });
}

/** The order things happen in: by moment, then (the sort being stable, and each item added last) as scheduled. */
const byTime = (a: Item, b: Item) => a.at - b.at;

/**
 * Runs one declared change on a life, held to its declaration, and returns the life it leaves. The slices it doesn't
 * write are carried over as they were; the ones it does are its own copies.
 */
function apply<S extends object>(life: Life<S>, who: string, access: Access<S>, now: number, act: (slices: S, context: Context) => void): Life<S> {
  const reads = new Set<string>(access.reads);
  const writes = new Set<string>(access.writes);
  const may = (part: Part, write: boolean) => {
    if (!writes.has(part) && (write || !reads.has(part))) throw new Error(`${who} ${write ? 'changes' : 'reads'} the ${part}, which it doesn't declare`);
  };
  const own = { ...(life.slices as Record<string, unknown>) };
  for (const w of writes) if (Object.hasOwn(own, w)) own[w] = structuredClone(own[w]);
  let { next, schedule, notices } = life.frame;
  const seed = seedFromText(life.frame.seed);
  const slices = new Proxy(own, {
    get(t, p) {
      if (typeof p !== 'string' || !(reads.has(p) || writes.has(p))) throw new Error(`${who} reads ${String(p)}, which it doesn't declare`);
      return writes.has(p) ? t[p] : readOnly(t[p], who, p);
    },
    set(t, p, v) {
      if (typeof p !== 'string' || !writes.has(p)) throw new Error(`${who} changes ${String(p)}, which it doesn't declare it writes`);
      t[p] = v;
      return true;
    },
    deleteProperty: (_t, p) => {
      throw new Error(`${who} removes ${String(p)}; a slice is never removed`);
    },
  }) as S;
  const context: Context = {
    now,
    draws: (decider, ...keys) => draws(seed, decider, ...keys),
    items: () => {
      may('schedule', false);
      return [...schedule];
    },
    schedule: (kind, at, data = null) => {
      may('schedule', true);
      if (!kinds.has(kind)) throw new Error(`${who} schedules ${kind}, which isn't a declared kind`);
      if (!isTime(at) || at < now) throw new RangeError(`${who} schedules ${kind} at ${at}, before now (${now}) or not a moment`);
      assertJson(data, `${kind}'s data`);
      const id = next;
      next += 1;
      schedule = [...schedule, { id, at, kind, data: structuredClone(data) }].sort(byTime);
      return id;
    },
    cancel: (id) => {
      may('schedule', true);
      if (!schedule.some((i) => i.id === id)) throw new Error(`${who} cancels item ${id}, which isn't scheduled`);
      schedule = schedule.filter((i) => i.id !== id);
    },
    notices: () => {
      may('notices', false);
      return [...notices];
    },
    notify: (kind, data = null) => {
      may('notices', true);
      if (!noticeKinds.has(kind)) throw new Error(`${who} leaves a ${kind} notice, which isn't a declared kind`);
      assertJson(data, `the ${kind} notice's data`);
      const id = next;
      next += 1;
      notices = [...notices, { id, at: now, kind, data: structuredClone(data), read: false }];
      return id;
    },
    markRead: (id) => {
      may('notices', true);
      if (!notices.some((n) => n.id === id)) throw new Error(`${who} marks notice ${id} read, which there isn't`);
      notices = notices.map((n) => (n.id === id ? { ...n, read: true } : n));
    },
  };
  act(slices, context);
  for (const w of writes) {
    if (!Object.hasOwn(own, w)) continue;
    assertJson(own[w], w);
    // A plain copy, so nothing read-only that was copied in travels on with the life.
    own[w] = JSON.parse(JSON.stringify(own[w]));
  }
  return { frame: { seed: life.frame.seed, now: life.frame.now, next, schedule, notices }, slices: own as S };
}

/** A declared command, run on a life with its arguments, at the life's moment. */
export function dispatch<S extends object, A extends Json>(life: Life<S>, command: Command<S, A>, args: A): Life<S> {
  if (commands.get(command.id) !== (command as unknown)) throw new Error(`${command.id} isn't a declared command`);
  assertJson(args, `${command.id}'s arguments`);
  return apply(life, command.id, command, life.frame.now, (slices, context) => command.run(slices, structuredClone(args), context));
}

/** The commitments that want the player now: scheduled at or before the life's moment. */
export function waiting<S extends object>(life: Life<S>): Item[] {
  return life.frame.schedule.filter((i) => i.at <= life.frame.now && kinds.get(i.kind)?.wants === true);
}

/**
 * Time passes, up to a moment: everything scheduled before it happens in order, each at its own moment, and time
 * stops early at the first commitment that wants the player (which stays on the schedule). Passing to a moment in one
 * step or in several ends the same.
 */
export function pass<S extends object>(life: Life<S>, to: number): { life: Life<S>; stoppedAt: Item | null } {
  if (!isTime(to) || to < life.frame.now) throw new RangeError(`time passes forward to a moment (from ${life.frame.now} to ${to})`);
  let current = life;
  for (;;) {
    const item = current.frame.schedule.find((i) => i.at <= to);
    if (item === undefined) break;
    const kind = kinds.get(item.kind);
    if (kind === undefined) throw new Error(`item ${item.id} is of ${item.kind}, which isn't a declared kind`);
    const at = Math.max(item.at, current.frame.now);
    if (kind.wants) return { life: { ...current, frame: { ...current.frame, now: at } }, stoppedAt: item };
    const due: Life<S> = { ...current, frame: { ...current.frame, now: at, schedule: current.frame.schedule.filter((i) => i.id !== item.id) } };
    current = apply(due, kind.kind, kind as Access<S>, at, (slices, context) => (kind as { happen(s: S, i: Item, c: Context): void }).happen(slices, item, context));
  }
  return { life: { ...current, frame: { ...current.frame, now: to } }, stoppedAt: null };
}
