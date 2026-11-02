# Brief: the work permits, every gap retried (2026-11-01)

Read `workbench/briefs/BRIEF-permits.md` first: its rules, its form and the owner's words bind you. Eight researchers
wrote one file per country in $S/permits/out/<CC>.json (S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad).
Your list file (named in your prompt) holds the countries where at least one of the permit's core facts (who applies,
the fees, the processing time, the term) is still null. For each country on it:

1. Read its file and every blocker's attempts. A retry that repeats an attempt is worth nothing: try each method a
   different way (another page or document of the authority, the fee schedule or gazette itself, the law's text in a
   legislation database such as the country's own, FAOLEX, NATLEX or WIPO Lex, an embassy's or consulate's page in
   another country, the IOM's or the EU's migration portal, a search in the country's own language and another
   phrasing, a law firm or employer-of-record quoting the primary). Any field null: retry it, core fields first.
2. Fix what the lead's check found: a quote not in its saved page (re-read the page and quote it exactly, or drop the
   fact it carried back to null with a blocker); a secondary source with no primary URL in `quotes` (give the
   primary's URL, the authority's own page or the law's official text, or reclassify it as primary only where the
   page is the authority's own); a source with no `saved` file (save it or drop it). The lead's list of bad quotes:
   AG cap27, AT wia-bb, BQ stb-2010-371, BT (no saved page), CH zh-kuenstler, CV lei-66-VIII-2014, ER labour, GG
   careyolsen2024, GS gaz4, MR code, MS labourcode, SI zzsdt2015, SL act2023, SN code-travail-2026, SV edh, XK law
   (fix those on your list).
3. Update the file in place: found facts filled with their sources; each still-null field's blocker keeps the earlier
   attempts and adds this turn's, all five methods, each with the URL or the exact query. Write `saved` paths as full
   paths, never `$S/...`.

Write only $S/permits/out/<CC>.json for your countries and files under $S/dl/permits/. No subagents, no repo edits.
Before finishing, check every quote of every file you touched is in its saved page (whitespace-normalised). Report
back in under 120 words: fields filled, fields still blocked, quotes fixed.
