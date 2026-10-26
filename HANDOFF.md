# Handoff

Layer in progress: 2

The precise state of the build, kept current at every checkpoint so an interrupted session resumes rather than
restarts. Read `CLAUDE.md` and the owner's package in `docs/` first.

## Where the build stands

- Branch `claude/new-slate-build`, off `main` at `c919279`. Nothing is merged; nothing is deployed.
- Layer 0 (the repository and the gate) is proven: the full gate green in a fresh clone of the branch at
  `2ff094d439ad`, recorded in `registry/layers.json`.
- Layer 1 (the core) is proven: the full gate green in a fresh clone of the branch at `dd447a897c68`, recorded in
  `registry/layers.json`.
- Layer 2 (the world) is next. Its first piece, the gazetteer, waits on the owner's answer about the count of places
  (Questions for the owner); the gate refuses code in `src/world/` until layer 1's proof is in the ledger, which it
  now is.

What layer 1 holds:

- `core.time` (`src/core/time/`): IANA tzdb 2026e compiled as zic compiles it (`tools/tzdb/`), every zone's history
  1800 to 2200, local time and instants with DST gaps and repeats, the calendar's arithmetic, and sunrise and
  sunset by NOAA's method; held to the system zic and zdump, to Node's ICU, to NOAA's own spreadsheet (one part in
  a hundred billion) and to USNO's tables (within 0.57 minutes). Register R-0001 to R-0023.
- `core.rng` (`src/core/rng/`): SplitMix64 over FNV-1a 64 keys (seed, decider, keys), each against its reference
  (R-0024, R-0025). No decider is registered yet: the first arrives with the weather (layer 2).
- `core.money` (`src/core/money/`): whole minor units, the 155 currencies of ISO 4217 list one (R-0026, R-0027),
  exact rational arithmetic, half-even rounding, largest-remainder allocation, exchange always an estimate with its
  dated, cited rate.
