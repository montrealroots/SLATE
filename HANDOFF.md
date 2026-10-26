# Handoff

Layer in progress: 0

The precise state of the build, kept current at every checkpoint so an interrupted session resumes rather than
restarts. Read `CLAUDE.md` and the owner's package in `docs/` first.

## Where the build stands

- Branch `claude/new-slate-build`, off `main` at `c919279`. Nothing is merged; nothing is deployed.
- Layer 0 (the repository and the gate) is built. It is proven when a green full gate (`npm run gate:full`) on a
  committed tree is recorded in `registry/layers.json` (layer, commit, date, evidence) in the commit after it.
- Layers 1 to 7 have not started. The gate refuses code in a layer until every layer under it is recorded proven.

What layer 0 holds:

- `docs/`: the owner's package, moved from the root with `git mv` (byte for byte, 100% renames), locked by SHA-256
  in `registry/owner-docs.lock.json` with `CLAUDE.md` (54 files). `CLAUDE.md`'s paths were updated for the move;
  none of its rules changed.
- The toolchain, pinned exactly and matched in the lockfile: TypeScript 6.0.3, React 19.3.0, Vite 8.3.4, Vitest
  4.1.11, ESLint 10.12.0 with typescript-eslint 8.71.1, Stryker 10.0.0, tsx 4.23.15; Node 22.22.0; npm 11.6.2.
- The gate (`gate/`), run as `npm run gate` (fast: every commit, by `.githooks/pre-commit`; red stops the commit;
  `.githooks/commit-msg` writes the verdict into the message as a `Gate:` trailer), `npm run gate:full` (adds
  mutation testing; proves a layer; CI runs it on every push), and `npm run gate:write` (rewrites `matrix/`).
  Its checks, each with fixture tests that show it biting:
  - toolchain: every package exactly pinned, the tools the build order names present, the lockfile agreeing,
    npm and Node pinned.
  - owner-docs: the owner's documents unchanged, and nothing joining `docs/` unlocked.
  - build-order: every source file in a layer; no layer started before the one under it is proven; proofs
    contiguous and at commits this branch carries; imports only downward, and never outside `src/`.
  - text-inventory: every player-facing line in `src/core/text/catalog.json`, each said somewhere in the source,
    none in the engine's vocabulary (`registry/voice.json`, from KEEP entry 2); placeholder wording unfinished from
    layer 6 on; the inventory for the owner's rewrite generated at `matrix/TEXT.md`.
  - research-register: every entry found (primary source, page, date read, value), secondary (naming the primary
    it quotes), blocked (all five methods of KEEP entry 7 tried and dated, and the line telling the player what
    isn't modeled), or the game's own figure (its reason and its label to the player); no fact held twice; no date
    after today.
  - typecheck, lint (with SLATE's own rules: no raw text in JSX, every control names its feature, every value shown
    sits inside an element naming its feature; no `Math.random`, `Date.now` or `new Date()` in the app), tests.
  - feature-matrix: every feature on a page (`data-feature`), with `@slate:reads`, `@slate:bites` and
    `@slate:downstream` anchors resolved to file and line (downstream outside the files that draw it), and a
    passing falsifier (`tests/support/falsify.ts`) for the bite and for the downstream effect, whose outcome is
    state, never a sentence. Generated at `matrix/FEATURES.md`.
  - coverage: every engine declared with its matrices; one row per key of each axis, no more, no fewer; the country
    axis held to the owner's 252 and the place axis to 170,911; an engine that reads a place covers the country
    axis and names a passing test over every place; every row researched, proven, blocked or the game's, cited and
    held by a passing test, or pending (incomplete). Generated at `matrix/COVERAGE.md`.
  - handoff: this file's sections, and the layer it names agreeing with the ledger.
  - generated: everything in `matrix/` exactly what the checks produce.
  - mutation (full gate only): Stryker over the gate's own code, static constants included; break threshold 100%.

## Next step

1. Commit layer 0, run `npm run gate:full` on the clean committed tree, and record the proof in
   `registry/layers.json` and this file (layer 1 then in progress).
2. Push the branch and read the CI run of the full gate in a clean clone.
3. Layer 1, the core, in `docs/BUILD-ORDER.md`'s order: time (instants, zones, calendar arithmetic, DST, sunrise and
   sunset; proven against the IANA tz rules for every zone family, cited in the register), deterministic randomness
   keyed by seed and named decider, money in integer minor units with ISO 4217 currencies (cited), the simulation
   frame (state, commands, scheduled items, passages, notices, each command's reader registered where declared), and
   persistence (the adapter contract, the local store with IndexedDB and the local-storage fallback, gzip, the copy
   kept before every write, the server adapter, the schema version pinned in both places). Each engine gets its
   directory under `src/core/`, its entry in `registry/engines.json` and its coverage matrix under `coverage/`;
   mutation testing extends to it.

## Verification evidence

- Fast gate green on the working tree: toolchain, owner-docs, build-order, text-inventory, research-register,
  typecheck, lint, 202 tests, feature-matrix, coverage, handoff, generated.
- Mutation testing over the gate (gate/**/*.ts, the lint plugin, the falsify helper), static mutants included:
  2,167 killed, 0 survived, 0 without coverage, 13 excluded by in-line `Stryker disable` comments, each stating why
  the mutant can't change an outcome (a fallback for a file just listed, an empty catch that returns undefined just
  the same, a sort this filesystem makes redundant but others need). The score went 84.02% (first real run) to
  97.70% to 99.67% to 100%; the survivors on the way were tests asserting too little (fixed by exact findings and
  whole generated documents), redundant code (simplified away), one real imprecision in the shown-value lint rule
  (it stopped looking at the first non-JSX parent; it now looks at every enclosing element), and one stale default.
