# Depth audit, department core: layer 0 (the gate) and layer 1 (the core)

Auditor: read-only subagent, 2026-10-30. Read: `CLAUDE.md`, `docs/MANDATE.md`, `docs/BUILD-ORDER.md` layers 0 to 3,
`docs/KEEP.md` entries 1, 2 (engine part), 5 to 7, `HANDOFF.md` (layer 0, layer 1 and their decisions), every file in
`gate/`, `registry/`, `src/core/`, `tests/core/`, the core's coverage matrices, and 1221's `src/engine/core/*`,
`src/engine/persistence/*`, `base44/shared/guard.js`, `base44/entities/SlateSave.json`, `tools/wired.mjs`,
`tools/deciders.mjs`, `tools/effects.mjs`. Probes run from the scratchpad with `npx tsx` (nothing in the tree written).
The gate wasn't run (it writes `.gate/` into the tree).

Ranking inside each engine: how often a life (or, for the gate, a commit) meets the gap.

---

## Layer 0: the gate

BUILD-ORDER layer 0 names six mandate checks. What exists:

| Named check | Exists | Does what the build order says |
|---|---|---|
| feature-to-effect matrix | `gate/checks/features.ts` | Partly: pages only (see G1) |
| falsifiability tests | `tests/support/falsify-core.ts`, read by features.ts | Partly: page features only; 0 features registered, so 0 claims held (G1, G5) |
| coverage matrices | `gate/checks/coverage.ts` | Yes for places; self-declared scope elsewhere (G3, G4) |
| research register | `gate/checks/register.ts` | Yes (found/secondary/blocked with all five methods and a player line/game) |
| text inventory | `gate/checks/text.ts` + `title-case.ts` | Yes for the catalog; notices not held (G2) |
| zero-decoration | lint rules (`gate/eslint/plugin.js`) + "said somewhere" | Partly: screens only; nothing finds unread engine state or data (G1) |

Also present and doing their job: toolchain pins, owner-docs lock, build-order (layers, downward imports), handoff
sections, generated matrices, audit, mutation at 100% break.

### Gaps, ranked

**G1. Engine-level read/bite/downstream isn't gated at all (owner's ask not met; below 1221).** BUILD-ORDER layer 1:
the frame registers "every command's reader ... where it's declared (the matrix reads this)". The matrix doesn't:
`checkFeatures` (`gate/checks/features.ts:73-169`) reads only `registry/features.json` and `data-feature` marks;
`commandIndex()` (`src/core/frame/frame.ts:148`) is read by no gate code, only by three tests. Today 6 commands
(`card.open/spend/pay`, `clock.play/pause/counted`), 3 scheduled kinds and 2 notice kinds
(`src/money/cards/account.ts:272-282`, `src/world/clock/clock.ts:45-47`) have no matrix row, no consumer at a file and
line, no falsifier. 1221 held exactly this with `tools/effects.mjs` (commands, scheduled kinds, reactors, events,
notices outside handlers, each to a consumer at file:line) and `tools/wired.mjs` (declared vocabulary nothing reads,
ratcheted in `docs/UNWIRED.json`). Concrete decoration that passes today: the server store's device mirror is written
on every save and never read (`src/core/persistence/remote.ts:68-77`; `load`/`listSlots` at 53-66 only ask the server).
Needs: a gate check over `commandIndex()` plus a kind/notice index: every slice a command or kind writes is read by
another declared command/kind or by a page feature (file:line), every notice kind has a reader and a line, every
command has a falsifier on its effect; and an unread-data check (fields of `src/**/*.json` and slice fields nothing
reads), ratcheted as 1221's was.

**G2. Notice kinds have no catalog line and no check (promise in HANDOFF not kept).** `HANDOFF.md:1284`: "Each notice
kind will need its line in the catalog; the gate check for that comes with the first notice." The first two came
(`card.stated`, `card.missed`, `account.ts:272-273`); `src/core/text/catalog.json` has no line for either and
`gate/checks/text.ts` has no notice rule. Needs: `defineNotice(kind, lineId)` (or a registry) and a text-check rule that
every declared notice kind names a catalog line that's said.

