# Brief: the research behind identity, background, genres and the portrait (2026-11-01)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator): "Continue on to the rest of layer 4."
Every field of the person (names, pronouns, Billed As, birth date, birthplace, citizenship, languages, race or
ethnicity), the background (the family's trade, where you grew up), the 149 genres and the portrait must be read by an
engine that changes an outcome the player meets, on real figures (workbench/plans/layer4-identity.md says which). Your
prompt names your part. Find, from primary sources first, every figure in it.

## Rules (binding; the repo's CLAUDE.md binds you too)
- Primary sources first: the institution's own pages and documents (unions' and guilds' agreements, constitutions and
  membership pages; government statistics and registers; Unicode CLDR's data files; peer-reviewed studies; a
  researcher's own published dataset, e.g. USC Annenberg's or Stephen Follows's, counts as primary with its basis
  named). Trade press is secondary and must name the primary it quotes.
- Quote verbatim and save the page: S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad
  `curl -sSL --max-time 60 -o $S/dl/identity/<part>-<slug>.html <url>` (PDFs as .pdf plus `pdftotext -layout` and
  `pdftotext -raw` beside them as .txt and .raw.txt). curl's default user agent. A page that refuses or bot-checks
  this environment is NOT read another way (no other fetcher, no WebFetch of a refused page, no user-agent change):
  record it under the blocker. web.archive.org snapshots may be read and cited with the snapshot URL and capture date.
- Never fill a gap from memory. A figure not found after all five methods (the institution, an official register or
  dataset, web search in several phrasings, trade press quoting the primary, the archive) is a blocker, each attempt
  written down.
- Write only $S/identity/out/<part>.json and files under $S/dl/identity/. Do not touch /home/user/SLATE. No subagents.
- Before finishing, check every quote is in its saved page (whitespace-normalised).

## Output: $S/identity/out/<part>.json
{"part": "<part>", "read": "2026-11-01",
 "figures": [{"item": "<item id from your share>", "finding": "<the real figure or rule in one plain sentence>",
   "value": <number, range or object, with units>, "applies": "<where and when it holds>",
   "sources": [{"url": "...", "title": "...", "saved": "dl/identity/<file>", "said": "<verbatim quote>",
                "kind": "primary|secondary", "quotes": "<primary URL if secondary>", "basis": "<if a dataset's owner>"}],
   "use": "<how the game should read it, one sentence>"}],
 "blockers": [{"item": "...", "sought": "...", "tried": {"institution": "...", "official-register": "...",
   "web-search": "...", "trade-press": "...", "archive": "..."}}]}
(The genres parts use the form their prompt gives.)
Report back in under 150 words: items found, items blocked, anything surprising.
