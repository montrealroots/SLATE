# Brief: more markets for the actor's work (2026-11-01)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator): "add more markets." Today a part is
booked only under SAG-AFTRA's agreements (US), Pact/Equity's and UK Theatre's (UK) and ACTRA's (Canada), so the work
permits built for 246 countries can't be reached. Your prompt names three countries. For each, find the real terms a
professional actor is engaged on there for film, television and the stage, from the sources that set them, as R-4614
(`research/sources/person/work/actor-calibration.json`, read it first: its form and depth are the standard) did for
those three.

## The facts sought, per country
- `agreements`: each collective agreement, union rate card or statutory minimum that sets a performer's pay in film,
  in television and on the stage (the agreement's own name, who signs it, the years it runs).
- `rates`: each minimum it sets for a performer: a day's, a week's, a month's or a performance's, by role where it
  distinguishes (principal, supporting, a part of few lines, a child), by budget or production tier where it does,
  with the currency and the date each rate applies from; the hours a day or week covers.
- `union`: the actors' union or guild, whether membership is needed to be engaged and how one joins (fees where
  published).
- `language`: the language parts are cast in there (the market's own), from a source where one says so.
- `market`: the city or region where most film and television work is (for its time zone), from a source.
- `none`: where no agreement or minimum sets an actor's pay (pay left to negotiation), say so from a source that says it.

## Rules (binding; the repo's CLAUDE.md binds you too)
- Primary sources first: the agreement's text (an official gazette's extension order, the labour ministry's register
  of collective agreements, the union's or the producers' association's own published rate card), the union's own
  pages. Secondary (trade press, a law firm) must name the primary it quotes.
- Quote verbatim and save the page: S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad
  `curl -sSL --max-time 60 -o $S/dl/markets/<CC>-<slug>.html <url>` (PDFs as .pdf with `pdftotext -layout` and `-raw`
  beside them). curl's default user agent. A page that refuses or bot-checks this environment is NOT read another way.
  web.archive.org snapshots may be read and cited with the snapshot URL and date. The session's web-search budget may
  be spent: fetch the institutions directly when it is.
- Never fill a gap from memory. A fact not found after all five methods (the institution, an official register or
  gazette, web search, trade press quoting the primary, the archive) is a blocker, each attempt written down.
- Write only $S/markets/out/<CC>.json and files under $S/dl/markets/. Do not touch /home/user/SLATE. No subagents.
- Before finishing, check every quote is in its saved page (whitespace-normalised).

## Output: $S/markets/out/<CC>.json
{"country": "<CC>", "read": "2026-11-01",
 "figures": [{"item": "agreements|rates|union|language|market|none", "finding": "<one plain sentence>",
   "value": <object with units and dates>, "applies": "<where, when, to whom>",
   "sources": [{"url", "title", "read": "2026-11-01", "said", "kind": "primary|secondary", "quotes"?, "saved"}]}],
 "blockers": [{"item", "sought", "tried": {"institution", "official-register", "web-search", "trade-press", "archive"}}]}
Report back in under 150 words: agreements found, rates found, blockers.
