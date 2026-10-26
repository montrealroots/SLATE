# The Build Order

The new SLATE's code is built from the bottom up in this order, each layer proven (its tests, its coverage matrix,
its research register rows, the gate green) before the next is laid on it. Nothing in a later layer may be started
on an assumption about an earlier one. The order follows the mandate: foundations, then the world, then the person,
then the screens that read them, so that when a page is drawn every word on it already has something real behind it.

## 0. The repository and the gate

- The clean repository, with this package as its first commit under `docs/`.
- The toolchain: TypeScript, React, Vite, Vitest, ESLint, as this SLATE used them, pinned.
- The gate from day one: typecheck, lint, the test suite, and the checks that hold the mandate: the
  feature-to-effect matrix (every feature has a consumer at a file and line), the falsifiability tests, the
  coverage matrices (every engine, every country), the research register (every row cited and dated, blockers
  named), the text inventory (every player-facing string known and in the voice), zero-decoration (no string, control
  or figure without a reader). Every commit runs it; a red gate blocks the next layer.
- The checkpoint and handoff discipline this SLATE kept, so an interrupted build resumes.

## 1. The core

- Time: instants, zones, the calendar's arithmetic, DST, sunrise and sunset by latitude and date; proven against
  real zone rules for every zone family.
- Deterministic randomness keyed by the save's seed and a named decider, so every draw is reproducible and testable.
- Money: integer minor units, currencies, exchange as estimates said to be estimates.
- The simulation frame: state, commands, scheduled items, passages, notices, with every command's reader
  registered where it's declared (the matrix reads this).
- Persistence: the adapter contract, the local store (IndexedDB with the local-storage fallback, gzip, backup
  before every write), the server adapter, the schema version pinned in both places (`KEEP.md`, entry 1).

## 2. The world

- The gazetteer and the map: 252 countries and territories, every first-level region, 170,911 places, each with
  its zone, its country, its coordinates; the map's outlines; the pickers.
- Coverage matrix A, by country and territory, which every later engine fills a column of; and the research
  register that holds its sources.
- The clock as the player meets it: real time, paused, play, advance, stops at commitments.
- The weather: climate by place from researched normals for every country (the latitude model only behind a
  recorded blocker), the day's weather as a function of seed, place and day, the forecast.
- Holidays and the calendar by country.
- Prices and the cost of living by place, from researched indices.

## 3. The person's papers and money

- Citizenship, passports, ID, visas, residence and work permissions for every country, from the governments' own
  pages; the US package in the depth this SLATE reached, every other country to the same depth or a named blocker.
- Banking: every country's banks, fee sheets, account formats, cards, credit records; the currency the life is
  kept in; the family's starting means.
- Tax where the premise brings earnings; held until it does.

## 4. The person

- Identity: names (legal and preferred), pronouns, Billed As, birth date and age, birthplace, citizenship,
  languages, race or ethnicity; each with the reader the premise gives it, written and tested before the field is
  drawn (`KEEP.md`, entries 4, 13).
- Background: the family's means, the family's trade, where you grew up; their readers likewise.
- Genres: all 149 with their cited definitions and the reader the premise gives them, each with its matrix row
  (entry 12).
- The portrait as a kept image with its reader (open until the premise).

## 5. The screens

In the player's order, each drawn only from state that layers 1 to 4 already hold and test:

1. Startup (entry 1).
2. Slots (entry 2).
3. Creation: Identity, Background, Genres, Starting Point (Your Money), Review (entries 3, 9, 12, 14, 15).
4. Home: the top bar, the menu (Player Profile, Money, Papers), the greeting and town line, the weather, What Needs
   You, Up Next and the calendar, Recent Updates (entries 16 to 19).
5. The pages behind the menu and the calendar, in the order they were reviewed, each after its engine.

## 6. The voice

The rewrite of every string in the owner's voice, screen by screen, against the text inventory, with the voice
checks in the gate, once the screens are drawn and before the first release.

## 7. Verification, end to end

Long played lives on real clocks across many places; the falsifiability twins for every claim; the coverage
matrices complete; the research register complete or blocked by name; the gate green in a clean clone; the
receipt and the handoff. Only then is a build "done" in the mandate's sense.
