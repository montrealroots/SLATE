import { describe, expect, it } from 'vitest';
import {
  assertJson,
  begin,
  commandIndex,
  defineCommand,
  defineKind,
  defineNotice,
  dispatch,
  pass,
  waiting,
  type Command,
  type Context,
  type Item,
  type Json,
  type Life,
} from '../../../src/core/frame/frame.ts';
import { draws, seedFromText, type Decider } from '../../../src/core/rng/rng.ts';

interface S {
  money: { cash: number; log: string[] };
  papers: { held: string[] };
  [k: string]: unknown;
}
const SEED = '0123456789abcdef';
const T0 = 1_800_000_000;
const life = (): Life<S> => begin(SEED, T0, { money: { cash: 100, log: [] }, papers: { held: ['passport'] } });
/** A command for one test: its id made unique, so the registry takes it. */
let n = 0;
const command = <A extends Json = Json>(c: Omit<Command<S, A>, 'id'> & { id?: string }): Command<S, A> => defineCommand<S, A>({ id: `test.${(n += 1)}`, ...c });
const run = (reads: Command<S>['reads'], writes: Command<S>['writes'], body: (s: S, ctx: Context) => void, from = life()) =>
  dispatch(from, command({ reads, writes, run: (s, _a, ctx) => body(s, ctx) }), null);

/**
 * The kinds and the notice the tests schedule, declared on first use inside a test, so a declaration that throws fails
 * that test rather than stopping the file from loading.
 */
let declared: { pay: string; meeting: string; note: string } | undefined;
const K = () =>
  (declared ??= {
    pay: defineKind<S>({ kind: 'test.pay', wants: false, reads: [], writes: ['money'], happen: (s, item) => {
      s.money.cash += Number(item.data);
      s.money.log.push(`pay ${item.at}`);
    } }).kind,
    meeting: defineKind<S>({ kind: 'test.meeting', wants: true }).kind,
    note: defineNotice('test.note'),
  });

describe('a life', () => {
  it('begins at a moment, with its seed and its slices, and nothing scheduled or noticed', () => {
    const slices = { money: { cash: 1, log: [] }, papers: { held: [] } };
    const l = begin(SEED, T0, slices);
    expect(l).toEqual({ frame: { seed: SEED, now: T0, next: 1, schedule: [], notices: [] }, slices });
    slices.money.cash = 2;
    expect(l.slices.money.cash).toBe(1);
  });
  it('refuses a seed, a moment or slices it could not keep', () => {
    expect(() => begin('xyz', T0, {})).toThrow('not a seed: "xyz"');
    for (const bad of [1.5, Number.NaN, 2 ** 53]) expect(() => begin(SEED, bad, {})).toThrow(`a moment is a whole number of seconds (${bad})`);
    expect(() => begin(SEED, T0, { a: { b: undefined } })).toThrow('slices.a.b is not plain data');
    for (const part of ['schedule', 'notices']) expect(() => begin(SEED, T0, { [part]: {} })).toThrow(`a slice can't be called ${part}: the frame has its own`);
  });
});

describe('plain data', () => {
  it('is null, a boolean, a string, a finite number, and arrays and plain objects of them', () => {
    for (const ok of [null, true, false, '', 'x', 0, -1.5, [], [1, [2]], {}, { a: { b: [null] } }, Object.create(null)]) expect(() => assertJson(ok, 'v')).not.toThrow();
  });
  it('is not anything else, and says where', () => {
    class Thing {
      readonly at = 1;
    }
    for (const bad of [undefined, Number.NaN, Infinity, -Infinity, 1n, () => 1, new Date(0), new Map(), new Thing(), Symbol('s')]) expect(() => assertJson(bad, 'v')).toThrow('v is not plain data');
    expect(() => assertJson({ a: [1, { b: new Date(0) }] }, 'life')).toThrow('life.a.1.b is not plain data');
  });
});

