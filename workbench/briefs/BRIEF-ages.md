# Brief: papers.ages, what a person may do at what age, and what their sex changes (2026-10-31)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`). The owner, 2026-10-31: "Male and Female should matter in this game ... also age too as far as being
legally able to get this ... Realism is still something I want throughout this." Read first, and follow:
`$S/audit/BRIEF-wave6.md` ("Sources", "Writing a file", "A blocker": all bind you, NO bot-check circumvention, the
owner's "Keep the block; don't switch user agents"), and `$S/audit/BRIEF-wave16.md`'s last section on archive.org.
Then the form: `tools/papers/ages/compile.ts` (read it in full; the code wins).

## The form, per country (research/sources/papers/ages/<CC>.json, through `python3 bin/gw.py papers/ages <spec>`)

- `majority`: the age of majority (full legal capacity, contracts in one's own name), from the civil code or the
  statute that sets it. Where a first-level region's own law sets another (US states: Alabama 19, Mississippi 21,
  Nebraska 19; Canadian provinces 18 or 19), `regions: { "US.AL": 19, ... }` with the region keys of
  `src/world/gazetteer/regions.json`, each from its own statute. Emancipation by marriage isn't held: say so in the note.
- `work`: `from`, the youngest age the labour law lets a person be employed in general (not light work, not
  apprenticeship: say those in the note); `performers`: what the law says of a performer younger than that: `permit`
  (allowed with a permit or licence: name it as the law or the issuing office names it in `permit`, and `permitFrom`
  where the law sets an age below which none is given), `free` (the law leaves performing out of the age), or
  `barred`. ILO's NATLEX country profiles may point to the law; cite the law or the labour ministry.
- `service`: military service, `"none"` where the law asks none or the source says it isn't enforced (a suspended
  draft, as Germany's since 2011, is "none" with the note saying what remains), or `{ "sexes": ["male"] or
  ["male","female"], "from": age, "until": age, "months": length or null }` from the conscription law or the defence
  ministry: the ages a person can be called between, and the length of the ordinary term. Selective registration only
  (the US Selective Service) is "none" for service, the registration duty in the note (it's a duty a later form may hold).
- Any of the three you can't read: `null`, and the note says what was tried; a country with all three null is a
  blocker file instead (`$S/ages/blk/<CC>.json`, all five methods).
An age is whole years, or `{ "years": 17, "months": 6 }`, or `{ "years": 18, "days": 275 }`.

The note says each law's name, number and date in force, every reading made, and what the form doesn't hold (e.g.
consent rules for a minor's contract, a married minor's capacity, hours limits for young performers, the age to
register for service). Check each file with `npx tsx $S/bin/chk.mts papers/ages <CC>` from the repo (if chk.mts
doesn't know the engine, check with `node -e` importing compileAges from tools/papers/ages/compile.ts).

## Don't touch

git, `research/register.json`, `HANDOFF.md`, `docs/`, code, other agents' countries. No register scripts, no builds.

## Report

Short: written (country, majority, work from/performers, service), blocked (why), readings to check.
