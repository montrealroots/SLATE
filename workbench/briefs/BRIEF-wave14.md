# Brief: wave 14, the licence files rewritten in the three new forms (2026-10-30)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`; its rules bind you). Read `$S/audit/BRIEF-wave6.md` (sources; no bot-check circumvention; the owner's
ruling at its end: never change the user agent; writing through `$S/bin/gw.py`, run from `$S`, which checks every
' ... ' part of `said` against its saved page) and `tools/papers/licence/compile.ts` (its header, `document()` and
`term()`). Check every file you write with `npx tsx $S/bin/chk.mts papers/licence <KEY>` (see `$S/w13/L13A_1.py` for how
earlier waves built specs and called both).

## The forms, new today

1. `terms`: where the source sells the licence for more than one term the holder chooses, each at its own fee, the
   licence gives `"terms": [ {"years": 2, "fee": "250"}, {"years": 5, "fee": "600"}, {"forLife": true, "fee": "1500"} ]`
   (shortest first; a permanent licence last as `forLife`; a fee in UMA or UR as `{"count": "5.18", "unit": "UMA"}`),
   and then `"validYears": null` and `"fee": null` (each term holds its own). Every term and fee must be in a quoted
   part of a saved page; add the quote (from the same saved page) where the file doesn't have it yet.
2. `untilAge` as a list: where the source ends the licence at the first of several ages the holder reaches (a decade
   birthday, a renewal-age table), `"untilAge": [30, 40, 50, ...]` in order, each above the age it's issued from.
3. `issuedBy` a region: a territory whose people hold a region's licence (a country kept by regions, as Australia is)
   is `{ "country", "issuedBy": "AU.08", "note", "sources" }`, only where a source says that region's licence is the one
   used there.

## The job

Go through every licence file of your share (`research/sources/papers/licence/`, the list in your prompt): read its
note and its saved pages; where a source gives what one of the new forms holds, rewrite the file through gw.py with
it, everything else in the file kept as it is (name, issuer, age, sources, the note's facts; the note says what changed
and that it changed on 2026-10-30, past tense for what the file held before). A per-year fee (`perYear`) stays as it
is. Don't rewrite a file whose sources give one term only. No new research beyond your share's named places, and no
guessing: a term or age not in a saved page isn't written.

## Don't touch

git, `research/register.json`, `HANDOFF.md`, `docs/`, code, files outside your share, register scripts.

## Report

Per file rewritten: what changed and the quote it rests on. Files read and left as they were, in one line. Readings
to check.
