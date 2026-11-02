# Brief: every country's terms for the actor, the writer, the director and the producer (2026-11-01)

The owner of SLATE: every engine that reads a country covers all 252 of the map's countries and territories; the four
roles' markets cover 21 (research/sources/person/markets/<CC>.json for the actor, <role>-<CC>.json for the writer,
the director, the producer; read two or three of them first: their form and depth are the standard, and
`workbench/briefs/BRIEF-markets.md` and `BRIEF-roles-markets.md` state what each role's facts are). Asked whether to
research the other 231 now: "Want it done now." The main law in CLAUDE.md binds you. Your prompt names a list of
countries. For each, find from the sources that set them:

- `actor.*`: any collective agreement, union rate card or statutory rule that sets a performer's pay in film,
  television or the stage (its name, signatories, years, minimums by role, tier and term, currency and dates), the
  actors' union and how one joins.
- `writer.*`: the same for a screenwriter (the guild, its agreement, minimum fees by form, option terms).
- `director.*`: the same for a director (the guild, minimum fees, guaranteed periods, cut rights).
- `producer.*`: the national film fund(s) (share, cap, selection rate), the production incentive (rate, base, cap),
  fee caps, films made and released.
- `language` and `market`: the language film and television is made in there and the city where most of it is made.
- `none`: for each role, where no agreement or fund sets anything, a source saying so (a guild's or ministry's page,
  a labour code with no sector agreement in its register, the national film body's own statement, UNESCO's or the
  European Audiovisual Observatory's country profile) is a finding, not a blocker; a territory whose film work follows
  its sovereign's rules says so from a source and names the sovereign ("follows").
A country with almost no film or television industry still gets its file: what its labour code and culture ministry
say, and the blockers where nothing is published.

## Rules
Those of `workbench/briefs/BRIEF-markets.md` (primary first; quote verbatim and save under
$S/dl/markets-world/<CC>-<slug>; nothing past a refusal or a bot check; web.archive.org may be read with snapshot
URL and date; the web-search budget may be spent, so fetch institutions directly; five methods before a blocker;
`saved` paths in full; check every quote). Write only $S/markets-world/out/<CC>.json in that brief's output form, the
items named as above (`actor.rates`, `writer.fees`, `producer.incentive`, `none` with `value.role` ...). No subagents.
Report back in under 150 words.
