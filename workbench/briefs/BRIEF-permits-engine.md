# Brief: the work permit engine (2026-11-01)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator): work permits must be real and cover the
game's world map ("stay true to the factual and realism and cover that across the game's world map"), and the main law
in CLAUDE.md binds every line (continuity, nothing decorative, every basis covered or named as not modeled). Read
first, in full: CLAUDE.md; `src/papers/work/work.ts`, `tools/papers/work/*.ts` and their tests (the layer 3 engine
whose route this permit is); `src/person/unions/unions.ts` (`mayWorkIn`, which now refuses every permit) and
`src/person/acting/acting.ts` (`play`, which calls it, and `COUNTRY`); `src/person/identity/identity.ts`;
`src/core/frame/frame.ts` (commands, scheduled kinds); `tests/support/falsify-core.ts`; the briefs
`workbench/briefs/BRIEF-permits.md` (the research's form) and `BRIEF-identity-readers.md` (the conventions, which
bind you here too).

## The research
One file per country in the form of BRIEF-permits.md, now at /tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad/permits/out/<CC>.json
(another worker is fixing quotes in them now; do not edit them). The lead lands them at
`research/sources/papers/permits/<CC>.json`, each cited by a register entry `papers.permits.<CC>` with its SHA-256
(blocked fields by `papers.permits.blocked.<CC>`). Build your compile for that layout and test it on fixtures; the
lead runs it once the files land.

## What to build: `papers.permits` (src/papers/permits, slice `permits`)
- The compile (`tools/papers/permits/{compile,build,coverage}.ts`, as tools/papers/work's): per country the route, who
  applies and what must come first, each fee as Money, the standard and premium processing as a span, the term and
  whether it renews, any union consultation, the eligibility, the pay rule and a short engagement's exemption; null
  where blocked. Coverage `coverage/permits-countries.json`: researched where the permit's core facts (who applies,
  fees, processing, term) are found, blocked where any is, proven where every passport may work freely (layer 3's
  free countries), each citing its register entries.
- `permits.apply`: for a country where the person (identity's citizenships) needs a permit (papers.work says
  `permit`), for an engagement booked there (an acting audition booked whose agreement's country is that one; the
  engager applies where the research says the employer does): its fees recorded, its decision scheduled (a declared
  kind) at the standard processing time from now, or the premium one where asked and offered. Refused where the
  person needs none, where nothing is booked there, or where the country's permit isn't known well enough to apply
  for (who applies, processing or term blocked), saying which.
- The decision (the scheduled kind): granted for the term the research gives from that day; where the research's
  eligibility is a test the life's own records can answer (prior credits, a recognised reputation), read it from them
  and say in the register how; where it can't be answered, it is not modeled and the proposal names it.
- `permits.renew` where the research says it renews.
- What it changes: export `permitted(s, country, now, days)` for the lead to wire into `mayWorkIn`: the person may work
  in a country by citizenship (papers.work), by a permit held and in force on the day, or because the engagement is
  inside the country's exemption (`days` worked within the period). You may edit `src/person/unions/unions.ts`'s
  `mayWorkIn` and `src/person/acting/acting.ts`'s call with their tests (no one else edits them now), keeping both at
  100% mutation. The days an engagement works: acting's `daysWorked(part)`.
- Conventions, configs (`workbench/configs/{vitest,stryker}.permits.*`, own temp dir), 100% mutation, proposal at
  `/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad/readers/permits.json` in
  BRIEF-identity-readers.md's form (with `effects` for every command and kind, `register` for the game's readings,
  `operations`), as that brief says. Do not edit shared files.
Report back in under 200 words.
