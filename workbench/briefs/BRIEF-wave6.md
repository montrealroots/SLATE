# Brief: wave 6, the papers and money a life holds (research subagents, 2026-10-30)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`; its rules bind you). Today is 2026-10-30. The owner ruled on 2026-10-30 that a life holds its papers and
its money in layer 3 (HANDOFF.md, "Next step"); the forms are built, and you fill them, country by country, from each
country's own sources. Read `$S/audit/FORMS.md` (the forms in prose) and your engine's `tools/<engine>/compile.ts` in
full (the form as the code holds it, every error it can give): the code wins where they differ.

## Sources (as every wave before)

- Primary first: the government's, the regulator's, the bank's or the issuing office's own page, law or document,
  read in full and saved. A secondary source (a guide, an embassy's page about another country, a law firm's summary)
  only where it states the primary rule; mark it `kind: 'secondary'` with `quotes: '<URL of the primary it rests on>'`.
- Not sources: AI-written guides, aggregators, forums, comparison sites, Wikipedia (except to find the primary).
- **No bot-check circumvention**, ever: no user-agent spoofing; no fetching or rendering past Cloudflare, Akamai,
  Incapsula, a captcha or a "Just a moment" page; no TLS bypass (completing a missing intermediate with
  `bash bin/chain.sh HOST` is allowed). Honest Playwright rendering of an unprotected page is allowed
  (`node bin/render.js URL out.html`). Don't use WebFetch or a browser to get a page that refused curl.
- Tools (from `$S`): `bash bin/get URL dir/name.ext` saves to `dl/dir/name.ext` and prints its text;
  `bash bin/probe.sh URL [regex]`; `bash bin/wb.sh URL...` (archive.org's availability API; web.archive.org itself is
  refused by this egress, so say a snapshot exists, never that it was read).
- Web searches: your budget is in your prompt; the turn's searches are shared by every agent. Go to the institution's
  own site first; search to find the page, in the country's languages.

## Writing a file

Write `$S/w6/<AGENT>_<n>.py` that builds a list of entries and dumps it to `$S/w6/<AGENT>_<n>.json`; each entry is the
file's whole content plus `key` (the file name without `.json`: the country code, or for licences `US.CA`-style region
keys as the form says). Each source: `url`, `title`, `read: '2026-10-30'` (or the day it was saved), `said` (exact
words from the page, parts joined by ' ... '), `page` (the saved file's path under `$S/dl/`), or, for a page read by eye
(a scanned PDF), `read_by_eye: True` and no `page`. A `note` in plain English says what was read (with each document's
date in force), every reading you made, and what the form doesn't hold. Then, from `$S`:

    python3 bin/gw.py <engine> w6/<AGENT>_<n>.json        # checks every said part against its page, writes the file
    cd /home/user/SLATE && npx tsx $S/bin/chk.mts <engine> <KEY> ...   # compiles each file as the engine reads it

`<engine>` is the folder under `research/sources/` and `tools/`: `papers/numbers`, `papers/residence`, `papers/licence`,
`papers/passports`, `papers/ids`, `papers/citizenship`, `money/banks`, `money/means`. Fix until both pass. Where a file
already exists (banks, passports, ids, citizenship, means), load it, change only what your job names, keep every
existing source and fact that still holds, and write the whole file back through `gw.py` (an existing source with no
`page` is kept with `read_by_eye: True` only if the note already says it was read by eye; otherwise give it a `page`
by saving the page again, or report it).

## A blocker

When the five methods all fail for a country, write `$S/w6/blk/<engine-name>/<KEY>.json` (engine-name: `numbers`,
`residence`, `licence`, ...): `{ "sought": "<what was sought, one sentence>", "attempts": [ {"method": "institution" |
"official-register" | "web-search" | "trade-press" | "archive", "tried": "<exactly what, URLs>", "result": "<what came
back>", "date": "2026-10-30"}, ... ] }`, every one of the five methods present, each recording only what was actually
tried today. The lead registers them.

## Don't touch

git, `research/register.json`, `HANDOFF.md`, `docs/`, code, the gate, other agents' countries or engines. No register
scripts, no builds.

## Report

Per country: written (one line: the main facts and the source), or blocked (why), or not reached. Then the readings I
should check. Short.

## The owner, 2026-10-30

"Keep the block; don't switch user agents." A site that refuses the client by the name it declares is blocked: record it in the five methods; never change the user agent (to a browser's, curl's default or any other) to get past a refusal.
