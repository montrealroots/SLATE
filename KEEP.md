# The Keep Register For The New SLATE

What the owner has decided to carry from this SLATE into the rebuilt one, decided page by page from the captures,
and every detail of each kept thing, so the new build can reproduce it without reopening this one. Started
2026-10-26. Each entry says what was kept, where it lives on this tree (`ed623986`, branch `claude/career-universe`),
how it behaves, how it looks, what holds it, and what the owner said about it.

Captures, as sent: `/tmp/claude-0/-home-user-1221/93119f3d-c8d9-5356-8130-0e0fe32e5c95/scratchpad/capture/shots/`
(this session's scratch; the register is the durable record).

---

## 1. The startup screen and its engine (KEEP, in full)

**Owner's decision (2026-10-26):** "So that startup screen we're going to keep that and its engine."

### What the player sees

The first thing SLATE shows, for about a second on a fast device, longer on a slow one, and for as long as it takes
when something's wrong:

- A full-screen dark field, centered: a radial gradient from `#191c22` at 50% across and 42% down to `#0c0d10` at
  62%, laid over the app (`position: fixed; inset: 0; z-index: 100`).
- The clapper mark 🎬 at 68 px (54 px on a phone), which arrives with a 900 ms animation: from 14 px low, rotated
  -9° and scaled .86 at zero opacity, through +3° and 1.04 at 60%, to rest (`clapper-in`, easing
  `cubic-bezier(.2,.8,.2,1)`).
- The wordmark **SLATE**: 46 px, weight 300, letter-spacing .42em with a matching text-indent so it centers
  (34 px and .34em on a phone), in the text color `#eceef2`.
- Under it, "A LIFE SIMULATOR": extra-small type (0.72rem), uppercase, letter-spacing .28em, dim text `#8a929e`.
  The words "life simulator" are bound with a non-breaking space so a phone breaks before them, never between them.
- A 2 px progress bar on `#21252c`, its fill the clapper gold `#d8b25f`, animating its width over 280 ms.
- A status line under the bar: the current stage's label on the left ("Reading Save Slots"), the percentage on the
  right in monospace tabular figures. "Ready" at 100%; "Startup Stopped" on a failure.
- The four stages listed, left-aligned, each with a glyph and a color by state: waiting `·` dim, active `▸` gold,
  done `✓` muted `#a3aab6`, failed `✕` red `#d97a6c`. The list is an `aria-live="polite"` region; the bar is a
  `progressbar` with its value.
- The foot: "Version 1.1.0 · Save Format 94" (the app version and the save schema version, both constants).
- The whole column is `min(520px, 90vw)` wide.

### What the engine does (the stages are real work, not a timer)

Each stage runs in order and moves the bar by its weight, totalling 100:

| # | Label | Weight | What it does |
|---|---|---|---|
| 1 | Connecting To Storage | 30 | `resolveAdapter()`: if a Base44 client is injected on `globalThis.base44` with `functions.invoke` or a `SlateSave` entity, use the Base44 adapter (server-authoritative); otherwise the local adapter ("This Device"). |
| 2 | Reading Save Slots | 25 | `adapter.listSlots()` for slots 1, 2, 3: occupied or not, the save's meta, whether a readable backup exists and the world date it sits at, the stored size in bytes, or an error message if the stored text can't be read. |
| 3 | Checking Each Save | 25 | For each slot with an error, a warning: "Slot N: <error>" plus "Press Restore Backup on the slot to open its backup." when a backup exists. |
| 4 | Checking Save Versions | 20 | For each occupied slot: a save from a newer schema gets "was saved by a newer version of SLATE, so this version won't open it. That keeps the save safe."; an older one gets "was saved by an older version of SLATE. When you open it, SLATE keeps a backup and then updates it." |

Rules the owner should keep with it:

- **A failure stops with a reason and a way on.** The failed stage shows `✕`, the status says "Startup Stopped",
  and a red callout says "<Stage> failed." with the message and a **Try Again** button that reruns all stages from
  the start. If the stages finish but no adapter or no slots came back: "Your saves' storage didn't answer."
- **Warnings never block; the player decides.** With warnings, a gold callout "Before You Continue" lists them and
  offers **Continue**; the result is parked on `window.__slateStartup` until the player presses it. With none, the
  app moves to the slots screen on its own.
- **No fake waiting.** Until 2026-09-27 it opened on a stage that only waited ("Starting The Projector") and
  padded about 850 ms between stages; that was removed and must not come back.
- Unmounting cancels the run (a `cancelled` ref checked between stages).
- The stage list is exported (`STAGES`) so a test can run stages 2 to 4 against an in-memory adapter.

### The persistence engine behind stage 1 and 2 (kept with it)

- **One adapter contract** (`SaveAdapter`): `name`, `serverAuthoritative`, `listSlots`, `load(slot)`,
  `save(universe)`, `remove(slot)`, `backup(slot)`, `restoreBackup(slot)`. The simulation never knows where a save
  lives. Slots are `1 | 2 | 3`.
- **The local adapter** ("This Device"): saves in IndexedDB (database `slate`, store `saves`) where the browser has
  it, local storage where it doesn't, and a moving store that carries a save still in local storage across the first
  time it's read (local storage caps at about five million characters an origin, and a life played to eighty packs to
  about 1.4 million). Keys `slate.save.N` and `slate.backup.N`.
- **Every save is gzipped** before it's stored (`CompressionStream`), base64, with the marker `slate.gz1:` in
  front, which is not valid JSON so a plain older save still loads. A browser without compression streams is told
  "This save is compressed, and this browser can't open it. Open SLATE in an up-to-date browser."
- **Every write backs up what was there first**, then writes the slot's key last and whole, so a failed write leaves
  the slot as it was. A full device gets "There isn't enough storage space on this device to save, so nothing in the
  slot changed. Free some space, or delete a save you no longer want, then try again."; any other failure "SLATE
  couldn't save to this device, so nothing in the slot changed. Try again in a moment."
- **Deleting keeps a backup** of a readable save, and never overwrites a good backup with a corrupt one.
- **A backup is only advertised if it can be read**, so Restore Backup never fails when pressed.
- **Reading a damaged save** says "That save file is damaged and can't be read." or "That file isn't a SLATE save.",
  never the JSON parser's own message.
- **The Base44 adapter** (deployed): the same contract over four backend functions, `loadUniverse` (no slot: list;
  with slot: open), `saveUniverse` (and with `restore: true` to restore), `clearSlot`, plus `recordOfficialResult`
  and `askAssistant` for other features. Writes go through the functions, where the server checks a save balances,
  belongs to this player and hasn't gone backwards. It degrades to the local adapter when the SDK is absent.
  Retries on 5xx, 409 and 429 only; a refusal the server made on purpose is not retried, and its own words reach the
  player.
- **The save's meta**, which the slots screen reads without deserialising the universe: id, slot, schemaVersion,
  createdAt, playtimeSeconds, seed, characterName, portrait (a small copy), careerLabel, locationLabel,
  worldDateLabel, netWorthLabel, appVersion, the save's currency, and `endedAt` for a finished life.
