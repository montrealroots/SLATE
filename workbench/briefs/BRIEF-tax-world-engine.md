# Brief: the tax engine reads every country (2026-11-01)

The owner of SLATE, of the tax research covering 21 countries: "It should cover across every country so I have no
clue what stopped that from happening"; then "Retry the blocked tax facts once all countries land." All 252 are
researched and retried, and the lead has landed them in the working tree (uncommitted until the engine reads them,
since the gate holds every file to its compile and every blocker to a coverage row): `research/sources/money/tax/<CC>.json`
for 231 more countries, and CA, JP, US and AU re-landed with their quotes fixed (their figures may have moved: check
every reading of theirs); register `money.tax.<CC>` and `money.tax.blocked.<CC>` (notModeled `tax.unkept`). Read
`BRIEF-ledger.md` (what the engine was built to), `tools/money/tax/*` (the compile, the readings map, coverage),
`src/money/tax/tax.ts`, and a dozen of the new files of different kinds (a large economy, a territory that follows its
sovereign, a country with no income tax, a blocker-only file) before writing a line. The main law in CLAUDE.md binds
every line; so do `BRIEF-identity-readers.md`'s conventions.

## What to build
- The readings map (`tools/money/tax/readings.json`) reads every country's file: the resident's scale and allowance
  by year, social contributions, withholding from a resident's and a non-resident's pay of each kind of work, an
  author's treatment, VAT's rate and threshold, the tax year and the return's due date, from the research's values at
  their place; what a file doesn't give is `unknown`, told by `tax.unkept`, never invented.
- The shapes the 21 didn't need, each read from what the research says, not assumed: a country with no personal
  income tax (the research's own statement read as a scale of none, not as missing); a territory whose tax is its
  sovereign's or its own as its file's sources say (a `follows` finding read as the sovereign's figures only where the
  source says the sovereign's law applies there; where the territory's own law sets a rate, its own); flat taxes;
  surtaxes and solidarity levies; a gross-receipts or turnover tax where the research gives it for the self-employed;
  conflicts the research records (two readings in a blocker): not modeled, told.
- Coverage `coverage/tax-countries.json`: every one of the 252 researched or blocked as its register entries are, none
  pending where research exists; every blocked entry cited.
- Tests: every figure exact (generated tests over the compiled file may assert each against the research's value at
  its place), each new shape held by a country's case, pay and the year's reckoning in several new countries
  (a no-tax country, a follower, a flat tax, a progressive scale with social caps), determinism; existing tests green;
  100% mutation on every file you touch (`workbench/configs/{vitest,stryker}.tax.*`, own temp dir). Never
  `pkill -f "stryker run"`.
- Proposal at `$S/readers/tax-world.json` (S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad)
  in BRIEF-identity-readers.md's form: what each new shape reads, every figure not read and why, catalog lines needed.
  Use Node 22.22.0 first on PATH (`PATH=/opt/node22220/node-v22.22.0-linux-x64/bin:$PATH`). Other agents are editing
  the four role engines' markets at the same time: touch none of `tools/person/*` or `src/person/*`; run your own
  configs, not the whole gate (the lead runs it). Do not edit research, the register, the registry's other engines,
  the catalog, HANDOFF or git.
Report back in under 200 words.
