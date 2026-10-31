# Brief: depth audit of layers 0 to 3 (read-only auditors, 2026-10-30)

The owner (2026-10-30): "make sure everything in layers 0-3 is fully fleshed out in their certain department covering
every single detail leaving no basis untouched when it comes to said feature for each."

You audit one department of the new SLATE (/home/user/SLATE). Read first: `CLAUDE.md`, `docs/MANDATE.md`,
`docs/BUILD-ORDER.md` (layers 0 to 3), `docs/KEEP.md` entries 1, 4 to 7, 14, 18 and 19, and the parts of `HANDOFF.md`
on your engines. The first SLATE is at /home/user/1221 (read-only): its US package and banking are the depth floor
the build order names ("the US package in the depth this SLATE reached, every other country to the same depth").

## The job

For each engine in your department, compare what it holds (its research form in `tools/<...>/compile.ts`, its engine in
`src/<...>`, its tests, its coverage matrix in `coverage/`) with everything the real-world thing it models has that a
life would meet, and with what the owner's documents ask. List every gap:

1. **Dimensions missing from the form**: a real rule, fee, term, process, time, condition or exception that exists in
   the real world for this thing, that a life would meet, and that the form has no place for (example for passports:
   a child's passport, the processing time, an urgent service, renewal from abroad, validity). Say how a player would
   meet it, and what the form would need.
2. **Depth below the first SLATE**: anything the first SLATE (/home/user/1221) modelled for this thing that the new
   build doesn't (name the file in 1221).
3. **Owner's asks not met**: anything `BUILD-ORDER.md` or `KEEP.md` names for your layer that has no engine or only
   part of one (example: residence permissions; "how pay and prices move" in a currency; account formats).
4. **Shallow rows**: countries whose research file leaves out terms the form already holds where the country's own
   source would give them (a count per engine and the worst examples; use scripts over `research/sources/...`).
5. **Read, bite, downstream**: any part of an engine nothing reads, or that changes no outcome.

Out of scope (the owner's rulings): tax (held until the premise brings earnings), unions, casting markets, the career,
the body, energy and anything in `KEEP.md` entries 8, 10, 11, 16 and 17. Layer 4 (the person) and layer 5 (screens)
aren't audited.

## Rules

Read only: no edits to any file in /home/user/SLATE or /home/user/1221, no git, no web searches (the turn's searches
are kept for the blocker retries). Write your report to `$S/audit/<DEPT>.md` (S =
/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad) and return it short: for each engine, the gaps
ranked by how often a life meets them, each with the form change it needs, and a verdict (complete, or what's left).
Be concrete and cite file:line. Don't pad: a gap a life would never meet isn't one.