- **The schema version is pinned in two places** that can't share a constant: `SAVE_SCHEMA_VERSION` in the engine
  and `SUPPORTED_SCHEMA_VERSION` in the Base44 guard (Deno, can't import the engine). Both 94 today.

### What holds it

- `tests/b20-guide-startup.test.ts`: the stages read the slots and say what a slot from another version will do; a
  new life is written to its slot and the slot's card says what the save holds; Continue opens it at the same moment;
  every older save fixture opens and draws without error; a save made at 2:37 opens at 2:37 and plays on identical to
  the never-saved life.
- `tests/persistence.test.ts`, `tests/save-migration.test.ts`, `tests/b26-persistence-repeats.test.ts`,
  `tests/b27-older-save.test.ts`.

### Where it lives on this tree

`src/ui/startup/StartupSequence.tsx` (230 lines), `src/engine/persistence/adapter.ts`, `local.ts`, `base44.ts`,
`src/engine/version.ts`, `src/styles/app.css` (`.startup`, `.startup-inner`, `.clapper`, `clapper-in`, `.wordmark`,
`.wordmark-sub`, `.startup-bar`, `.startup-status`, `.startup-stages`, `.startup-stage[data-state]`), the design
tokens in `:root` of the same file, `index.html` (title SLATE, the clapper as a data-URI SVG favicon, the description
"SLATE: an actor's life, simulated hour by hour.", `color-scheme: dark light`, `viewport-fit=cover`), and
`src/app/SlateApp.tsx`, whose phase router goes startup → saves → creation → playing.

### The design tokens the screen is drawn with (kept, since the look is the thing)

Surfaces `#0c0d10` → `#131519` → `#191c21` → `#21252c` → hover `#262b33`; overlay `rgba(6,7,9,.82)`. Text `#eceef2`,
muted `#a3aab6`, dim `#8a929e` (4.9:1 or better on every surface, WCAG AA). Lines `#262a31`, strong `#363c45`. The
clapper gold `#d8b25f`, strong `#efc978`, dim and line tints at .14 and .32 alpha, "used sparingly, for identity and
for what matters". Positive `#6db98a`, negative `#d97a6c`, warning `#dda863`, info `#7aa5c9`, each with a .14 tint.
Type: the system sans stack; monospace for figures. Sizes 0.72 / 0.8 / 0.875 / 1 / 1.25 / 1.6 / 2.1 / 3 rem. Space 4,
8, 12, 16, 24, 32, 48, 64 px. Radii 6 / 10 / 16 px. Two shadows. Nav 56 px, rail 232 px.

---

## 2. The slots screen (KEEP, with its words to be rewritten)

**Owner's decision (2026-10-26):** keep the screen and what it does; "text here is too robotic so that will need to
change." The voice the owner wants, in their words: **"natural and coherent and realistic."** So: the layout, the
states, the behaviour and the engine are kept as they are; every string below is to be rewritten in the new build in
that voice, and this list is the inventory the rewrite works from so nothing is dropped by accident.

**The voice standard, for every rewrite in this register:** natural (the way a person would say it to someone in the
room, not a system reporting its state), coherent (the screen's lines read as one voice, each following from the
last, with the same words for the same things), and realistic (it says what is actually true and actually happens,
no cheer, no padding, no telling the player what they already see). The engine's vocabulary stays out of it: no
"slot", "save format", "schema", "adapter", "validation" where a plainer word does the job.

Captures: `captures/01-opening/00-opening-slots.png` (fresh), `01-slots-occupied.png` (a life in Slot 1),
`01-slots-delete-confirm.png` (the confirmation).

### What the player sees

- The clapper at 44 px, the wordmark at 32 px, and one line under it. Then three cards in a grid (`auto-fit`,
  280 px minimum, 24 px gaps, so three across on a laptop and one above another on a phone), each at least 300 px
  tall, on the surface color with a 1 px line and the 10 px radius. An empty card has a dashed border and centers
  its contents in dim text. The slot number is extra-small uppercase with .16em letter-spacing. A name is 1.6rem at
  weight 600. The four facts sit in a two-column grid. A foot line at the bottom.
- **Empty slot:** "SLOT N", the sentence, New Save. With a leftover backup: a different sentence, New Save, Restore
  Backup, and the backup's date.
- **Occupied slot:** headshot (when one was uploaded) beside the name and the title line (the save's `careerLabel`,
  "Actress, Yale Drama Year 1" here); Date, Location, Net Worth (monospace), Played (monospace: `0s`, `12m`,
  `3h 7m`); the version line; the backup note when there is one; Continue (full width, gold), then Restore Backup
  (when there is one) and Delete side by side.
- **A finished life:** Continue reads "See How It Ended" and the life opens on its ending with the clock stopped
  (a save with `endedAt`, or whose title line ends ", Died At N").
- **A damaged save:** "Unreadable Save" in place of the name, the reason in red, Restore Backup if there's a backup,
  Delete.
- **Opening:** the pressed button reads "Opening…" and every button on the screen is disabled until it's done.
- **An error opening** shows in a red callout above the grid; a save that fails validation also has a fold-out
  "What's Wrong With It" listing the checker's lines (developer's words, kept behind the fold on purpose).
- **Delete** opens a modal ("Confirm Deletion" to a screen reader) over a dimmed screen; clicking outside it or Keep
  It closes it.

### Every string on the screen as it stands (all to be rewritten)

| Where | Text now |
|---|---|
| Under the wordmark | "Three slots, three separate lives. What happens in one never touches the others." |
| Empty slot | "An empty slot. Press New Save to start a life here." |
| Empty slot with a backup | "Empty, but there's a backup of the save that was here." |
| Buttons | "New Save", "Continue", "See How It Ended", "Opening…", "Restore Backup", "Delete" |
| Backup note | "Backup from <date>" / "Backup from an unknown date" |
| Damaged save | "Unreadable Save", then the adapter's reason: "That save file is damaged and can't be read." / "That file isn't a SLATE save." / "This device's storage couldn't be read just now. Reload SLATE to try again." / "This save is compressed, and this browser can't open it. Open SLATE in an up-to-date browser." |
| Failed validation | "The save in Slot N is damaged, so it can't be opened." + " Press Restore Backup to open its backup instead." when one exists; fold-out "What's Wrong With It" |
| Version line | "Version 1.1.0 · Save Format 94" + " · Updated When Opened" for an older save + " · 8 KB" |
| Facts | "Date", "Location", "Net Worth", "Played" |
| Foot | "SLATE 1.1.0 · Saved To This Device" (local) / "Saved To Base44 · The Server Checks Each Save" (deployed) |
| Delete modal | "Delete Slot N?"; "This deletes <Name>'s life from the slot, with everything that happened in it." (or "This deletes the save in this slot." when no name can be read); "SLATE keeps a backup, so if you change your mind, press Restore Backup on this slot to bring it back." or "This slot has no backup, so you can't bring it back afterwards."; "Keep It", "Delete Slot N" |

### The rewrite (2026-10-26, the owner's "complete and natural rewrite"; a draft, not yet decided)

**Owner, later the same day:** "I'll worry about the wording later but keep this feature and the engine behind it."
So the feature and the engine are decided; the lines below are a first draft in the voice standard, to be settled
when the owner turns to wording, and none of them is final.

The owner asked for a complete overhaul of the language, not a touch-up. This is the whole screen's text again, in the
voice standard above, one line for each line in the inventory. The first column is where the line goes; the second is
what it says in the new build. The old text above is kept only so nothing is lost; it is not the model.

