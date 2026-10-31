# Brief: the four roles' rules, country by country (2026-10-31)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`). The owner, 2026-10-31: "Also note how each of these rules are covered and however many countries you
can possibly get research on. Everything should uniquely be attached to wherever its at just like in the real world."
And: "every single feature ... to have downstream effects ... depth covering every basis for each feature."
Read and follow `$S/audit/BRIEF-roles.md` (sources, the form of a fact, gw.py) and the briefs it names (no bot-check
circumvention; "Keep the block; don't switch user agents"; archive.org may be read when it answers). Read the US
depth reference first: `research/sources/person/roles/{screenwriter,director,actor,producer,production}.json`, and
what `research/sources/person/roles/world.json` already holds for your countries (carry its facts and sources into
your file where they're your country's; don't contradict it without a newer source).

## Your file, per country

`research/sources/person/industry/<CC>.json` through `python3 bin/gw.py person/industry <spec>` (key the country
code), in the roles' form: `{ "key", "country": "<CC>", "topics": [ { "topic", "facts": [ { "fact", "value"?, "src",
"asOf"? } ] } ], "sources", "note" }`, with these topics, each as far as the country's own sources go:
1. `writers`: the screenwriters' guild or union, its agreement's minimums (film, TV), membership terms;
2. `directors`: the same for directors;
3. `actors`: the actors' union, its minimum day/week rates for screen work, membership terms, and the rules on agents
   (licensing, commission caps);
4. `producers`: the producers' association, the screen incentive (its rate, caps, who qualifies) and the national film
   agency's funding;
5. `minors`: what a child performer needs (permit or licence, issuing office, hours, schooling, the share of earnings
   set aside), from the law;
6. `awards`: the national screen awards, and whether their acting categories are split by sex or gender-neutral
   (with the year it changed and the body's own words);
7. `ratings`: the film/TV classification body and its age bands;
8. `industry`: how many films (and where given, series) the country produces in a year, and its box office, from the
   national agency's or statistics office's own figures.
A topic the country has nothing for (no guild exists) is a fact saying so only where a source says so; otherwise the
note lists it as not found with what was tried. A country where nothing at all is found gets a blocker
(`$S/industry/blk/<CC>.json`, all five methods) instead of a file.

## Don't touch

git, `research/register.json`, `HANDOFF.md`, `docs/`, code, other agents' countries. No register scripts, no builds.

## Report

Short: per country the topics written with fact counts and the key figures, blocked countries (why), readings to
check.
