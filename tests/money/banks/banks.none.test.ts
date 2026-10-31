import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { aboutBanks, banksIn, hasNoBank, keepsBanks, NONE_LINE } from '../../../src/money/banks/banks.ts';
import { aboutFormats, accountNumber, keepsFormat } from '../../../src/money/formats/formats.ts';

/** A place with no bank of its own, held on the compiled form (the research's own lands with its sources). */
vi.mock('../../../src/money/banks/banks.json', () => ({ default: { countries: { PN: [], GB: [{ bank: 'Barclays', account: 'Bank Account', currency: 'GBP' }] } } }));

describe('a place with no bank', () => {
  it("has no bank to open an account at, and the player is told; its account numbers aren't missing, there are none", () => {
    expect([keepsBanks('PN'), banksIn('PN'), hasNoBank('PN'), hasNoBank('GB'), hasNoBank('AQ')]).toEqual([true, [], true, false, false]);
    expect(NONE_LINE).toBe('banks.none');
    expect(aboutBanks('PN')).toBe(t(NONE_LINE, { country: 'Pitcairn' }));
    expect(aboutBanks('PN')).toBe('Pitcairn has no bank of its own, so no account can be opened there.');
    expect([aboutBanks('GB'), aboutBanks('AQ')]).toEqual([undefined, "The banks of Antarctica aren't known to this game yet."]);
    // The formats say nothing of a place with no bank: there's no number to keep.
    expect([keepsFormat('PN'), accountNumber(1n, 'PN', 'x', 0), aboutFormats('PN')]).toEqual([false, undefined, undefined]);
    expect(aboutFormats('AQ')).toBe("How banks in Antarctica number their accounts isn't known to this game yet.");
  });
});
