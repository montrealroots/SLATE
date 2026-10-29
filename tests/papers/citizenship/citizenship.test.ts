import { describe, expect, it } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/papers/citizenship/citizenship.json';
import { aboutNaturalisation, KEEP_UNKNOWN_LINE, keepingUnknown, keepsCitizenship, nationality, naturalisation, naturalise, NONE_LINE, UNKEPT_LINE } from '../../../src/papers/citizenship/citizenship.ts';

describe('citizenship', () => {
  it("is each state's own, and a territory's is its state's", () => {
    expect(COUNTRY_CODES.filter(keepsCitizenship)).toEqual(Object.keys(data).sort());
    expect([keepsCitizenship('DE'), keepsCitizenship('AQ')]).toEqual([true, false]);
    // Germany since 27 June 2024: five years, other citizenships kept either way.
    expect(naturalisation('DE')).toStrictEqual({ years: 5, renounce: false });
    expect(naturalisation('JP')).toStrictEqual({ years: 5, renounce: true });
    expect(naturalisation('CA')).toStrictEqual({ years: 3, renounce: false });
    expect(naturalisation('CN')).toBe('none');
    expect([naturalisation('AQ'), nationality('AQ')]).toEqual([undefined, undefined]);
    // A territory's people hold their state's nationality under its rules; Svalbard's residence doesn't count.
    expect([nationality('GP'), nationality('GU'), nationality('HK'), nationality('DE')]).toEqual(['FR', 'US', 'CN', 'DE']);
    expect(naturalisation('GP')).toStrictEqual(naturalisation('FR'));
    expect(naturalisation('HK')).toBe('none');
    expect([nationality('SJ'), naturalisation('SJ'), naturalisation('NO')]).toEqual(['NO', 'none', { years: 8, renounce: false }]);
    // What naturalising does to the citizenships held.
    expect(naturalise(['FR'], 'DE')).toStrictEqual({ held: ['FR', 'DE'], unsure: [] });
    expect(naturalise(['GP'], 'DE')).toStrictEqual({ held: ['FR', 'DE'], unsure: [] });
    expect(naturalise(['JP'], 'US')).toStrictEqual({ held: ['US'], unsure: [] });
    expect(naturalise(['US', 'FR'], 'JP')).toStrictEqual({ held: ['JP'], unsure: [] });
    expect(naturalise(['GU', 'US'], 'FR')).toStrictEqual({ held: ['US', 'FR'], unsure: [] });
    expect(naturalise(['DE'], 'DE')).toStrictEqual({ held: ['DE'], unsure: [] });
    expect(naturalise([], 'GU')).toStrictEqual({ held: ['US'], unsure: [] });
    // Where no one is naturalised by residence, or a rule isn't kept, there's no answer.
    for (const [held, into] of [[['US'], 'SJ'], [['US'], 'CN'], [['US'], 'AQ'], [['AQ'], 'DE']] as const) expect(naturalise(held, into)).toBeUndefined();
  });

  it("tells the player what the game doesn't know", () => {
    expect([UNKEPT_LINE, NONE_LINE, KEEP_UNKNOWN_LINE]).toEqual(['citizenship.unkept', 'citizenship.none', 'citizenship.keep-unknown']);
    expect(aboutNaturalisation('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutNaturalisation('AQ')).toBe("How Antarctica naturalises, and whether its citizens keep its citizenship when they take another, aren't known to this game yet.");
    expect(aboutNaturalisation('CN')).toBe("China doesn't naturalise anyone on residence alone.");
    // A territory under a state that naturalises no one is named by its state; one whose residence doesn't count, by itself.
    expect(aboutNaturalisation('HK')).toBe(t(NONE_LINE, { country: 'China' }));
    expect(aboutNaturalisation('SJ')).toBe(t(NONE_LINE, { country: 'Svalbard and Jan Mayen' }));
    expect([aboutNaturalisation('DE'), aboutNaturalisation('GP')]).toEqual([undefined, undefined]);
    // The Maldives' renunciation isn't known, so every citizenship kept is unsure; San Marino's own loss rule isn't.
    const mv = naturalise(['FR', 'SM'], 'MV');
    expect(mv).toStrictEqual({ held: ['FR', 'SM', 'MV'], unsure: ['FR', 'SM'] });
    expect(naturalise(['FR', 'SM', 'JP'], 'DE')).toStrictEqual({ held: ['FR', 'SM', 'DE'], unsure: ['SM'] });
    expect(keepingUnknown(mv as NonNullable<typeof mv>)).toEqual([t(KEEP_UNKNOWN_LINE, { country: 'France' }), "Whether you'd keep your San Marino citizenship isn't known to this game yet."]);
    expect(keepingUnknown({ held: ['DE'], unsure: [] })).toEqual([]);
  });
});
