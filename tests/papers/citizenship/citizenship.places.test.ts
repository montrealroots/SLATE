import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutNaturalisation, keepsCitizenship, nationality, naturalisation, naturalise } from '../../../src/papers/citizenship/citizenship.ts';

/**
 * Citizenship for the country of every one of the map's 171,654 places: held by the gate's test run on every commit,
 * and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('citizenship', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const state = nationality(code);
      const into = naturalisation(code);
      const kept = keepsCitizenship(code);
      for (const p of await placesOf(code)) {
        expect(state === undefined, p.id).toBe(!kept);
        // Everyone born there holds a state's nationality the game keeps, and naturalising there either can be done,
        // keeping that nationality where its rules allow, or the player is told why not.
        if (into === undefined || into === 'none') expect(aboutNaturalisation(p.country), p.id).toBeDefined();
        else expect(naturalise([code], code)?.held, p.id).toEqual([state]);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
