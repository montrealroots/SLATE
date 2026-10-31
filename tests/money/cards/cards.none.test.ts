import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { aboutCards, cardsIn, hasNoCard, keepsCards, NONE_LINE, UNKEPT_LINE } from '../../../src/money/cards/cards.ts';

/**
 * A place where no bank offers a card, and one with no bank at all, held on the compiled forms (the research's own land
 * with their sources): the Falklands with no card, Pitcairn with no bank, Britain with both.
 */
vi.mock('../../../src/money/cards/cards.json', () => ({ default: { countries: { FK: [], GB: [{ bank: 'Barclays', card: 'Barclaycard', currency: 'GBP', rate: 'in full', fees: [] }] } } }));
vi.mock('../../../src/money/banks/banks.json', () => ({ default: { countries: { PN: [], FK: [{ bank: 'Standard Chartered', account: 'Current Account', currency: 'FKP' }], GB: [{ bank: 'Barclays', account: 'Bank Account', currency: 'GBP' }] } } }));

describe('a place where no bank offers a card', () => {
  it('has none to take out, and the player is told', () => {
    expect([keepsCards('FK'), cardsIn('FK'), hasNoCard('FK'), hasNoCard('PN'), hasNoCard('GB'), hasNoCard('AQ')]).toEqual([true, [], true, true, false, false]);
    expect(NONE_LINE).toBe('cards.none');
    expect(aboutCards('FK')).toBe(t(NONE_LINE, { country: 'Falkland Islands' }));
    expect(aboutCards('FK')).toBe('No bank in Falkland Islands offers a credit card, so none can be taken out there.');
    // No bank at all is no card either; a place whose cards the game doesn't keep is told so; one with cards, nothing.
    expect(aboutCards('PN')).toBe('No bank in Pitcairn offers a credit card, so none can be taken out there.');
    expect([aboutCards('GB'), aboutCards('AQ')]).toEqual([undefined, t(UNKEPT_LINE, { country: 'Antarctica' })]);
  });
});
