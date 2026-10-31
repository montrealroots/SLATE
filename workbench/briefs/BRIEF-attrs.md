# Brief: a screenwriter's attributes, researched to the source (2026-10-31)

The owner of SLATE (a realistic actor/screenwriter/producer/director life simulator) asked for "every single
screenwriter attribute", "covering everything and every basis", from fresh research, not memory. An attribute is a
skill, ability, kind of knowledge or working trait that a real source says a screenwriter has or is judged on, hired
for, taught, or rewarded for. Not an attribute: a record (credits, guild units, agent, earnings) or who the person is
(sex, age, nationality).

## Rules (binding)
- Every attribute must be named by a source you read today. Quote the sentence verbatim (exact characters as on the
  page) and save the page: `curl -sSL --max-time 60 -o $S/dl/attrs/<slug>.html <url>` (PDFs as .pdf, and also
  `pdftotext` to .txt beside it). S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad
- Primary sources first: the institution's own pages and documents. A secondary source only if it quotes a primary,
  and mark it so with the primary's URL.
- No bot-check circumvention. Do not change the user agent or work around a block; if a page refuses, record it and
  try the institution's other pages, an official register, web search in other phrasings, trade press quoting the
  source, and web.archive.org (cite the snapshot URL). A source not reachable by all five is a blocker, named.
- Never fill a gap from memory. If no source names a thing, it is not on the list.
- Write only your output file. Do not touch /home/user/SLATE.

## Output: $S/attrs/out/<your-id>.json
{"agent": "<id>", "read": "2026-10-31",
 "attributes": [{"name": "<the source's own term>", "meaning": "<one plain sentence, from the source>",
   "sources": [{"url": "...", "saved": "dl/attrs/<file>", "said": "<verbatim quote>", "kind": "primary|secondary",
                "quotes": "<primary URL if secondary>", "rating": "<O*NET importance/level if any, else omit>"}],
   "judged_by": "<who rewards or tests it, from the source: a hiring rule, a judging criterion, a course>"}],
 "blockers": [{"sought": "...", "tried": {"institution": "...", "official-register": "...", "web-search": "...",
   "trade-press": "...", "archive": "..."}}]}
Keep each source's own term; the lead merges synonyms. Report back in under 150 words: counts, and anything odd.
