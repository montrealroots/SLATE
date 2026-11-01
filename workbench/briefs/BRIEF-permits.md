# Brief: the work permit a foreign performer needs, country by country (2026-11-01)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator), told that an actor without the right
to work in a country can't take a part there because the game holds no work permits: "we didn't do work permits in
layers 0-3 ... stay true to the factual and realism and cover that across the game's world map." Layer 3 already
holds, per country, whether a passport may work there freely or needs a permit, and the permit's route for a
performer (`src/papers/work/work.json`, from `research/sources/papers/work/<CC>.json`, register `papers.work.<CC>`;
read your countries' files first, and `coverage/work-countries.json`). What it lacks is the permit itself. Your
prompt names a list file of country codes. For each country, find the permit a foreign film, television or stage
performer (and, where the route differs, a screenwriter or a director) must hold to be engaged there.

## The facts sought, per country
- `route`: the permit's name as the government names it (correct layer 3's where the research finds otherwise, and say so).
- `applies`: who applies (the employer or engager, an agent, a sponsor, the worker), and what must come first (a job
  offer, a petition, a labour-market test, a certificate of sponsorship, an arts body's endorsement).
- `fees`: each government fee for it (application, visa, issue, premium processing), amount and currency.
- `processing`: how long a decision takes as the government states it (standard; premium where offered).
- `validity`: how long it is granted for (the most at once), and whether it can be extended or renewed.
- `union`: a union or guild consultation, notice or approval the law or the code asks (the US O-1's consultation; the
  UK Creative Worker code's notice to Equity; Australia's union consultation for the 408 entertainment stream).
- `eligibility`: the criteria the performer must meet, in one sentence quoted (e.g. "extraordinary ability").
- `pay`: any minimum pay or market-rate rule.
- `exempt`: an engagement short enough to need no permit, if the law says so (days within a period).
- For the five countries layer 3 holds as free to every passport (AM, KZ, SI, SJ, UA), confirm or correct it.

## Rules (binding; the repo's CLAUDE.md binds you too)
- Primary sources first: the immigration authority's or ministry's own pages, forms, fee schedules and laws (official
  gazettes, legislation databases), an embassy's own page. Secondary (a law firm, an employer of record, trade
  press) must name the primary it quotes, and is used only after the primary fails.
- Quote verbatim and save the page: S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad
  `curl -sSL --max-time 60 -o $S/dl/permits/<CC>-<slug>.html <url>` (PDFs as .pdf with `pdftotext -layout` and
  `-raw` beside them). curl's default user agent. A page that refuses or bot-checks this environment is NOT read
  another way (no other fetcher, no WebFetch of a refused page, no user-agent change): record it. web.archive.org
  snapshots may be read and cited with the snapshot URL and capture date.
- Never fill a gap from memory. A fact not found after all five methods (the institution, an official register or
  legal database, web search in several phrasings and the country's own language, trade press or a law firm quoting
  the primary, the archive) is a blocker for that field, each attempt written down. A country with no published rule
  at all is a blocker for the country.
- Write only $S/permits/out/<CC>.json and files under $S/dl/permits/. Do not touch /home/user/SLATE. No subagents.
- Before finishing, check every quote is in its saved page (whitespace-normalised).

## Output: $S/permits/out/<CC>.json
{"country": "<CC>", "read": "2026-11-01", "route": "...", "routeChanged": false,
 "permit": {"applies": "...", "first": "...", "fees": [{"what": "...", "amount": "123.45", "currency": "XXX"}],
   "processing": {"standard": {"n": 0, "unit": "days|business-days|weeks|months"}, "premium": {...} or null},
   "validity": {"n": 0, "unit": "...", "renewable": true|false|null}, "union": "..." or null,
   "eligibility": "..." or null, "pay": "..." or null, "exempt": {"days": 0, "within": 0} or null},
 "sources": [{"url", "title", "read": "2026-11-01", "said", "kind": "primary|secondary", "quotes"?, "saved", "fields": ["fees", ...]}],
 "blockers": [{"field", "sought", "tried": {"institution", "official-register", "web-search", "trade-press", "archive"}}]}
A field not found is null in `permit` and has its blocker. Report back in under 150 words: countries done, fields
blocked most, anything surprising.
