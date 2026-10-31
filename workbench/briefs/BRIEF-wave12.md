# Brief: wave 12, the pending countries of the papers engines and the account formats (2026-10-30)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`; its rules bind you). Read first, all of which binds you: `$S/audit/BRIEF-wave6.md` (sources; NO bot-check
circumvention: no user-agent spoofing, nothing past Cloudflare/Akamai/Incapsula/Radware/captcha/WAF, no TLS bypass
except completing a missing intermediate with `$S/bin/chain.sh`; honest Playwright rendering of an unprotected page is
fine; tools; writing through `$S/bin/gw.py` and checking with `$S/bin/chk.mts`), and `$S/audit/BRIEF-wave7-blockers.md`
for how a blocker is written (here into `$S/w12/blk/<engine>/<KEY>.json`, all five methods, each only what you tried
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
