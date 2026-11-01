# Brief: the writer's, director's and producer's markets in their engines (2026-11-01)

The owner of SLATE: "Now add markets for writers, directors and producers." The research is landed:
`research/sources/person/markets/<role>-<CC>.json` (role writer, director, producer; 20 countries each), cited by
register `person.markets.<role>.<CC>` and, where blocked, `person.markets.<role>.blocked.<CC>` (each with notModeled
`work.unkept`, `directing.unkept` or `producing.unkept`, lines now in the catalog). The actor's markets show how it is
done: read `workbench/briefs/BRIEF-markets-engine.md`, `tools/person/markets/*` (its compile, readings map and
coverage) and `src/person/acting/acting.ts`'s use of `markets.json`. The main law in CLAUDE.md binds every line;
so do `workbench/briefs/BRIEF-identity-readers.md`'s conventions. Your prompt names your role and the files you own.

## What to build, for your role
- A compile (`tools/person/markets-<role>/{compile,build,coverage}.ts`, SHA-checked as the actor's) to
  `src/person/<engine dir>/markets.json`: per country, what the research gives that the engine can read (writer:
  the minimum fees by form and budget tier, option terms, step payments; director: the minimum fees by form and tier,
  guaranteed prep, shoot and cut periods, cut rights; producer: the fund(s) with share, cap and selection rate, the
  incentive's rate, base and cap, fee and overhead caps, release and earn-back rates by budget). A country whose
  research says no agreement sets the pay leaves it to negotiation (none), never a made-up figure. Every figure exact,
  held by test, from the research's own values.
- The engine reads it: the work (a script sold, a film or an episode directed, a project produced) is in a market
  (the existing US/UK terms stay as they are, from R-4608, R-4613, R-4612), its pay, periods, funding and incentives
  are that market's; refuse what a market doesn't set. Where a market's language matters to the work (a script
  written in the market's language: identity's `speaks`), read it.
- What isn't known is told: `aboutMarket(...)` fills the role's `*.unkept` line from the blockers; tested.
- Coverage `coverage/markets-<role>-countries.json`: a row per country, researched or blocked as its register entries
  are, each citing them; every blocked entry cited.
- Tests: every figure exact, every tier's edge, refusals, existing tests green, a falsifier for any new command; 100%
  mutation on every file you own (`workbench/configs/{vitest,stryker}.markets-<role>.*`, own temp dir).
- Do not edit `src/person/permits/*` (a later step wires each role's engagements abroad into the permit); export
  the engagement's country and days so it can.
- Proposal at `/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad/readers/markets-<role>.json`
  in BRIEF-identity-readers.md's form. Do not edit shared files (research, register, registry, catalog, HANDOFF, git).
Report back in under 200 words.
