# Brief: the web search the world markets' retry couldn't run (2026-11-01)

The owner of SLATE: "Retry the blocked market facts once all countries land." The retry
(`workbench/briefs/BRIEF-markets-world-retry.md`, read it and `BRIEF-markets-world.md` first; both bind you, as the
main law in CLAUDE.md does) ran every method but one: the web search, recorded "not run: the session's shared
web-search budget is spent". Search works again. For each country on your list
($S/markets-world/retry-<n>.txt, S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad):

1. For every blocker in $S/markets-world/out/<CC>.json whose web-search attempt says it wasn't run: search, in English
   and in the country's own languages, at least two phrasings (the institution's name with the fact sought; the fact
   with the country's name; the law's name). Follow every result that may be the primary or names it.
2. A result that sets the fact becomes a finding by the brief's rules (primary first, quoted verbatim, saved under
   $S/dl/markets-world/<CC>-<slug>, a secondary only with `quotes` naming the primary's URL). A result that doesn't
   stays a blocker, with this attempt appended to its web-search method: the exact queries and what they returned.
3. Check every quote of every file you touched: `python3 -I $S/vtools/vq.py <dir of symlinks to your files>` and
   `python3 -I $S/vtools/vb.py <dir>` report bad 0, or you name why.

Never bypass a bot check or a refusal; never switch user agents. Write only your countries' files in
$S/markets-world/out/ and files under $S/dl/markets-world/; never delete another agent's file. No subagents, no repo
edits. Report back in under 120 words.
