# Brief: wave 16, every blocker of layers 2 and 3 retried again (2026-10-30)

S = /tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad. Repo = /home/user/SLATE (read its
`CLAUDE.md`; its rules bind you). Read first, all of which binds you:
- `$S/audit/BRIEF-wave6.md`: sources, tools, writing through `$S/bin/gw.py` and checking with `$S/bin/chk.mts`. NO
  bot-check circumvention: no user-agent spoofing, nothing past Cloudflare/Akamai/Incapsula/Radware/captcha/WAF, no
  TLS bypass except completing a missing intermediate with `$S/bin/chain.sh`. Honest Playwright rendering of an
  unprotected page is fine.
- `$S/audit/BRIEF-wave7-blockers.md`: how a blocker is retried and written, and the writers of the layer 2 engines,
  cards (`bin/cw.py`) and credit (`bin/crw.py`). Here blocker files go into `$S/w16/blk/<engine>/<KEY>.json`.
- `$S/audit/BRIEF-wave15.md`: what the lead refuses (read its "What the lead refused" list: every point holds), the
  forms as they stand, unit fees, and the owner's ruling, quoted here again: "Keep the block; don't switch user
  agents." A site that refuses the client by the name it declares is blocked: record it; never change the user agent.

## The job

Your list file (named in your prompt) holds the keys of blocked facts, biggest first. Each is the register entry
`<engine prefix>.blocked.<KEY>` in `research/register.json` (a region's key is `CC.<region>`). For each, in order:

1. Read the entry's `sought` and every earlier attempt. Most were tried earlier today, so a retry that repeats one is
   worth nothing: try each method **a different way** from every earlier attempt. A different page or document of
   the institution, or another institution that holds the fact (the ministry, the regulator, the statistics office,
   the gazette or legal database, the central bank, an embassy or consulate abroad, a regional office). A search in
   the country's own language and another phrasing. An international body or trade press quoting the primary (IMF,
   World Bank, UN, SPC, ECCB, CARICOM, ILO NATLEX, OECD, BIS, SWIFT, a bank's own tariff PDF). Archive.org's
   availability API for a URL not asked before (`bash $S/bin/wb.sh URL...`; say a snapshot exists, never that you
   read it).
2. Found, from a source that says it: write the research file in the engine's own form, through its writer, and check
   it (chk.mts, chkcards.ts, or the engine's compile for layer 2). The row turns researched when the lead registers
   it. A fact that genuinely doesn't exist is written in the form's own way (`none: true`, `free: true`) only where a
   source says so.
3. Not found: write `$S/w16/blk/<engine>/<KEY>.json` as `{ "attempts": [ {"method", "tried", "result", "date":
   "2026-10-30"} ... ] }`. All five methods must be present (institution, official-register, web-search,
   trade-press, archive), each recording only what you tried this turn, with the URL or the exact query. The lead
   appends them to the entry's earlier attempts. A key left with neither a file nor a blocker is the worst outcome:
   every key on your list ends with one or the other.

`<engine>` in the blocker path is the short name your list file has (`licence`, `credit`, `formats`, ...).

## Don't touch

git, `research/register.json`, `HANDOFF.md`, `docs/`, code, `research/held/`, register scripts, other agents' keys.
Don't run Stryker or the full test suite: eight agents share the machine.

## Budget

Web searches: the number in your prompt. Go to the institutions' own sites first; one sharp query in the country's
own language often does the work of three.

## Report

Short, and checkable by the lead:
- Written: key, the main fact, its source URL, the file path.
- Blocked: key and one line of why.
- Readings to check: anything where the fact is your reading and not the source's words.

## From 2026-10-31: archive.org's snapshots can be read

web.archive.org now serves snapshots through this egress (it refused them until 30 October). It drops connections
often: retry with a few seconds' pause, up to five times. Read a snapshot as the archive method's own work, and as a
source when it is the institution's page:
- Find snapshots with `bash $S/bin/wb.sh URL` or the CDX API
  (`https://web.archive.org/cdx/search/cdx?url=<host/path>&output=json&limit=-5`), and fetch the raw page with
  `https://web.archive.org/web/<timestamp>id_/<original URL>`. Save it for gw.py as any page.
- Cite it with `url` the snapshot's own address (`https://web.archive.org/web/<timestamp>/<original URL>`), a title
  naming the institution and the snapshot's date, `read` today, and `said` from the saved page. It is the institution's
  own words, so the kind is primary; the note says the snapshot's date. A snapshot older than the institution's current
  rule may be is no proof the rule still holds: say what the date is and whether a later text was looked for.
- The archive doesn't get past what the institution refused: a snapshot is a copy the archive made in the open, and
  reading it is honest. Never use the archive to reach a page behind a login.
