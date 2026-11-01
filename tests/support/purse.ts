import { money, type CurrencyCode } from '../../src/core/money/money.ts';
import type { AccountsSlice, Opened } from '../../src/money/accounts/accounts.ts';
import type { Bank } from '../../src/money/banks/banks.ts';
import { accountOf, balance, move, open, type LedgerSlice } from '../../src/money/ledger/ledger.ts';
import { TAX_START, type TaxSlice } from '../../src/money/tax/tax.ts';

/** The account a purse holds. */
export const ACCOUNT = 'everyday:1';

/** A bank's account that costs nothing and can't be overdrawn, in a currency, with any other terms. */
export const bank = (currency: string, over: Partial<Bank> = {}): Bank => ({ bank: 'Test Bank', account: 'Everyday', currency, fees: [], overdraft: false, ...over });

/** The money slices of a life holding one account, opened at the epoch with so much in it from the family. */
export function purse(currency = 'USD', minor = 100_000_000, terms: Bank = bank(currency)): { accounts: AccountsSlice; ledger: LedgerSlice; tax: TaxSlice } {
  const ledger: LedgerSlice = { accounts: [], next: 1 };
  open(ledger, ACCOUNT, currency as CurrencyCode, 0);
  if (minor > 0) move(ledger, 0, 'the family', [{ account: 'world:family', amount: money(currency as CurrencyCode, -minor) }, { account: ACCOUNT, amount: money(currency as CurrencyCode, minor) }]);
  const held: Opened = { id: ACCOUNT, country: 'US', bank: terms.bank, account: terms.account, kind: 'everyday', currency, opened: 0, terms, months: 0, born: '2000-06-14', zone: 'America/Los_Angeles', national: true };
  return { accounts: { held: [held] }, ledger, tax: structuredClone(TAX_START) };
}

/** An account's balance in a life's ledger, in minor units, by its id (a world account's with its currency: `world:tax:US:USD`). */
export const minorIn = (ledger: LedgerSlice, id: string): number => balance(accountOf(ledger, id)).minor;
