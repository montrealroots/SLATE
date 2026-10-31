import { describe, expect, it } from 'vitest';
import { readsAsProse, titleCaseLabel, titleCaseWord } from '../../../src/core/text/case.ts';

describe('a label', () => {
  it('starts every word with a capital, small words included', () => {
    expect(titleCaseLabel('skip to event')).toBe('Skip To Event');
    expect(titleCaseLabel('Skip to Event')).toBe('Skip To Event');
    expect(titleCaseLabel('Delete slot 1')).toBe('Delete Slot 1');
    expect(titleCaseLabel('same as your place of birth')).toBe('Same As Your Place Of Birth');
    expect(titleCaseLabel('add a language')).toBe('Add A Language');
    expect(titleCaseLabel('Rent — 3405 Rosemont Road due')).toBe('Rent — 3405 Rosemont Road Due');
  });
  it('keeps every space as written', () => {
    expect(titleCaseLabel('  new   day ')).toBe('  New   Day ');
    expect(titleCaseLabel('new\tday')).toBe('New\tDay');
  });
  it('capitalises a letter of any script, past a leading bracket or quote', () => {
    expect(titleCaseLabel('île de la cité')).toBe('Île De La Cité');
    expect(titleCaseLabel('(new) "draft" ¿qué')).toBe('(New) "Draft" ¿Qué');
    expect(titleCaseLabel('évora ändern')).toBe('Évora Ändern');
  });
  it('leaves a word with no lower-case letter: an acronym, a symbol, a number', () => {
    expect(titleCaseLabel('USA tour')).toBe('USA Tour');
    expect(titleCaseLabel('3D glasses')).toBe('3D Glasses');
    expect(titleCaseLabel('£ — 250')).toBe('£ — 250');
    expect(titleCaseLabel('東京 office')).toBe('東京 Office');
  });
  it('leaves a word with a capital past its first letter', () => {
    expect(titleCaseLabel('LA office')).toBe('LA Office');
    expect(titleCaseLabel('VFX and P&L')).toBe('VFX And P&L');
    expect(titleCaseLabel('iPhone budget')).toBe('iPhone Budget');
    expect(titleCaseLabel('McKinsey report')).toBe('McKinsey Report');
    expect(titleCaseLabel('tvN drama')).toBe('tvN Drama');
    expect(titleCaseLabel('éCole')).toBe('éCole');
  });
  it('leaves a word that starts with a digit, in any script', () => {
    expect(titleCaseLabel('97th awards')).toBe('97th Awards');
    expect(titleCaseLabel('$250m greenlight')).toBe('$250m Greenlight');
    expect(titleCaseLabel('(2nd) take')).toBe('(2nd) Take');
    expect(titleCaseLabel('٣rd round')).toBe('٣rd Round');
  });
  it('leaves a slot for a value as written', () => {
    expect(titleCaseLabel('delete slot {slot}')).toBe('Delete Slot {slot}');
    expect(titleCaseLabel("{country}'s holidays")).toBe("{country}'s Holidays");
    expect(titleCaseLabel('trip to {place}')).toBe('Trip To {place}');
  });
  it('is idempotent', () => {
    for (const label of ['skip to event', 'LA office', 'île de la cité', '97th awards', 'trip to {place}']) {
      expect(titleCaseLabel(titleCaseLabel(label))).toBe(titleCaseLabel(label));
    }
  });
});

describe('one word', () => {
  it('is capitalised, or left as spelled on purpose', () => {
    expect(titleCaseWord('the')).toBe('The');
    expect(titleCaseWord('a')).toBe('A');
    expect(titleCaseWord('"of')).toBe('"Of');
    expect(titleCaseWord('S.A.')).toBe('S.A.');
    expect(titleCaseWord('inc.')).toBe('Inc.');
    expect(titleCaseWord('dm')).toBe('Dm');
    expect(titleCaseWord('iRobot')).toBe('iRobot');
    expect(titleCaseWord('600d')).toBe('600d');
    expect(titleCaseWord('{name}')).toBe('{name}');
    expect(titleCaseWord('a{b}')).toBe('a{b}');
    expect(titleCaseWord('')).toBe('');
  });
});

describe('prose', () => {
  it('is a sentence: anything ending in a full stop, a question mark or an exclamation mark', () => {
    for (const prose of ['You were too exhausted to work.', 'Why did I not get the part?', 'Delete slot 1?', 'Go!', 'They accepted it. The air cleared.', 'done.  ']) {
      expect(readsAsProse(prose), prose).toBe(true);
      expect(titleCaseLabel(prose), prose).toBe(prose);
    }
  });
  it('is anything longer than nine words, and nine words is still a label', () => {
    const ten = 'no bills overdue no offers expiring no conflicts on the';
    expect(readsAsProse(ten)).toBe(true);
    expect(titleCaseLabel(ten)).toBe(ten);
    const nine = 'no bills overdue no offers expiring no conflicts on';
    expect(readsAsProse(nine)).toBe(false);
    expect(titleCaseLabel(nine)).toBe('No Bills Overdue No Offers Expiring No Conflicts On');
    expect(readsAsProse('  one   two  ')).toBe(false);
    expect(readsAsProse('one  two  three  four  five  six  seven  eight  nine')).toBe(false);
  });
  it('is nothing at all, so an empty string is never a label', () => {
    expect(readsAsProse('')).toBe(true);
    expect(readsAsProse('   ')).toBe(true);
    expect(titleCaseLabel('')).toBe('');
    expect(titleCaseLabel('   ')).toBe('   ');
  });
  it('ends at its last mark, not one before it', () => {
    expect(readsAsProse('Mr. Smith')).toBe(false);
    expect(readsAsProse('what? now')).toBe(false);
    expect(titleCaseLabel('mr. smith')).toBe('Mr. Smith');
  });
});
