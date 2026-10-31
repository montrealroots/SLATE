# Brief: the four roles, researched to the source (2026-10-31)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`; its rules bind you). The owner, 2026-10-31: "To begin layer 4, I first need you to research and get all
the depth on a Screenwriter, Producer, Director, and Actor/Actress." The life's character is always "Writer, Producer,
Director, and Actor or Actress" (HANDOFF, "Questions for the owner"). This research is what the owner will set the
premise from, and what the person and career engines will later read: so every fact must be one an engine could use
(a rule, a step, a figure, a threshold, a time, a requirement, a credit form, a path), with its source.

## Sources (as every wave)

Read `$S/audit/BRIEF-wave6.md` sections "Sources" and "Writing a file": they bind you (primary first; secondary only
where it states the primary, `kind: 'secondary'` with `quotes`; no AI guides, aggregators, forums, Wikipedia except to
find the primary; NO bot-check circumvention; the owner, 2026-10-30: "Keep the block; don't switch user agents").
web.archive.org may be read (BRIEF-wave16.md's last section) but has been resetting raw fetches since 02:05 UTC today.
Primary here means: the guild's or union's own agreement, rules, constitution, rate sheets and manuals (WGA, DGA,
SAG-AFTRA, PGA, Actors' Equity, IATSE where relevant, and their counterparts abroad); a government's own pages (US BLS
Occupational Outlook Handbook and OES/OEWS wage tables, O*NET, national statistics offices, film agencies, tax-credit
offices); an awarding body's own rules (the Academy's, the Television Academy's, BAFTA's); a festival's or market's own
rules; a school's own catalogue for training paths. Trade press (Variety, The Hollywood Reporter, Deadline, Screen
Daily) only quoting a primary, as `secondary`.

## What "all the depth" means for your role

For your role, as far as the sources go, each with its source:
1. The work itself: what the person does, step by step, through a project's life (development, pre-production,
   production, post, release), and the kinds of work (film, series TV, streaming, theatre, commercials, games, voice,
   new media) with how each differs.
2. The ladder: the titles and levels in order (e.g. staff writer to showrunner; PA, AD, director; background,
   day player, series regular; producer credits), what moves a person up, and how long it typically takes where a
   source measures it.
3. Getting in and getting work: training and schools, the first credits, representation (agents, managers, their
   licensing and commission caps), how work is found and won (pitches, specs, auditions, self-tapes, festivals,
   markets, fellowships and labs), and what it costs.
4. Pay: every minimum the agreements set (by medium, budget tier, term), how pay is structured (fees, weekly and day
   rates, step deals, overscale, backend, residuals and how they're computed), real earnings distributions (BLS
   percentiles, guild earnings reports), and the agreements' term dates.
5. The union or guild: membership routes and requirements, initiation fees and dues, pension and health plans and
   their earnings thresholds, working rules a member is held to (e.g. Global Rule One), strikes in force or recent.
6. Credit: the credit forms and the rules that decide them (WGA's Screen Credits Manual, DGA's one-director rule,
   PGA's "p.g.a." mark, SAG-AFTRA billing), and how credits are contested.
7. Recognition: awards that matter for the role, their eligibility rules and voting membership.
8. Combinations: what the agreements say when one person holds two or more of the four roles (writer-director,
   actor-producer, hyphenates, the DGA/WGA rules on a director who wrote), since the life holds all four.
9. Time and money of a project: how long each stage takes and what it costs, where a source states it.

The US is the depth reference (the owner: "the US package in the depth this SLATE reached"); the world agent covers
the other countries.

## Writing

Your file is `research/sources/person/roles/<key>.json`, written through gw.py (`python3 bin/gw.py person/roles
<spec>.json` from `$S`; key as your prompt says). Its form:
`{ "key": "<key>", "role": "<role>", "topics": [ { "topic": "<one of the nine above, by name>", "facts": [ { "fact":
"<one plain sentence, true by the source>", "value": <optional structured figure: an amount with currency and period,
a duration, a count, a list of titles in order>, "src": [<indices into sources>], "asOf": "<the date the source's rule
is in force from, YYYY-MM-DD, where it gives one>" } ] } ], "sources": [ ... as BRIEF-wave6 says ... ], "note": "<what
was read, each document's date, every reading made, what wasn't found>" }`. Every fact cites at least one source;
every source's `said` is checked against its saved page by gw.py. A fact not found after real effort is listed in the
note as not found (with what was tried), never guessed. No figure worked out by you from others unless the note says
how and the parts are each sourced.

Write in several passes (one gw.py run per topic or two is fine; each run rewrites the whole file, so build the spec
cumulatively). Save pages under `$S/dl/roles-<key>/`, scripts under `$S/roles/<key>/`.

## Don't touch

git, `research/register.json`, `HANDOFF.md`, `docs/`, code, other agents' files. No register scripts, no builds.

## Report

Short: the topics covered with their fact counts, the key figures (minimums, thresholds) with sources, what wasn't
found, and the readings the lead should check.
