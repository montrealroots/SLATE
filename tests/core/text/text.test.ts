import { describe, expect, it } from 'vitest';
import catalog from '../../../src/core/text/catalog.json';
import { fill, isLine, t, type LineId } from '../../../src/core/text/text.ts';

describe('lines', () => {
  it('are said as the catalog has them', () => {
    expect(t('life.damaged')).toBe("The file's damaged.");
    // Every line, its slots filled with their own names, reads as the catalog writes it.
    for (const id of Object.keys(catalog) as LineId[]) {
      const text = catalog[id].text;
      const slots = Object.fromEntries([...text.matchAll(/\{([^}]*)\}/g)].map((m) => [m[1] as string, `{${m[1] as string}}`]));
      expect(t(id, slots)).toBe(text);
    }
    expect(t('weather.borrowed', { country: 'Vatican', place: 'Rome', placeCountry: 'Italy' })).toBe('No averages are published from near here in Vatican, so the weather follows those measured near Rome, in Italy.');
  });
  it('are only the catalog\'s', () => {
    expect(isLine('life.damaged')).toBe(true);
    for (const id of ['life.nothing', 'toString', 'constructor', '', undefined, 3, { toString: () => 'life.damaged' }]) expect(isLine(id)).toBe(false);
    expect(() => t('life.nothing' as LineId)).toThrow('there is no line life.nothing');
    expect(() => t('toString' as LineId)).toThrow('there is no line toString');
  });
});

describe('a line\'s slots', () => {
  it('are filled with the words given, each where it stands', () => {
    expect(fill('x.y', 'Let {name} go? {name} won\'t mind.', { name: 'Ada' })).toBe("Let Ada go? Ada won't mind.");
    expect(fill('x.y', '{a} and {b}', { b: 'two', a: 'one' })).toBe('one and two');
    expect(fill('x.y', 'Plain.', {})).toBe('Plain.');
    expect(fill('x.y', 'Only {a}.', { a: '{b}' })).toBe('Only {b}.');
  });
  it('are never left empty, and take nothing they have no place for', () => {
    expect(() => fill('x.y', 'Let {name} go?', {})).toThrow('the line x.y needs {name}');
    expect(() => fill('x.y', 'Plain.', { name: 'Ada' })).toThrow('the line x.y has no {name}');
    expect(() => fill('x.y', 'Let {name} go?', { name: '' })).toThrow("the line x.y's {name} is given no words");
    expect(() => fill('x.y', 'Let {name} go?', { name: 3 as unknown as string })).toThrow("the line x.y's {name} is given no words");
    expect(() => fill('x.y', 'Let {name} go?', Object.assign(Object.create({ name: 'inherited' }) as Record<string, string>, {}))).toThrow('the line x.y needs {name}');
    expect(() => t('life.damaged', { name: 'Ada' })).toThrow('the line life.damaged has no {name}');
  });
});
