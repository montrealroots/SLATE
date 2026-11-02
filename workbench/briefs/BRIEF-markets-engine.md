# Brief: eighteen more markets in the actor's engine (2026-11-01)

The owner of SLATE: "add more markets." The actor's work (`src/person/acting/acting.ts`) books and pays parts only
under SAG-AFTRA (US), Pact/Equity and UK Theatre (UK) and ACTRA (Canada). The research is landed for eighteen more:
`research/sources/person/markets/<CC>.json` (AU BR DE DK ES FR IE IN IT JP KR MX NG NL NO NZ SE ZA), each cited by
register `person.markets.<CC>` with its SHA-256, and `person.markets.blocked.<CC>` (14 of them, each with notModeled
`acting.unkept`). The main law in CLAUDE.md binds every line; so do `workbench/briefs/BRIEF-identity-readers.md`'s
conventions. Read first, in full: CLAUDE.md; acting.ts and its tests; `research/sources/person/work/actor-calibration.json`
(how the three markets there were read); every market file; `src/person/permits/permits.ts` (`permitted`, which
acting.perform asks, and which needs `COUNTRY` per agreement); `src/person/unions/unions.ts`.

## What to build
- A compile (`tools/person/markets/{compile,build,coverage}.ts`, as tools/person/identity's, SHA-checked) to
  `src/person/acting/markets.json`: each market's agreements as the game's agreement ids, each with its country, the
  minimums it sets (by medium: film, television, stage; by role or tier where it distinguishes; per day, week, month,
  session or performance; the date each applies from; the currency), the market's language and the market's city's
  time zone; a market whose research says no agreement sets an actor's pay (`none`: South Africa, Nigeria, India,
  Japan's live action, Mexico beyond its broadcasters, New Zealand's screen, the Netherlands' screen) has pay left to
  negotiation (none, as the US Micro-Budget's is), never a made-up figure.
- acting.ts reads it: `Agreement` grows by the new ids; `scaleOf`, `pay`, `MARKET` (language and zone), `COUNTRY`,
  `partOf`'s checks and the breakdown's market language read the compiled data for them (the existing three stay as
  they are, from R-4614). A part's `term` gains what the new agreements pay by (session, month, performance) where the
  research gives it; refuse a term an agreement doesn't set.
- What isn't known is told: `aboutMarket(agreement)` fills `acting.unkept` with what's missing (from the blockers);
  test it.
- Coverage `coverage/markets-countries.json`: a row per market, researched or blocked as its register entries are,
  each citing them; every `person.markets.blocked.<CC>` cited.
- Tests: every rate exact from the research, every tier's edge, refusals, the existing tests green, a falsifier for any
  new command (there may be none). 100% mutation on acting.ts and the compile (configs `workbench/configs/
  {vitest,stryker}.markets.*`, own temp dir).
- Proposal at `/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad/readers/markets.json`
  (BRIEF-identity-readers.md's form: register for any game reading, e.g. how a medium or a role is chosen where an
  agreement distinguishes them, `operations`, `notModeled`). Do not edit shared files (research, register, registry,
  catalog, coverage other than your new matrix's build output, HANDOFF, git).
Report back in under 200 words.
