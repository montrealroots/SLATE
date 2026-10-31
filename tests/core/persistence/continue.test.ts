import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { begin, dispatch, pass, type Life } from '../../../src/core/frame/frame.ts';
import { DeviceStore, indexedStore, PACKED } from '../../../src/core/persistence/local.ts';
import { daysFromCivil } from '../../../src/core/time/calendar.ts';
import { CARDS_START, MISSED, openCard, payCard, spendOnCard, STATED, type Holding } from '../../../src/money/cards/account.ts';
import { cardsIn } from '../../../src/money/cards/cards.ts';
import { CREDIT_START } from '../../../src/money/credit/credit.ts';
import { SEED, kept } from './support.ts';

const at = (y: number, m: number, d: number, h = 9) => daysFromCivil(y, m, d) * 86_400 + h * 3600;

/**
 * KEEP entry 1's own test: a life saved partway through opens as it was and plays on identical. It's a played life, not
 * an idle one: a real card of the catalog, opened, spent on, its statements and due dates come and gone, a minimum
 * missed, saved with the next statement and due date on the schedule, then played on a year from both copies.
 */
describe('a life saved, opened and played on', () => {
  it('ends where the life never saved ends', async () => {
    const card = cardsIn('US')[0];
    if (card === undefined) throw new Error('no US card');
    let life: Life<Holding> = begin(SEED, at(2026, 1, 15), { cards: CARDS_START, credit: CREDIT_START });
    life = dispatch(life, openCard, { country: 'US', bank: card.bank, card: card.card, limit: '500', income: '100000', born: '1966-02-15', zone: 'America/New_York', national: true });
    life = dispatch(life, spendOnCard, { card: 0, amount: '120.50', foreign: true, cash: false });
    life = pass(life, at(2026, 4, 20)).life;
    expect(life.frame.notices.filter((n) => n.kind === STATED)).toHaveLength(3);
    expect(life.frame.notices.some((n) => n.kind === MISSED)).toBe(true);
    expect(life.frame.schedule.length).toBeGreaterThan(0);

    const factory = new IDBFactory();
    const store = new DeviceStore(indexedStore(factory));
    await store.save({ ...kept(1), life: life as unknown as Life });
    expect((await indexedStore(factory).getItem('slate.life.1'))?.startsWith(PACKED)).toBe(true);
    const opened = (await new DeviceStore(indexedStore(factory)).load(1))?.life as unknown as Life<Holding>;
    expect(opened).toEqual(life);

    const playOn = (from: Life<Holding>) => {
      let l = pass(from, at(2026, 6, 1)).life;
      l = dispatch(l, payCard, { card: 0, amount: '50' });
      l = dispatch(l, spendOnCard, { card: 0, amount: '10', foreign: false, cash: true });
      return pass(l, at(2027, 4, 20)).life;
    };
    const never = playOn(life);
    expect(playOn(opened)).toEqual(never);
    // The year played on moved the life: twelve more statements, and the balance it left.
    expect(never.frame.notices.filter((n) => n.kind === STATED)).toHaveLength(15);
    expect(never.slices.cards.held[0]?.purchases).not.toBe(life.slices.cards.held[0]?.purchases);
  });
});
