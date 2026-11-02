# Brief: markets for the writer, the director and the producer (2026-11-01)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator), told why the other three roles should
work in the same markets as the actor: "Now add markets for writers, directors and producers." Today the screenwriter
works under the WGA's terms (US), the director under the DGA's (US), the producer in the UK (the BFI, the UK's
credits, the BFI's release figures). Your prompt names one role and the countries to cover. For each, find the real
terms that role works on there, from the bodies that set them, to the depth of the role's existing research (read it
first: the screenwriter's `research/sources/person/work/screenwriter-calibration.json` R-4608 and the WGA figures it
names, the director's `director-calibration.json` R-4613, the producer's `producer-calibration.json` R-4612, which
already holds some of the CNC's, Telefilm's and Screen Australia's figures: re-read those, don't repeat them).

## The facts sought, per country
- Writer: the writers' guild or union and its agreement with producers or broadcasters (its name, signatories, the
  years it runs); the minimum fees it sets (a feature screenplay, a treatment, a TV episode or hour, by budget tier
  where it distinguishes), the option or purchase terms it sets, how writing steps are paid; how one joins and what it
  costs; where no agreement sets a writer's pay, a source saying so.
- Director: the directors' guild or union and its agreement; the minimum fees (a feature by budget tier, a TV episode
  by length), the guaranteed prep, shoot and cut periods and the director's cut rights; how one joins and what it
  costs; where none, a source saying so.
- Producer: the national film fund(s) (the fund's name; what it funds; its share of a budget and its cap; how many
  applications it funds of how many, where published); the production incentive (rate, what it counts, its cap, who
  qualifies); any cap on the producer's fee and overheads a funder sets; how many films are made, released and earn
  back, by budget where published; the producers' association.
- For every role: the language work is made in and the city where most of it is made, from a source, where the
  actor's market research (`research/sources/person/markets/<CC>.json`) doesn't already give it (don't repeat it).

## Rules (binding; the repo's CLAUDE.md binds you too)
- Primary sources first: the agreement's text (an official gazette's extension order, a ministry's register, the
  guild's or the producers' association's own published rate card), the fund's or the tax authority's own pages and
  guidelines. Secondary must name the primary it quotes as a URL in `quotes`.
- Quote verbatim and save the page: S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad
  `curl -sSL --max-time 60 -o $S/dl/roles-markets/<role>-<CC>-<slug>.html <url>` (PDFs with `pdftotext -layout` and
  `-raw` beside them; scans by tesseract, saved beside them, the source marked `"ocr": true`, each figure checked
  against the image). curl's default user agent. A page that refuses or bot-checks this environment is NOT read
  another way. web.archive.org snapshots may be read and cited with the snapshot URL and date. The web-search budget
  may be spent: fetch the institutions directly.
- Never fill a gap from memory. A fact not found after all five methods (the institution, an official register or
  gazette, web search, trade press quoting the primary, the archive) is a blocker, each attempt written down.
- Write only $S/roles-markets/out/<role>-<CC>.json and files under $S/dl/roles-markets/. Do not touch /home/user/SLATE.
  No subagents. Write `saved` paths in full.
- Before finishing, check every quote is in its saved page (whitespace-normalised).

## Output: $S/roles-markets/out/<role>-<CC>.json
{"role": "writer|director|producer", "country": "<CC>", "read": "2026-11-01",
 "figures": [{"item": "<agreement|fees|option|periods|cut|union|fund|incentive|feecap|outcomes|language|market|none>",
   "finding": "<one plain sentence>", "value": <object with units, currency and dates>, "applies": "<where, when, to whom>",
   "sources": [{"url", "title", "read": "2026-11-01", "said", "kind": "primary|secondary", "quotes"?, "saved", "ocr"?}]}],
 "blockers": [{"item", "sought", "tried": {"institution", "official-register", "web-search", "trade-press", "archive"}}]}
Report back in under 150 words: what was found per country, what is blocked.
