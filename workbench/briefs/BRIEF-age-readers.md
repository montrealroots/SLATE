# Brief: the age readers, in every role and every country (2026-11-01)

The owner of SLATE: "Start the age readers once the ledger lands", then, asked whether the age rules reach young
writers, producers and directors too, yes, each where the law reaches them; and (2026-11-01) "Start the age readers
once this lands" (the world markets and tax). The research is landed with this work (the lead holds it in the
working tree until an engine reads it; the gate holds every blocker to a coverage row):
`research/sources/person/ages/<CC>.json` for all 252 countries (the 21 markets from `BRIEF-ages-roles.md`, the other
231 from `BRIEF-ages-world.md`), register `person.ages.<CC>` and `person.ages.blocked.<CC>` (notModeled `youth.unkept`,
a line the lead adds to the catalog). Items: `majority`, `minimumWorkAge`, `minorsContracts`, `childPerformers`,
`unions`, `funds`, `companies`, `follows`. Read both briefs, a dozen files of different kinds (California's Coogan
trust, the UK's licence, France's Caisse des dépôts, a follower, a blocker-only file), the layer-3 ages
(`src/papers/ages`, `tools/papers/ages`, `research/sources/papers/ages`), and the four role engines before writing a
line. The main law in CLAUDE.md binds every line; so do `BRIEF-identity-readers.md`'s conventions.

## Two parts, two agents at once
**Part A, layer 3 (`ages`).** Layer 3's ages hold 168 countries blocked on majority or working age. Where the new
research finds them (`majority`, `minimumWorkAge` with its light-work age and the performer's exception), the layer-3
compile reads them from the person research files (one copy of the fact: never copy them into a second file), the
blocked rows become researched, and conflicts are settled by the source: Uganda's Children (Amendment) Act 2016 sets
16 where layer 3 holds 14; a state's own UN treaty report is secondary and older than its code, which wins. Owns
`tools/papers/ages/*`, `src/papers/ages/*`, their tests and configs, `coverage/ages-countries.json` by its build.

**Part B, layer 4 (`youth`).** A compile (`tools/person/youth/{compile,build,coverage}.ts`, SHA-checked) to
`src/person/youth/youth.json` and an engine `src/person/youth/youth.ts` read by every role engine, so that a person
under the majority of the country where the work is:
- signs a contract for performing, writing, directing or producing work only as that country's law binds it (a
  court's approval, a guardian's signature, an inspector's authorisation), refused or made voidable where the research
  says so, and the rule reaches each kind of work only where the research says it does (California's "artistic or
  creative services" reaches writing; many reach only performing);
- has the share the law sets aside paid into the account it names (the Coogan trust's 15%, the Caisse des dépôts'
  pécule) through the ledger, the rest to the minor's account; nothing set aside where the law sets nothing;
- needs the child performer's permit or licence the country requires, at the ages it requires, its hours a day and a
  week and times of day by age read against the work's days (a part's days, a shoot's), its rest days and schooling,
  a chaperone where required; refused or limited, never invented;
- meets the union's and the fund's age rules, and the company law's age to form and direct the producer's company.
Wire each into `acting.ts`, `work.ts`/`career.ts`, `directing.ts`, `producing.ts` (Part B owns those edits this round;
nobody else edits them) at the point the work is engaged or paid. What isn't known is told: `aboutYouth(...)` fills
`youth.unkept`'s `{missing}`. Coverage `coverage/youth-countries.json`, a row for every country, every blocked entry
cited; an operations matrix for each new command or kind.

## Both parts
Tests: every figure exact, every age's edge (the birthday in the work country's zone), refusals, a minor's life run
through each role, determinism, a falsifier for every new command and kind, existing tests green, 100% mutation on
every file you touch (own configs and temp dirs; never `pkill -f "stryker run"`). Proposal at
`$S/readers/age-<part>.json` (S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad) in
BRIEF-identity-readers.md's form. Use Node 22.22.0 first on PATH. Run your own configs, not the whole gate (the lead
runs it). Do not edit research, the register, the registry, the catalog, HANDOFF or git.
Report back in under 200 words.

## Military service removed (the owner, 2026-11-01)
"Dont need military service at all." Part A removes it from layer 3: the `service` field, `serviceIn`, `termFor`, the
compile's reading and the coverage's test of it, their tests; a row is researched on its majority and working age
alone. The lead settles the register (blockers that sought service alone go; a blocker that sought service with
another fact keeps its other attempts) and the `ages.unkept` line.
