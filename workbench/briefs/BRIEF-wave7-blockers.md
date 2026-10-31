# Brief: wave 7, every blocker of layers 2 and 3 retried (research subagents, 2026-10-30)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`; its rules bind you). The owner (2026-10-30): "launch subagents to retry all the blockers in layers 2 and 3".
Read first `$S/audit/BRIEF-wave6.md` (sources, no bot-check circumvention, tools, writing through `bin/gw.py` and
checking with `bin/chk.mts`): all of it binds you. For cards the writer is `bin/cw.py` and the checker
`bin/chkcards.ts` (see `$S/bank/BRIEF-cards.md`); for credit `bin/crw.py` (see `$S/cr/BRIEF.md`).

## The job

Each of your blocked facts is a register entry `<engine>.blocked.<KEY>` in `research/register.json`, with `sought`
and the five methods' `attempts` as they were tried before (some name exactly what to try again: read them first, and
the engine's part of `HANDOFF.md`). For each:

1. Try again by every method, differently from before: the institution's other pages and documents (a ministry, the
   statistics office, the gazette, the central bank, a consulate abroad, a regional office), the statute or gazette
   site, searches in the country's own languages and other phrasings, trade press or an international body's report
   quoting the primary (the IMF's, the World Bank's, the UN's, SPC's, ECCB's, CARICOM's, the ILO's NATLEX, the
   ICAO/IATA Timatic-free official sources), and archive.org's availability API (`bash bin/wb.sh URL...`; the
   snapshots themselves can't be read here; say a snapshot exists, never that it was read).
2. If found: write the research file as the engine's form needs it (through the writer named above), so the country
   becomes researched; say so in your report with the file path. A fact that genuinely doesn't exist (no bank, no
   bureau, no national number) is written in the form's own way where the form has one (`none: true`), from a source
   that says so.
3. If not found: write `$S/w7/blk/<engine>/<KEY>.json` as `{ "attempts": [ {"method", "tried", "result", "date":
   "2026-10-30"} ...] }`, every one of the five methods present, each recording only what you tried today. The lead
   appends them to the entry's attempts (earlier attempts are kept).

Layer 2's forms aren't `gw.py`'s: weather (`tools/wmo/`, the national sets under `research/sources/*.json` and
`tools/research/`), holidays (`src/world/holidays/countries.json` rules and `research/sources/holidays/<CC>.json`, as
HANDOFF's "How a country is added" says) and prices (`research/sources/prices/<CC>.json`, `tools/prices/compile.ts`):
read the engine's compile and two finished files, write in the same form, and run the engine's build to check it
compiles (`npx tsx tools/<engine>/build.ts`; it rewrites the engine's JSON and coverage, which is fine, but don't
register: the build reads only registered files, so it will say your file isn't cited; check yours with the engine's
compile function directly instead, as `bin/chk.mts` does for the papers). Holidays' rules live in a source file:
change only your countries' entries.

## Don't touch

git, `research/register.json`, `HANDOFF.md`, `docs/`, other agents' countries or engines, code other than the data
files your engine's form names. No register scripts.

## Budget

Your web searches are in your prompt (the turn's are shared). Go to the institutions' own sites first. Biggest
places first where you can't do them all.

## Report

Per blocked fact: resolved (file, the main fact, its source) or still blocked (one line why). Short.
