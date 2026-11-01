# Brief: the readers of the person (2026-11-01)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator): "Continue on to the rest of layer 4."
The person is built (`src/person/identity/identity.ts`, slice `identity`, command `identity.make`; read
`workbench/plans/layer4-identity.md`). Every field must be read by an engine that changes an outcome the player meets,
on the real figures in `research/sources/person/identity/*.json` (register R-4618 languages, R-4619 genres, R-4620
casting, R-4621 unions, R-4622 background; read every figure and blocker of yours). Your prompt names your part and
the files you own. Read first, in full: `CLAUDE.md`; the files you own; `src/person/identity/identity.ts`;
`tests/support/person.ts` (a made person for tests); the reference engines `src/person/acting/acting.ts` and
`src/person/work/work.ts` with their tests; `src/core/frame/frame.ts`; `tests/support/falsify-core.ts`.

## Binding
- Every figure the research gives is the real one; where none is given, the game reckons it, and every such figure goes
  in your proposal's register entry so the player is told it is the game's own. Never invent a figure and present it as
  real. A rule the research leaves blocked is not modeled, and your proposal names it.
- Zero decoration: every new command reads real state, changes it, and is read by code that changes an outcome the
  player meets (`// @slate:consumer <command id>` on the reading line, in another function than the command's own;
  `identity.make`'s consumers are the lines that read `personOf(...)` fields); every new command has a falsifier
  (`falsifyAny({ feature: '<id>', claim: 'bites', ... })`) in a passing test.
- KEEP entry 4's line: race or ethnicity is read only where the trade's published practice reads it (a breakdown that
  names one, a programme whose eligibility names one), never as an ability, a judgment of work, a pay rate or a chance.
- The voice: no player-facing text except through the text catalog (you add none; propose lines if any).
- Keep `identity.ts`'s exported names and signatures as they are (other parts import them); only the identity-tests
  part edits it, and only to fix a bug it finds, reported.

## Conventions (copy the role engines')
- Draws: the decider of the engine you edit (`acting.work`, `directing.work` ...), keyed by what is drawn.
- Declarations at the file's end under the `// Stryker disable all:` comment; a test listing each command with its
  reads and writes (`commandIndex()`).
- Tests: exact-value tests from the life's own draws, boundaries at every threshold, refusals, a falsifier per new
  command, determinism. Existing tests of a file you edit stay green (update them where the change means to).
- Mutation 100% on every file you own: `workbench/configs/{vitest,stryker}.<part>.*` (copy the role engines', own temp
  dir `.stryker-tmp-<part>`), run with `PATH=/opt/node22220/node-v22.22.0-linux-x64/bin:$PATH npx stryker run ...`.
  Also `npx tsc --noEmit -p .`, `npx eslint src tests tools/person`, `npx vitest run tests/person` clean.

## Shared files: DO NOT EDIT
research/*, registry/*.json, src/core/rng/deciders.json, src/core/text/catalog.json, coverage/*, matrix/*, HANDOFF.md,
src/person/attributes/*, files another part owns, git. Write a proposal instead:
`/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad/readers/<part>.json`:
{"part", "files": [...], "effects": {"<new command id>": {"what": "<one sentence>"}},
 "register": {"fact": "person.<part>.model", "sought", "why", "value": {<every game figure, named>}} or null,
 "sourced": ["<each figure taken from the research, with its item>"],
 "fields": [{"key": "<identity field or genre/union/etc. key>", "tests": ["<file>::<describe> > <it>"]}],
 "operations": [{"key", "tests": [...]}], "notModeled": ["..."], "lines": {"<proposed line id>": "<text>"}}
Report back in under 200 words: what reads what, figures sourced vs game, tests, mutation score.
