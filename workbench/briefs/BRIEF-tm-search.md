# Brief: the depth round's web search, the tax and the markets (2026-11-02)

The owner of SLATE: "Again I want depth covering every basis for every feature leaving NO STONE UNTURNED", and "Run
the tax and markets web searches now." (`BRIEF-depth-round.md`, item 1.) Read `BRIEF-tax.md` and `BRIEF-tax-retry.md`
for the tax, `BRIEF-markets-world.md` and `-retry.md` for the markets: their rules and form bind you, as the main law
in CLAUDE.md does. 710 blockers in $S/tax/out/ and $S/markets-world/out/
(S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad) have never had a web search run.
Your list ($S/tm-search-<n>.txt: folder, country, item) is in priority order: a resident's tax, contributions and
withholding, a performer's, writer's and director's pay, a fund and an incentive first; the rest after.

For each, in order: search at least two phrasings, in English and in each of the country's own languages (the
authority or the body with the fact; the law's name with the figure; the fact with the country). Follow every result
that may be the primary or names it. A result that sets the fact makes it a finding by the briefs' rules (primary
first, quoted verbatim, saved under $S/dl/tax/ or $S/dl/markets-world/ as <CC>-<slug>; a secondary only with `quotes`
set to exactly the primary's URL, any note in `quotesNote`); one that doesn't adds this attempt to the blocker's
web-search method: the exact queries and what they returned.

The web search is shared by six agents and capped at 200 a turn: when it refuses, stop searching, record the refusal
on the blockers you reached, and report where you stopped (the next turn resumes there). Never bypass a bot check or a
refusal; never switch user agents. Check: `python3 -I $S/vtools/vq.py <dir of symlinks to the files you touched>`
bad 0, and no secondary's `quotes` fails `^https?://\S+$`. Edit only the items you work on, in your countries' files;
never delete another agent's file. No subagents, no repo edits. Report back in under 120 words: how many blockers
searched, how many found, where you stopped.
