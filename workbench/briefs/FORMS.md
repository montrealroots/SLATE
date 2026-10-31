# The forms layer 3 grows (the lead's spec, 2026-10-30)

The owner's rulings of 2026-10-30 (HANDOFF.md, "Next step"): papers a life holds (passport and ID, national number,
residence permits, driving licence or state ID as photo ID), account formats built with transfers, the family's money
read as the liquid share with debt kept, all in layer 3 now. The audits are in this folder (`core.md`, `world.md`,
`papers.md`, `money.md`). This file says the research form each engine grows, so research can follow it. Every new key
is optional unless said, so every file already written still compiles; a term a source doesn't state is left out,
never guessed, and the note says so.

## How a form is built (every coding subagent)

Follow the pattern of the engine's existing `tools/<...>/compile.ts`: each key validated with an error that names the
file and the key (tests assert the error text); nothing else accepted (`nothingElse` / a TERMS list); amounts through
`fromMajor` in the currency's major units; shares as decimal strings (`percent`); periods from a closed list; the
compiled JSON typed in `src/<...>/<engine>.ts` with a doc comment per field; tests in `tests/tools/<engine>.test.ts`
(every accept and every refusal) and `tests/<...>/<engine>.test.ts` (the engine's reads); 100% mutation on every line
changed (`npx stryker run --mutate "<file>:<a>-<b>" --reporters clear-text`; copy `reports/mutation/mutation.json`
aside first and restore it after; `// Stryker disable next-line <Mutator>: reason` only for a true equivalent).
Comments in the project's voice: what was decided and why. A new engine has `tools/<...>/{compile,coverage,build}.ts`,
its coverage matrix by country (researched, blocked with the five methods, proven where no one lives; the existing
`coverage.ts` files are the model), `src/<...>/<engine>.ts` with its lookups and an `about...` line for what the game
doesn't know (`UNKEPT_LINE`), and a `*.places.test.ts` over every place. Don't edit the shared files
(`registry/engines.json`, `src/core/text/catalog.json`, `gate/`, `research/register.json`, `HANDOFF.md`): report the
lines to add (the engine's registry entry, each catalog line with its text and `where`) and the lead adds them.

## money.banks (extended; `tools/money/banks/compile.ts`)

Each bank's everyday account may also give:

- `overdraft`: `false` where the account can't go below nothing (a payment past the balance is refused), or
  `{ rate?: {percent, per: 'year'|'month'}, fee?: amount (each item paid into overdraft), monthly?: amount (each
  month spent overdrawn), limit?: amount (where the bank sets one for every holder) }`.
- `returned`: amount, the fee for a payment refused for want of funds.
- `interest`: `{ percent, per: 'year'|'month', over?: amount }`, what the bank pays on the account's balance (above a
  figure where it says so).
- `debit`: `{ fee?: {fee, per}, fx?: percent }`, the debit card's own fee and its share on spending in another currency.
- `atm`: `{ own?: amount, other?: amount, abroad?: charge }` per withdrawal (own bank's machines, another bank's at
  home, abroad).
- `transfers`: `{ domestic?: amount, abroad?: charge }` per transfer sent.
- `opening`: `{ deposit?: amount, from?: age, residents?: true, papers?: ('passport'|'id'|'number'|'residence'|'address')[] }`:
  what opening the account asks.
- `savings`: `{ account: name, interest: {percent, per, over?}, fees?: Fee[], minimum?: amount }`: the bank's savings
  account for individuals.
- Waivers gain `{ first: n }` (the first n periods free).

A `charge` is the cards form's: `{ percent?, fixed?, min?, max? }` (import it from `tools/money/cards/compile.ts`).

## money.formats (new; `tools/money/formats/`)

The account number each country's banks give, from SWIFT's IBAN Registry (the primary source for IBAN countries; its
text release, fetched and vendored with its date) and the central bank's or bankers' association's own page elsewhere.
Per country: `{ country, iban?: { length, bban: '<the registry's BBAN structure, e.g. 4!a6!n8!n>', bank: [from, to],
branch?: [from, to], check?: '<national check algorithm id>' }, national?: { name, parts: [{ name, length, kind:
'n'|'a'|'c' }], check?: '<algorithm id>' }, note, sources }`. The engine: draws a new account's number for a bank of
the country (digits from the life's seed through a registered decider), computes the IBAN's two check digits (ISO
13616, mod 97-10) and any national check algorithm the research names and the code implements (ABA routing, the UK's
modulus checking is out unless its spec is read, France's RIB key, Spain's CCC, Mexico's CLABE, Italy's CIN, Belgium's
mod 97, and others as the research names them), and validates a payee's number for a transfer.

## papers.passports (extended)

Per route: `renewal?: true` (the route renews a passport held, as the US's DS-82 by mail) and the bands' `pay` by such
routes; `replacement?: true` (a lost or stolen passport replaced) with its own `pay`; per file `abroad?: { currency,
pay by band }` where the consulate's fee is set in the host's or another currency; `card?: { name, validYears, pay }`
where a passport card is issued (the US's). Keep `within` per route.

## papers.ids (extended)

`must?: age` (from which a card must be held), `from?: age` (the youngest it's issued to), `travel?: string[]` (the
group or countries where it serves as a travel document: 'EU/EEA', 'GCC', 'Mercosur', 'ECOWAS', or ISO codes),
`renewal?` and `replacement?` with their fees and times; `issuers?` by first-level region where a region issues its own
(the US's states' ID cards: those go to papers.licence below).

## papers.citizenship (extended)

`atBirth: { soil: 'unconditional' | 'conditional' | 'none', soilIf?: string (the condition as the law states it),
descent: 'either parent' | 'father' | 'none', descentAbroad?: string }`: how citizenship comes at birth, which layer 4's
Citizenship field reads from the place of birth and the parents. And `fee?`, `within?` and `test?` for naturalisation.

## papers.numbers (new; `tools/papers/numbers/`)

The national number a person is given (the US Social Security number, the UK's National Insurance number, Canada's
SIN, Brazil's CPF, ...): `{ country, name (as the government names it), issuer, format: { length, pattern (regex),
check?: algorithm id }, when: 'birth' | 'registration' | 'application' | 'work', from?: age, who: ('citizens' |
'residents' | 'workers' | 'anyone')[], fee?, within?: {n, unit}, needed?: ('work' | 'bank' | 'pay' | 'tax' |
'health')[], note, sources }` or `none: true` where the law shows none is given. The engine: the number a life holds
(drawn in format, check digit computed where named) and whether a purpose needs one.

## papers.residence (new; `tools/papers/residence/`)

Living somewhere as a non-citizen: `{ country, routes: [{ id, name (as named), for: 'work' | 'self-employed' |
'talent' | 'family' | 'study' | 'means' | 'retirement' | 'permanent' | 'free movement', apply: 'abroad' | 'in country' |
'either', fee?: amount, within?: {n, unit}, term?: {n, unit}, renewable?: true, work: 'any' | 'sponsor' | 'none',
counts?: true (counts toward naturalisation's years), permanentAfter?: years, groups?: string[] (free movement: the
groups whose citizens it is for) }], note, sources }`. The routes a performer could use first (work, self-employed or
talent, free movement, permanent), then family and means.

## papers.licence (new; `tools/papers/licence/`)

The driving licence and the identity card a licensing office issues, as photo ID (nothing drives): per country, and per
first-level region where regions issue their own (the US's states and DC, Canada's provinces, Australia's states):
`{ country, region?, issuer, licence?: { name, from: age (a full licence), fee, validYears }, card?: { name (the state
ID card), from?: age, fee, validYears }, exchange?: string[] (licences it exchanges without a test), note, sources }`.

## money.means (re-read)

Per country the band's liquid share: `{ liquid: { p0p20 ... p99p100 } as shares of net wealth or as amounts, source }`
from a central bank's or statistics office's household wealth survey (the US's SCF, the euro area's HFCS, the UK's WAS,
...), else a blocker; a band's negative net wealth starts the life with that debt (owed to the family, the game's
reading, said so).
