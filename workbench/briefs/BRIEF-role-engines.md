# Brief: build one role's engine, to the screenwriter's standard (2026-11-01)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator): "Build them." You build ONE role's
engine (your prompt names it: producer, director or actor), as the screenwriter's was built. Read first, in full:
`CLAUDE.md`; `HANDOFF.md`'s last sections (from "Ruled 2026-10-31, the owner, on how attributes work"); the reference
engine `src/person/work/work.ts` and `src/person/work/career.ts` with their tests `tests/person/work/*.test.ts`;
`src/person/attributes/attributes.ts`; the frame `src/core/frame/frame.ts`; `tests/support/falsify-core.ts`.

## What the owner has ruled (binding)
- Attributes make the quality and the outcomes of the work; a life at 100 throughout gets the top of what's real, any
  lower levels correspondingly worse; doing the work raises what it used (`practise`, a day of work at a time, never past
  100). The player holds your role's broad attributes (attributes.json, `ATTRIBUTES.<role>`), each covering researched
  components with facets; read a component's level with `componentValues(s.attributes, role)` and its skill through its
  facets with `skillOf(values, role, componentId)` (a facet tied to other components draws on them, `facetSkill`).
- Every figure the trade publishes is the real one: your role's figures are `research/sources/person/work/<role>-calibration.json`
  (register R-4612 producer, R-4613 director, R-4614 actor; read every figure and blocker). Use them. Where no source
  gives a figure, the game reckons it, and every such figure goes in your proposal's register entry (below) so the
  player is told it is the game's own. Never invent a figure and present it as real.
- Zero decoration: every command reads real state, changes it, and is read by code that changes an outcome the player
  meets (a consumer anchor `// @slate:consumer <command id>` on the reading line, in another function than the command's
  own); every command has a falsifier (`falsifyAny({ feature: '<command id>', claim: 'bites', ... })`) in a passing test.
- Each broad attribute of your role must be read somewhere by your engine (through its components), or say plainly in
  your report why one isn't.
- The voice: no player-facing text in this layer except through the text catalog (you add none; propose lines if any).

## The work to model (decide the design from the research; keep it to what the figures support)
- Producer (`src/person/producing/producing.ts`, slice `producing`, commands `producing.*`): taking a project from
  material to release: option or acquire material (the WGA's option terms in the figures), finance it (each funder's
  acceptance rate, incentives' rates, caps on fees and overheads), budget and schedule it (shooting days), produce it
  (overruns where the team falters), release it (release rates by budget, the share that earns back twice its budget).
- Director (`src/person/directing/directing.ts`, slice `directing`, commands `directing.*`): prep, shoot and cut a film
  or episode: a film's parts' quality from the broad attributes (performances from Working With Actors, images from
  Visual Craft, the story told from Vision and Script Sense, the cut from Editing), the DGA's guaranteed periods and the
  director's cut (at least ten weeks or a day for every two shooting days), shooting days, pay at the DGA's minimums,
  festival selection at each festival's real rate scaled by the film's quality, a second feature's real odds.
- Actor (`src/person/acting/acting.ts`, slice `acting`, commands `acting.*`): auditions (self-taped, as most are),
  booking (no source gives the audition-to-booking ratio: a game figure, labelled), a performance's quality from the
  broad attributes a part asks for (Acting, Memorization of its lines, Voice, Physicality, Camera, Direction), pay at
  the union minimums in the figures (SAG-AFTRA's day and weekly rates; Equity's, ACTRA's where the part is there).

## Conventions (copy the screenwriter's)
- One decider is registered for you (do not edit deciders.json): `producing.work`, `directing.work` or `acting.work`;
  key every draw (`c.draws('<role>.work', 'what', id, ...)`).
- Declarations at the file's end, under the `// Stryker disable all:` comment the reference uses; a test listing each
  command with its reads and writes (`commandIndex()`).
- Tests in `tests/person/<role>/<role>.test.ts`: exact-value tests recomputing formulas from the life's own draws,
  boundary tests at every threshold, refusals, a falsifier per command, determinism (same seed same result).
- Mutation: 100%. Add `workbench/configs/vitest.<role>.config.mjs` and `workbench/configs/stryker.<role>.mjs` (copy
  `workbench/configs/*.person.*` with your paths) and run
  `PATH=/opt/node22220/node-v22.22.0-linux-x64/bin:$PATH npx stryker run workbench/configs/stryker.<role>.mjs` until
  every mutant is killed, or disabled on its line with a reason that holds (an equivalent mutant; a continuous draw's
  strict comparison; a module-load literal). Use Node 22.22.0 from that PATH for every npx command.
- Also: `npx tsc --noEmit -p .`, `npx eslint src/person tests/person`, `npx vitest run tests/person` all clean.

## Shared files: DO NOT EDIT
research/register.json, registry/*.json, src/core/rng/deciders.json, src/core/text/catalog.json, coverage/*, matrix/*,
HANDOFF.md, src/person/attributes/*, other roles' files, git. The lead integrates them. Instead write a proposal:
`/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad/engines/<role>.json`:
{"engine": "person.<producing|directing|acting>", "dir": "src/person/<...>",
 "effects": {"<command id>": {"what": "<one sentence>"}},
 "register": {"fact": "person.<role>.model", "sought": "...", "why": "...", "value": {<every game figure, named>}},
 "sourced": ["<each figure taken from R-4612/13/14, one line each, with its figure item>"],
 "operations": [{"key": "<operation>", "tests": ["<test file>::<describe> > <it>", ...]}],
 "attributes": [{"key": "<broad attribute id>", "tests": [...]}],
 "decider": ["<test name that shows the draws are the same for the same life and differ for another>"]}
Report back in under 200 words: the commands, which broad attributes each reads, the figures used (sourced vs game),
test count, mutation score.
