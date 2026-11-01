# Brief: every blocked market rate retried (2026-11-01)

The owner of SLATE, told which actors' rates the eighteen market researchers could not read: "Retry the blocked rates
once all markets land." Read `workbench/briefs/BRIEF-markets.md` first: its rules, form and the owner's words bind
you. The researchers wrote $S/markets/out/<CC>.json (S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad).
For each country in your prompt:

1. Read its file and every blocker's attempts. A retry that repeats an attempt is worth nothing: try each method a
   different way (the agreement's text from a signatory's own site: the producers' association, the union, the
   broadcaster; the labour ministry's or the official gazette's register of collective agreements or its extension
   orders; a court or the labour authority's decision quoting the rates; the union's annual report or magazine;
   a search in the country's own language and another phrasing; trade press quoting the agreement; the archive).
   The web-search budget may be spent: fetch the institutions directly. Scans may be read with tesseract (installed):
   save the OCR text beside the page and mark the source `"ocr": true`, checking each figure against the image.
2. Fix what the lead's check found: a secondary source must have `quotes` as the URL of the primary it rests on (the
   signatory's or the gazette's page, or the institution's home page with the agreement's name in `title`); a quote
   from a spreadsheet must be in a text copy saved beside it (export the sheet to .csv or .txt and quote from that).
3. Update the file in place: found facts filled with their sources; each still-blocked fact keeps the earlier attempts
   and adds this turn's, all five methods, each with the URL or the exact query. Write `saved` paths in full.

Write only your countries' files in $S/markets/out/ and files under $S/dl/markets/. No subagents, no repo edits.
Check every quote of every file you touched is in its saved page (whitespace-normalised). Report back in under 120
words: rates found, still blocked.
