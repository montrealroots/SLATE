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
