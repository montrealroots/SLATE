# Brief: the real figures behind the screenwriter's model (2026-10-31)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator): "Is there actual research behind each
attribute also? Again I want facts and realism." The screenwriter's engines (src/person/work/work.ts and career.ts)
use figures the game made up (register R-4605 and R-4606, read their `value` in research/register.json). Your job:
find the REAL figure, from a primary source, for each item in your share, so the game's guess can be replaced.

## Rules (binding; the repo's CLAUDE.md binds you too)
- Primary sources first: the institution's own pages and documents (the WGA's agreements, reports and guides; the
  Black List's and the Nicholl's own published statistics; government statistics; peer-reviewed studies). Trade press
  (Deadline, Variety, The Hollywood Reporter, Screen Daily) or a data researcher's published analysis of their own
  survey (e.g. Stephen Follows) counts as secondary unless it is the primary's own data, and must name what it rests on.
- Quote the sentence verbatim and save the page: S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad
  `curl -sSL --max-time 60 -o $S/dl/calib/<part>-<slug>.html <url>` (PDFs as .pdf plus `pdftotext -layout` and
  `pdftotext -raw` beside them as .txt and .raw.txt). curl's default user agent; no bot-check workaround.
  web.archive.org reset most connections today: try it once per blocker and record it.
- Never fill a gap from memory. A figure not found after all five methods (the institution, an official register or
  dataset, web search in several phrasings, trade press quoting the primary, the archive) is a blocker, with each
  attempt written down.
- Write only $S/calib/out/<part>.json and files under $S/dl/calib/. Do not touch /home/user/SLATE. No subagents.
- Before finishing, check every quote is in its saved page (whitespace-normalised).

## Output: $S/calib/out/<part>.json
{"part": "<part>", "read": "2026-10-31",
 "figures": [{"item": "<the item id from your share>", "finding": "<the real figure in one plain sentence>",
   "value": <number, range or object, with units>, "applies": "<where and when it holds: country, years, which writers>",
   "sources": [{"url": "...", "title": "...", "saved": "dl/calib/<file>", "said": "<verbatim quote>",
                "kind": "primary|secondary", "quotes": "<primary URL if secondary>"}],
   "replaces": "<which game figure it stands for, and how the game should use it, in one sentence>"}],
 "blockers": [{"item": "...", "sought": "...", "tried": {"institution": "...", "official-register": "...",
   "web-search": "...", "trade-press": "...", "archive": "..."}}]}
Report back in under 150 words: items found, items blocked, anything surprising.
