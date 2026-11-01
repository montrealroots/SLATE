# Brief: every fee, wage and cost through the ledger, with each country's tax (2026-11-01)

The owner of SLATE: "Build those first 3 starting with ledger first", then "Start the ledger once the tax retry
lands." Today every money the person engines record is recorded and nothing is paid: an actor's pay
(`acting.ts` Work.pay), a script's fee and an option's (`career.ts`), a director's fee (`directing.ts`), a producer's
fee (`producing.ts`), a union's initiation and dues (`unions.ts`), a permit's fees (`permits.ts`), a headshot
session's price (`identity.ts`). The money layer is built: `src/money/ledger/ledger.ts` (double-entry `move`, world
accounts `world:<name>`), `src/money/accounts/accounts.ts` (accounts held at a bank, `account.pay` with the bank's
fees, the monthly kind), `src/money/rates` (the day's exchange rate), `src/money/cards`. The main law in CLAUDE.md
binds every line; so do `workbench/briefs/BRIEF-identity-readers.md`'s conventions. Read all of those, and the tax
research landed at `research/sources/money/tax/<CC>.json` (register `money.tax.<CC>`, blocked `money.tax.blocked.<CC>`,
21 countries; read every figure and blocker).

## What to build
- A tax engine (`src/money/tax`, compiled by `tools/money/tax/{compile,build,coverage}.ts`, SHA-checked as the papers'
  and markets' compiles): per country, the resident's brackets and allowance for each tax year read, the social
  contributions (employee, self-employed, the screen workers' own schemes), what is withheld at source from a resident's
  pay and from a freelancer's fee, the non-resident artiste's withholding (rate, base, threshold, final or not), any
  authors' treatment, VAT's threshold; the tax year's dates. Where a figure is blocked it isn't modeled and is told
  (a line proposed: `tax.unkept`), never invented.
- Pay into the ledger: each engine's money, when it is earned (a part played, a sale, a director's fee as the agreement
  pays it, a producer's fee, an option), is paid from the payer's world account into the person's account named for
  it (the work's `account` argument; refused where none is held or it can't take the currency: converted at the day's
  rate with the bank's fee where the account is in another currency), less what the work's country withholds at source
  (resident or non-resident, by the person's residence, which is where they live: where the person's residence is held,
  read it; until then, by citizenship, and say so in the register), the withheld part posted to that country's tax
  authority's world account and recorded as tax paid. Costs (a union's initiation and dues, a permit's fees, a
  headshot) are paid from the person's account the same way, refused where the balance can't cover them (or the account
  allows an overdraft, as its terms say).
- A tax year's reckoning (a scheduled kind at each country's year end, where the person is resident): the year's
  income taxed at the resident brackets less what was withheld, the balance due or refunded through the ledger on the
  return's due date; social contributions as the person's status there takes them. What the research doesn't give is
  not modeled and told.
- Each engine's existing "recorded, not paid" notes become the payment; every money a command records is now a posting;
  coverage `coverage/tax-countries.json` and an operations matrix; every blocked entry cited.
- Tests: every bracket, rate and threshold exact; each payment's legs exact (gross, withheld, net, the bank's fee and
  rate); refusals; determinism; a falsifier for every new command and kind; existing tests green (update them where a
  command now pays); 100% mutation on every file you own or touch (configs `workbench/configs/{vitest,stryker}.tax.*`
  and the touched engines' own).
- Proposal at `/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad/readers/ledger.json` in
  BRIEF-identity-readers.md's form (effects for every new command and kind, the commands' new reads and writes, register
  for the game's readings, catalog lines proposed, what isn't modeled). Do not edit shared files (research, register,
  registry, catalog, HANDOFF, git).
Report back in under 200 words.
