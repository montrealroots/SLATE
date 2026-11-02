# Brief: the tax on a screen worker's pay, country by country (2026-11-01)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator): "Build those first 3 starting with
ledger first": every fee, wage and cost the game records is to be paid into and out of the person's accounts, with
each country's tax taken as the law takes it. The main law in CLAUDE.md binds you ("leave no stone unturned"). Your
prompt names countries. For each, find from the tax authority's own pages and the law, in force for 2026 (the game's
first year; later years where already set):

- `residents`: the personal income tax a resident pays: the brackets and rates for 2026 (national, and the regional or
  municipal layer where one applies everywhere, with how it is set), the allowance or tax-free amount, the tax year
  (calendar or other) and when the return is due.
- `social`: the social contributions on a worker's pay (employee and employer shares, ceilings), and how they differ
  where a screen worker is self-employed, a freelancer or an "intermittent" (France's intermittents du spectacle, for
  one); where performers and authors have their own scheme (Germany's Künstlersozialkasse), its terms.
- `withholding`: what is withheld at source from a resident's pay (PAYE, withholding tables) or from a freelancer's fee,
  and the rate or table.
- `nonResident`: what a non-resident performer, writer or director working there pays (the artistes' withholding most
  countries take under Article 17 of the OECD model: its rate, base and any threshold), and whether it is final.
- `authors`: any special treatment of authors' fees and royalties (a writer's, a director's) where the law gives one.
- `vat`: whether a freelancer's fee bears VAT or GST and above what turnover.
- `currency` and the tax year's dates.

## Rules (binding; the repo's CLAUDE.md binds you too)
- Primary sources first: the tax authority's own pages, rate tables and guides; the law's text (the legislation
  database, the official gazette); the OECD's or the EU's tax database where it quotes them (secondary, naming the
  primary). Secondary (a big-four firm's tax summary) must name the primary it quotes as a URL in `quotes`.
- Quote verbatim and save the page: S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad
  `curl -sSL --max-time 60 -o $S/dl/tax/<CC>-<slug>.html <url>` (PDFs with `pdftotext -layout` and `-raw` beside
  them; scans by tesseract, saved beside, `"ocr": true`). curl's default user agent. A page that refuses or bot-checks
  this environment is NOT read another way. web.archive.org may be read and cited with the snapshot URL and date. The
  web-search budget may be spent: fetch the institutions directly.
- Never fill a gap from memory. A fact not found after all five methods (the institution, an official register or
  gazette, web search, trade press or a tax firm quoting the primary, the archive) is a blocker, each attempt written.
- Write only $S/tax/out/<CC>.json and files under $S/dl/tax/. Do not touch /home/user/SLATE. No subagents. `saved`
  paths in full. Check every quote is in its saved page (whitespace-normalised) before finishing.

## Output: $S/tax/out/<CC>.json
{"country": "<CC>", "read": "2026-11-01",
 "figures": [{"item": "residents|social|withholding|nonResident|authors|vat|year", "finding": "<one plain sentence>",
   "value": <object: brackets as [{"from": n, "to": n|null, "rate": r}], amounts with currency, dates>, "applies": "...",
   "sources": [{"url", "title", "read": "2026-11-01", "said", "kind": "primary|secondary", "quotes"?, "saved", "ocr"?}]}],
 "blockers": [{"item", "sought", "tried": {"institution", "official-register", "web-search", "trade-press", "archive"}}]}
Report back in under 150 words.
