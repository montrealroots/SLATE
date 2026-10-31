# Brief: wave 15, the pending countries of the papers engines and the account formats (2026-10-30)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`; its rules bind you). Read first, all of which binds you: `$S/audit/BRIEF-wave6.md` (sources; NO bot-check
circumvention: no user-agent spoofing, nothing past Cloudflare/Akamai/Incapsula/Radware/captcha/WAF, no TLS bypass
except completing a missing intermediate with `$S/bin/chain.sh`; honest Playwright rendering of an unprotected page is
fine; tools; writing through `$S/bin/gw.py` and checking with `$S/bin/chk.mts`), and `$S/audit/BRIEF-wave7-blockers.md`
for how a blocker is written (here into `$S/w15/blk/<engine>/<KEY>.json`, all five methods, each only what you tried
today, date 2026-10-30). Then the engine's part of `HANDOFF.md` (search "Wave 9") and its compile
(`tools/<engine path>/compile.ts`), and three finished files of your engine in `research/sources/<engine path>/`.

## The job

Your countries are in the list file named in your prompt, biggest first. For each: research it from the institution's
own pages and the law (every method of BRIEF-wave6), write its file through gw.py, check it with chk.mts. A country you
can't do after all five methods: a blocker file. Biggest first; do as many as you can, properly.

## What the lead refused in wave 8, so don't do it

The lead held back (into `research/held/`) every file whose key value was the agent's reading rather than what a source
says. Don't write:
- a length guessed from examples, or fixed for a number that varies (write the range the source gives, if the form
  takes one, or block);
- a currency, an age, a time or a deadline inferred, borrowed from another permit or document, or read off a table's
  layout;
- a right to work, a place to apply, or who charges a fee "read into" a page that doesn't say it;
- one fee standing for another (a test fee for an issuing fee, a renewal's for a first issue's): leave the fee null
  and say so in the note;
- a territory pointed at another country's paper (`issuedBy`) on citizenship or sovereignty alone: the source must say
  that paper is the one used there;
- a blocker with a method "not tried": try all five, or write no blocker.
A null with a note saying what wasn't found is right; a plausible value without its source is wrong. If the form can't
hold what the source says, say so in your report instead of bending the fact.

Files held in `research/held/<engine path>/` that are your countries: read the file and its HANDOFF line; if today you
find the one fact it lacks from a source that says it, write the file again through gw.py into
`research/sources/<engine path>/` (don't move the held file; the lead does).

## Don't touch

git, `research/register.json`, `HANDOFF.md`, `docs/`, code, other agents' countries, register scripts,
`research/held/`. Don't run Stryker or the full test suite (memory: eight agents share the machine).

## Budget

About 22 web searches (shared across the turn's agents); institutions' own sites first.

## Report

Short. Written (country, main facts, source); blocked (one line why); not reached; readings to check (anything a lead
should verify).

## Wave 10 additions

Wave 9's agents left notes of what they tried for many of these countries (in HANDOFF "Wave 9" and in the scratchpad's
`w9/` scripts and `dl/` pages): read them, and don't repeat a probe that failed today unless by a different way. Where a
country's site was unreachable in wave 9 and is again today, try every other method and, if all five fail, write the
blocker (all five, today's attempts only): a country tried and left with no blocker is the worst outcome.

## Wave 13 additions

A fee set in an index unit is now written as `{ "count": "6", "unit": "UMA" }` (with `"plus": "333"` for an amount in
the currency the office adds on top), where the unit is one the game holds: Mexico's UMA and Uruguay's UR are being
added today (until they're registered, chk.mts refuses a file that names one: that's expected, say so in your report).
A fee in any other unit (Chile's UF, Colombia's UVT, Uruguay's UI, ...) stays null with the unit and its count in the
note, as before. Never write a currency amount you worked out from a unit's value.

## The owner, 2026-10-30

"Keep the block; don't switch user agents." A site that refuses the client by the name it declares is blocked: record it in the five methods; never change the user agent (to a browser's, curl's default or any other) to get past a refusal.

## Wave 15: no country left pending

This wave closes the matrix: every country on your list ends either written (researched) or blocked, with all five
methods tried today and recorded. "Not reached" isn't an outcome this time. Work through the list in order; give each
country an honest try by each method (the institution's own site; the official register or gazette; a web search in
the country's own language and in English; trade press or an international body quoting the primary; the archive's
availability API), and if none gives the fact, write the blocker and move on. A country whose site doesn't answer at
all still gets the other four methods. Keep each search sharp, since the turn's searches are shared: one well-phrased
query in the country's own language often does the work of three.

The forms as they stand today (read the compile before writing): licences take `terms` (each with its fee and,
where set, `foreignFee`, `for`, `perYear`, `from`/`under`, or `untilAge`), `untilAge` as one age or a list,
`forLife`, unit fees in UMA, UR, VFU or NTRU, and `issuedBy` a region; residence routes may leave `apply`/`work` out,
take `for: 'general'`, and a place may be `free` or `none`; numbers take `min` with or without `length`.
