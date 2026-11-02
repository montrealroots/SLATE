# Brief: Screen 1, the startup screen (2026-11-02)

The owner of SLATE: "Start the startup screen while the proof runs." Read, in full, before a line: CLAUDE.md (the
main law, read-bite-downstream, zero decoration, the voice, the look), `.claude/rules/title-case.md`,
`docs/SCREENS.md` (Screen 1, kept whole, register entry 1), `docs/BUILD-ORDER.md` layer 5, `docs/KEEP.md` entry 1,
`workbench/briefs/BRIEF-ui.md`, the kept code `docs/kept/01-startup-and-persistence/` (StartupSequence.tsx,
SlateApp.tsx, startup.css, tokens.css, version.ts), the core's persistence `src/core/persistence/*` (the Store, the
slots, decode, isNewer, resolveStore, the versions) and the text catalog `src/core/text/`.

## What to build
- Layer 5's first files: `src/ui/` (the screens) and `src/app/` (the entry: `index.html` at the repo root if Vite needs
  it, `src/app/main.tsx` mounting the app). The look starts from the kept `tokens.css`, refined, never cluttered: the
  full dark field, the radial glow, the clapper mark's 900 ms turn, SLATE's spaced light wordmark, "A LIFE SIMULATOR",
  the hairline gold bar with the stage's name left and the percentage right, the four stages ticking dot, gold arrow,
  check; "Version {app} · Save Format {schema}" from the core's own `APP_VERSION` and `SCHEMA_VERSION`.
- The four stages do the real work, each on the core's persistence: Connecting To Storage (resolve the Store: the
  server where one is given, else this device), Reading Save Slots (list the three), Checking Each Save (decode each
  life; one that can't be read is named with its reason), Checking Save Versions (a life from a newer version, or one
  to be brought up to date). A failed stage: "Startup Stopped", the stage's red cross, a red box saying what failed and
  why, Try Again re-running from the start. A save needing a word: the gold box "Before You Continue" listing each, and
  Continue. Otherwise straight on. The result (the store, each slot's state) is what the slots screen reads next; until
  it is built, the result is handed to an exported callback the slots screen will take, and nothing is shown that
  nothing reads.
- The sequence as a pure, deterministic engine (`src/ui/startup/sequence.ts` or the like) the screen renders: its
  stages, transitions, failures, the before-you-continue list. Tests: every stage's success and failure on an injected
  Store (fake-indexeddb is installed), the percentage at each step, the versions' cases, Try Again, determinism; the
  screen's markup by `react-dom/server` (no new dependency: no jsdom, no testing library); 100% mutation on every file
  you add (a `workbench/configs/{vitest,stryker}.ui-startup.*` pair, own temp dir; never `pkill -f "stryker run"`).
- Every word on the screen through the catalog (`src/core/text/catalog.json` lines, status placeholder, propose them in
  your report; the lead adds them), labels in Title Case; prose as prose.
- Look at it: `npx vite` and a Chromium screenshot (Playwright is pre-installed: `require('playwright')`,
  `chromium.launch()`), at desktop and phone widths, success, a failure and the before-you-continue box; save the PNGs
  under $S/ui/ (S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad).

## Rules
The gate holds layer 5 code red until layer 4 is recorded proven (its proof is running in a separate clone, which
takes the machine's cores: run only your own tests and configs, never the whole gate). Use Node 22.22.0 first on PATH
(`PATH=/opt/node22220/node-v22.22.0-linux-x64/bin:$PATH`). Don't edit research, the register, the registry, the
catalog, HANDOFF, `docs/` or git; propose. Report back in under 200 words, with the screenshot paths.
