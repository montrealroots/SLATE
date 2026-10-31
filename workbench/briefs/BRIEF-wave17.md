# Brief: wave 17, closing the form gaps of wave 16 (2026-10-31)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Read and follow
`$S/audit/BRIEF-wave16.md` exactly (with every brief it names, and its last section on archive.org, whose raw fetches
have been reset since about 02:05 UTC: try a few times with pauses, then record the snapshot and the failure). What
changed today, which this wave uses:

- **A licence's age may fall between birthdays** (papers.licence, `from` of the licence or card): whole years as before,
  or `{ "years": 17, "months": 6 }` (months 1 to 11), or `{ "years": 18, "days": 275 }` (days 1 to 364), never both.
  The age is the youngest a full licence is held at, by the source's own words or by adding the stages its law sets
  (16 learner + 6 months + ... as AU.02, MY and DZ do); write the arithmetic in the note. A text older than the rule
  in force isn't proof.
- **Cards may be `none`** (money.cards): `{ "country": "FK", "none": true, "note": ..., "sources": [...] }`, where a
  source says no bank in the place offers a credit card, or that the only bank(s) there offer none. A bank's list of
  debit cards alone is silence, not a statement: the source must say there is none (a regulator's or a government's
  page, a bank's own "we do not offer credit cards", a statute), or say the place's one bank and that it issues none.
  A place with no bank at all is handled already (its banks file's `none`). Writer `$S/bin/cw.py` (or gw.py
  money/cards), checker `$S/bin/chkcards.ts`.

Blocker files for this wave go to `$S/w17/blk/<engine>/<KEY>.json` (all five methods, today's attempts, dated
2026-10-31). Don't touch git, the register, HANDOFF, docs, code or other agents' keys.
