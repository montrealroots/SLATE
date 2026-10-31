# Depth audit, layer 3: papers (2026-10-30)

Department: `src/papers/{passports,ids,citizenship,visits,work}`, `tools/papers/*`, `research/sources/papers/*`,
`coverage/{passports,ids,citizenship,visits,work}-countries.json`. Held to BUILD-ORDER layer 3 ("citizenship,
passports, ID, visas, residence and work permissions for every country ... the US package in the depth this SLATE
reached, every other country to the same depth or a named blocker") and KEEP 18's Your Papers. Read only; no edits.
Counts below come from scripts over the compiled JSON and the research files, run 2026-10-30.

## Verdict in one paragraph

The five engines are wide (every place answered, matrices complete, 100% mutation) but thin, and the department is
not complete. Each is a lookup table with no papers a life holds: no document record (number, issue day, expiry,
status), no command (apply, renew, replace, report lost), no scheduled issue on the office's time, no fee posted, no
day counted against a visit's or a permit's allowance, and nothing outside `src/papers` reads any of them
(`registry/features.json` is `{}`; the only cross-imports are visits and work reading `citizenship.nationality`). The
money side of layer 3 already has this (`src/money/cards/account.ts:277-282`, `card.open`/`spend`/`pay` and their
scheduled kinds); papers has none. Three things the owner named have no engine at all: residence (decided out,
HANDOFF.md:158-160, against BUILD-ORDER and KEEP 18's own word), a national number (Social Security and its peers),
and the driving licence with the US state ID card. Against the first SLATE the US package is shallower on every axis
it modelled, including passport facts the first SLATE had read (US processing time, renewal by mail, from abroad).

---

## 1. Engines that don't exist (owner's asks not met), ranked by how often a life meets them

### 1a. Held papers: the record and its lifecycle (every life, on the first morning)
- **What's missing.** No state for a passport, an ID card, a visa or authorisation, a permit, a residence status or a
  citizenship acquired. `passportOffers` (`src/papers/passports/passports.ts:260`) and `idOffers`
  (`src/papers/ids/ids.ts:65`) price an application nobody can make; `visit()`/`work()` return a rule nobody holds or
  counts; `naturalise()` (`src/papers/citizenship/citizenship.ts:162`) changes no held list.
- **First SLATE:** `PersonDocument` (1221 `src/engine/systems/documents.ts:51`): kind, issuer, number, status
  pending/valid/lost/cancelled, appliedAt, readyAt, issuedAt, expiresAt, destination, the passport it was issued on;
  `inForce`; `documents.apply_passport` (:333, fee charged from the bank, `readyAt` scheduled, old passport cancelled
  with what was issued on it), `documents.report_lost` (:352), `documents.police_report` (:367); starting papers
  (`STARTING`, :528, `startingDocuments` :535: a US citizen holds a passport at State's 0.536 share of residents, issue
  drawn across the term so expiry is real; a licence at FHWA's 80.9% for ages 20-24).
- **Form/engine needed:** a `papers` slice in the frame (documents with issuer, kind, number, issued, expires, status,
  `issuedOn` passport link); commands `papers.apply` (route + band from the offer, fee posted to the ledger, issue
  scheduled at `within`, unknown time said so), `papers.renew`, `papers.report_lost`, `papers.replace`; an expiry kind
  that warns ahead (What Needs You); starting papers by citizenship from a researched holding share per country (a new
  research column: passports in circulation over population, by country), a blocker where unpublished.

### 1b. Residence permissions (any life that lives where it isn't a citizen; feeds citizenship)
- **What's missing.** Decided out: "one engine for residence and work ... a non-working residence is out until the
  premise needs one" (HANDOFF.md:158-160). BUILD-ORDER layer 3 and KEEP 18 both name residence separately from work.
  `work()` collapses residence to `free`/`permit`; nothing grants, renews or counts residence, and nothing models
  permanent residence.
- **Why it bites now, not only with the premise.** `naturalisation(country).years` is "years of residence" with no
  engine producing it; in most states the clock is lawful residence of a set kind (US: 5 years as a permanent
  resident; UK: indefinite leave plus 12 months; Canada: 1,095 days' physical presence as a PR in 5 years; EU
  long-term residence, Directive 2003/109, 5 years). The citizenship engine reads an input no engine writes.
- **First SLATE:** `systems/residence.ts` (UK Global Talent, £561 endorsement + £205 visa + £1,035/yr Immigration
  Health Surcharge, five years, settlement/ILR £3,226 after five, `documents.settle` :193; Mexico temporary residence
  by solvency, 11,460 UMA savings or 680 UMA/month income, card MXN 11,140.74/yr, consular visa US$56, yearly renewal
  in the last 30 days, `documents.renew_residence` :208, permanent after 4 years MXN 13,578.96; US EB-1A green card,
  I-140 $715 + $300 + I-485 $1,440, premium $2,965, 31 months or 15 business days, Visa Bulletin by birth country;
  Canada and Ireland "no route" with the reason). `residenceRefusal` (1221 `systems/documents.ts:258`). Status end
  and grace (`usStatusEnds`, 1221 `systems/permission.ts:191`: F-1 60 days, O-1 10 days, out-of-status consequences).
- **Form needed:** per country, the residence routes open to a performer and to a non-working person (temporary:
  name, fee, time, term, renewable, conditions such as solvency thresholds, work allowed y/n; permanent: after how
  many years on which route, fee, time), the registration duty on arrival (EU art. 8 registration after 3 months,
  Germany's Anmeldung in 14 days, Japan's and Korea's residence cards), and which residence counts toward
  naturalisation (feeds `citizenship`). A new matrix `coverage/residence-countries.json`.

### 1c. A national number: Social Security and its peers (every life that banks, works or is credit-checked)
- **What's missing.** No engine, no research column. Nothing in `src/` or `research/sources/papers/` models a US
  SSN, ITIN, UK National Insurance number, Canada's SIN, Australia's TFN, Ireland's PPSN, Mexico's CURP/RFC,
  Brazil's CPF, Germany's Steuer-ID, Japan's My Number, Korea's RRN, India's Aadhaar/PAN. The only trace is Belize's
  Social Security card filed as its ID (`research/sources/papers/ids/BZ.json`).
- **First SLATE:** `systems/taxid.ts` (US SSN held by citizens; a non-citizen's application only with work
  authorisation, in person, card in 21 days, `documents.apply_ssn` :62; without one the ITIN by W-7, 7 weeks; banks
  opening only in branch without one). `systems/socialsecurity.ts` (the retirement benefit) is earnings-bound and
  held with tax.
- **Readers it would have in this build:** the banks (US accounts and credit files key on SSN/ITIN; Canada's SIN for
  interest-bearing accounts; Brazil's CPF for any account), the credit engine (`src/money/credit`: no number, no
  US file), work (an engagement can't be paid without one).
- **Form needed:** per country, the number's name and issuer, who gets it (citizens at birth / residents /
  authorised workers), how applied for (in person, online), fee, time, prerequisites (right to work, an address),
  and which institutions ask it (bank, employer, bureau). Matrix per country.

### 1d. Proving the right to work: the I-9 and its peers (every hire)
- **What's missing.** No engine. KEEP 18 names the I-9 in the US package.
- **First SLATE:** shallow there too: work-study's I-9 done at registration (1221 `systems/school.ts:147, 3657`),
  the DMV's primary document list (1221 `systems/identity.ts:166-170`), `usWorkAuthorized`
  (1221 `systems/permission.ts:115`) read at each booking.
- **Form needed:** per country, the employer's check (US I-9 Lists A/B/C and E-Verify; UK right-to-work check;
  Australia VEVO; ...) as the set of papers that satisfy it. Its reader is a hire, which the premise brings; the
  research and the rule can be held now.

### 1e. The driving licence and the US state ID card (many lives; the owner's US package)
- **What's missing.** No engine. `research/sources/papers/ids/US.json` says "Cards a state issues are left to the
  United States package, with the driver's license" and no such package exists; CA and AU files say the same of
  provincial/state cards. The ID form has no sub-national issuer, so US states, Canadian provinces and Australian
  states can't be expressed.
- **First SLATE:** `content/licenses.ts:48` (19 jurisdictions: steps and fees, minimum ages, validity, renewal fee, MCTD
  surcharge, graduated stages, visitor days and language rules, new-resident exchange, IDP issuer),
  `content/licensepaths.ts` (each step in order, waits, retakes, pass rates; `LICENSE_EXCHANGES` :519),
  `content/replacements.ts:28, 51` (licence and ID card replacement fee, days, drive meanwhile, police report first),
  `content/identity.ts:67` (`ID_CARDS`: NY $14/8y, CT $28/7y to a birthday mailed in 20 business days, CA $40/6y,
  Ontario Photo Card, BCID, Ireland's passport card), REAL ID shares, `NONCITIZEN_ID` (SAVE check, 10 federal
  workdays, term to lawful presence; 1221 `systems/identity.ts:53`), commands `documents.apply_idcard` (:315),
  `replace_idcard` (:288), `replace_license` (:349). In 1221's final state the licence decided nothing but photo ID
  (`photoIdOf`, 1221 `systems/documents.ts:276`, read by `bank.switch`): driving went in its 2026-10-09 scope reset.
- **Ruling needed (material).** BUILD-ORDER's depth floor includes the licence; KEEP 14 cut "a US citizen's starting
  license state" with the residence history; nothing in this build drives, so the licence's only reader would be
  a photo-ID check (bank opening's CIP, 31 CFR 1020.220), which `src/money/banks` doesn't have. Either the owner keeps
  the licence and state ID as photo ID (needs the bank's ID check as reader, a region axis on the ID form, and the
  licence form: issuer region, classes, minimum age, steps and fees, validity, renewal, exchange on moving,
  replacement), or it is recorded as out with its reason.

---

## 2. Per engine: dimensions missing from the form, ranked by how often a life meets them

### papers.passports (`tools/papers/passports/compile.ts:24-49`, `src/papers/passports/passports.ts`)
1. **Renewal, distinct from a first issue.** Every adult passport is renewed several times in a life; offices price
   and route it differently (US DS-82 by mail, $130, no execution fee; Ecuador's, Slovenia's). The US file's note
   says it "isn't modelled until the game tells a renewal from a first issue". 40 of 223 notes describe a renewal
   rule the form can't hold. Form: a `renew` fee per route per band, and eligibility (US: issued within 15 years, at
   16 or over, not reported lost; 1221 `US_RENEWAL`, `content/passportsabroad.ts:194`, `renewsByMail` :469).
2. **Processing time.** Null on every route for 103 of 200 own-passport countries, incl. US, DE, FR, ES, IT, JP, KR,
   MX, IN, IE; 27 more have some routes null. The first SLATE had a time for all 15 (US 42 days/21 expedited, DE 56,
   IE 28, JP 12, KR 15, AU 42, NZ 28, CA 28). Form holds it; the files don't.
3. **Validity.** Null on at least one band for 95 countries, incl. IE (every band), BR, PT, LV, GR, HR, RO, PH, TW, VN;
   the first SLATE had 10 years for IE, BR, LV. Brazil's and Portugal's notes name the decree as "a lead" not
   followed. Form holds it; files don't.
4. **From abroad.** 159 of 200 have no `abroad` route, incl. US (embassy, passport fee only, no expedite), MX, BR, ES,
   IT, JP, KR, IS, LV, NZ, all of which 1221 had (`PASSPORTS_ABROAD`, 1221 `content/passportsabroad.ts:52`). KEEP 18
   names "from abroad". Form gap too: one `currency` per file, so a mission's fee in the host's currency (Japan's
   US$62 set by MOFA ordinance for the US, Mexico's and Korea's consular dollar fees) can't be written; needs a
   currency per route, and an abroad fee by host country where the office sets one per mission.
5. **Lost or stolen.** 41 notes give a replacement rule (Brazil's double fee, Slovenia's doubled and quadrupled tax,
   US DS-64 and in-person DS-11). Form: a `replace` fee per band and whether a police report or declaration comes
   first; the old passport and what was issued on it cancelled (1221 `systems/documents.ts:352-366`).
6. **Urgent service.** 122 have no urgent route; some are true (none sold), some are leads (IE's same-day renewal and
   Passport Express, which 1221 priced +€170). Check per note.
7. **The passport card** (US, Ireland), a second document with its own fee and validity.
8. **Route and office names are dropped by the compile.** Every research file carries `label` and `office`
   (200 each); `route()` (compile.ts:73) keeps only the id, so a screen could only show "in-person-expedited". The
   voice rule (MANDATE 8) needs the label and the office compiled.
- Shallow counts: 46 countries with a null fee somewhere, 9 with none known (BA CI CR ES MW SI SJ TJ VA; Spain's
  €30 is in 1221). 106 of 223 notes name an unfollowed "lead". 41 files rest on secondary sources only.
  Blocked 23 (BO BT BY CF CG DJ EG GW IR KG KM KP LY NR PS PW SL SO SZ TC TO TV UZ).
- **Verdict:** not complete. Below 1221 for US (time, renewal, abroad), IE (validity, urgent), ES (fee), JP/KR/MX
  (time, abroad), BR/LV (validity).

### papers.ids (`tools/papers/ids/compile.ts:22-39`, `src/papers/ids/ids.ts`)
1. **Holding duty and minimum age.** Many states oblige a card from an age (Germany from 16, PAuswG §1; Spain's DNI
   from 14); others issue from 18 only (Mexico's INE). The form has age bands for fees but no "must hold from" or
   "first issued at". A life living there meets the duty.
2. **The card as a travel document.** An EU/EEA citizen crosses Schengen and the EU on the card; GCC, Mercosur and
   ECOWAS cards do the same regionally. `visit()` assumes a passport. Form: per list, the documents accepted at the
   border (ties visits to ids).
3. **Renewal and replacement.** HANDOFF.md:59-61 names it as a pass still to make (Ecuador's US$16 renewal against
   US$5). 1221 had replacements for 7 issuers (`content/replacements.ts:51`).
4. **Sub-national issuers.** US states, Canadian provinces, Australian states: see 1e.
5. **The number on the card** (Spain's DNI number, Belgium's national register number): see 1c.
6. Route and office labels dropped, as passports.
- Shallow counts: processing time null on every route for 124 of 190 issuing countries; validity null (not permanent)
  for 90; a fee null for 35, none known for 28. 79 files secondary-only. Blocked 8.
- **Verdict:** not complete.

### papers.citizenship (`tools/papers/citizenship/compile.ts:20-31`, `src/papers/citizenship/citizenship.ts`)
1. **Citizenship at birth.** The form has no jus soli/jus sanguinis rule, yet layer 4's Citizenship field is read
   from Place of Birth (KEEP 4) and a life born in the US, Canada or Mexico is a citizen there while one born in
   Germany or Japan is not. GLOBALCIT's dataset already read for 190 states codes the birth modes (A01-A02). Form:
   by birth in the territory (unconditional, conditional on a parent's residence, none), by descent (a parent's
   citizenship, born abroad limits), and whether multiple citizenship at birth is kept.
2. **What residence counts.** `years` only. Needs: the status it must be held on (permanent residence or any lawful),
   physical presence and absence limits (US 30 months present, UK 450 days absent in 5 years), and the link to the
   residence engine (1b).
3. **Fee, time, tests, oath.** None held; 0 of 246 notes even name a fee. 1221 had GB £1,839 + £50 Life in the UK
   test, ~6 months, after 12 months' settlement; MX MXN 9,502.01, 40 business days, 2 years for outstanding artistic
   work (Ley de Nacionalidad art. 20); US $760, after 5 years with a green card (1221 `systems/citizenship.ts:46`).
   Language and civics tests are real gates (the US N-400 test, the UK's B1 English).
4. **Shorter routes:** by marriage, by descent or nationality (Portugal's 7, the Nordic 2), which HANDOFF names as not
   modelled. A life with a partner meets marriage; lower priority until people exist.
- Shallow: 188 of 246 rest on GLOBALCIT (secondary, law as at 1 January 2024); reforms after that are checked for a
  handful only (HANDOFF.md:72-79). `renounce` null for 16.
- **Verdict:** not complete; and its one input (years of residence) has no engine behind it.

### papers.visits (`tools/papers/visits/compile.ts:23-36`, `src/papers/visits/visits.ts`)
1. **The authorisation's fee, validity and time.** `eta`/`evisa`/`arrival`/`visa` carry no fee, no validity, no
   processing. ESTA US$40 for 2 years or the passport's expiry, the UK ETA, Canada's eTA, K-ETA, NZeTA, Australia's
   ETA and eVisitor: 1221 held each one's fee, validity, processing and live date (`Authorization`, 1221
   `content/entry.ts:31-40`), and visa fees and waits for 10 pairs (B-1/B-2 $185 and the ~5-month interview wait,
   Canada TRV CAD 100 + 85 biometrics, AU 600 AUD 250, Brazil e-Visa US$80.90; 1221 `content/visas.ts:65`).
   Form: per rule, `fee` (currency), `validFor` (days or years, capped at the passport), `within` processing, and
   the authorisation tied to the passport it was issued on.
2. **Passport validity on entry.** Six months beyond the stay, Schengen's three months beyond departure and issued
   within ten years, the US Six-Month Club: 1221 held one per destination (`Destination.passport`, 1221
   `content/entry.ts:43-48`, checked in `mayEnter` :192). Only 8 files mention it; the form has no place. Needs the
   held passport's expiry (1a).
3. **A shared count area.** The eu1806 list is kept by some 37 states and territories, each with its own 90 days in 180; Schengen counts
   them as one area. Same for the CA-4 and the Common Travel Area. Form: an `area` on the shared list, and day
   counting over held stays (needs state).
4. **Stay unset.** 961 of 12,792 non-visa rules have no days or months.
5. **Conditions not modelled** (HANDOFF.md:151-153): another country's visa or residence standing in (US visa holders
   into Mexico, Canada's eTA for US-visa holders), age/sex limits, tours. Frequent for some passports.
6. **A person with two citizenships** gets `visit(one, dest)`; no helper picks the best of those held.
- Shallow: 177 of 246 destination files rest on Wikipedia copies alone (marked secondary, the primary named);
  HANDOFF holds them for re-reading.
- **Verdict:** wide, not deep; below 1221 for every destination 1221 kept.

### papers.work (`tools/papers/work/compile.ts:27-32`, `src/papers/work/work.ts`)
1. **The permit's fee, time and term.** A route is a name only. 5 of 188 notes name a fee. 1221's O-1: I-129 $1,055,
   Asylum Program Fee $600, SAG-AFTRA's advisory opinion $300, premium $2,965 in 15 business days, three years,
   extended a year at a time, 10 days' grace after (1221 `content/workrules.ts:58`); Canada's C14 CAD 155 at the port
   of entry for a US citizen, ahead with biometrics (CAD 85) for others. New build's Canada is "Work permit" with
   nothing else; 28 countries' routes are only "Work permit" and the issuing body.
2. **Who applies.** The O-1 needs a US employer or agent as petitioner and a union consultation; the UK Creative
   Worker needs a sponsor's Certificate of Sponsorship; Australia's 408 a sponsor. A life without one can't get it.
   Form: `petitioner` (self, employer, agent, sponsor), the consultation and its fee.
3. **Eligibility.** The O-1's evidence (three of six criteria, 8 CFR 214.2(o)(3)(v)(B)) which 1221 read from the
   record. A screen offering a route nobody can meet is decoration. Form: the criteria as researched, read when the
   premise brings a record.
4. **Alternatives.** One route per passport; real lives choose (US O-1 or P-1B/P-3; UK Creative Worker or Global
   Talent; Germany's §25 BeschV or a freelancer's residence). Form: a list of routes per rule.
5. **The days a short engagement may be worked** are kept for 29 of 183 permit rules but nothing counts them (no
   state).
- Blocked 58 (HANDOFF.md:269 lists them). 53 files secondary-only. EAC and GCC free movement undecided.
- **Verdict:** not complete; below 1221 for the US, Canada and the UK on everything but the route's name.

---

## 3. Depth below the first SLATE (1221), one list

| 1221 had | File in 1221 | New build |
|---|---|---|
| Documents as records, status, expiry, cancel-with-passport | `src/engine/systems/documents.ts:51-104` | none |
| Apply for a passport: fee from the bank, ready on the calendar, expedited | `systems/documents.ts:333` | offers only, no command |
| US renewal by mail (DS-82, $130, 15-year rule) | `content/passportsabroad.ts:194`, `systems/documents.ts:469` | not modelled |
| From abroad for 13 offices (fee, time, no expedite abroad) | `content/passportsabroad.ts:52` | abroad route for 6 of those 13 |
| Processing days for all 15 offices | `content/passports.ts` | null for US IE DE FR ES JP KR MX |
| Validity for all 15 (IE, BR, LV 10 years) | `content/passports.ts` | null for IE BR LV |
| Lost/stolen, police report, replacement | `systems/documents.ts:352-367`, `content/replacements.ts` | none |
| Starting papers (passport share 0.536, licence 80.9%) | `systems/documents.ts:528-535` | none |
| Entry: authorisation fee/validity/processing, passport validity rule, 15x15 | `content/entry.ts:31-51`, `systems/documents.ts:192` | entry kind and stay only |
| Visa fees and waits, 10 pairs | `content/visas.ts:65` | none |
| Driving licence, 19 jurisdictions, paths, exchange, replacement | `content/licenses.ts:48`, `content/licensepaths.ts:519`, `content/replacements.ts:28` | none |
| US state ID cards, REAL ID, non-citizen card via SAVE | `content/identity.ts:67`, `systems/identity.ts:53, 288, 315` | none (US `none: true`) |
| SSN (apply, 21 days, ITIN fallback) | `systems/taxid.ts:32, 62` | none |
| I-9 at hire (shallow) | `systems/school.ts:147` | none |
| O-1 fees, premium, term, extension, grace; OPT; Canada C14 | `content/workrules.ts:35-58`, `systems/permission.ts:115, 191` | route name only |
| Residence: UK Global Talent, MX temporary/permanent, US EB-1A | `systems/residence.ts:84-85, 189-208` | out by decision |
| Naturalisation fee and time (GB, MX, US) | `systems/citizenship.ts:46` | years and renounce only |

Out of scope by the owner's rulings and left out here: tax returns, Social Security's retirement benefit, Universal
Credit and the other benefits, health cover (1221 `ui/workspaces/PapersWorkspace.tsx` panels).

---

## 4. Read, bite, downstream

- Nothing outside `src/papers` imports any papers engine (`grep` of `src/`); `registry/features.json` is `{}`. Every
  field (`within`, `validYears`, `pay`, `days`/`within` of a stay or permit, `renounce`, `lapses`, `years`) is read
  only by its own engine's function and the tests. Each fails "bite" until 1a exists.
- `naturalisation().years` has no writer (1b): the engine can never be asked honestly.
- `src/money/cards/account.ts:76` and `src/money/banks/banks.ts:59` take `national` as an argument instead of reading
  the life's citizenships from papers: a second copy of a fact waiting to happen (MANDATE 7).
- No invariant test ties papers to papers: a visa or authorisation outliving its passport, a naturalisation reaching
  `visit`/`work` as 'home', a passport issued to someone not a citizen.

## 5. What's left, in order

1. Held papers state and commands (1a), with route and office labels compiled.
2. Residence engine and its matrix (1b), wired into citizenship's years.
3. Fill the forms' existing nulls where notes name leads: passport time (103) and validity (95), ID time (124) and
   validity (90); US, IE, ES, JP, KR, MX, BR, LV first, to reach 1221's floor.
4. Passport renewal, replacement, abroad currency (section 2, passports 1, 4, 5).
5. Visits: authorisation fee/validity/time, passport validity on entry, Schengen area count.
6. Work: fee, time, term, petitioner, alternatives.
7. National number (1c); right-to-work check (1d).
8. Citizenship at birth; naturalisation's fee, time, tests, what residence counts.
9. Owner's ruling on the licence and state ID (1e).