**G3. Core operation matrices are hand-listed scope.** `coverage.ts:26-28` lets an engine's axis be "the keys
listed". Every core matrix but zones, currencies and deciders is such a list (`coverage/*-operations.json`,
`time-calendar.json`, `time-local.json`): the engine declares its own scope, so a missing dimension (age, cash rounding,
money formatting; see the engines below) can't show as a missing row. Needs: operations axes derived from the module's
exports (TypeScript's own export list), so an export with no row is red; and the gaps below added as rows.

**G4. `readsPlace` is self-declared.** `coverage.ts:177-180` enforces country and all-places coverage only where
`registry/engines.json` says `readsPlace: true`. Nothing checks that an engine importing the gazetteer or taking a
`CountryCode`/zone says so. Needs: readsPlace derived (imports `src/world/gazetteer` or `src/core/time` zones ⇒ true).

**G5. Deciders aren't swept (below 1221).** `src/core/rng/deciders.json` has four deciders whose `reader` is free text
("src/world/weather/weather.ts: how cloudy..."), checked by nothing; the coverage rows only cite a determinism test.
1221's `core/deciders.ts` + `tests/deciders.test.ts` swept every input a decider declares and failed one whose
outcome never moved; `tools/deciders.mjs` failed a draw no decider owned. Needs: deciders.json rows with `reader`
as file:line (resolved by the gate) and declared inputs, and a sweep test the gate requires per decider.

**G6. A proven layer can change without a new proof.** `gate/checks/layers.ts:86-95` checks proofs are contiguous and
on the branch; nothing compares a proven layer's files with its proof commit. Layer 1 was proven at `dd447a8`
(2026-10-26); `src/core/text/case.ts` and 31 catalog lines were added to layer 1 since. Needs: red (or incomplete)
when files in a proven layer's dirs differ from the proof commit, until a new proof row is recorded.

**G7. The handoff check doesn't catch drift.** `checkHandoff` holds sections and the layer number only. `HANDOFF.md`
"What layer 1 holds" still says "No decider is registered yet" (four are) and "19 lines so far" (the catalog has 50).
Needs at least: the counts the handoff states generated from the receipt, or a test that quotes them.

**G8. 28 tool files aren't typechecked.** `tsconfig.json:24` includes `src, gate, registry, tests` but not `tools`;
`tools/tzdb/build.ts` (writes `src/core/time/tzdb.json`), `tools/money/build.ts` (writes `currencies.json`), every other
`build.ts` and all of `tools/research/*.ts` are reached by neither the typecheck nor mutation
(`stryker.config.mjs` `!tools/**/build.ts`). Low risk (the compile.ts files they wrap are tested). Needs: `tools` in
the include.

Smaller: the falsifier rejects only a top-level string (`falsify-core.ts:27`; `{text: '...'}` passes as "state");
the text check's "said" is any quoted occurrence of the id in `src/` (a comment or dead constant counts). Two
interrupted Stryker sandboxes sit in `.stryker-tmp/` (ignored, but disk; HANDOFF records an ENOSPC).

**Verdict, layer 0:** the register, coverage-by-place, text catalog and build-order checks are complete for what they
hold. The two checks at the heart of the mandate (feature-to-effect and zero-decoration) hold only screens, which don't
exist yet, so every engine built in layers 1 to 3 has passed without a consumer or falsifier being asked of it. G1 and
G2 should land before more of layer 3 is built on them.

---

## Layer 1: the core

### core.time (`src/core/time/`)

Holds: tzdb 2026e compiled as zic does, 344 zones and 253 links, 1800 to 2200, held to zic/zdump for every zone and to
ICU; instants, local time, DST gaps (`skipped`) and repeats; Hinnant's calendar; NOAA sunrise/sunset held to USNO.
Every zone the 171,654 places name resolves (probe: 392 zone names, 0 unknown). This is deeper than 1221's
`core/time.ts`, which leaned on `Intl`.

Gaps:

1. **No zone-aware date arithmetic, so engines do it in UT (met daily: every "day", statement, due date and age).**
   1221 had `startOfDay/startOfNextDay/endOfDay/addDays/addMonths/addYears/daysBetween/sameLocalDay/dateKey` in a
   zone (`1221 src/engine/core/time.ts:202-316`). The new core has `localTime`/`instantOf` only, and the money engine
   rolls its own on UT days: `nextStatement`, `dateOf`, `ageOn` (`src/money/cards/account.ts:101-122`). Needs in core:
   local day start/end, add days/months/years with end-of-month clamping, days between local dates, each by zone.
2. **No age in core; the copy in cards is wrong by zone (met by every life, every birthday).** Probe: born 2000-05-10,
   at 08:00 on 2026-05-10 in Tokyo, `ageOn` says 25 (UT is still the 9th). Also no rule for a 29 February birthday
   (it gives 1 March everywhere; countries settle this in statute and not all alike (New Zealand's Age of Majority Act
   1970, to my knowledge, says 28 February; unverified here, no searches were allowed), so it's a research row). Age
   gates passports (child validity), ID cards, cards (`account.ts:224`). Needs: `ageOn(birthDate, instant, zone,
   leapRule)` in core, the leap rule per country researched (a papers column), and one copy (MANDATE rule 7).
3. **No formatting of dates, times or durations for the player (met on every screen).** 1221 had
   `formatTime/formatDate/formatWeekdayDate/formatDuration/formatRelative` (`1221 core/time.ts:325-423`). Catalog
   slots take words the caller supplies (`src/core/text/text.ts:18-33`), so each engine would write its own. Needs: one
   formatter in core (Intl by the player's locale, or the owner's chosen house style), with the abbreviation from
   `typeAt`.

Verdict: the zone, DST and sun engine is complete; the calendar a life uses (local days, months, ages) is missing.

### core.rng (`src/core/rng/`)

Holds: SplitMix64 and FNV-1a 64 against their references; streams keyed by seed, decider and keys; unbiased `below`;
`pick`; a crypto seed. The `Decider` type forces a registered name, so an unregistered draw doesn't compile.

Gaps: G5 above (no sweep, reader unchecked). 1221 also had weighted choice and `clamp/lerp/remap`
(`1221 core/rng.ts:115-135`); nothing needs them yet, so they're not gaps until a decider does. `newSeed` and
`seedToText` have no caller in `src/` (a new life isn't made anywhere yet; see core.frame 3).

Verdict: complete as a generator; the proof that deciders decide is missing (G5).

### core.money (`src/core/money/`)

Holds: integer minor units over ISO 4217 list one (155 currencies, sha-pinned XML), exact rationals, half-even
rounding, largest-remainder allocation, exchange through the dollar always marked an estimate with its dated rate.

Gaps:

1. **No money formatting (met on every screen that shows money).** Only `toMajor` ("1234.50",
   `money.ts:46-51`). No symbol, grouping, decimal separator or symbol position ("1.234,50 €" in Germany, "¥1,235").
   1221 had `formatMoney/formatMoneyCompact/currencySymbol` (`1221 core/money.ts:125-150`). Needs: a formatter in core
   (Intl/CLDR by the player's locale) and the symbol in `currencies.json`.
2. **One currency per country, where the cited source lists two (met daily by a life in those places).** ISO list one
   (R-0026, already in `vendor/iso4217/list-one.xml`) gives Panama PAB+USD, El Salvador SVC+USD, Haiti HTG+USD,
   Bhutan BTN+INR, Lesotho LSL+ZAR, Namibia NAD+ZAR, Venezuela VES+VED; `tools/money/compile.ts:28-48` drops the country
   entries and the gazetteer keeps one (`src/world/gazetteer/gazetteer.ts:40-43`): Panama's prices are in balboa, which
   has no notes; pay and prices there are in dollars. Needs: `currencies[code].countries` from list one, and per
   country the currencies in use with the one prices and pay are quoted in (research: the central bank's page).
3. **No cash rounding (met at every cash payment, once cash exists; `account.ts` already carries cash).** Canada,
   Australia, New Zealand, Switzerland, Sweden, Denmark, Finland, Ireland, the Netherlands, Belgium, Italy and others
   round cash totals (0.05, 0.10, whole kronor) while card payments aren't. Needs: per country a cash increment and
   rule, from the central bank or the law, and `roundCash(money, country)`.
4. **No currency by date.** List one is the current list (2026-09-17): a start date before Bulgaria's euro
   (2026-01-01) or Croatia's (2023-01-01) has no BGN or HRK. Depends on the owner's start date; needs list three and
   a changeover date per country only if the start date is earlier.

Verdict: the arithmetic is complete and exact; what a player sees and pays with (format, which currency, cash) is
missing.

### core.frame (`src/core/frame/frame.ts`)

Holds: a life as plain data; commands and kinds declared with slices read and written, held at run time by proxies;
atomic dispatch (a throwing command returns nothing, the life is untouched); the schedule in stable time order; time
passing in one or many steps to the same end; commitments that stop time; notices.

Gaps:

1. **`pass()` has no bound (met by any happening that schedules itself at its own moment, e.g. a daily kind with an
   off-by-one).** `frame.ts:275-289` loops while an item is due; `schedule` allows `at === now` (217). Probe: a kind
   that reschedules at `c.now` ran until my own guard stopped it at 5,001; without one the tab hangs. Needs: a cap per
   moment (or refuse `at === now` from inside a happening) with a red error naming the kind.
2. **A commitment can't lapse (met by any appointment the player doesn't answer).** A `wants: true` kind
   (`frame.ts:88-90`) stays on the schedule forever and time can't pass it. 1221's timeline had `missed`
   (`1221 core/scheduler.ts:18`). Whether time should stop for ever is the owner's call ("stops at commitments"),
   but the form needs a field for what happens when one is let go (a deadline and a `lapse` handler) or a recorded
   ruling that it never lapses.
3. **No life is assembled or validated.** `begin`, `waiting`, `assertJson`, `newSeed` have no caller in `src/`; each
   engine declares its own slice type and no type or test builds one life with every engine's slice. A life read from
   storage is checked only for its top-level shape (`contract.ts:74-99`); an item of an undeclared kind is found only
   when `pass` reaches it and throws (`frame.ts:282`). KEEP entry 2: "validates the universe, and only then hands it to
   the app"; 1221 had `validateUniverse` and `core/invariants.ts`. Needs: `validateLife` (seed, `now`, ids below
   `next`, schedule sorted, every kind and notice kind declared, every slice an engine's) run on load, and one test
   holding the cross-engine invariants MANDATE rule 7 names (money, dates, places, papers never contradict).
4. **No reaction between engines (below 1221).** 1221's event bus (`core/events.ts`) let a change in one system be
   met by others in the same transaction. Here an engine can only schedule another engine's kind, which means
   knowing it, or read its slice later. Not a gap until two layer-3 engines must react to each other at once
   (moving country and papers will); flag for layer 3/4.

Verdict: complete as a deterministic kernel; it needs the loop guard now, and validation and a lapse rule before a
life is opened from a save.

### core.text (`src/core/text/`)

Holds: `t()` over one catalog, slots that refuse to be left empty, the Title Case functions and check.

Gaps: no plural (1221 `core/text.ts:55`, `plural-check.mjs`), ordinal or list joining ("Bhutan, India and Nepal"),
so a `{years}`-style count will be written per engine; G2 (notices). Needs: plural/ordinal/list helpers that the voice
check reads, before the first counted line.

Verdict: complete for what it holds; the helpers come before layer 5.

### core.persistence (`src/core/persistence/`)

Against KEEP entry 1:

| KEEP entry 1 asks | Here |
|---|---|
| One adapter contract | Yes (`contract.ts:46-54`); `backup()` left for schema 2 (decided, HANDOFF) |
| IndexedDB with local-storage fallback | Yes, but only when `indexedDB` is absent (`local.ts:218-220`; gap 3) |
| gzip, `slate.gz1:`, plain still loads | Yes |
| Backup before every write, slot key last and whole | Yes, and better: a damaged life never becomes the copy (`local.ts:293`) |
| Deleting keeps a readable copy | Yes, but can fail on a full device (gap 1) |
| Damaged-save words, never the parser's | Yes (`life.damaged`, `life.not-slate`) |
| Server adapter, its functions, refusals in the player's words | Yes (`remote.ts`, `server/functions.ts`), handlers only; Deno entries and entity schemas wait on deployment |
| Server checks a save balances, belongs to this player, hasn't gone backwards | Two of three: no balance check (gap 4) |
| Retries on 5xx, 409, 429 only | Classified (`isRetryable`), not retried; same as 1221 |
| Meta: ... createdAt ... currency, endedAt | Reduced to id, slot, versions, playtime, `card` words (decided); `endedAt` lost (gap 6) |
| Schema version pinned in two places | Yes, `version.ts:6` and `server/guard.ts:10`, a test holds them equal |
| Startup's four stages exported for tests | Deferred to layer 5 by the agent's decision (HANDOFF), not the owner's |
| Held by "a save made at 2:37 opens at 2:37 and plays on identical" | No such test here (gap 2) |

Gaps:

1. **Deleting a life on a full device fails raw (met exactly when a player frees space).** `remove()` writes the copy
   before removing the life (`local.ts:300-305`), outside any try: on a full device the copy write throws a bare
   `QuotaExceededError`, which isn't a `PersistenceError`, so no catalog line reaches the player and the life isn't
   deleted. The device-full line tells them to "delete a save you no longer want". Needs: the same quota/refusal
   handling as `save()` (`local.ts:295-297`), and a delete that can go without the copy when the device is full (say so).
2. **Save-load-continue isn't held.** No test keeps a life holding real engines' slices and scheduled items, reads it
   back, passes time, and compares with the never-saved life (KEEP entry 1's own "What holds it"). Needs that test,
   with the clock and card slices.
3. **IndexedDB present but refusing.** A browser with `indexedDB` defined whose `open` fails (private modes, policy,
   a corrupt profile) gets `life.storage-unreadable` on every read; local storage is never tried (1221 behaved the
   same). Needs: fall back on an open error, not only on absence.
4. **No ledger, so the server's balance check can't exist (owner's ask, below 1221).** KEEP entry 1: the server
   "checks a save balances". 1221 held a double-entry ledger in core (`1221 core/ledger.ts`) and the guard summed it
   (`1221 base44/shared/guard.js:86-107`). HANDOFF deferred it "to banking (layer 3), when a ledger exists"; layer 3 is in
   progress and cards keep balances as running totals (`account.ts:231`: `h.purchases + h.cash`), not postings. Needs:
   the ledger as a core module (accounts, postings in minor units, balance as a sum), and the guard's balance rule.
5. **The device mirror is written and never read (decoration, MANDATE rule 2).** `ServerStore` saves to the device on
   every write, refused ones included (`remote.ts:72-76`), so a stale tab the server refused overwrites the mirror;
   nothing ever reads it. Needs: either a reader (offer the mirror when the server can't be reached, saying how
   recent it is) or removal.
6. **Smaller, each met rarely:** two tabs on one slot on the device, the stale one wins (the server refuses it;
   the device has no forward-progress rule; needs the guard's rule on the device or a Web Lock); no
   `navigator.storage.persist()`, so Safari may clear the device's lives after seven days without a visit (neither
   build asked; needs the request and a line if refused); `endedAt` for a finished life is gone from the meta (needed
   once a life can end); the server's entity schema and row-level security (1221 `base44/entities/SlateSave.json`)
   aren't in the repository, though `functions.ts` relies on them.

Verdict: the device store and server handlers meet KEEP entry 1 and improve on 1221 in two places. Left: gaps 1, 2
and 5 now; the ledger and balance check (4) with layer 3; 3 and 6 before release.

---

## Cross-department notes (for the money and world auditors)

- `src/money/cards/account.ts` keeps its days, months and ages in UT (core.time 1, 2).
- The gazetteer's single currency per country (core.money 2) is a world/money row as well.
- Rates and prices are snapshots; nothing moves pay or prices over a life's years (BUILD-ORDER: "how pay and prices
  move" in a currency). No core primitive for a dated series exists either.

## Summary of verdicts

| Engine | Verdict |
|---|---|
| Gate | Partial: screens-only feature matrix and zero-decoration (G1), no notice lines (G2), self-declared scopes (G3, G4), no decider sweep (G5), no re-proof rule (G6) |
| core.time | Zones, DST and sun complete; local-day arithmetic, age and formatting missing |
| core.rng | Complete generator; decider sweep missing (G5) |
| core.money | Arithmetic complete; formatting, multi-currency countries and cash rounding missing |
| core.frame | Complete kernel; loop guard, lapse rule and life validation missing |
| core.text | Complete for what it holds; plural, ordinal and list helpers missing |
| core.persistence | KEEP entry 1 met but for the balance check; delete-when-full, the save-load-continue test and the unread mirror to fix |

Not checked: the gate's live run and timings, the mutation report's survivors, the Base44 SDK's real `invoke` error
shape, and the browsers' storage behaviour (stated from the vendors' published behaviour, not tested here).
