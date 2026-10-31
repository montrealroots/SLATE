import { describe, expect, it } from 'vitest';
import { JOINING_WORDS, checkTitleCase } from '../checks/title-case.ts';
import { all, fixture } from './fixture.ts';

const N = 'registry/names.json';
const C = 'src/core/text/catalog.json';
const line = (text: string) => ({ text, where: 'The slots screen', status: 'placeholder' });
const names = (over: Record<string, unknown> = {}) => ({ source: 'the rule', asWritten: [], shownAsLabels: [], ...over });
const check = (catalog: unknown, n: unknown = names(), files: Record<string, unknown> = {}) => checkTitleCase(fixture({ [N]: n, [C]: catalog, ...files }).repo);
const findings = (catalog: unknown, n?: unknown, files?: Record<string, unknown>) => all(check(catalog, n, files));
const pgaName = { name: 'The Producers Guild of America Awards', why: 'as the Guild writes it' };

describe('the title-case check', () => {
  it('passes Title Case labels and leaves prose alone, and counts both', () => {
    const r = check({ 'a.skip': line('Skip To Event'), 'a.body': line('nobody here yet.'), 'a.ask': line('delete slot 1?'), 'a.long': line('one two three four five six seven eight nine ten') });
    expect(all(r)).toEqual([]);
    expect(r.check).toBe('title-case');
    expect(r.notes).toEqual(['1 labels and 3 lines of prose in the catalog; 0 names shown as labels from 0 registries']);
  });
  it('fails a label that is not Title Case, naming the line and the text it should be', () => {
    expect(findings({ 'slots.delete': line('Delete slot 1') })).toEqual([`red ${C} slots.delete | a label is Title Case: "Delete Slot 1", not "Delete slot 1"`]);
    expect(findings({ 'a.b': line('Skip to Event') })).toEqual([`red ${C} a.b | a label is Title Case: "Skip To Event", not "Skip to Event"`]);
  });
  it('holds the exceptions: acronyms, inner capitals, digits first and slots for values', () => {
    expect(findings({ 'a.b': line('USA Tour'), 'a.c': line('McKinsey And iPhone'), 'a.d': line('97th Awards'), 'a.e': line('Trip To {place}'), 'a.f': line('3D P&L'), 'a.g': line('Rock--n--Roll') })).toEqual([]);
  });
  it('holds nothing when the catalog is missing or unreadable, which text-inventory reports', () => {
    expect(all(checkTitleCase(fixture({ [N]: names() }).repo))).toEqual([]);
    expect(findings([line('delete slot')])).toEqual([]);
    expect(findings({ 'a.b': 'delete slot', 'a.c': { text: 3 }, 'a.d': line('Delete Slot') })).toEqual([]);
  });

  it("keeps a listed real name as its owner spells it, inside a label and alone, and nowhere it isn't whole", () => {
    const n = names({ asWritten: [pgaName, { name: 'dm', why: 'the shopfront' }] });
    expect(findings({ 'a.b': line('The Producers Guild of America Awards'), 'a.c': line('Nominated At The Producers Guild of America Awards'), 'a.d': line('Shop At dm') }, n)).toEqual([]);
    expect(findings({ 'a.b': line('Nominated at The Producers Guild of America Awards'), 'a.d': line('Shop At dm') }, n)).toEqual([
      `red ${C} a.b | a label is Title Case: "Nominated At The Producers Guild of America Awards", not "Nominated at The Producers Guild of America Awards"`,
    ]);
    // Not a listed name: the Guild's name in another case, and "dm" inside a longer word.
    expect(findings({ 'a.b': line('the Producers Guild of America Awards'), 'a.d': line('Shop At dm'), 'a.e': line('admin dmx') }, n)).toEqual([
      `red ${C} a.b | a label is Title Case: "The Producers Guild Of America Awards", not "the Producers Guild of America Awards"`,
      `red ${C} a.e | a label is Title Case: "Admin Dmx", not "admin dmx"`,
      `red ${N} asWritten 0 | no label or name shown says "The Producers Guild of America Awards", so it's no exception`,
    ]);
  });
  it('finds a listed name with any character in it, taken as itself', () => {
    const n = names({ asWritten: [{ name: 'e.l.f. Cosmetics', why: 'as the brand writes it' }] });
    expect(findings({ 'a.b': line('Shop At e.l.f. Cosmetics') }, n)).toEqual([]);
    expect(findings({ 'a.b': line('Shop At e.l.f. Cosmetics'), 'a.c': line('Shop At exlxfx Cosmetics') }, n)).toEqual([
      `red ${C} a.c | a label is Title Case: "Shop At Exlxfx Cosmetics", not "Shop At exlxfx Cosmetics"`,
    ]);
  });
  it('prefers the longer of two listed names that overlap', () => {
    const n = names({ asWritten: [{ name: 'Pick n', why: 'x' }, { name: 'Pick n Pay', why: 'the sign' }] });
    expect(findings({ 'a.b': line('Pick n Pay'), 'a.c': line('Pick n') }, n)).toEqual([]);
    expect(findings({ 'a.b': line('Pick n Pay') }, n)).toEqual([`red ${N} asWritten 0 | no label or name shown says "Pick n", so it's no exception`]);
  });
  it('fails an exception that is malformed, already Title Case, or shown nowhere', () => {
    const n = names({ asWritten: [{ name: 'Pick n Pay' }, { why: 'x' }, 'dm', { name: ' ', why: 'x' }, { name: 'x', why: ' ' }, { name: 'The Globe And Mail', why: 'x' }, { name: 'Banco S.A.', why: 'x' }, pgaName] });
    expect(findings({ 'a.b': line('Banco S.A.') }, n)).toEqual([
      ...[0, 1, 2, 3, 4].map((i) => `red ${N} asWritten ${i} | a name as its owner writes it needs "name" and "why"`),
      `red ${N} asWritten 5 | "The Globe And Mail" is already Title Case, so it's no exception`,
      `red ${N} asWritten 6 | "Banco S.A." is already Title Case, so it's no exception`,
      `red ${N} asWritten 7 | no label or name shown says "The Producers Guild of America Awards", so it's no exception`,
    ]);
  });
  it('fails a names file that is missing, unreadable or incomplete, and holds nothing else', () => {
    const bad = { 'a.b': line('delete slot') };
    expect(all(checkTitleCase(fixture({ [C]: bad }).repo))).toEqual([`red ${N} | ${N} is missing`]);
    expect(all(checkTitleCase(fixture({ [N]: '{', [C]: bad }).repo))[0]).toMatch(new RegExp(`^red ${N} \\| ${N} is not valid JSON`));
    const shape = `red ${N} | the names need a "source", an "asWritten" list and a "shownAsLabels" list`;
    for (const n of [null, [], names({ source: ' ' }), names({ source: undefined }), names({ asWritten: {} }), names({ shownAsLabels: 'x' })]) expect(findings(bad, n)).toEqual([shape]);
  });

  describe('the names a registry shows as labels', () => {
    const reg = 'src/world/x/banks.json';
    const shown = (data: unknown, over: Record<string, unknown> = {}) => findings({}, names({ shownAsLabels: [{ file: reg, key: 'name' }], ...over }), { [reg]: data });
    it('passes real names, joining words lower case inside them, wherever the key sits', () => {
      const data = { name: 'Bank of America', banks: [{ name: 'Banque Internationale à Luxembourg' }, { id: 'x', nested: { name: 'Banco de la Nación S.A.' } }], other: 'lower case', code: { name: 3 } };
      expect(shown(data)).toEqual([]);
      const r = checkTitleCase(fixture({ [N]: names({ shownAsLabels: [{ file: reg, key: 'name' }] }), [reg]: data }).repo);
      expect(r.notes).toEqual(['0 labels and 0 lines of prose in the catalog; 3 names shown as labels from 1 registries']);
    });
    it('fails a name not in Title Case, with its place in the file and what it should be', () => {
      expect(shown({ banks: [{ name: 'the bank of nowhere' }], top: { name: 'of Lisbon' } })).toEqual([
        `red ${reg} banks[0].name | a name shown as a label is Title Case, but for the joining words inside it: "The Bank of Nowhere", not "the bank of nowhere"`,
        `red ${reg} top.name | a name shown as a label is Title Case, but for the joining words inside it: "Of Lisbon", not "of Lisbon"`,
      ]);
      expect(shown([{ name: 'acme inc.' }])).toEqual([`red ${reg} [0].name | a name shown as a label is Title Case, but for the joining words inside it: "Acme Inc.", not "acme inc."`]);
      expect(shown({ name: 'Cum Laude cum Honours' })).toEqual([`red ${reg} name | a name shown as a label is Title Case, but for the joining words inside it: "Cum Laude Cum Honours", not "Cum Laude cum Honours"`]);
    });
    it('keeps a listed real name whole, as its owner writes it', () => {
      expect(shown({ list: [{ name: 'Pick n Pay' }, { name: 'dm' }] }, { asWritten: [{ name: 'Pick n Pay', why: 'the sign' }, { name: 'dm', why: 'the shopfront' }] })).toEqual([]);
    });
    it('fails a registry entry that is malformed, unreadable or names nothing', () => {
      const r = (s: unknown[], files: Record<string, unknown> = {}) => findings({}, names({ shownAsLabels: s }), files);
      expect(r([{ file: reg }, { key: 'name' }, 'x', { file: ' ', key: 'name' }, { file: reg, key: ' ' }])).toEqual(
        [0, 1, 2, 3, 4].map((i) => `red ${N} shownAsLabels ${i} | a registry shown as labels needs its "file" and the "key" its names sit under`),
      );
      expect(r([{ file: reg, key: 'name' }])).toEqual([`red ${N} shownAsLabels 0 | ${reg} is missing`]);
      expect(r([{ file: reg, key: 'name' }], { [reg]: { title: 'x', name: ['x'] } })).toEqual([`red ${N} shownAsLabels 0 | ${reg} has no name under "name"`]);
    });
  });

  it("keeps 1221's joining words", () => {
    expect([...JOINING_WORDS]).toEqual(['a', 'an', 'and', 'at', 'by', 'de', 'del', 'della', 'alla', 'di', 'da', 'du', 'for', 'from', 'in', 'la', 'le', 'of', 'on', 'or', 'the', 'to', 'van', 'von', 'with', 'bin', 'al', 'à']);
  });
});