describe('commands', () => {
  it('are declared once, and listed with what they read and write', () => {
    const c = defineCommand<S>({ id: 'test.listed', reads: ['papers'], writes: ['money', 'notices'], run: () => undefined });
    expect(commandIndex()).toContainEqual({ id: 'test.listed', reads: ['papers'], writes: ['money', 'notices'] });
    expect(() => defineCommand<S>({ ...c })).toThrow('the command test.listed is declared twice');
    expect(() => defineCommand<S>({ id: 'test.unnamed', reads: ['' as 'money'], writes: [], run: () => undefined })).toThrow("test.unnamed names a slice that isn't a name");
    expect(() => defineCommand<S>({ id: 'test.unnamed2', reads: [], writes: [3 as unknown as 'money'], run: () => undefined })).toThrow("test.unnamed2 names a slice that isn't a name");
    expect(commandIndex().map((x) => x.id)).not.toContain('test.unnamed');
  });
  it('change the slices they write, leave the rest as they were, and never touch the life they were given', () => {
    const before = life();
    const after = run(['papers'], ['money'], (s) => {
      s.money.cash += s.papers.held.length;
    }, before);
    expect(after.slices.money.cash).toBe(101);
    expect(before.slices.money.cash).toBe(100);
    expect(after.slices.papers).toBe(before.slices.papers);
    expect(after.slices.money).not.toBe(before.slices.money);
    expect(after.frame).toEqual(before.frame);
  });
  it('may replace a slice they write, or start one', () => {
    const after = run([], ['money', 'extra'], (s) => {
      s.money = { cash: 5, log: ['new'] };
      s['extra'] = { on: true };
    });
    expect(after.slices).toEqual({ money: { cash: 5, log: ['new'] }, papers: { held: ['passport'] }, extra: { on: true } });
  });
  it('stop at a slice they don\'t declare, and at any change to one they only read', () => {
    expect(() => run([], ['money'], (s) => void s.papers.held)).toThrow(/^test\.\d+ reads papers, which it doesn't declare$/);
    expect(() => run(['papers'], [], (s) => void s.papers.held.push('visa'))).toThrow(/^test\.\d+ changes papers, which it doesn't declare it writes$/);
    expect(() => run(['papers'], [], (s) => void (s.papers.held[0] = 'visa'))).toThrow(/changes papers, which it doesn't declare it writes$/);
    expect(() => run(['papers'], [], (s) => void delete (s.papers as Partial<S['papers']>).held)).toThrow(/changes papers, which it doesn't declare it writes$/);
    expect(() => run(['papers'], [], (s) => void Object.defineProperty(s.papers, 'x', { value: 1 }))).toThrow(/changes papers, which it doesn't declare it writes$/);
    expect(() => run(['papers'], [], (s) => void (s.papers = { held: [] }))).toThrow(/^test\.\d+ changes papers, which it doesn't declare it writes$/);
    expect(() => run([], ['money'], (s) => void delete (s as Partial<S>).money)).toThrow(/^test\.\d+ removes money; a slice is never removed$/);
    expect(() => run([], [], (s) => void (s as unknown as Record<symbol, number>)[Symbol.iterator])).toThrow(/^test\.\d+ reads Symbol\(Symbol\.iterator\), which it doesn't declare$/);
    expect(() => run([], [], (s) => void ((s as unknown as Record<symbol, number>)[Symbol.iterator] = 1))).toThrow(/^test\.\d+ changes Symbol\(Symbol\.iterator\), which it doesn't declare it writes$/);
    // Reading what it declares is fine, all the way down, nothing included.
    const blank = begin(SEED, T0, { money: { cash: 0, log: [] }, papers: { held: [] }, note: { text: null } });
    expect(run(['note'], [], (s) => expect((s['note'] as { text: null }).text).toBeNull(), blank).slices['note']).toEqual({ text: null });
    expect(run(['papers'], [], (s) => void s.papers.held.map((p) => p.length)).slices.papers.held).toEqual(['passport']);
  });
  it('keep only plain data, copied clear of anything they only read', () => {
    expect(() => run([], ['money'], (s) => void (s.money.log = [new Date(0) as unknown as string]))).toThrow('money.log.0 is not plain data');
    const after = run(['papers'], ['money'], (s) => void ((s.money as unknown as Record<string, unknown>)['copied'] = s.papers.held));
    expect(structuredClone(after.slices.money)).toEqual({ cash: 100, log: [], copied: ['passport'] });
  });
  it('run only as declared, with their own copy of plain arguments', () => {
    const c = command<{ add: number }>({ reads: [], writes: ['money'], run: (s, a) => {
      s.money.cash += a.add;
      a.add = 0;
    } });
    const args = { add: 5 };
    expect(dispatch(life(), c, args).slices.money.cash).toBe(105);
    expect(args.add).toBe(5);
    expect(() => dispatch(life(), { ...c }, args)).toThrow(`${c.id} isn't a declared command`);
    expect(() => dispatch(life(), c, { add: Number.NaN })).toThrow(`${c.id}'s arguments.add is not plain data`);
  });
  it('draw from the life\'s seed, by decider and keys', () => {
    let got: bigint[] = [];
    run([], [], (_s, ctx) => {
      got = [ctx.draws('test.coin' as Decider, 'a', 1).u64(), ctx.draws('test.coin' as Decider, 'a', 1).u64()];
      expect(ctx.now).toBe(T0);
    });
    const want = draws(seedFromText(SEED), 'test.coin' as Decider, 'a', 1).u64();
    expect(got).toEqual([want, want]);
  });
});

describe('the schedule', () => {
  it('takes items of declared kinds, now or later, in the order they will happen', () => {
    const after = run(['schedule'], ['schedule'], (_s, ctx) => {
      expect(ctx.schedule(K().pay, T0 + 60, 7)).toBe(1);
      expect(ctx.schedule(K().meeting, T0 + 30)).toBe(2);
      expect(ctx.schedule(K().pay, T0 + 60, { x: [1] })).toBe(3);
      expect(ctx.schedule(K().pay, T0)).toBe(4);
      expect(ctx.items().map((i) => i.id)).toEqual([4, 2, 1, 3]);
    });
    expect(after.frame.schedule).toEqual([
      { id: 4, at: T0, kind: K().pay, data: null },
      { id: 2, at: T0 + 30, kind: K().meeting, data: null },
      { id: 1, at: T0 + 60, kind: K().pay, data: 7 },
      { id: 3, at: T0 + 60, kind: K().pay, data: { x: [1] } },
    ]);
    expect(after.frame.next).toBe(5);
  });
  it('keeps things due at one moment in the order they were scheduled', () => {
    const after = run([], ['schedule'], (_s, ctx) => {
      for (let i = 0; i < 6; i += 1) ctx.schedule(K().pay, T0 + 60 - (i % 2) * 60, i);
    });
    expect(after.frame.schedule.map((i) => i.data)).toEqual([1, 3, 5, 0, 2, 4]);
  });
  it('refuses the past, a moment that isn\'t one, a kind never declared, and data it can\'t keep', () => {
    const at = (when: number) => () => run([], ['schedule'], (_s, ctx) => void ctx.schedule(K().pay, when));
    expect(at(T0 - 1)).toThrow(`schedules test.pay at ${T0 - 1}, before now (${T0}) or not a moment`);
    expect(at(T0 + 0.5)).toThrow('not a moment');
    expect(() => run([], ['schedule'], (_s, ctx) => void ctx.schedule('test.never', T0))).toThrow(/^test\.\d+ schedules test\.never, which isn't a declared kind$/);
    expect(() => run([], ['schedule'], (_s, ctx) => void ctx.schedule(K().pay, T0, [undefined as unknown as Json]))).toThrow("test.pay's data.0 is not plain data");
  });
  it('is read and changed only by what declares it', () => {
    expect(() => run([], [], (_s, ctx) => void ctx.items())).toThrow(/^test\.\d+ reads the schedule, which it doesn't declare$/);
    expect(() => run(['schedule'], [], (_s, ctx) => void ctx.schedule(K().pay, T0))).toThrow(/^test\.\d+ changes the schedule, which it doesn't declare$/);
    expect(() => run(['schedule'], [], (_s, ctx) => void ctx.cancel(1))).toThrow(/changes the schedule, which it doesn't declare$/);
    expect(run([], ['schedule'], (_s, ctx) => void ctx.items()).frame.schedule).toEqual([]);
  });
  it('lets an item be taken off, and only one that is on it', () => {
    const on = run([], ['schedule'], (_s, ctx) => {
      ctx.schedule(K().pay, T0 + 10);
      ctx.schedule(K().pay, T0 + 20);
    });
    expect(run([], ['schedule'], (_s, ctx) => ctx.cancel(1), on).frame.schedule.map((i) => i.id)).toEqual([2]);
    expect(() => run([], ['schedule'], (_s, ctx) => ctx.cancel(9), on)).toThrow(/^test\.\d+ cancels item 9, which isn't scheduled$/);
  });
  it('declares each kind once', () => {
    expect(() => defineKind<S>({ kind: K().pay, wants: true })).toThrow('the kind test.pay is declared twice');
    expect(() => defineKind<S>({ kind: 'test.bad', wants: false, reads: [''], writes: [], happen: () => undefined } as never)).toThrow("test.bad names a slice that isn't a name");
    expect(() => run([], ['schedule'], (_s, ctx) => void ctx.schedule('test.bad', T0))).toThrow("schedules test.bad, which isn't a declared kind");
  });
});

describe('notices', () => {
  it('are left at the moment, unread, and marked read', () => {
    const left = run([], ['notices'], (_s, ctx) => {
      expect(ctx.notify(K().note)).toBe(1);
      expect(ctx.notify(K().note, { who: 'bank' })).toBe(2);
    });
    expect(left.frame.notices).toEqual([
      { id: 1, at: T0, kind: K().note, data: null, read: false },
      { id: 2, at: T0, kind: K().note, data: { who: 'bank' }, read: false },
    ]);
    const read = run(['notices'], ['notices'], (_s, ctx) => {
      ctx.markRead(2);
      expect(ctx.notices().map((x) => x.read)).toEqual([false, true]);
    }, left);
    expect(read.frame.notices.map((x) => x.read)).toEqual([false, true]);
    expect(left.frame.notices.map((x) => x.read)).toEqual([false, false]);
    expect(() => run([], ['notices'], (_s, ctx) => ctx.markRead(9), left)).toThrow(/^test\.\d+ marks notice 9 read, which there isn't$/);
  });
  it('are of declared kinds, read and changed only by what declares them', () => {
    expect(() => defineNotice(K().note)).toThrow('the notice test.note is declared twice');
    const fresh = defineNotice('test.fresh');
    expect(run([], ['notices'], (_s, ctx) => void ctx.notify(fresh)).frame.notices.map((x) => x.kind)).toEqual(['test.fresh']);
    expect(() => run([], ['notices'], (_s, ctx) => void ctx.notify('test.unknown'))).toThrow(/^test\.\d+ leaves a test\.unknown notice, which isn't a declared kind$/);
    expect(() => run([], ['notices'], (_s, ctx) => void ctx.notify(K().note, { a: undefined as unknown as Json }))).toThrow("the test.note notice's data.a is not plain data");
    expect(() => run([], ['notices'], (_s, ctx) => ctx.markRead(4))).toThrow(/^test\.\d+ marks notice 4 read, which there isn't$/);
    expect(() => run([], [], (_s, ctx) => void ctx.notices())).toThrow(/^test\.\d+ reads the notices, which it doesn't declare$/);
    expect(() => run(['notices'], [], (_s, ctx) => void ctx.notify(K().note))).toThrow(/^test\.\d+ changes the notices, which it doesn't declare$/);
    expect(() => run(['notices'], [], (_s, ctx) => ctx.markRead(1))).toThrow(/changes the notices, which it doesn't declare$/);
    expect(run(['notices'], [], (_s, ctx) => void ctx.notices()).frame.notices).toEqual([]);
  });
});

describe('the passage of time', () => {
  const plan = (...items: [string, number, Json?][]) => run([], ['schedule'], (_s, ctx) => {
    for (const [kind, at, data] of items) ctx.schedule(kind, at, data ?? null);
  });
  it('brings each thing about at its moment, in order, and ends at the moment asked', () => {
    const l = plan([K().pay, T0 + 200, 2], [K().pay, T0 + 100, 1], [K().pay, T0 + 300, 3]);
    const { life: after, stoppedAt } = pass(l, T0 + 250);
    expect(stoppedAt).toBeNull();
    expect(after.frame.now).toBe(T0 + 250);
    expect(after.slices.money).toEqual({ cash: 103, log: [`pay ${T0 + 100}`, `pay ${T0 + 200}`] });
    expect(after.frame.schedule.map((i) => i.at)).toEqual([T0 + 300]);
    // Something due exactly at the moment asked happens.
    expect(pass(l, T0 + 300).life.slices.money.cash).toBe(106);
    expect(pass(l, T0).life).toEqual(l);
  });
  it('runs each happening at its own moment, and what it schedules happens in turn', () => {
    const seen: number[] = [];
    const chain: string = defineKind<S>({ kind: 'test.chain', wants: false, reads: [], writes: ['schedule'], happen: (_s, item, ctx) => {
      seen.push(ctx.now);
      if (Number(item.data) > 0) ctx.schedule('test.chain', ctx.now + 10, Number(item.data) - 1);
    } }).kind;
    const { life: after } = pass(plan([chain, T0 + 5, 3]), T0 + 1000);
    expect(seen).toEqual([T0 + 5, T0 + 15, T0 + 25, T0 + 35]);
    expect(after.frame.schedule).toEqual([]);
    expect(after.frame.next).toBe(5);
  });
  it('stops at a commitment that wants the player, which stays until it is dealt with', () => {
    const l = plan([K().pay, T0 + 100, 1], [K().meeting, T0 + 150], [K().pay, T0 + 200, 2]);
    const first = pass(l, T0 + 1000);
    expect(first.stoppedAt).toEqual({ id: 2, at: T0 + 150, kind: K().meeting, data: null });
    expect(first.life.frame.now).toBe(T0 + 150);
    expect(first.life.slices.money.cash).toBe(101);
    expect(waiting(first.life).map((i) => i.id)).toEqual([2]);
    expect(waiting(l)).toEqual([]);
    // It holds time where it is.
    const again = pass(first.life, T0 + 1000);
    expect(again.stoppedAt?.id).toBe(2);
    expect(again.life.frame.now).toBe(T0 + 150);
    // Dealt with, time goes on.
    const done = run([], ['schedule'], (_s, ctx) => ctx.cancel(2), first.life);
    const on = pass(done, T0 + 1000);
    expect([on.stoppedAt, on.life.frame.now, on.life.slices.money.cash]).toEqual([null, T0 + 1000, 103]);
    // Before its moment, it doesn't stop anything.
    expect(pass(l, T0 + 149).stoppedAt).toBeNull();
  });
  it('ends the same in one step or in many', () => {
    const l = plan([K().pay, T0 + 100, 1], [K().pay, T0 + 200, 2], [K().pay, T0 + 300, 4]);
    const whole = pass(l, T0 + 400).life;
    let stepped = l;
    for (const to of [T0 + 50, T0 + 100, T0 + 101, T0 + 299, T0 + 400]) stepped = pass(stepped, to).life;
    expect(stepped).toEqual(whole);
  });
  it('only goes forward, to a moment', () => {
    expect(() => pass(life(), T0 - 1)).toThrow(`time passes forward to a moment (from ${T0} to ${T0 - 1})`);
    expect(() => pass(life(), T0 + 0.5)).toThrow('time passes forward to a moment');
  });
  it('holds each happening to what it declares', () => {
    const sneaky = defineKind<S>({ kind: 'test.sneaky', wants: false, reads: ['money'], writes: [], happen: (s) => void (s.money.cash = 0) }).kind;
    expect(() => pass(plan([sneaky, T0 + 1]), T0 + 2)).toThrow("test.sneaky changes money, which it doesn't declare it writes");
  });
  it('refuses an item whose kind isn\'t declared', () => {
    const l = life();
    const odd: Item = { id: 9, at: T0 + 1, kind: 'test.lost', data: null };
    expect(() => pass({ ...l, frame: { ...l.frame, schedule: [odd] } }, T0 + 2)).toThrow("item 9 is of test.lost, which isn't a declared kind");
    expect(waiting({ ...l, frame: { ...l.frame, now: T0 + 5, schedule: [odd] } })).toEqual([]);
  });
});
