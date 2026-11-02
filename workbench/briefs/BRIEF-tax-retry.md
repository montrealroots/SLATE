# Brief: every blocked tax fact retried (2026-11-01)

The owner of SLATE, of the tax research: "Retry the blocked tax facts once all countries land." Read
`workbench/briefs/BRIEF-tax.md` first: its rules, form and the owner's words bind you, as the main law in CLAUDE.md
does. The researchers wrote $S/tax/out/<CC>.json (S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad).
For each country in your prompt:

1. Read every blocker and its attempts. A retry that repeats an attempt is worth nothing: try each method a different
   way (another page or publication of the tax authority: its rate tables, its guides, its annual circulars, its
   employer's guide to withholding; the finance ministry; the law in the country's legislation database or official
   gazette, another consolidation of it; the social-security agency's own rate page; the OECD's Taxing Wages country
   chapter or the EU's Taxes in Europe database, naming the primary; a big-four tax summary naming the primary; a
   search in the country's own language and another phrasing; the archive). A method marked "not run" must be run now.
   The web-search budget may be spent: fetch the institutions directly.
2. Fix what the lead's check found: Japan's quote from JP-kenpo-r08 isn't in its saved page's text (re-quote exactly or
   drop the fact to a blocker); every secondary source must have `quotes` as the primary's URL (the authority's or the
   law's page, or the institution's home page with the law's name in `title`): CA, FR, IE, IT, US; a `said` written as
   a list of runs is fine but must be a single string joined by " … ".
3. Update the file in place; each still-blocked fact keeps the earlier attempts and adds this turn's, all five methods,
   each with the URL or the exact query. `saved` paths in full.

Write only your countries' files in $S/tax/out/ and files under $S/dl/tax/. No subagents, no repo edits. Check every
quote of every file you touched is in its saved page (whitespace-normalised). Report back in under 120 words.

## The world round (2026-11-01, after all 252 countries landed)
The same brief, for the 231 countries researched under `BRIEF-tax.md`'s world round, and the quote misses of the 21.
Your prompt names `$S/tax/retry-<n>.txt`; its countries are yours. Besides every blocker and every method left "not
run", "not tried" or "budget exhausted" in its last attempt:
- `$S/tax/retry-misses.txt` lists, per country, the quotes the lead's check didn't find in their saved page (text
  normalised: NFKC, whitespace dropped, line-end hyphens joined; xlsx and docx read from their XML; PDFs through
  pdftotext in layout, plain and raw modes). For each of yours: re-quote it exactly as the saved page has it, or save
  the page that does say it, or drop the fact to a blocker. A quote stitched from cells (`a | b`) is quoted as cells
  that appear in the page, each a part joined by " … ".
- Conflicts the landing found: Latvia's non-taxable minimum (€550 or €570 for 2026: the State Revenue Service's own
  page decides), the Caribbean Netherlands' band edges, Palau's wage tax bands. Settle each from the authority's own
  page, or record both readings in a blocker.
- A secondary source that the authority's own page can replace is replaced; one that can't keeps `quotes`.
