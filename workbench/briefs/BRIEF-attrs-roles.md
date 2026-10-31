# Brief: a role's attributes, researched to the source (2026-10-31)

Read /home/user/SLATE/workbench/briefs/BRIEF-attrs.md first: its rules and output form bind you, with these changes.
- Scratchpad S = /tmp/claude-0/-home-user-SLATE/cfe06f79-0641-529e-b709-1fcd46045c09/scratchpad (not the brief's).
- The role is the one your prompt names (the brief says "screenwriter"; read it as your role). Every attribute is one
  a source says THIS role has, is judged on, hired for, taught or rewarded for.
- Save pages as $S/dl/attrs/<role>-<part>-<slug>.<ext> (PDFs also pdftotext -layout AND pdftotext -raw beside them,
  as <slug>.txt and <slug>.raw.txt). Write only $S/attrs/out/<role>-<part>.json; set "agent" to "<role>-<part>".
- Each source in the output also carries "title": the page's own title or the document's name and date.
- A secondary source's "quotes" is the primary's URL alone; anything more goes in its "title".
- HTML to text lines: python3 $S/attrs/txt.py <file.html>. curl's default user agent; no bot-check workaround.
  web.archive.org reset every connection today; try it once per blocker and record it.
- An API that needs a key taken from a site's own scripts is not a source (record a blocker).
- Do not touch /home/user/SLATE except to read. Do not spawn subagents.
- Before finishing, check every "said" is in its saved page, whitespace-normalised (for a PDF, in .txt or .raw.txt).
- The screenwriter's three files ($S/attrs/out/registers.json, judging.json, teaching.json) show the form done well;
  /home/user/SLATE/research/sources/person/roles/<role>.json (read only) names sources an earlier wave read: use its
  URLs as leads, but read and quote each page yourself today.
Report back in under 150 words: counts per source, blockers, anything odd.