| Where | The new line |
|---|---|
| Under the wordmark | "You can have three lives going at once. They don't know about each other." |
| Empty card | "Nobody here yet." |
| Empty card with a backup | "Nobody here now. There's still a copy of the life that was, if you want it back." |
| New Save | "Start A Life" |
| Continue | "Pick Up Where You Left Off" |
| See How It Ended | "See How It Ended" (this one already says it) |
| Opening… | "One moment." |
| Restore Backup | "Bring Back The Copy" |
| Delete | "Let This Life Go" |
| Backup note | "The copy is from <date>." / "The copy's date isn't known." |
| Title line under the name | As the save says it: "Actress, first year at Yale" (the life's own words for where it is, not a label with commas) |
| Facts | "The day", "Where", "Worth", "Time played" |
| Version line | "Made with SLATE 1.1.0" + ", from an earlier version: it'll be brought up to date when you open it" + " · 8 KB" |
| Unreadable | "This one can't be read." then the reason, in these words: "The file's damaged." / "This isn't a SLATE life." / "Your browser couldn't read its storage just now. Reload and try again." / "This life was saved compressed, and this browser can't open it. Try a newer one." |
| Failed validation | "Something's wrong inside this life, so it can't be opened." + " There's a copy from before; you can bring that back instead." when one exists; fold-out "What's wrong, exactly" |
| Foot, on a device | "SLATE 1.1.0. Your lives are kept on this device." |
| Foot, deployed | "SLATE 1.1.0. Your lives are kept on the server, and it checks each one." |
| Delete modal, title | "Let <Name> go?" (or "Let this life go?" when no name can be read) |
| Delete modal, body | "Everything that happened to <Name> goes with them." |
| Delete modal, the copy | "There'll still be a copy for a while. If you change your mind, bring it back from this card." / "There's no copy of this one. Once it's gone, it's gone." |
| Delete modal, buttons | "Keep Them" / "Let Them Go" |

Rules the rewrite follows, so the next screens follow them too:

- A life is "a life" or the character's name; never "a save", "a slot", "a universe".
- A backup is "a copy". The schema is never mentioned; "an earlier version" is as technical as it gets.
- Buttons say what will happen, in the player's terms ("Bring Back The Copy"), not the system's ("Restore Backup").
- Where the engine would have printed a label with commas ("Actress, Yale Drama Year 1"), the new build writes a
  sentence fragment a person would say ("Actress, first year at Yale"), which means the meta the save keeps changes
  shape with it (entry 1's `careerLabel` becomes words, not a label).
- The error lines are kept short and say the one thing the player can do.

### What the engine does (kept as is)

- Reads the slots the startup sequence handed it, and re-reads them after a delete.
- **Continue:** `openSlot(adapter, slot, { fromBackup })`, which keeps a backup of an older save before bringing it
  forward to the current schema; then loads the save's towns' countries (`loadPlacesFor`), validates the universe,
  and only then hands it to the app. A failure at any step is said in the callout and nothing opens.
- **Restore Backup** is Continue with `fromBackup: true`: the backup is written over the slot and opened.
- **Delete** keeps a readable save as its own backup (see entry 1), so the modal can promise Restore Backup; an
  unreadable save can only promise it where a backup already exists (`restorableAfterDelete`).
- **Net worth, date, location, title** are read from the save's meta, which the engine refreshes on every save
  (`refreshMeta`), so the card never deserialises the universe to draw itself.

### What holds it

`tests/b20-guide-startup.test.ts` (the card says what the save holds, each fact read again from the life; Continue
opens at the same moment; every older fixture opens), `tests/persistence.test.ts`.

### Where it lives on this tree

`src/ui/saves/SaveSlots.tsx` (copied to `kept/01-startup-and-persistence/SaveSlots.tsx`), `src/styles/app.css`
(`.slot-grid`, `.slot`, `.slot-empty`, `.slot-number`, `.slot-name`, `.slot-meta`; copied to `slots.css`), and the
`openSlot`, `loadPlacesFor` and `validateUniverse` entry points of `src/engine/index.ts`.

---

## 3. Creation, step 1 of 5, Identity: the page is kept, in the order below (DECIDED 2026-10-26; confirmed again with Billed As restored and Languages added)

**Owner (2026-10-26):** "I want it to fall in a perfect order so whatever you feel that may be let me know." Then,
on the order proposed in answer: "let's keep that page and the information I just gave you including having it in the
perfect order." So the Identity page is kept, in this order, and entries 4, 5 and 6 (an engine behind every field,
researched to the source worldwide, with zero decoration) apply to every feature on it: the engines proposed in
entry 4 are the plan for each field, each to be researched before it's built. The reasoning stays so the decision
can be read back. The fields themselves
are page 1's, written up in the capture page and in the feature rows; what's decided here is only where each sits.

Captures: `captures/01-opening/02-identity.png` (as it opens), `02b-identity-filled.png` (with the three required
things chosen).

### The rule the order follows

The page reads the way a person introduces themselves, and nothing is asked before the thing it depends on:
**who you are, then when and where you were born, then what that makes you a citizen of, then the optional things
last** so the required path runs unbroken from the top to Continue.

### The order

1. **Your face and your name.** The portrait on the left; on the right the legal name (first, middle, last), then
   Preferred Name (defaults to first and last), then Pronouns, then Billed As directly under Pronouns, since pronouns
   settle it and it only opens as a choice under they/them. One block, because that's what a document and an
   introduction both start with. **Billed As stays** (owner, 2026-10-26: the difference between actor and actress is
   wanted, with downstream effects behind it, "same as race and ethnicity"); entry 11's cut of it is withdrawn, and
   like race or ethnicity it carries the rule of entries 4 to 6: a researched engine that reads it and changes
   outcomes, written when the premise says what those outcomes are.
2. **When you were born.** Year, month, day, and the line "You'll be 24 when you start" *directly under them*, where
   the figure comes from. (Today that line is printed at the foot of the page, under Citizenship, far from the
   fields it reads.)
3. **Where you were born.** The map, the country, the state or region, the town search. It follows the date because
   "born June 14, 2002, in New York" is the order the sentence takes, and it sits low on the page because it's the
   tallest thing on it.
4. **Citizenship.** Directly after the birthplace, because the birthplace suggests it (Same As Your Place Of Birth),
   and it's the last required thing.
5. **Languages** (moved here from Genres & Background; the owner, 2026-10-26: "adding languages to the page to
   wherever it perfectly lands"; and "with language I should be able to pick multiple"). Several, each with how well
   it's spoken: today English always and up to five more, a cap of six that was this SLATE's own figure (ASSUMPTION,
   never a researched one); in the new build there is no cap but the list of real languages itself, since nothing
   real limits how many a person speaks. It lands directly
   after Citizenship because that's where the sentence goes ("born in Seoul, a Korean citizen, speaks Korean and
   English") and because the birthplace and the citizenship are what a language follows from; in the new build the
   birthplace's country can suggest its languages the way it suggests the citizenship, and the player confirms or
   changes them. It stays above Race or Ethnicity because it's read by casting (a part written for a speaker) and so
   belongs on the required path.
6. **Race or Ethnicity**, with In Your Own Words, last. Today it's optional and decides nothing; in the new build it
   has the engine in entry 4 and may stay optional (a breakdown that names an ethnicity simply isn't written for a
   player who gave none, as "any ethnicity" parts are for everyone). Last because it's the one field a player may
   leave, so the required path above it runs unbroken.
7. The amber "what this step still needs" box and Back / Continue at the foot, as now.

What moves, in short: the age line goes up to the birth date, Languages comes over from step 3 to sit after
Citizenship, and Race or Ethnicity goes down to the end. Everything else keeps its place. Height and weight stay on
Starting Point, where the owner moved them on 2026-10-10. Step 3 (Genres & Background) loses its Languages card.

---

## 4. The rule for creation in the new build: every field means something and has an engine (DECIDED), with the
## engines for the fields that have none today (DECIDED AS THE PLAN on 2026-10-26, each to be researched first)

**Owner (2026-10-26):** "I need each to mean something and have an engine behind it including race or ethnicity."

This is a standing rule for the rebuild, and it reverses a choice this SLATE made on purpose: here, names, race or
ethnicity, the portrait and the background sentence decide nothing and say so to the player. In the new build a
field with no reader is not asked. For each field of the Identity page as it stands, what reads it today and what
would read it in the new build. The engines are proposals; the ones that rest on a real rule say what has to be
researched before they're built, as this SLATE's research register did for every real rule it used.

| Field | Today | In the new build (proposed) |
|---|---|---|
| Legal name | Profile, Home, the slot only | **Papers and the union.** The legal name is what the passport, the visa, the bank account, the W-2 and the tax return carry, and it must match across them (a bank opening or a visa reads it). SAG-AFTRA requires a professional name no other member uses: joining with a name already taken means working under a different billing, which the join step asks for. (Research: SAG-AFTRA's professional-name rule as published.) |
| Preferred Name | Home's greeting, the slot | **The billing name.** What goes on the credit, the call sheet, the poster, the award nomination and the union card; the name casting knows. Diverging from the legal name is the stage-name case the union rule above reads. |
| Pronouns | Settle the title | As now, and they're what every notice, agent, director and reviewer uses for the player, so a wrong one never appears. |
| Billed As | Casting reads it | As now (the strongest reader on the page). |
| Portrait | "Only for show" | **The first headshot.** The photo the player brings is their starting headshot, version 1 of the material the career already versions (`pro.headshots`): it's what the first submissions send, it ages like any headshot (casting offices and agents read a headshot's age today), and a professional session replaces it. A life that brings no photo starts with none and can't submit until a session is had, which is true to life. |
| Date of birth | Age, the birthday, mortality, fitness | As now, plus **playing age**, which casting already reads from the role's ages: the field is the source of the figure. |
| Race or Ethnicity | Nothing | **Casting breakdowns, as the industry actually writes them.** Real breakdowns name an ethnicity for a part or say "any ethnicity" or "open ethnicity"; a role written for a specific one is cast from actors who identify with it, and that's the largest single thing after age and gender that decides which parts an actor is seen for. So in the new build: a share of the slate's parts carry an ethnicity line, drawn from how real breakdowns are written by kind and market (research needed: published breakdown practice, the casting guilds' and unions' own language, SAG-AFTRA's diversity-casting provisions); a part's line is read where Billed As and the playing ages are read, at the posting, the agent's submission and casting's fit; "any ethnicity" parts read nothing; the player's choice of several, or none, is honored as the breakdown's language would honour it. Also the real institutions that are keyed to it and that this SLATE's awards and festivals build left out: the NAACP Image Awards, the Imagen Awards, the American Black Film Festival, the Asian World Film Festival and the like, each entered as a real institution with its real eligibility, read from the same field. **The line to hold:** the field moves which parts are written for the player and which institutions they're eligible for, exactly as the real industry does, and never any ability, judgment of work, pay rate or chance of being good; nothing in the engine may encode a stereotype, only a published practice. The player is told plainly what the field does. |
| In Your Own Words (race) | Profile | Folded into the above: the free text stays as the player's own words, read nowhere, since free text can't be an engine's input. |
| Place of Birth | Suggests citizenship, a license state, a body's draw | As now, plus the **home market**: the first place the player's hometown press, local theater and regional casting know them from (regional theaters and local commercials cast locally), and the accent the Accents And Dialects technique starts from. |
| Citizenship | Papers, work permission, banks | As now. |
| Background sentence (Genres & Background) | Profile | **Replaced by structured choices** the engine can read: where you grew up (town or country, which sets the starting accent and the home market above), what your family did (which reads into the family's means and into whether anyone in it was in the business, a real route to a first agent meeting), and what you did before Yale (prior training, which sets the starting techniques; prior work, which sets the starting credits and union status). The sentence itself can stay as a line the player writes for themselves, but nothing is asked that only a sentence answers. |

What this rule means for the capture pages still to come: every field, control and figure on every page gets the
same two columns, what reads it today and what would in the new build, and a field with no honest second column is
proposed for cutting rather than kept as decoration.

---

## 5. The standard for every engine in the new build (DECIDED), and what the world map covers today (RECORDED)

**Owner (2026-10-26):** "We're putting real engines that read bits and have downstream effects behind each of these.
That means doing extensive research through and through to get 100% accuracy and realism."

**The standard, as a rule for the rebuild:** every field and feature has an engine that reads real inputs and
changes real outcomes downstream; every figure, rule, name, date and process in it is researched from the primary
source (the government's, the union's, the guild's, the institution's own published page) and cited in a research
register as this SLATE kept one; where a source is unpublished, confidential or can't be reached, the engine does
not invent it: it says so, the gap is recorded as a blocker, and the game's own figure, where one must stand in, is
labeled the game's wherever the player meets it. "100% accuracy" is held to that bar: nothing is stated as real that
wasn't read from the real source, and nothing real is left out that the research could reach.

### What the world map and the geography cover today, honestly

- **Every country and territory as a place: yes.** The gazetteer holds 252 countries and territories (51 of them
  territories), every first-level subdivision, and 170,911 populated places of a thousand people or more, from
  GeoNames; the map draws the countries' outlines from Natural Earth at 110m, and the countries too small to draw at
  that scale are still in the list. Each place has its time zone, its country's currency and its distance to the
  nearest market. A life can be born in, be a citizen of, and have lived in any of them.
- **The rules of those countries: no, far from all.** The work rules that let a life *work* somewhere are the US
  package, verified routes for 2 more countries (the UK and Australia, the game's markets abroad), 5 partly
  researched, and 244 unsupported, where the game refuses to assume a rule. Banking covers thirteen countries with
  real banks and fee sheets (US, Canada, Mexico, UK, Ireland, France, Spain, Germany, Iceland, Japan, South Korea,
  Australia, New Zealand). Passports and visas are researched for the routes the game plays. Markets where work is
  cast: twelve, ten of them in the US, plus London and Sydney. Official lists cover 87 performers' unions (FIA) and
  50 accredited festivals (FIAPF) by name.
- **So the coverage matrix reads:** 3 countries researched, 66 partly, 183 simulated (only the shared rules: time
  zone, currency, distance). The matrix (`docs/verification/career-universe-2026-10-24/geography/COVERAGE.md`) says
  this country by country, and it's the starting list for the new build's research: for the standard above to hold
  worldwide, each of the 249 countries not yet researched needs its work rules, tax, banking, union and market read
  from its own sources, or an explicit, player-visible statement that work there isn't modeled.

**For the new build:** the gazetteer and the map are kept (entry to come when the Place of Birth control is
reached in the captures). The coverage matrix becomes the research plan, worked country by country, and a country's
row moves to "researched" only when its sources are cited.

---

## 6. Full worldwide coverage, research behind every country, and zero decoration (DECIDED)

**Owner (2026-10-26):** "I want full coverage matrix and research behind each, and all should read bits and have
downstream effects, with absolutely zero decorations, like none at all."

Three rules for the rebuild, each absolute:

1. **Full coverage.** The geography matrix reaches "researched" for every one of the 252 countries and territories,
   not 3. For each: its work rules for a performer (permits, visas, who may employ whom), its tax on earnings and
   on a non-resident's earnings, its banking (real banks, real fee sheets, account formats), its performers' union
   or guild and its agreements, its casting markets and what's cast there, its public holidays and its calendar, its
   currency and how pay arrives, its passports and the visas its citizens need elsewhere. A country whose own
   sources can't be reached is still in the matrix, with the blocker named and dated, and the game says to the
   player what isn't modeled there; it never pretends.
2. **Research behind each.** Every row cites the primary source it was read from, with the date it was read, in a
   research register; no figure comes from memory or from a summary. The register is a deliverable of the build,
   gated like this SLATE gated its matrices: a row without its source fails.
3. **Zero decoration.** Every field, control, figure, word, screen and system reads real inputs and changes real
   outcomes downstream. Nothing is shown that nothing reads; nothing is asked that nothing uses; no number is
   typed where a sum belongs; no choice ends the same whichever way it's made. This SLATE's own ONE RULE ("a
   declared word with nothing that reads it is worse than no word at all") becomes the rebuild's only rule for what
   goes in, applied without exception, and the gate that proves it (a feature-to-effect matrix with a consumer at a
   file and line for every feature, and the falsifiability test: change the input, does the outcome change?) is kept
   and run on every commit.

What this changes in the capture work from here: each page's entry lists every element with its reader in the new
build; an element with no reader is cut, not kept. And the scale of the research is the real cost of the rebuild:
this SLATE researched three countries in depth over its briefs, and the standard above asks for 252.

---

## 7. How the research is done (DECIDED)

**Owner (2026-10-26):** "Do everything possible to find information, like everything: Google searches and all."

For every engine and every row of the coverage matrix, the research goes as far as it can go, not as far as is
convenient: web searches in every phrasing, the institution's own site and its published documents (rules, rate
cards, agreements, forms, fee sheets, statutes), official registers and lists, trade press where it quotes a
primary source, and the archived copy where the live page has gone. Each fact is recorded with the page it was read
from and the date, in the register. A fact found only in a secondary source is marked so; a fact not found after
that is a blocker, named, not a guess. This is the method this SLATE's research register already used (its
`docs/verification/career-universe-2026-10-24/research/register.json` holds the form: id, what was sought, the
pages tried, what each said, the date, and the status), carried over whole and applied to everything.

### Kept source for the Identity page

`kept/02-creation-identity/`: the creation component (all five steps live in one file, `CharacterCreation.tsx`),
the place picker and the world map with its data loader, the portrait picker and its arithmetic, the identity and
ethnicity option lists, the gazetteer's registry (`geography.ts`; the per-country place files are the app's
`public/geo/` data, generated from GeoNames and not copied here), the new-save config and its defaults
(`bootstrap.ts`), the title rule (`performer.ts`), and the creation styles.

---

## 8. Creation, step 2 of 5, Dispositions & Traits: NOT CARRIED OVER (DECIDED 2026-10-26)

**Owner:** "This page will not be carrying over so pass."

Recorded so the decision is on file and nothing of it is rebuilt by habit: the seven dispositions (Openness,
Conscientiousness, Extraversion, Agreeableness, Emotional Stability, Ambition, Risk Tolerance, 5 to 95) and the 35
traits in opposing pairs (Temperament, Habits, Body, Money, People, Mind; up to four), with the knobs they moved in
this SLATE (stress, sleep, morale, the card's autopay, grime, food cost, a slight, a line learned). The capture is
`captures/01-opening/03-dispositions-traits.png` for the record. What read them downstream (stress, the night, the
starting Composure and Discipline, how a day is taken) will need other inputs in the new build or will go with
them; that is settled when those systems are reached.

---

## 9. Creation, step 3 of 5, becomes Background only (DECIDED 2026-10-26); Genres move elsewhere (destination open)

**Owner:** "This page should just be backgrounds, we're going to move genres some place else."

Capture: `captures/01-opening/04-genres-background.png` (the page as it stands, with its four cards).

### What the page becomes

**Background**: who you were before now, every part of it read by an engine (entries 4 to 6), **in the order a
life happens** (owner, 2026-10-26: "put the things on my new background page in chronological order"), and with
nothing of the School or of this SLATE's career engine in it (owner, the same day, entry 10):

1. **The family you were born into.** Its means first, since they're there from the first day: the six families
   (Nothing, Scraping By, Modest, Comfortable, Wealthy, Inherited), each setting the first morning's checking,
   savings, card limit and balance and credit score, said in a box in the player's money. Kept as it stands, less
   the School's half of it: what Yale found and the Yale Health fee go with the School.
2. **What your family did.** A structured choice, read by the means above and by what a family's trade leaves a
   person with; what else reads it is settled when the systems that would are decided.
3. **Where you grew up**, if not the birthplace (the place picker again, or "the same"): the starting accent, and
   it can refine the languages Identity suggested.

Gone from this page with the School and the career engine (entry 10): "Training before Yale", "Work before Yale",
and "When you came to New Haven". Where the player lives now, and since when, stays a question for Starting Point.
The sentence "In Your Own Words" is not a field of this page: under entry 6 it's not asked, since nothing reads it.

### Genres

Moved off this page. Where they land is open; the owner will say. For the new build they earn a place only where
every genre is read against real work (the slate's parts, the plays, the kinds of production), as a casting and
preference engine, not as the mood knob they are today; and the dot that marks a genre with no work in the game goes,
because under entry 6 such a genre is not offered.

### Languages

Decided onto Identity (entry 3, after Citizenship), not onto Background. The owner asked whether a language counts
as background: it is both, a fact of where you grew up and a fact casting reads directly, like Billed As. It sits on
Identity because it belongs to the required path with birthplace and citizenship, which suggest it; in the new build
"where you grew up" on this page can refine the suggestion. If the owner would rather it live here, the move is one
line in entry 3.

---

## 10. The School and this SLATE's career engine are not carried over (DECIDED 2026-10-26)

**Owner:** "We're getting rid of the school and career engine, so get rid of those from this right now."

Recorded as said: the School (Yale's MFA, its terms, classes, coursework, productions, standing, the dean, the
need assessment and the Yale Health plan, the start at New Haven on the first day of term) and this SLATE's career
engine (the `pro.*` systems: postings, submissions, auditions, offers, agents, contracts, pay, work days, releases,
awards, as built through brief 27) do not carry over. Every entry above that leaned on either is corrected in place:
the Background page (entry 9) drops its School and career items; entry 4's engines for the Identity fields that
named casting breakdowns, the union's name rule, headshots, playing age and the home market are **held, not
decided**, until the owner says what the new SLATE's life is made of, since each of them is a career reader.
Identity's Billed As, whose only reader was casting, is in the same position.

What this leaves standing from the pages so far: the startup screen and its engine (entry 1), the slots screen
and its engine (entry 2), the Identity page's order and its non-career engines (papers, citizenship, banks, age,
mortality, the body's draw, the place and the languages), and the Background page's family means and where you grew
up. What the new SLATE is a life *of*, now that it isn't an actor's training and career as built here, is the
owner's to say, and the next entries wait on it where they'd otherwise guess.

---

## 11. Yale, everything School and career, and all the attributes with them: gone from the new build (DECIDED 2026-10-26)

**Owner:** "Get rid of Yale too, everything school and career, get rid of that and all the attributes with it for
this."

What this removes, named so none of it comes back by habit:

- **Yale and the start it fixed.** The life no longer begins at Yale's drama school in New Haven on the first day of
  the 2026 fall term. So Starting Point's "Where It Begins: New Haven, fixed" becomes **Where You Live**, the
  player's own choice from the same world picker (the control already exists for a life made away from school), and
  the start date is no longer the term's first day: what it is instead is the owner's to set (a fixed date for
  everyone, or a choice). The slot card's title line ("Actress, Yale Drama Year 1") and Review's School line go.
- **Everything School:** terms, classes, coursework, productions, the Rep, the Cabaret, standing, leave, the dean,
  the casting pool, the need assessment, the Yale Health plan, the F-1 student status as the non-American's starting
  paper (a non-American's papers in the new build are whatever their reason for being where they live is, which the
  owner decides with the premise).
- **Everything career:** the `pro.*` engine entire (entry 10), and with it the readers that made Billed As, the
  portrait-as-headshot, playing age, the union name rule, casting breakdowns and the home market mean anything.
  Those engines (entry 4's career rows) are **withdrawn**, not held: they were readers of a system that's gone. The
  fields they would have served stand or fall on the premise the owner names: Billed As was cut here and
  restored the same day by the owner (entry 3), to carry a reader like race or ethnicity's; the portrait, the legal name and the preferred name keep the readers that
  aren't career (papers, the bank account, the slot, Home); race or ethnicity's reader is open again; the birthplace
  keeps citizenship, the license, the body's draw and the languages.
- **All the attributes:** the twelve abilities (Emotional Depth, Presence, Listening, Imagination, Focus, Memory,
  Adaptability, Composure, Vocal, Physical, Discipline, Stamina), the seventeen techniques and the craft, the
  evaluation of judged work, readiness, mastery, the approaches, the genres' demands and families, and the
  dispositions' two starting lifts (Composure, Discipline) that fed them. Genres (entry 9) lose the only reader they
  were going to have, work in a genre; where they land, if anywhere, waits on the premise.

What stands from the pages so far, after this: the startup screen and its engine; the slots screen and its engine
(its title line to be redefined); the Identity page's order with the engines that aren't School or career (papers,
citizenship, banks, age, the birthday, mortality, the body's draw, the place, the languages); the Background page's
family means, family trade and where you grew up; the world map and the gazetteer; the design tokens and the voice
standard. Everything else on the five creation pages is cut or waits.

**Open, and only the owner's to answer before the next entries can be honest:** what the new SLATE is a life of.
Every engine still proposed above reads either papers and money (which stand on their own) or a vocation (which is
gone). The next capture (Starting Point) is read against that answer.

---

## 12. Creation, step 3 of 5, Genres: every genre on its own page (DECIDED 2026-10-26)

**Owner:** "Let's title this next page Genres and we're putting all the genres on them." And of the Background page
before it: "Perfect, keep it and all the information."

The step strip is now **Identity, Background, Genres, Starting Point, Review**. The Genres page is one card: the
heading, one line, the chosen count and Select All / Clear These at the right, and all 149 genres as chips, pick as
many as are true. Changes from the old card: the dot that marked a genre with no play or project in the game is
gone, because under entry 6 nothing is offered that nothing reads, so in the new build every genre on this page has
a reader or the page doesn't ship it; and the card stands alone as its own step.

The 149, as the game lists them today (kept with the source in `kept/02-creation-identity/`; the list and each
genre's definition and cited source are in `src/engine/content/genres.ts`, generated from the research of
2026-10-09): Absurdist, Action, Action Comedy, Adventure, Alternate History, Animated, Anime, Anthology, Apocalyptic,
Art House, Avant-Garde, Backstage Musical, Biker, Biographical, Black Comedy, Blaxploitation, Body Horror, Buddy
Comedy, Buddy Cop, Caper, Chanbara, Chase, Children's, Christmas, Comedy, Coming Of Age, Concert Film, Conspiracy
Thriller, Cosmic Horror, Costume Drama, Courtroom Drama, Creature Feature, Crime, Cyberpunk, Dance, Dark Fantasy,
Detective, Disaster, Docudrama, Docufiction, Documentary, Domestic Drama, Drama, Dystopian, Eco-Horror, Epic, Erotic
Thriller, Espionage, Experimental, Exploitation, Fairy Tale, Family, Fantasy, Farce, Film Noir, Folk Horror, Found
Footage, Gangster, Giallo, Gothic Horror, Grindhouse, Hangout, Heist, Historical Drama, Historical Fiction, Holiday,
Hood Film, Horror, Horror Comedy, Isekai, Jidaigeki, Jukebox Musical, Kaiju, Kitchen Sink Drama, Legal Drama,
Magical Realism, Martial Arts, Medical Drama, Melodrama, Military, Mockumentary, Monster Movie, Mumblecore, Musical,
Mystery, Nature Documentary, Neo-Noir, Neorealism, New Wave, Nordic Noir, Occult, Parody, Period Drama, Picaresque,
Police Procedural, Political Drama, Political Thriller, Post-Apocalyptic, Prison Film, Psychological Horror,
Psychological Thriller, Queer Cinema, Revenge, Road Movie, Rockumentary, Romance, Romantic Comedy, Romantic Drama,
Samurai, Satire, Science Fantasy, Science Fiction, Screwball Comedy, Sea Adventure, Silent Film, Slapstick, Slasher,
Slice Of Life, Social Realism, Space Opera, Spaghetti Western, Splatter, Sports, Spy, Steampunk, Stoner Comedy,
Superhero, Supernatural, Surrealist, Survival, Swashbuckler, Sword And Sandal, Sword And Sorcery, Techno-Thriller,
Teen, Thriller, Time Travel, Tokusatsu, Tragedy, Tragicomedy, True Crime, Vampire, War, Werewolf, Western, Whodunit,
Wuxia, Yakuza, Zombie.

**Owner (2026-10-26):** "These should all have full coverage matrix and an engine that reads bits and has downstream
effects too." So entries 5 and 6 apply to the genres one by one: **every one of the 149 has a row in a coverage
matrix** (what the genre is, from its cited source; what in the game is of that genre; what reads the player's love
of it; what that changes downstream; its tests), and a genre whose row can't be filled isn't on the page. Research
to the source for each: the definition this SLATE already cites (`genres.ts`, from the 2026-10-09 research, 38 of
whose citations were corrected to followable pages on 2026-10-19) is the start, and the rest of the row is written
when the premise names what a loved genre does. In this SLATE a loved genre moved the mood of work in that genre;
that reader went with the career. What reads a loved genre in the new build, and so what the rows' downstream
columns hold, is decided when the owner says what the life is a life of; the rule that each must have one is
decided now.

Capture: `captures/02-new-build/04-genres-new.png`.

---

## 13. Billed As, gender, race and ethnicity: kept, each with a researched engine and downstream effects (DECIDED 2026-10-26)

**Owner** (by voice, as understood): the difference between actor and actress is wanted in the new build; "actor" is
used across genders today, but the choice should stand and have real downstream effects behind it, the same as
race and ethnicity and everything else on the page.

So on Identity: Pronouns, Billed As (Actor or Actress, settled by she/her and he/him, chosen under they/them) and
Race Or Ethnicity each stay, each with the rule of entries 4 to 6: an engine that reads the choice and changes
outcomes downstream, researched to the source, with nothing decorative. What those outcomes are waits on the
premise (entry 11), as race or ethnicity's does; the decision that each must have them is made now, and a field
that ends up with none is cut, not kept.

---

## 14. Creation, step 4 of 5, Starting Point: Your Money alone (DECIDED 2026-10-26)

**Owner:** "Get rid of everything but 'Your Money'."

Capture of the page as it stood: `captures/01-opening/05-starting-point.png`; as decided:
`captures/02-new-build/05-starting-point-new.png`.

**Kept: Your Money.** "The money in your own name on the first morning": the currency line (the money is kept in
the currency of the place the life starts, and exchange rates are estimates, not live rates), **Your Bank** (a real
bank of the country, with its real fee line, from the thirteen countries' sheets today and from every country's under
entry 6), and the figures the family set: checking, savings, credit record, the card's limit. The Yale Health box
under them is gone with the School. The engine behind it is this SLATE's banking (real banks, fee sheets, account
formats, the card, the credit score, the currency), which stands on its own without the career and is kept. Note
for the build: the family's figures are shown on Background and again here; the owner decides which page owns the
choice and which only reads it back.

**Cut from this page:**

- **Your Body** (height and weight, drawn around the birth country's averages where left blank). With it goes what
  read it: the daily weight, what a workout or a night spends, the chronic-condition rates by body mass index and
  the long-life chance, unless the premise brings a body back with its own reader.
- **Where It Begins** (the Yale paragraph and the town's population, time zone and cost of living). With the
  School gone this would have become Where You Live; the owner cut the card, so **where the life begins is open**:
  the places the player has already given are the birthplace (Identity) and where they grew up (Background), and the
  premise says which of those, or what else, is home on the first morning.
- **Before Yale** (the place lived just before, the account kept there, the savings split; "I Lived Where I Was
  Born"). With it goes the residence-history engine: the home bank abroad and its holidays, the account number's
  format by country, a US citizen's starting license state. If the premise needs a residence history, it comes back
  as its own card under its own name.

The step strip stays **Identity, Background, Genres, Starting Point, Review**; whether a one-card step keeps the
name Starting Point or becomes Money is wording, deferred.

---

## 15. Creation, step 5 of 5, Review: re-formed around the kept steps (DECIDED 2026-10-26)

**Owner:** "You already know what to get rid of on this." Applied from entries 3 to 14.

Captures: as it stood, `captures/01-opening/06-review.png`; as decided, `captures/02-new-build/06-review-new.png`.

**What stays:** Ready To Begin with the name large and a line under it (age, Billed As, and home, which is open
until the premise; the mock shows the birthplace); the sections, each saying back what its step took, in the steps'
order: **Identity** (legal name, pronouns, billed as, born, place of birth, citizenship, languages, race or ethnicity,
in the page's own order), **Background** (family, what your family did, where you grew up), **Genres**, **Money**
(bank, checking, savings, credit record, card); **The Guide** choice (Guide Me Through It / I Know SLATE); the
amber line that the life starts paused and the clock's rule; Back and **Begin**.

**Gone:** the School line; the Dispositions & Traits section; In Your Own Words; Where You Live and Food Each Month
(their cards and the household reader of the town went with Starting Point's cuts; if a household comes back with
the premise, its line comes back here).

**Open with the premise:** what the Guide teaches (its chapters were this SLATE's, School and career among them) and
whether the clock's rule stays as written ("a minute passes in the game for every real minute, and the clock pauses
itself at each commitment"), both features of the first morning, which the next capture page is.

---

## 16. No tutorial (DECIDED 2026-10-26)

**Owner:** "Let's go with no tutorial right now, so get rid of it."

Gone from the new build: the guide's twenty chapters as a tutorial, the locks they held on panels and controls
("Locked", "Read About It", the command guard that refused a command whose chapter wasn't read), the Guide (N Left)
count, the guide line with its Read button at the top of Home, and the choice on Review (Guide Me Through It / I
Know SLATE), since there's nothing to choose. The life opens with everything live, as "I Know SLATE" opened it.

Left standing for now, as reference rather than tutorial, until the owner rules on it: the Guide button in the top
bar and the "How This Works" / "How Home Works" / "How The Weather Works" links on each panel, which open the guide's
entries as a manual; and the amber line on Review about the paused clock, which is a fact, not a lesson.

Capture: `captures/02-new-build/07-home-no-tutorial.png`, Home on the first morning with nothing locked. What's on
it that the School and career cuts (entries 10 and 11) still remove: School and Career on the menu, the term's
events in Up Next (Registration And Your Account, The Fall Term Begins, Meeting Your Class and the rest), the
"Welcome To The Class Of 2029" notice, and New Haven as the town; "Actress" in the date line stays with Billed As.

---

## 17. Home, the first morning: the School, the career and the attributes taken off it, with their engines (DECIDED 2026-10-26)

**Owner:** "Get rid of what needs to get rid of and their engines." Applied from entries 10, 11 and 16.

Capture: `captures/02-new-build/07-home-new.png`.

**Gone, with the engine behind each:**

- **School** and **Career** on the menu, and their groups Your Training and Your Work: the School engine and the
  `pro.*` career engine (entries 10 and 11).
- **The term's events in Up Next** (Registration And Your Account, The Fall Term Begins, Meeting Your Class, Meeting
  The Acting Faculty, The Building, The Studios And The Library, The Courses And What They Ask): the School's
  orientation calendar. Up Next itself stays, reading the calendar, which starts empty.
- **The School's welcome notice** in Recent Updates ("Welcome To The Class Of 2029"): Recent Updates stays, reading
  the notices, which start empty.
- **Readiness** in How You Are, its meter and the "costing readiness" line under Look After Yourself: readiness was
  the attributes' reading of the body and the mind for work, cut with them (entry 11). Energy and Stress stay, with
  the line on how you are, which is wording.
- **New Haven** as the town: home is open (entry 14); the mock shows the birthplace.

**Standing on Home, each with its engine, until the owner rules on it:** the top bar (the clock in real local time,
Paused and Play, Sleep, Look After Yourself, Advance, Save & Exit); the menu with Player Profile, Money and Papers;
the greeting and the town line (time zone, season, daylight from the town's latitude and the date, each word a link
to its detail); the weather and its five-day forecast (the climate model by place); What Needs You (the questions
waiting, what's past due, the bank and the card, the calendar's clashes); How You Are (energy and stress, and Look
After Yourself with Eat A Meal and Order In, each with its time and its cost in the town's prices); Up Next with
Open Calendar; Recent Updates with View All Updates; the Guide button and the How This Works links as a manual.

---

## 18. Home: How You Are and Look After Yourself gone with their engines; the clock, the weather, the money and the papers held to full worldwide coverage (DECIDED 2026-10-26)

**Owner:** "Remove all those on How You Are, and remove Look After Yourself and the engine of those. Make sure the
clock is still ticking accurately as a real-time clock, and the weather matches back with the geography and map
covering every single country and territory. Same with the banking system in Your Money and Your Papers: the full
world map, the coverage matrix covers it all."

### Gone, with their engines

- **How You Are**: the panel, the line on how you are, Energy and Stress (Readiness went in entry 17). With it the
  life engine's energy and stress: what a night puts back, what a day spends, stress's gain and recovery, nerves,
  running on empty, overwrought, the dispositions' readers of them (already gone with entry 8).
- **Look After Yourself**: the panel's Eat A Meal and Order In with their times and costs, the nourishment line, and
  the Look After Yourself menu in the top bar. With it the nourishment engine, meals and their prices by town, the
  household's food cost, the Frugal/Spender readers (already gone).
- **Held, not decided:** the **Sleep** button in the top bar. It belonged to the energy engine (the night restores
  energy), but it is also the way the clock is moved to the next morning; if the owner wants it as a clock action
  alone, it stays as that, else it goes with energy.

### Held to full coverage, with what is true today

- **The clock.** Real time, in the town's own local time: one game minute per real minute while playing, paused
  when paused, every place on its IANA time zone with daylight saving as that zone keeps it, the season and the
  daylight from the town's latitude and the date, and every jump (Advance, Sleep) stopping at a commitment that
  wants the player. This is the engine as it stands and it already covers every place in the gazetteer, since a
  time zone is part of each place's record. **Kept, and held to accuracy**: the new build proves the clock against
  real zone rules (a test per zone family, DST transitions included) rather than assuming the browser's tables.
- **The weather.** Today: a climate model, physics by latitude, longitude and coast, with a hand-kept table of
  Köppen-type classifications for the countries, regions and cities people most look at, and a fallback by latitude
  everywhere else; the weather itself a pure function of the seed, the place and the day, so it covers every one of
  the 170,911 places, but is *calibrated* for a few dozen, and the screen says so. **Required**: the climate behind
  every country and territory researched to its own published normals (a national meteorological service's or a
  recognized climatology's figures for its places), each cited in the register, so the weather at any town matches
  that town's real climate, not a latitude guess; the fallback by latitude stays only for a place whose country's
  figures can't be reached, and is marked so.
- **Your Money.** Today: real banks with fee sheets, account formats and returned-payment rules for thirteen
  countries; a currency for every country; exchange rates estimated. **Required**: the full matrix, every country
  and territory's banks, fees, account formats, cards and credit systems as they really are, from the banks' own
  sheets and the regulators' pages, with the currency and how pay and prices move in it; a country whose banks'
  pages can't be reached is in the matrix with the blocker, and the game says what isn't modeled there.
- **Your Papers.** Today: passports researched for fifteen countries from their offices' own pages (fees, times,
  expedited services, validity, from abroad), the US package of papers (passport, license, Social Security, the
  I-9, taxes and returns) in depth, visa and work routes for the US, the UK and Australia. **Required**: every
  country and territory's passport office, ID, visas, residence and work permissions, from the government's own
  pages, in the register, with the same rule for the unreachable.

These four are the first systems of the new build to be built, since every page so far reads them, and entry 6's
three absolutes apply to each without exception.

---

## 19. Whatever reads the geography covers the whole map; the manual goes (DECIDED 2026-10-26)

**Owner:** "Everything that needs the geography is required to cover that whole map that's built into the game. Also
you can get rid of the 'How It Works'."

**The rule, general now:** any engine that reads a place (the clock and its zones, the weather and its climates, the
banks and the currency, the papers and the permissions, the holidays and the calendar, the prices, and anything
built later that asks where the player is) is required to cover every one of the gazetteer's 252 countries and
territories and 170,911 places that the map built into the game already offers. No engine may offer a place on the
map and then not know it. Each such engine has a coverage matrix by country and territory, researched to the
source (entries 5 to 7), and the game's own fallback stands only where the matrix records a blocker, marked where
the player meets it.

**Gone:** the "How This Works", "How Home Works", "How The Weather Works", "How Your Own Plans Work" links on every
panel and the Guide button in the top bar, which were the guide's entries served as a manual after the tutorial
went (entry 16). With them the guide system entire: the entries, the chapters, the help links, the "looks" opened
from underlined words stay only where they are the detail of a fact (a town's facts, a date's), not an explanation
of a feature. Nothing explains the game to the player from inside the game; the game says what it does where it
does it.

Capture: `captures/02-new-build/07-home-new.png` (Home with the manual's links gone).

---

## 20. The first build's scope is closed (2026-10-26)

**Owner:** "I think that's it as far as what I want for the first build of this new SLATE."

The first build is the nine screens in `captures/02-new-build/`, in the player's order, as `SCREENS.md` describes
them: the startup screen (entry 1); the slots screen (entry 2); creation in five steps, Identity (entries 3, 13),
Background (entries 9, 11), Genres (entry 12), Starting Point as Your Money (entry 14), Review (entry 15, less The Guide card, gone with the tutorial on 2026-10-26: "anything that has been removed, it and
its engine needs to be gone from the pages too"); and Home
on the first morning (entries 16 to 19), with the clock, the date and town line, the weather, What Needs You, Up Next
and the calendar, Recent Updates, and Sleep held.

Behind them, the engines the first build carries, each under entries 4 to 7 and 19 (a real engine, researched to the
source, covering the whole map, with zero decoration): persistence and the save slots; the gazetteer and the map;
the clock and its zones; the weather and its climates; the banks, the currency, the card and the credit record; the
papers (passports, ID, visas, permissions); the calendar and the notices; the family's means; citizenship; languages;
and the readers still to be written for Billed As, race or ethnicity, what your family did, where you grew up, the
portrait and the genres, each required to exist before its field ships.

Not in the first build, by the owner's rulings: Yale, the School, the career, the attributes, dispositions and
traits, the tutorial and the manual, the body, the household's food and meals, energy and stress, readiness, the
earlier residence, and the free-text background.

Open, in the owner's hands: the premise (what the life is a life of), home on the first morning, the start date,
Sleep, the wording of every screen in the owner's voice, and the clean repository the folder goes to.

**Sweep of 2026-10-26, at the owner's word that nothing removed may remain on a page:** The Guide card is off Review;
the Languages card on Identity loses its sentences about training, parts and the résumé (career readers that are
gone) and says only "The languages you speak, and how well."; the earlier Home capture with the tutorial gone but the
School still on it is dropped from the folder. Every other page was read again against entries 8, 10, 11, 16, 17, 18
and 19 and holds nothing of what they removed.