- The falsifier's ledger and Vitest's report agree on test names, shown end to end by a test that runs a real Vitest
  suite in a child process; a falsifier recorded in a test that then fails is not counted.

## Assumptions

- The package moves under `docs/` (BUILD-ORDER layer 0 says so); `CLAUDE.md` stays at the root, where Claude Code
  reads it, with its paths updated. The first SLATE's exact tool versions aren't in the package, so the toolchain is
  the newest release of each tool that was at least two weeks old on 2026-10-26 and compatible with the rest:
  TypeScript 6 (typescript-eslint doesn't support 7), Vitest 4 (Stryker supports Vitest 5 only from 10.1.0,
  released 2026-10-23).
- jsdom and Testing Library are left out until layer 5 needs them (jsdom 30 needs Node 22.22.2; this machine has
  22.22.0): a tool nothing uses isn't installed.
- "Every commit runs it; a red gate blocks the next layer": a red gate stops the commit; an incomplete one (declared
  work not done, such as pending coverage rows) is let through and recorded in the commit message, so research can
  be checkpointed; only a green full gate proves a layer.
- The gate checks the working tree, not only what's staged; stage everything meant for the commit.
- Feature anchors bind to the next line of code when the anchor's line starts as a comment; a line that starts with
  a block comment and then holds code counts as a comment line.
- The axis sources (`src/world/gazetteer/countries.json`, `place-ids.json`) are where layer 2 is expected to put the
  gazetteer; if layer 2 settles elsewhere, `registry/axes.json` moves with it.

## Blockers and open issues

- `npm audit`: 2 moderate advisories in `qs` (GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g),
  reached only through Stryker's dashboard reporter (`typed-rest-client`), a development tool that this build never
  runs against untrusted input; no Stryker release at least two weeks old fixes it. Recheck at the next toolchain
  update.
- npm 10.9.4 crashes resolving this tree (`Cannot read properties of null (reading 'edgesOut')`); `npm ci` from the
  lockfile works under it, and changing dependencies uses npm 11.6.2.
- Stryker 10.0.0 reports a mutant that breaks a test file at load as surviving rather than killed (fixed in 10.1.0);
  `gate/test/eslint-plugin.test.ts` asserts the plugin's shape apart from the rule cases so such mutants are caught.

## Questions for the owner

None at layer 0. The four that are the owner's (the premise's detail, home on the first morning, the start date,
Sleep as a clock action) are asked when the build reaches them, not before.
