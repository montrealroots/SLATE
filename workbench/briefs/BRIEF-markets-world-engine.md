# Brief: every country's market in the four role engines (2026-11-01)

The owner of SLATE, of the markets beyond the 21 researched: "Want it done now", and of every engine that reads a
country: it covers all 252 of the map's countries and territories. The research is landed in the working tree (the
lead holds it uncommitted until your engine reads it; the gate goes red on a blocker no coverage row cites):
`research/sources/person/markets/<CC>.json` (the actor's, with the country's `language`, `market`, and where a
territory's status is researched `status`/`follows`/`successors`) and `<role>-<CC>.json` for the writer, the director
and the producer, for 231 more countries; register `person.markets[.<role>].<CC>` and, where blocked,
`person.markets[.<role>].blocked.<CC>` (notModeled `acting.unkept`, `writing.unkept`, `directing.unkept`,
`producing.unkept`). Item names are the role's own after its prefix (`rates`, `agreements`, `union`, `fees`, `terms`,
`fund`, `incentive`, `outcomes`, `feecap`, `rules`, `none` with `value.role`). Read `BRIEF-markets-engine.md` and
`BRIEF-roles-markets-engine.md` (what the 21 were built to), `tools/person/markets*/*`, each engine's use of its
`markets.json` (`src/person/{acting,work,directing,producing}`), and two or three of the new files of each kind before
writing a line. The main law in CLAUDE.md binds every line; so do `BRIEF-identity-readers.md`'s conventions.

## What to build
- Each role's compile reads every country's file it can: every figure the engine can use (a minimum, a fee by form,
  tier and term, a fund's share and cap, an incentive's rate, base and cap, a union's dues and joining terms, a fee
  cap), from the research's own values at their place, held by the readings map; a figure the research gives in a
  shape the engine can't read is listed in the proposal, not forced. A `none` is the market leaving the term to
  negotiation, never a made-up figure. A national minimum wage the research gives as the floor of a performer's or
  author's pay is read as that floor where the research's source says it applies to them (Andorra's Llei 46/2022, for
  one), not elsewhere.
- Coverage: each role's matrix has a row for every one of the 252 countries (the gazetteer's), researched or blocked as
  its register entries are, each citing them; a country with neither is pending; every blocked entry cited. A
  country whose engine market isn't compiled still tells the player what isn't known (`aboutMarket` from the blockers).
- The engines: a work in any compiled market is paid and refused by that market's terms, as the 21 are; the
  engagement's country and days stay exported for the permits (do not edit `src/person/permits/*`).
- Tests: every figure exact (generated tests over the compiled file are fine where each asserts the research's value
  at its place), every tier's edge in the new markets, refusals, the all-countries universe, existing tests green;
  100% mutation on every file you touch (each engine's own configs and temp dirs). Never `pkill -f "stryker run"`.
- Proposal at `$S/readers/markets-world.json` (S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad)
  in BRIEF-identity-readers.md's form, with what isn't read and why. Run `npm run gate:write` then `npm run gate` with
  Node 22.22.0 first on PATH (`PATH=/opt/node22220/node-v22.22.0-linux-x64/bin:$PATH`) and report its last lines.
  Do not edit research, the register, the registry's other engines, the catalog, HANDOFF or git.
Report back in under 200 words.

## Split (the lead, 2026-11-01)
Four agents build this at once, one per role, each owning only its own compile (`tools/person/markets` for the actor,
`tools/person/markets-<role>` for the others), its engine's `markets.json` and code (`src/person/acting`,
`src/person/work`, `src/person/directing`, `src/person/producing`), their tests and configs; the proposal is
`$S/readers/markets-world-<role>.json`. Another agent is extending the tax engine at the same time. Run your own
configs and mutation, not the whole gate (the lead runs it); read the others' files, never edit them; where your
engine needs a change in a shared file (`src/person/identity`, `src/person/unions`, `src/person/permits`, the
registry), put it in the proposal.
