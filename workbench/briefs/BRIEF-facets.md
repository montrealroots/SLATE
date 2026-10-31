# Brief: what each screenwriter attribute is made of, from the sources (2026-10-31)

The owner of SLATE (a realistic Writer/Producer/Director/Actor life simulator), on the 27 screenwriter attributes
(src/person/attributes/attributes.json; workbench/plans/screenwriter-attributes.md): "I want those meanings to mean
something and actually reflect on the work and not be for decoration. Just want tons of realism here." So each
attribute's meaning, as real sources state it, is broken into the facets it is made of; the game will score a script's
work facet by facet, readers will grade and note the facets their own criteria name, and revisions will work on them.

## Where the meanings are
- research/sources/person/attributes/screenwriter.json (read only): each attribute's group (the `research` name in
  attributes.json) holds its terms, each with sources' verbatim quotes already checked against saved pages. Start there.
- Where a meaning is thin, read further primary sources: the institutions' own pages and documents (the WGA's credits
  manuals and Screenwriters Handbook, the Nicholl's rubric as the Black List's blog copies it, PAGE's judging page,
  Austin's "What our readers look for", the Black List's help pages and Franklin Leonard's posts, BBC Writers' guidance,
  AFI/NFTS/USC programme pages, O*NET's and ESCO's definitions, France Travail's fiche E1134). Save each page:
  S=/tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad
  `curl -sSL --max-time 60 -o $S/dl/facets/<part>-<slug>.html <url>`; PDFs also `pdftotext -layout` and `-raw` beside
  them (.txt, .raw.txt). curl's default user agent; no bot-check workaround. No AI guides, forums, or Wikipedia.

## Rules
- A facet exists only where a source states it in its own words. Quote verbatim (a quote from screenwriter.json may be
  reused with its url, title and saved path there, `saved` as given in that file's source list is not kept: give
  "from": "R-4601" instead of "saved").
- `alsoDrawsOn`: another attribute counts toward a facet only where a source ties them (PAGE's dialogue "reveals
  character": Characters). Quote that tie.
- `readBy`: which reader or judge grades that facet, by its own published criterion (the Black List, PAGE, the Nicholl
  readers, Austin, BBC Writers, the WGA's credit arbiters, Screen Australia, a staffing programme ...), with the quote.
- Never from memory. Write only $S/facets/out/<part>.json and files under $S/dl/facets/. Do not touch /home/user/SLATE.
  No subagents. Check every quote is in its page (or in screenwriter.json) before finishing.

## Output: $S/facets/out/<part>.json
{"part": "<part>", "read": "2026-10-31", "attributes": [
  {"attribute": "<id from attributes.json>",
   "definition": "<one plain sentence a player reads, built only from the sources' words>",
   "definitionFrom": ["<url>", ...],
   "facets": [{"id": "<kebab-case>", "name": "<Title Case, as a player reads it>", "meaning": "<one plain sentence>",
     "sources": [{"url": "...", "title": "...", "said": "<verbatim>", "kind": "primary|secondary", "quotes": "<primary URL if secondary>", "saved": "dl/facets/<file>" or "from": "R-4601"}],
     "alsoDrawsOn": [{"attribute": "<id>", "said": "<verbatim tie>", "url": "..."}],
     "readBy": [{"reader": "<who>", "criterion": "<its own name for it>", "said": "<verbatim>", "url": "..."}]}]}]}
Aim for the facets the sources actually name (often 2 to 6 per attribute); one facet is right where the sources give
one meaning. Report back in under 150 words: facets per attribute, and any attribute whose meaning stayed thin.