- `core.frame` (`src/core/frame/frame.ts`): a life as plain data (the frame: seed, moment, schedule, notices; and
  each engine's slice); commands, kinds of scheduled item and kinds of notice declared once, each command and
  happening with the slices it reads and writes, and held to them at run time (reading an undeclared slice, or
  changing one only read, stops it; written slices are copied, the rest shared); the passage of time, which brings
  each scheduled thing about at its moment in order and stops at a commitment that wants the player; `commandIndex()`
  lists every command with its reads and writes for the feature matrix.
- `core.text` (`src/core/text/`): `t()` over `catalog.json`, slots filled with words the caller supplies, never left
  empty. 19 lines so far, all placeholder wording (the persistence and server refusals), listed in `matrix/TEXT.md`.
- `core.persistence` (`src/core/persistence/`): the store contract; the device store (IndexedDB, local storage
  where there is none, gzip with the `slate.gz1:` mark, a copy kept before every write, the life's key written last
  and whole, letting a life go keeping it as the copy); the server store over the three backend functions, mirrored
  on the device; the server's own checks and the three functions (`server/`), with the schema version pinned there a
  second time and a test holding the two equal. APP_VERSION 0.1.0 (the package's version), SCHEMA_VERSION 1.

What layer 0 holds:

- `docs/`: the owner's package, moved from the root with `git mv` (byte for byte, 100% renames), locked by SHA-256
  in `registry/owner-docs.lock.json` with `CLAUDE.md` (54 files). `CLAUDE.md`'s paths were updated for the move;
  none of its rules changed.
- The toolchain, pinned exactly and matched in the lockfile: TypeScript 6.0.3, React 19.3.0, Vite 8.3.4, Vitest
  4.1.12, ESLint 10.12.0 with typescript-eslint 8.71.1, Stryker 10.0.0, tsx 4.23.15; Node 22.22.0; npm 11.6.2 keeps
  the lockfile, npm 10 resolves it too. Overrides: `qs` 6.16.0 (security) and `vitest` 4.1.12 (its own pin, so
  every peer request for Vitest resolves to it).
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
  - audit (full gate only): `npm audit`; any known advisory in the installed tree is red, named by its page.
  - mutation (full gate only): Stryker over the gate's own code, static constants included; break threshold 100%.

## Next step

1. Push the proof and read the CI run of the full gate on GitHub.
2. Layer 2, the world, starting with the gazetteer: GeoNames' country list (252 entries, read 2026-10-26), its
   first-level subdivisions and its populated places of a thousand people or more, vendored and pinned by SHA-256 and
   compiled by a tool as tzdb is; the map's outlines from Natural Earth 1:110m. Then coverage matrix A by country,
   the clock as the player meets it, the weather from each country's published normals, holidays, prices.

## Verification evidence

- Layer 1's proof: `npm ci` then `npm run gate:full` in a fresh clone of the branch at `dd447a897c68`, green in
  605 s: the same checks as below, with 4,479 of 4,479 mutants killed (the frame's slice-name rule added six).
- Layer 1, before its proof: `npm run gate:full` green in the working tree on 2026-10-26 in 595 s: toolchain (19
  packages), owner-docs (54), build-order (19 source files), text-inventory (19 lines, all placeholder),
  research-register (31), typecheck, lint, 1,124 of 1,124 tests, feature-matrix, coverage (6 engines, 0 rows
  pending), handoff, audit (0 advisories), mutation 100.00% (4,473 of 4,473 mutants killed, the gate's and the
  core's together, static mutants included), generated. The proof itself is the same run in a fresh clone.
- Layer 0's proof: `npm ci` then `npm run gate:full` in a fresh clone of the branch at `2ff094d439ad`, green in 289 s:
  toolchain (18 packages), owner-docs (54 documents), build-order, text-inventory, research-register, typecheck,
  lint, 202 of 202 tests, feature-matrix, coverage, handoff, mutation 100.00%, generated.
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
  released 2026-10-23). A security fix outranks the two-week rule: Vitest 4.1.12 (2026-10-15) is in for that.
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

- Layer 1's decisions, each reversible and each the plainer reading of the package:
  - This build keeps its lives under its own keys and database (`slate.life.N`, `slate.copy.N`, IndexedDB
    `slate-lives`), not the first SLATE's (`slate.save.N`, database `slate`): those saves are of a world model this
    build doesn't have (Yale, the career, the body), so it can't open them, and it leaves them untouched. With that,
    the first SLATE's "moving store" (which carried its local-storage saves into IndexedDB) has nothing to move and
    isn't carried.
  - The first schema is the only one, so nothing is older: the "older version" branch, bringing a life forward, and
    the copy made before it (the contract's `backup()`) arrive with the second schema version, when something calls
    them. A life from a newer build is refused, so it stays safe.
  - The save's meta holds the life's id, its place, the schema and app versions, the playtime, and `card` (the
    words the slots screen shows, written by the layers that know them). The world's moment is read from the life
    itself, not copied into the meta.
  - A write never makes an unreadable life the copy (the first SLATE's write copied whatever was there, so a damaged
    life could take a good copy's place); letting a life go already followed that rule.
  - The server's checks keep the shape, size, version, place, forward-progress and once-only rules; the ledger
    balance and the other-life-record checks come back with banking (layer 3), when a ledger exists. Timestamps
    nothing read (`checked_at`, `deleted_at`, `applied_at`) aren't written. The three functions are written as
    handlers over the slice of the Base44 SDK they use; the Deno entry files that wrap them are deployment, which
    waits on the owner's word.
  - Every refusal reaches the player as a line of the catalog, the server's included: the server answers with a
    line id, and the app says the line.
  - The startup screen's four stages are its engine and are built with the screen (layer 5), on this store.
  - Each notice kind will need its line in the catalog; the gate check for that comes with the first notice.
- `fake-indexeddb` 6.2.5 (2025-11-07) is the only package layer 1 added, to test the IndexedDB store against real
  IndexedDB semantics in Node.

## Blockers and open issues

- Resolved 2026-10-26, the owner's two open issues:
  - The `qs` advisories (GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g), reached through Stryker's
    `typed-rest-client`, which pins `qs` 6.15.1 exactly: fixed by overriding `qs` to 6.16.0, the first release
    outside all three ranges. The audit then also named two in Vitest 4.1.11's `@vitest/mocker`
    (GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp), fixed by Vitest 4.1.12. `npm audit`: 0 vulnerabilities, and the full
    gate now runs it, so a new advisory turns the gate red.
  - npm 10's crash (`Cannot read properties of null (reading 'edgesOut')`): its cause was Vite 8's optional peer
    `@vitejs/devtools`, whose own peers ask for Vitest; with no lockfile, npm 10 reached for Vitest 5 there and
    crashed in its peer-set resolver. Overriding `vitest` to its own pin ties every such request to 4.1.12; a fresh
    `npm install` with no lockfile now succeeds under npm 10.9.4, as do `npm ci` and adding a package.
- Stryker 10.0.0 reports a mutant that breaks a test file at load as surviving rather than killed (fixed in 10.1.0);
  `gate/test/eslint-plugin.test.ts` asserts the plugin's shape apart from the rule cases so such mutants are caught.

## Questions for the owner

1. **The count of places on the map.** The package holds the map to 170,911 places, the first SLATE's count of
   GeoNames' populated places of a thousand people or more. GeoNames changes daily: its `cities1000` today
   (2026-10-26, last modified 02:48 UT) holds 171,654, and its country list the same 252 entries. The snapshot the
   first SLATE used isn't in the package (`public/geo/` wasn't copied), the Internet Archive can't be reached from this
   session, and reading the first SLATE's repository (`montrealroots/1221`) to recover it was refused by this
   session's permissions. Two ways on: allow this session to read `montrealroots/1221`, so the build uses the first
   SLATE's exact snapshot and the 170,911 holds; or take today's GeoNames release, pinned by its hash, and the map's
   count becomes 171,654 (the owner's rule, every place on the map covered, holds either way). The recommendation is
   today's release: it is current, citable and reproducible, and the 743 more places are real towns.
2. The four the package leaves to the owner (the premise's detail, home on the first morning, the start date, Sleep
   as a clock action) are asked when the build reaches them.
