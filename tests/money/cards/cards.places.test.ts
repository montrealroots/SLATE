import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutCards, cardsIn, hasNoCard, keepsCards } from '../../../src/money/cards/cards.ts';

/**
 * The credit cards of the country of every one of the map's 171,654 places: held by the gate's test run on every commit, and
 * left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('cards', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const cards = cardsIn(code);
      for (const p of await placesOf(code)) {
        // A kept country has a card to hold, unless no bank there offers one; otherwise the player is told.
        if (keepsCards(code) && !hasNoCard(code)) expect(cards.length, p.id).toBeGreaterThan(0);
        else expect([cards, aboutCards(p.country)], p.id).toEqual([[], expect.any(String)]);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
