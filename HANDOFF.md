# Handoff

Layer in progress: 3

The precise state of the build, kept current at every checkpoint so an interrupted session resumes rather than
restarts. Read `CLAUDE.md` and the owner's package in `docs/` first.

## Where the build stands

- Branch `claude/new-slate-build`, off `main` at `c919279`. Nothing is merged; nothing is deployed.
- Layer 0 (the repository and the gate) is proven: the full gate green in a fresh clone of the branch at
  `2ff094d439ad`, recorded in `registry/layers.json`.
- Layer 1 (the core) is proven: the full gate green in a fresh clone of the branch at `dd447a897c68`, recorded in
  `registry/layers.json`.
- Layer 2 (the world) is proven: the full gate green in a fresh clone of the branch at `53f8e0227dfe`, recorded in
  `registry/layers.json` (2026-10-28). It holds the gazetteer (`world.gazetteer`), the map (`world.map`), coverage
  matrix A, the clock (`world.clock`), and the weather (`world.weather`): the engine is built and tested, and its
  matrix is complete: 202 countries researched, 44 blocked (each after all five methods, the player
  told where the weather is borrowed from), 6 proven, none pending. `tools/wmo/compile.ts` and `coverage.ts` are at
  100% mutation score with the last sources (1,559 mutants; the survivors of that run killed by tests or simpler
  lines, and the two equivalent ones disabled with their reasons). The
  holidays (`world.holidays`): the engine, its reckonings and its gate wiring are built and tested; 195 countries
  researched (639 official lists matched day for day; Liberia added 2026-10-29), 6 proven, none pending, and 51 blocked, each after all
  five methods (the countries and regions are named in the next step's lists: whole countries such as Haiti, Iran,
  Bhutan or the Faroe Islands, and regions such as Prince Edward Island, Yukon, India's four, South Australia, Alderney,
  Formosa, Brčko, Ascension and Tristan da Cunha, and, for the day in place of a holiday on the weekly day of rest only,
  Kedah, Kelantan and Terengganu); Western Sahara keeps Morocco's days by the owner's ruling of 2026-10-28; its code
  at 100% mutation score (532 mutants, with the regions' and the shared substitutes' rules). The prices
  (`world.prices`): the engine is built and tested, at 100% mutation score; 172 countries researched from the World
  Bank's levels, 21 carried from the 2021 benchmark, 5 priced against France and 25 territories kept at another's
  level by the owner's ruling, and the Caribbean Netherlands from Bonaire's ICP level; 6 proven, 22 blocked, each
  after all five methods (R-0428 to R-0449; the next step names them and what to try again), none pending.
- Layer 3 (the person's papers and money) is in progress. Built: the passports engine (`papers.passports`,
  `src/papers/passports/`), compiled by `tools/papers/passports/` from the research files, at 100% mutation score
  (406 mutants). Its matrix (`coverage/passports-countries.json`): 223 researched, 23 blocked, 6 proven (no places),
  none pending (2026-10-29: Kiribati from its ministry's March 2026 brochure); every research file is in the engine's form. Next: visas, residence and work
  permissions, and the banks (step 5 below), and the blocked passports again when a source opens.
- The national identity documents engine (`papers.ids`, `src/papers/ids/`, compiled by `tools/papers/ids/` from
  `research/sources/papers/ids/<CC>.json`, register facts `papers.ids.<CC>`) is built, at 100% mutation score (308
  mutants, 2026-10-29; the territories' route limits, which no territory uses, removed rather than kept untested),
  and its matrix
  (`coverage/ids-countries.json`) is complete as of commit 966df41 (2026-10-29): 238 researched, 6 proven, 8 blocked
  (Anguilla, the Falklands, Saint Helena, Montserrat, Libya, Palestine, Equatorial Guinea, Guinea-Bissau; R-0940 to
  R-0947, each after all five methods: none was found to issue a card, and none was found to state that it doesn't),
  none pending. The form
  is the passports' (`routes`, and `cards` for the bands, without `pages` or seasonal `months`), with
  `"validYears": "permanent"` for a card that never expires (Slovenia from 70, Taiwan, Indonesia, Brazil and Vietnam
  from 60, Peru over 60, Tanzania, Timor-Leste from 60); a country that issues none is `none: true` (the United
  States, the United Kingdom, Canada, Andorra, the Bahamas, the DR Congo, the Faroes and Greenland under the Danish
  Act 236/2017 §6, and the Pacific states without one: Micronesia, Nauru, the Solomons, Tuvalu, Samoa, Palau); a
  territory holding another's card names it (`issuedBy`), on all its routes. Where a card is due again at set
  ages rather than after a term (Singapore, Malaysia, Vietnam before 60) its validity is null. What the research
  couldn't read is null, and the player is told so (`idOfferGaps`). Retried on 2026-10-29 (fees found for Ecuador,
  Serbia, Cameroon, the Dominican Republic, Sri Lanka, Niger, Malawi, Slovakia's children, Uganda, Bangladesh,
  Senegal and Guyana; Cameroon's term corrected to the 2025 decree's ten years): 42 countries still have at least one
  fee null, 32 of them with none at all (BA BM BN CG DM DZ ET IR JO KI KM KN KP LS MG MH MM MR MV SD SL SS SZ TL TM TN
  TO VA VC VG VU YE); each file's note says what was tried. Every adult (30) of a country that issues a card has at
  least one offer (the places test). The files model a first card; renewal (an expired card renewed, often at
  another fee, as Ecuador's US$16 against US$5) is in many notes but not in the form, and is a depth pass to make for
  identity cards and passports alike before the papers screen reads them: a `renew` fee by route on each band,
  researched per country, the player told where it isn't known.
- The citizenship engine (`papers.citizenship`, `src/papers/citizenship/`, compiled by `tools/papers/citizenship/` from
  `research/sources/papers/citizenship/<CC>.json`, register facts `papers.citizenship.<CC>`) is built (2026-10-29), at
  100% mutation score (267 mutants), its matrix complete: 246 researched, 6 proven (no places), none pending. Its
  reader is what a move abroad does to a life's papers: `naturalisation(country)` gives the years of residence a
  state's ordinary naturalisation asks and whether every other citizenship must be given up ('none' where no one is
  naturalised on residence alone: China, Kuwait, North Korea, Myanmar, Nepal, the Vatican and others), and
  `naturalise(held, country)` the citizenships held afterwards, dropping those the new state makes the applicant
  renounce or whose own law takes them from a citizen who takes another, and naming as unsure those whose rule isn't
  known (`keepingUnknown`). A territory names the state whose nationality its people hold (`nationalityOf`), and that
  state's rules are its own, except Svalbard, where living doesn't count (`residenceCounts: false`). The 190 states
  GLOBALCIT covers start from its Citizenship Law Dataset v3.0 (EUI, 2025; laws in force on 1 January 2024; secondary,
  each row quoted verbatim from its CSV), with the minimum residence read from each provision's own words where the
  dataset's count is a window (Canada 3, India 12, St Kitts 15, Dominica and St Lucia 8, the Bahamas 7, Malta 5).
  Reforms since then are read from the law itself: Germany (5 years, renunciation and loss repealed, 27 June 2024),
  Finland (8 years, Act 474/2024), Sweden (8 years, Act 2026:447), Portugal (10 years, 7 for Portuguese-speaking and EU
  nationals, Organic Law 1/2026); primary sources added for the Netherlands, Australia and China. Andorra, Monaco,
  San Marino (renunciation removed, 2026), the Vatican, the Maldives, Uruguay (legal citizenship, Constitution art. 75)
  and Palestine (Basic Law arts. 7 and 28) are read from their own texts; the territories from their states' laws
  (France's Constitution art. 72-3; 8 U.S.C. 1101, 1401-1408; the British Nationality Act 1981 Sch. 6 and s. 50 and
  the British Overseas Territories Act 2002 s. 3; the Kingdom Act on Dutch Nationality art. 8; New Zealand's Citizenship
  Act s. 2; Australia's s. 3; Denmark's naturalisation form for the Faroes and Greenland; Åland's Autonomy Act; the
  Svalbard Act and a Minister's answer to the Storting; Hong Kong's Basic Law Annex III and Macao's Government portal).
  Still to do: a pass over the other 180 GLOBALCIT states for reforms after 1 January 2024 (each file's note says what
  date its rule is from); the shorter periods by nationality, marriage or descent aren't modelled (Portugal's 7, the
  Nordic 2 in Sweden), nor naturalisation by religion (the Maldives).
- The visitors engine (`papers.visits`, `src/papers/visits/`, compiled by `tools/papers/visits/` from
  `research/sources/papers/visits/<CC>.json` and the shared lists in `research/sources/papers/visits/groups/<name>.json`,
  register facts `papers.visits.<CC>` and `papers.visits.group.<name>`) is built (2026-10-29), at 100% mutation score
  (237 mutants). Its reader is the move abroad: `visit(citizenship, destination)` gives what the visitor's passport
  meets at the destination's border, `free`, `eta` (an electronic travel authorisation), `evisa`, `arrival` (a visa at
  the border) or `visa`, with the days a stay may last and the period they're counted in where the list sets them, or
  'home' for the destination's own citizens and those of the state whose nationality its people hold. A list names
  rules by passport (a territory's own where it's treated apart, as Bermuda's, else its state's) and a rule for every
  other passport. Shared lists: `eu1806`, the EU's common visa list (Regulation 2018/1806 as consolidated on
  30 December 2025, read from CELLAR since EUR-Lex answers this client with a bot challenge), kept by the 26 Member
  States bound by it and Iceland, Norway, Switzerland and Liechtenstein, with free movement for EU/EEA/Swiss citizens
  (Directive 2004/38 art. 5) and ETIAS left out until it starts; `us`, the United States' (the 42 Visa Waiver Program
  countries from the official ESTA site, 90 days, 8 U.S.C. 1187; Canada, Bermuda and the three Compact states free;
  the Bahamas, the Caymans, Turks and Caicos and the British Virgin Islands free on conditions not modelled; the other
  British territories' passports a visa, by the 2024 rule's footnote that the United Kingdom means British citizens),
  kept by the fifty states, Puerto Rico and the US Virgin Islands, and by Guam and the Northern Marianas with the
  Guam-CNMI waiver's own rules on top (Malaysia, Nauru, Papua New Guinea, Hong Kong: 45 days with an ETA); `gb`, the
  United Kingdom's Immigration Rules (Appendix Visitor: Visa National List and Appendix ETA National List, 6 months,
  Irish citizens free by the 1971 Act s. 3ZA), kept by the UK, Jersey, Guernsey and the Isle of Man (each with its own
  ETA since 23 April 2026; gov.je refuses this client, so Jersey is read from the Jersey Evening Post quoting it); `au`
  (ETA 601 and eVisitor 651, 3 months; New Zealanders free), kept by Australia, Christmas Island, the Cocos Islands and
  Norfolk Island (Migration Act s. 7). Own lists: Ireland (S.I. 473/2014 Sch. 1 as amended to S.I. 242/2026), Canada
  (IRPR ss. 7, 7.1, 183(2), 190, Sch. 1.1), New Zealand (INZ's visa waiver list; legislation.govt.nz refuses this client),
  Japan (MOFA, the Immigration Services Agency and the embassies all refuse this client, 403: MOFA's table is read from
  Wikipedia's copy, marked secondary), Korea (HiKorea's agreement and designation tables, K-ETA and its 22 exemptions to
  31 December 2026), China (the Consular Department's unilateral visa-free notice, read from the official visa
  centre's copy, Canada and the UK from 17 February 2026, Russia to 2027, the ordinary-passport mutual exemptions from
  its own table; Taiwan residents' permit at the port), Hong Kong (ImmD's table; others 7 days), Macao (gov.mo, the 88
  exempt and their stays; others a visa on arrival), India (the e-Visa list of 174, Japan and Korea on arrival, Nepal,
  Bhutan, the Maldives free), Mexico (INM's list of visa nationalities, read from its image; Brazil's e-visa since
  5 February 2026), Brazil (Itamaraty's table of 7 October 2026; the US, Canada and Australia by e-Visa). A stay is
  `days` (with `within`) or `months`. Then Thailand (TAT on the Royal Gazette of 31 August 2026, the 60-day
  exemption ended 15 September 2026; the MFA's bilateral table), Singapore (ICA), Malaysia (Immigration), Indonesia
  (Permenimipas 10/2026 for the exemption), and, where the governments' sites refuse this client, from Wikipedia's
  copies marked secondary with the primary named: the Philippines, Vietnam, Cambodia, Laos, Myanmar, Brunei,
  Timor-Leste, the UAE, Türkiye, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, the Middle East (Israel with Palestine as
  a shared list `il`, Jordan, Lebanon, Egypt, Iraq, Iran, Syria, Yemen, Afghanistan), the Caucasus and Central Asia,
  Russia (its ETA for the visa-exempt), Belarus, Ukraine, the Western Balkans, Moldova; Åland, Monaco, San Marino, the
  Vatican, Andorra, the Faroes and Greenland keep the eu1806 list; Svalbard has no visa regime; South and Central
  America (Argentina to Nicaragua, Costa Rica, Panama, Belize) from Wikipedia's copies with the migration authority
  named; the Caribbean states (Cuba to Saint Vincent) likewise; `nlcarib`, the Kingdom of the Netherlands' common list
  for Aruba, Curaçao, Sint Maarten and the Caribbean Netherlands (NetherlandsWorldwide, the government's own pages:
  90 days in 180, US nationals 180 in 365), with each territory's differences on top (Aruba's 180 days for Schengen
  nationals, Curaçao's Jamaicans, Sint Maarten's Guyanese). The British territories: Gibraltar from the Government's
  Technical Notice 558/2026 and its exempt list (Schengen's short-stay policy since 15 July 2026, the EU/EEA free),
  the Caymans from Customs and Border Control's table (6 months; Peru and Venezuela a visa since 2 April 2026),
  Bermuda from gov.bm (the Order's visa-controlled nationals need a UK, US or Canadian multi re-entry visa; the
  Order's schedule 404s, so the visa-free list is Wikipedia's), the rest from Wikipedia's combined article; the
  territories where every visitor needs a permit (South Georgia, BIOT) name British passports too; American Samoa
  (its own online permit, 30 days). Overseas France as two shared lists from the ministerial orders (read from
  Wikipedia's copy; Légifrance answers this client with a bot challenge): `fromdom` (the five departments, Saint
  Barthélemy, Saint Martin, Saint Pierre and Miquelon: 90 days in 180) and `frompac` (New Caledonia, French Polynesia,
  Wallis and Futuna: 3 months), EU/EFTA/Andorra/Monaco/San Marino free, each territory's extra exemptions on top;
  the Southern Lands need an authorisation, French citizens included. Taiwan from the Bureau of Consular Affairs
  (visa-exempt list of 17 July 2026, the eVisa list; Hong Kong and Macao residents' entry permit from the NIA, taken
  as a visa); Sri Lanka from the Department of Immigration's ETA page (everyone an ETA, free for 40 since 25 May
  2026); Pakistan, Bangladesh, Nepal, Bhutan, the Maldives and North Korea from Wikipedia's copies. Oceania (Fiji,
  Papua New Guinea, the Solomons, Vanuatu, Samoa, Tonga, Kiribati, Tuvalu, Nauru, Micronesia, the Marshalls, Palau,
  the Cook Islands, Niue, Tokelau) from Wikipedia's copies; a visitor permit given free on arrival is taken as free,
  one applied for beforehand (Tokelau, New Zealanders included) as a visa. North, East and Central Africa and the
  Sahel from Wikipedia's copies; Morocco's list is shared (`ma`) with the Moroccan-administered Western Sahara (the
  FCDO's travel advice says Morocco's border authorities control entry there). West and Southern Africa and the
  Indian Ocean likewise, South Africa from the Department of Home Affairs' own exemption list of 9 December 2025
  (its ordinary-passport column; P/A as 90 days in 365). Matrix (2026-10-29): 246 researched, 6 proven, none
  pending: every country and territory has a visitor list. Next for this engine: re-read the Wikipedia-sourced rows
  from their primaries as hosts open (each file's note and source say which), and the conditions the notes name as
  not modelled (another country's visa or residence standing in for one, age or sex limits, organised tours). The Wikipedia-sourced rows are to be re-read from the
  primary when it opens (each file's note says which host refused).
- The work engine (`papers.work`, `src/papers/work/`, compiled by `tools/papers/work/` from
  `research/sources/papers/work/<CC>.json` and the shared lists in `research/sources/papers/work/groups/<name>.json`,
  register facts `papers.work.<CC>` and `papers.work.group.<name>`) is built (2026-10-29), at 100% mutation score
  (278 mutants). Decided: one engine for residence and work, since what lets a performer live in a country is the
  same paper that lets them work there (free movement, or the permit for the engagement); a non-working residence is
  out until the premise needs one. `work(citizenship, destination)` gives `free` (a right to live and work with no
  permission asked) or `permit` with the route a performer takes as the government names it, and the days a short
  engagement may be worked without it where the law allows (`days`, `within`), or 'home', or undefined where the
  rules aren't kept (the player told, line `work.unkept`). A shared list names its passports and may give the rule
  for every other; a country keeping it adds its own and its own rule for every other where needed; the compile
  merges them so the engine reads one list. Shared lists: `csme`, `eaeu` and `oecs` (below), `eea` (Directive 2004/38 arts. 7 and 24, the EEA Joint
  Committee's Decision 158/2007, the EU–Swiss free movement agreement), `us` (the O-1 petition for everyone but the
  Compact states' citizens, 8 CFR 214.2(o) and 274a.12(a)(8)), kept by the US, Guam, Puerto Rico, the US Virgin
  Islands and the Northern Marianas (8 U.S.C. 1101(a)(38)). Own rules: Germany (BeschV §§ 22, 25, 30: the
  Federal Employment Agency's approval for artistic work, 90 days in twelve months without it for festivals, guest
  performances and foreign productions), France and its departments with Saint Martin and Saint Barthélemy (the
  « talent – profession artistique et culturelle » card, three months without a work authorisation, Code du travail
  D. 5221-2-1 read from the Culture Ministry's guide since Légifrance refuses this client), the United Kingdom (the
  Temporary Work – Creative Worker visa, 30 days of permitted paid engagements, Irish citizens free); the
  Netherlands (government.nl, UWV), Belgium (Flanders' page), Austria (migration.gv.at), Italy (TUI art. 27 on
  Normattiva), Spain (LO 4/2000 art. 41, RD 1155/2024 on the BOE), Ireland (the Atypical Working Scheme; British
  citizens free), Denmark (SIRI), Sweden (Migrationsverket, 14 days a year on an established promoter's invitation),
  Norway (UDI, 14 days a year; British artists without a Norwegian employer 90 in 180), Finland (EnterFinland; Migri
  refuses this client), Portugal (gov.pt's performing-arts visa), Switzerland (the eea list; VZAE art. 19 para. 4
  lit. b, from Zurich's artists' instruction), Luxembourg (guichet.lu, 90 days a year for an intermittent of the
  performing arts), Poland (30 days a year, the Zielona Linia), Czechia (the employee card), Slovakia (30 days a
  year, Act 5/2004 as in force from 1 August 2026), Hungary (the Hungarian Card for a performing artist, Act XC of
  2023 § 36; neither it nor Decree 35/2024 names days without it), Slovenia (performers outside the ZZSDT, art.
  5(2)(11): free; a longer stay on the single permit without the Employment Service's consent, ZTuj-2 art. 37), Croatia (OECD citizens' artists without even a work registration certificate during a short stay, Aliens
  Act art. 89(6); others the residence and work permit, or a registration certificate for up to 90 days a year),
  Romania (OUG 194/2002 as amended by OUG 32/2026, which repealed OG 25/2014), Bulgaria (the single permit, from a
  2024 analysis since lex.bg refuses this client), Greece (the Migration Code's Z.2 visa for members of artistic
  companies), Cyprus (the artists' permit, from WhatPassport's copy of the old Migration Department page), Malta
  (Identità's Single Permit), Estonia (five days in 30 without a permit, Aliens Act § 105(4)), Latvia (the right to
  employment with the visa or residence permit, Regulation No. 55 of 2014), Iceland (artists' 90 days a calendar
  year, notified), Liechtenstein (its own list, outside the eea one: EEA and Swiss citizens need a permit too, PFZG
  arts. 8, 15 and 30; others the AuG's permit for qualified workers, with a service's eight days in 90). Lithuania
  is a blocker (2026-10-29): e-tar.lt, e-seimas.lrs.lt, lrv.lt, uzt.lt and migracija.lrv.lt all serve this client a
  bot challenge, and no copy of the Aliens Law's art. 58 was found elsewhere. Beyond Europe: Canada (IRPR ss. 196 and
  186(g): a performing artist's time-limited engagement needs no permit, with no day count of its own, so no days),
  Australia (New Zealanders free on the subclass 444 visa; others the 408 visa's Entertainment Activities stream), New
  Zealand (Australians free on the Australian Resident Visa; others the Entertainers Work Visa), Japan (the Entertainer
  status of residence, from e-Gov's law data), South Korea (E-6-1, from a law firm's 2026 guide since law.go.kr loads
  by script), China (the Z visa for a commercial performance, from the Visa Application Service Center), Hong Kong
  (the employment visa, Mainland residents the ASMTP, and the STV Scheme's 14 days a trip on an authorised host's
  invitation), Macao (the non-resident worker's authorisation, and 45 days in six months for an invited artistic
  activity, from the Second Instance Court's ruling 14/2020 since the Official Gazette isn't reachable), Taiwan (the
  Ministry of Labor's employment permit; the Mainland's, Hong Kong's and Macao's residents' own acts not read, so they
  meet the same rule), Singapore (Work Pass Exempt performances, 90 days a calendar year, notified; then a regular work
  pass). A list names the passports of its own state's nationality where they aren't home there (China's, Hong Kong's
  and Macao's in each other's lists). The British Isles and Europe's small states: the Isle of Man (a work permit for
  anyone not an Isle of Man worker, British and Irish included, with theatrical and musical productions exempt for 48
  days a year; others the Tier 5 Creative visa as well), Guernsey (a Short Term Employment Permit for British and Irish
  nationals, a work visa too for others), Gibraltar (EEA and Swiss free; others the Department of Employment's work
  permit), Svalbard (free: the Immigration Act doesn't apply there), Greenland (Nordic citizens free; EU citizens as
  everyone else, and performers excluded from the artists' three months), Åland (Finland's rules), Monaco (the
  authorisation to hire and work permit for every hire), Andorra (the quota's residence and work authorisation, from a
  copy of the BOPA), San Marino (the quota's temporary work permit for entertainment and the arts). Jersey and the
  Faroe Islands are blockers (2026-10-29): gov.je, statesassembly.gov.je and jerseylaw.je refuse this client, and
  utlendingastovan.fo answers 403 while SIRI's old Faroese pages are gone. Latin America: Mexico (the visitor with
  permission for paid activities, Ley de Migración), Brazil (artistic activities on a visit with a fee allowed, Lei
  13.445 art. 13; the temporary visa for a fixed-term artistic contract), Argentina (special transitory residence for a
  tourist's paid work, Disposición DNM 1824/2013), Chile (SERMIG's authorisation to work with transitory stay), Colombia
  (Migración Colombia's POA, from the Film Commission's instructions), Peru (the Artística Temporal status), Uruguay
  (temporary residence's Provisional Identity Sheet), Paraguay (Occasional Residence, Ley 6984), Bolivia (the
  specific-purpose visa), Ecuador (the artists' temporary residence visa), Panama (the occasional workers' visa,
  artists' kind). The Mercosur Residence Agreement's residence isn't modelled separately in any of them. Venezuela is a
  blocker (2026-10-29): the Migration and Foreigners Law's copies (OAS, the Colombian consulate's guide) refuse this
  client and SAIME publishes no artists' requirements found. Central America: Costa Rica (the DGME's work permit for
  artists, from a 2026 report quoting it, since SCIJ refuses this client), Guatemala (the Culture Ministry's
  authorisation of a foreign artist's presentation; the Migration Institute's status not found), El Salvador (the
  DGME's special entry permit for artists, from a report quoting it), Honduras (the special stay permit for public
  spectacles, from Spain's embassy), Belize (the entertainers' Temporary Employment Permit, a week or less). Shared
  list `csme` (Trinidad and Tobago's Foreign Ministry: Article 46 of the Revised Treaty of Chaguaramas, artistes and
  musicians among the approved categories): the twelve participating states' nationals work in one another on the
  CARICOM Skills Certificate; each state keeping it gives its own rule for others. Nicaragua is a blocker
  (2026-10-29): only the 2006 tax rule on foreign artists' shows was found, not the migration rule. A country may keep
  several shared lists, in order: the first naming a passport gives its rule (decided 2026-10-29, for the OECS states,
  whose citizens' free movement must count over the CARICOM Skills Certificate). Shared list `oecs` (the OECS
  Commission, 16 January 2024: indefinite stay and no work permit for citizens of Antigua and Barbuda, Dominica,
  Grenada, St Kitts and Nevis, Saint Lucia, St Vincent and the Grenadines and Montserrat). The Caribbean: Trinidad and
  Tobago (30 days once a year without a permit, declared on entry; from a report of the minister's statement), Jamaica
  (the Ministry of Labour's work permit), Barbados (the short-term work permit, Immigration Act s. 17), Grenada (the
  entertainers' work permit, S.R.O. 26 of 2015), Saint Lucia (Labour Act s. 317), Dominica (the Labour Division's work
  permit, from Invest Dominica), St Kitts and Nevis (the Ministry of National Security's work permit). The Gulf: the
  United Arab Emirates (MOHRE's work permit for GCC citizens and the mission work permit for others, from a report of
  MOHRE's twelve permits). South Asia: India (Nepalese nationals free under the 1950 treaty; others the Employment
  Visa the MHA's FAQs name for engaged foreign artists, from a reproduction since the MHA, the Bureau of Immigration
  and the missions refuse this client). Türkiye (the work permit; artists' one-month exemption is itself applied for,
  so not days), Russia (a touring creative worker's thirty days without a permit, 115-FZ art. 13(4)(8.2)),
  Kazakhstan (artists need no permit to employ foreign labour, Decree 1041 item 11: free, the stay being the visa's).
  Shared list `eaeu` (the Eurasian Economic Commission: EAEU Treaty art. 97, members' citizens work without a
  permit): Armenia, Belarus, Kazakhstan, Kyrgyzstan, Russia. Decided: `free` means no permission to work is asked;
  a stay beyond the visit is the visa's or residence permit's, as in Svalbard and Kazakhstan. Where a law exempts
  performers from the work permit outright, film included, they're free (Kazakhstan, Armenia, Slovenia); an
  exemption with conditions that leave an actor's film work or employment out stays a permit (Canada's non-film
  tours, Spain's single performances, Brazil's visit with a fee). Armenia (the Law On Foreigners exempts performers
  for cinematography, theatre and concert tours, from a law firm's summary), Georgia (the labour permit required from
  1 March 2026; short-term professional activity, registered, up to four months a year: 120 days within 365, from a
  relocation firm's summary). South-East Asia: the
  Philippines (the Bureau of Immigration's Special Work Permit for artists, six months at most), Thailand (the work
  permit; the urgent-work notification for government-supported concerts, being for major events only, isn't days),
  Indonesia (the music performer visa C7A, no labour permit since 2023), Malaysia (PUSPAL and the Professional Visit
  Pass), Vietnam (the work permit; Decree 219/2025's exemptions name no performers). Africa and the Middle East: South
  Africa (the visitor's visa with section 11(2) authorisation, Immigration Regulations reg. 11), Nigeria (the Creative
  Arts visa F7F, performance without employment), Kenya (the Special Pass for a performance, paid or not), Israel (the
  B/1 work visa for a foreign artist, from a law firm), Egypt (the Musicians Syndicate's performing licence, from a
  report). Shared list `au` (Australia's rules: New Zealanders free on the Special Category visa, others the Temporary Activity visa's Entertainment Activities stream), kept by Australia and the territories its Migration Act s. 7 deems part of it: Christmas Island, the Cocos (Keeling) Islands, Norfolk Island. The Dutch Caribbean: Bonaire, Sint Eustatius and Saba (the BES work permit; an artist or musician living elsewhere four weeks in thirteen without it, 28 within 91, from the 2010 decree as published), Sint Maarten and Curaçao (the work permit of their Landsverordening arbeid vreemdelingen; Curaçao's event permit for foreign artists and its Carnival season aren't modelled), Aruba (the temporary residence permit allowing work, the Kingdom's other Dutch passports named since Dutch nationals not born there need it too). Suriname (the Wet Werkvergunning Vreemdelingen; the csme list), the Bahamas (the Short Term Work Permit, entertainers through the musicians' union), Antigua and Barbuda (the Labour Code's work permit; the oecs then csme lists), Saint Vincent and the Grenadines (the Office of the Prime Minister's work permit; oecs then csme), Guyana (the landing permit for employment status; csme). The British territories, each naming Britain's and the other territories' passports (of the same nationality, but asked for the permit; only the territory's own are home): Anguilla (the Control of Employment Act's work permit; Executive Council's event-by-event exemptions for bands aren't days), Bermuda (the Department of Immigration's work permit, entertainers through the Bermuda Entertainment Union), the British Virgin Islands (the Labour Code's work permit, festival work included), the Turks and Caicos Islands, Montserrat (the oecs list, then its work permit), the Falkland Islands (the work permit, or the short term work permission, both asked), Saint Helena (the Long Term Entry Permit on an Immigrant Employment Certificate), the Pitcairn Islands (the Island Council's written permission), South Georgia (the entry permit for work), the British Indian Ocean Territory (a permit to enter, for official duty only). France's overseas collectivities, where the EU's free movement doesn't reach, so EU citizens are asked like everyone else and only the French are home: Saint-Pierre-et-Miquelon (the work authorisation, with a performer's three months without it, 90 days, from the prefecture), New Caledonia (the DTE's work authorisation), French Polynesia (the SEFI's work authorisation; its exemption for some missions under three months names no performers), Wallis and Futuna (the Prefect's authorisation), the French Southern and Antarctic Lands (the TAAF prefect's authorisation, asked of the French too). The Balkans and Eastern Europe: Albania (EU, Schengen, United States and Western Balkan citizens work as Albanians do, Law 79/2021 art. 80; others the single permit, artists' special category of 60 days a year still a permit), Bosnia and Herzegovina (the Federation's law: performers 30 days at a stretch and three months a year without a permit, 90 within 365; Republika Srpska's and Brčko's laws not modelled apart), Montenegro (a performer's work registration, up to three months a year, 90 within 365; EU citizens' provisions only from accession), North Macedonia (the work permit; creative services up to seven days need a ministry's prior consent, so not days), Serbia (temporary artistic and cultural activities 90 days in 180 without the single permit; EU citizens' access only from accession), Kosovo (Law 03/L-136's work permit), Ukraine (artists and art workers need no permit, art. 42: free, from a trade journal quoting the Ministry of Justice), Belarus (the eaeu list; others the special permit, culture's exemption only for state invitations), Moldova (the residence permit for work; art. 43¹(8)'s list not read, so no days). Central Asia and the Caucasus: Kyrgyzstan (the eaeu list; others the single permit for stay and work of the May 2026 temporary regulation, from a news agency), Azerbaijan (the Migration Code's work permit; the art workers' exemption needs invitation and registration, so not days), Uzbekistan (the confirmation of the right to work, from an NGO legal service's guide). The Middle East: Jordan (the Ministry of Labour's work permit, down to three months), Lebanon (General Security's artist entry visa, six months at a stretch), Oman (the cultural visa since November 2025, from a newspaper; GCC citizens not modelled apart), Iraq (the Ministry of Labour's work permit, from a news report; Kurdistan's 2024 regulation not modelled apart), Iran (the Department General for Employment of Foreign Nationals' permit, from a law firm's note). South Asia: Nepal (Indian nationals free under the 1950 treaty; others the Department of Labour's work permit, Labour Act 2074 s. 22), Bangladesh (the work permit, from a news report of the Prime Minister's office), Sri Lanka (the Business Purpose Visa, whose allowed activities include art, music and dance events). East and South-East Asia: Mongolia (the Labour Migration Law's work permit, from an accounting firm), Cambodia (the work permit and employment card, Notification 110/23, from a law firm), Laos (the Ministry of Labour's permit for foreign labour under a quota). The Pacific: Fiji (the authority to work while on a visitor's permit, entertainers up to twelve weeks), Vanuatu (the Exemption and Temporary Work Permits, one and four months), Papua New Guinea (the Employment of Non-Citizens Act's work permit, from a business publication), Palau (the nonresident work permit; RPPL 11-26's exemption for US, Micronesian and Marshallese citizens covers visas and card fees only, from newspaper reports), Solomon Islands (the Entertainer Visa for commercial musicians, 60 days). Morocco (the Ministry of Employment's visa on the foreigner's contract; artists need no ANAPEC certificate, from the Spanish consulate's guide), the Dominican Republic (contracted artists admitted as temporary residents, Law 285-04 art. 35, from a law firm's copy). Africa: Uganda (the Special Pass for short contracts, US$400 for three months), Tanzania (the Labour Commissioner's work permit or Short Term Permit with the residence permit, from a law firm; the arts council's permit not modelled apart), Rwanda (the C2 Professional Player or Artist permit), Ghana (the GIS work and residence permit). Namibia (the short-term employment permit even for one performance, the ministry's spokesperson in August 2026), Seychelles (the Gainful Occupation Permit), Malawi (the Temporary Employment Permit), Mozambique (the work visa; the tourist visa excludes paid activity, the migration service's director-general in 2025), Zambia (the Temporary Employment Permit beyond thirty days), Zimbabwe (the Immigration Act's temporary employment permit). From the Union des Français de l'Étranger's country files (secondary, human-written): Senegal (the Ministry of Labour's visa on a contract from abroad), Côte d'Ivoire (the AGEPE's endorsement), Cameroon, Gabon (the employment and worker's entry authorisations), Algeria, Tunisia (the endorsed contract), Mauritius (work and residence permits together; its blocker entry kept as the record of the earlier attempts, the researched entry deciding the row). South Sudan (the Ministry of Labour's work permit, Labour Act 2017 art. 46(3), from a radio report of its December 2025 circular), the Democratic Republic of the Congo (the foreigner's work card, from a law firm), the Republic of the Congo (the temporary work authorisation up to six months, from an immigration firm), Angola (the work visa, from a law firm), Liberia (the Ministry of Labour's work permit, Decent Work Act ch. 45.1, from the Civil Service Agency's report), Cape Verde (the temporary visa, which names artists, Law 66/VIII/2014 art. 34). Africarrières' country guides were read and rejected: they are written with AI assistance and cite superseded law (Ghana's Act 573), so they aren't a source. Shared list `ecowas` (decided 2026-10-29): the twelve members the Commission lists (Mali, Burkina Faso and Niger having left in 2025) work in each other's countries as nationals, from Supplementary Protocol A/SP.1/7/86 arts. 2–3, the civil service excepted; kept by Ghana, Nigeria, Senegal, Côte d'Ivoire, Liberia, Cape Verde, Guinea, Benin and the Gambia, which give their own permit to every other passport. A national law naming no ECOWAS exception (Benin's, the Gambia's) is read under the protocol; a member found asking ECOWAS citizens for a permit in practice (Sierra Leone's revenue authority, by a search summary, not read) would need its own rule for them. From the West African retry: Guinea (the public employment service's work permit, Labour Code 2014 arts. 131.1–131.3, which itself excepts ECOWAS), Benin (the Minister's twelve-month work permit, Labour Code 98-004 art. 27, from the government's gazette site), the Gambia (the expatriate quota clearance, Labour Act 2023 s. 39), Niger (the public employment service's visa on every foreign contract, Decree 2017-682 arts. 121 and 126), Mali (the National Labour Directorate's visa, Labour Code 92-020 art. L.26 as FAOLEX holds it; the 2017 amendment not read), Mauritania (the work permit, Labour Code 2004-017 art. 388; the 2018 decree's exceptions not read). These six keep their blocker entries as the record of the earlier attempts, the researched entry deciding the row; Togo, Burkina Faso, Sierra Leone and Guinea-Bissau stay blocked, their entries carrying the retry's attempts. The EAC's free movement isn't modelled as a shared list. Blockers registered (papers.work.blocked.<CC>, five methods each, the player told by line
  `work.unkept`): Lithuania, Jersey, the Faroe Islands, Venezuela, Nicaragua, Saudi Arabia, Qatar, Bahrain, the Cayman Islands, Tokelau, Niue, the Cook Islands, American Samoa, Tajikistan, Turkmenistan, Kuwait, Palestine, Syria, Yemen, Bhutan, Pakistan, the Maldives, Afghanistan, Brunei, Myanmar, Timor-Leste, North Korea, Samoa, Tonga, Kiribati, Tuvalu, Nauru, Micronesia, the Marshall Islands, Cuba, Haiti, Vatican City, Western Sahara, Botswana, Lesotho, Eswatini, Madagascar, Somalia, Sudan, Eritrea, Ethiopia, Libya, Sierra Leone, Chad, Burkina Faso, Togo, Djibouti, the Comoros, the Central African Republic, Burundi, Guinea-Bissau, Equatorial Guinea, São Tomé and Príncipe. An exemption only for artists of fame or a significant event's main attraction (Belgium,
  Denmark) isn't modelled as days open to a performer. Matrix (2026-10-29): complete, 188 researched, 58 blocked, 6 proven, none pending. Open: retry the blockers (most
  are sites that refuse this client), and decide the EAC's free movement and the GCC's, neither of which a primary
  source found here states as a right to work without a permit.
- The banks engine (`money.banks`, `src/money/banks/`, compiled by `tools/money/banks/` from
  `research/sources/money/banks/<CC>.json`, register facts `money.banks.<CC>`, blockers `money.banks.blocked.<CC>`,
  notModeled `banks.unkept`), begun 2026-10-29. Decided: a country's banks are named as each names itself, each with
  the everyday account it sells as it names it and the fees that account carries (none where it costs nothing to
  keep), each fee in the account's currency (the country's unless the bank prices it in another, as Rawbank its
  packs in dollars), how often it's charged (a month, two months, a quarter, half a year, a year) and the conditions
  any one of which waives it that the game can check: money paid in over the period, a balance never below a figure,
  an average daily balance, an age under or from, citizenship of the bank's country (`national`; added for banks that
  exempt their own nationals). A condition it can't check (a student's status, a pension paid in,
  an application, membership of a co-operative) isn't written, and the fee is charged in full, as to anyone who
  doesn't meet it; the note says so. `feeFor(fee, standing, day)` is what the ledger will read each period. Every figure
  is read from the bank's own price list, fee schedule or account page (or, in the EEA and the UK, its Fee
  Information Document); the first SLATE's world bank list (Wikipedia-sourced, `montrealroots/1221`
  `banks-world.ts`) is not a source, and its fee sheets' URLs (`banks-world-sheets.ts`) are only leads, each fetched
  and read again. Not yet decided or built: credit records, the exchange rates the life's money is estimated
  at, the family's starting means; the account number's format by country went with the residence history
  (`docs/KEEP.md` entry 14). France's overseas departments (BRED's price lists) are read from MoneyVox's archived
  copies of the bank's documents, so secondary; Wallis and Futuna from the IEOM's tariffs observatory, which names its
  one bank. Where a bank's waiver needs two months below a minimum (BDO), the game charges after one, the stricter
  reading. A price list that gives the fee's next figure and the day it takes effect is kept as a change (Oberbank's
  2027 price), `feeOn(fee, day)` reading the figure in force; an age-banded fee is charged as parts each waived by its
  band (Slovenská sporiteľňa's 7 euros, 3.50 from 62, nothing under 27); a fee waived for a period after another was
  charged is left out where the other is always charged in the game's reading (HSBC Malta's minimum balance fee).
  An image-only fee document (DNB's) is read by eye and cited without a saved page. A regulator's published schedule
  of its banks' charges is a primary source for each bank in it (the Turks and Caicos FSC's, June 2026). A server that
  sends its certificate without the intermediate (Bank of Guam's) is read with that intermediate taken from the
  issuing CA's own published copy, verification left on. A fee set in an indexed unit the game's money doesn't hold
  (BROU's 30 UI) isn't written and another bank is taken; a fee a document gives before a tax whose rate it doesn't
  state is written before the tax (Promerica's, Sogebank's); a law barring any fee on an account is the source for its
  being free, beside the bank's own page naming the account (Venezuela's BCV Resolution 18-10-02). A fee the price list
  suspends until a day stands at nothing until its first change (Ameriabank's 1,000 drams a half-year from 1 July
  2027); the compiler takes a fee at nothing only with a change after it. A page whose server refuses curl but answers
  the fetch tool is read through the fetch tool's saved copy (BSB Bank's, maib's, Santander Uruguay's). Where a fee differs for salaried and
  non-salaried customers, the non-salaried rate is taken, a performer working by engagement being one (Coris Bank's
  West African conditions). A waiver for a balance below a figure isn't written, the game's waivers being balances
  at or above one (Nedbank Zimbabwe's), and a lower rate below a figure likewise isn't, the fee being charged in full
  (BNU Timor's 0.30 dollars under 150). A bank's complete published list of charges with no line for keeping an
  account is read as the account costing nothing to keep, and the note says so (the Commercial Bank of Kuwait's, the
  Bank of Abyssinia's); a charge on turnover (per mille of debits) or per transaction isn't a fee the game counts, and
  a savings account is taken where the current account's only charge is one (Access Bank Nigeria's). A card's yearly
  or quarterly price belongs to the card, not the account. A place with no bank of its own takes the bank its own
  pages show serving it (SpareBank 1 Nord-Norge for Svalbard, CommBank's agency for Nauru, Kiwibank's for Niue,
  Westpac's branch for Christmas Island, found in Westpac's locator data, Community Bank's on Diego Garcia); where
  none could be shown, it has a blocker (Cocos, Pitcairn, Tokelau, South Georgia, the French Southern Territories).
  A bank's page that answers only to a rendering browser is read rendered and cited by its text (Access Bank Liberia's
  tariff); a spreadsheet tariff is read through a dump of its cells (Kapital Bank's). Matrix (2026-10-29): complete,
  222 researched, 24 blocked, 6 proven, none pending. Blocked: the bank's own charges couldn't be read after all five
  methods (Cuba, North Korea, Russia, Iran, Syria, Yemen, Eritrea, Somalia, Sierra Leone, Mauritania, São Tomé, the
  Comoros, Gabon, Congo, the Central African Republic, Western Sahara, the Falklands, the Vatican, Tuvalu and the
  five places above); most fail because the bank's site doesn't answer, sits behind a bot check, or publishes no
  tariff. Open: retry the blockers.
- **Card accounts** (`src/money/cards/account.ts`, built 2026-10-30, the owner's "each feature fully fleshed out"): a
  card held runs on its bank's terms as they stood when it opened (`terms`). `card.open` asks a limit, held to the
  bank's multiple of income where it states one, and charges the issue fee and any share of the limit at issue, with
  the tax on fees; `card.spend` adds a purchase (the foreign share on spending in another currency) or a cash advance
  with its fee, nothing past the limit; `card.pay` clears what's past due first, the cash before the purchases. Each
  month on the day it opened (the 28th at most) `card.statement` charges interest once a statement wasn't paid in full
  by its due date (introductory, then priced by the record, the penalty rate once a minimum was missed; steps where the
  bank charges them), cash at its own rate with no grace, each holding fee at the start of its period (a month's with
  each statement) waived as the bank waives it, the yearly share of the limit after the first year, the over-limit
  fee, the tax on interest and fees, and asks its minimum less what's past due (a charge card, all of it). The due date
  is the grace less thirty days after the statement, or the next statement where no grace is published (`card.due`):
  short of the minimum, the late fee and the penalty rate, and a check (`card.report`) as many days on as the country's
  bureaus wait to report, which marks the record if still short. 1221's card and credit systems (`systems/credit.ts`,
  `content/cards.ts`, `latefees.ts`, `revolving.ts`) were read for the shape; its US score scale isn't carried over.
  Interest is on the statement day's balance, not the average daily balance (a shortcut, noted in the code, until the
  accounts' ledger keeps daily balances). 100% mutation, 221 mutants.
- **Credit records** (`money.credit`, built 2026-10-30): each country's bureau or registry, the days after a due date a
  late payment is reported (`report`), and the years it stays (`keep`), from the law, the regulator or the bureau
  (research/sources/money/credit/<CC>.json, register facts money.credit.<CC>), compiled by `tools/money/credit`. A late
  payment marks the record for the country's years; the record's standing is the game's reading, said as the game's: 1000
  less 250 for each mark still kept, down to 0, which prices a card's range (`priced`). Matrix (2026-10-30): 52
  researched (US, GB, CA, AU, IE, DE, FR, ES, IT, NL, BE, FI, JP, CN, SE, DK, MX, BR, PL, AT, HU, CH, RO, SI, HR, GR,
  NO, CZ, BG, SK, LT, LV, EE, PT, LU, IS; PR, GU, VI, AS, MP under the FCRA, whose "State" takes in every territory;
  GF, GP, MQ, RE, YT, BL, MF, PM through the IEDOM and NC, PF, WF through the IEOM, on the FICP's rules), 6 proven,
  194 pending. Where the country's own regulator or law shows no bureau
  or registry keeps a person's record of credit, the file says so (`none: true`, nothing else), a late payment there
  marks nothing, and the player is told so (`credit.none`): Luxembourg, whose central bank says it has no register of
  consumer credit. A rule of "more than 90 days" is written as 91, the first day past it (Hungary,
  Slovenia). Bulgaria's ordinance was read in a legal database, bnb.bg answering with its web firewall's refusal, and is
  registered as secondary. Where no
  source states the days after a due date a late payment is reported, the file marks them the game's (`reportGame`):
  the bureau's next monthly update, 30 days, compiled with `game: true` for the money screen to say so (China, Sweden,
  Denmark, Mexico, Brazil, Austria, Greece, Norway, Slovakia, Lithuania, Iceland). Mexico's retention steps with the debt's size in UDIs (12 to 72 months); the game keeps the
  72. Portugal: the Banco de Portugal's instruction answers with a bot check, not passed, so Santander's guide to its
  register is registered as secondary, quoting it; Lithuania's central bank and Register of Legal Acts answer with
  Cloudflare, so Creditinfo Lietuva's own statement is read.
 A monthly reporting cycle with no stated threshold
  (Britain's status codes, Ireland's Central Credit Register, Equifax Canada's 30-day reporting) is written as 30 days;
  Germany's 28 is BDSG § 31's four weeks from a first reminder sent at the due date. canada.ca refuses this
  environment's egress and was read through the web fetcher, said so in its sources.
- **Cards** (`money.cards`, built 2026-10-29): each country's credit cards from the bank's own price list, pricing and
  terms, or card page (research/sources/money/cards/<CC>.json, register facts money.cards.<CC>), compiled by
  `tools/money/cards` into `src/money/cards/cards.json`. A card is named as its bank names it, with its currency (the
  country's unless the bank names another), its interest (`rate`: a percent by the year or by the month as the bank
  states it, or `in full` for a charge card, whose balance the bank takes from the account each month, Deutsche Bank's
  Mastercard being one) and its fees, read as an account's are (`tools/money/banks`) and waivable also by spending a
  figure on the card over the fee's period (`spend`). From 2026-10-30 (the owner: "each feature fully fleshed out covering
  every basis") the form holds every term a holder meets, each with the engine function that charges it, at 100% mutation
  (785 mutants): a range's lowest (`rate.from`, priced by the holder's record, `priced`), a fixed sum per step of balance
  instead of interest (`rate.steps`, `stepped`), a fee waived for its first periods (`first`), the issue fee (`issue`),
  fees as a share of the limit (`limitFees`, `limitFee`), an introductory rate (`intro`), the cash advance's rate and fee
  (`cash`, `cashInterestFor`, `cashFee`), the share on spending in another currency (`fx`, `fxFee`), the minimum
  (`minimum`, `minimumDue`), the grace (`grace`), the late and over-limit fees as a fixed sum or a share of a named base
  within a floor and ceiling (`late`, `overLimit`, `lateFee`, `overLimitFee`), a returned payment (`returned`), the
  penalty rate (`penalty`), tax on interest and fees (`tax`, `taxOnInterest`, `taxOnFees`), and the limit as a multiple
  of income (`limit`). The 158 files written before then hold their rate and fees only, and are read again for the rest
  in the main-bank pass (task 18). A rate the bank gives as a range set by creditworthiness is written
  at the top of the range, the game not knowing where in it the bank would put the holder (Chase's 18.49% to 27.99%);
  an introductory rate, a fee on issue or replacement, a stamp duty on interest and a cash-advance rate aren't
  written. Tax is added to a fee only where the document states its rate (BAI's 14% VAT). `interestFor(card, owed)` is
  a month's interest (a yearly rate's twelfth, or for a yearly rate marked `effective`, where the bank states only its
  effective annual rate, as Peru's TEA and Argentina's register do, the rate that compounded twelve times makes it, a
  twelfth root carried to 18 places), rounded half to even, nothing on a credit balance; `paidInFull(card)`
  says a charge card carries nothing; `feeFor(fee, standing, day)` takes an account's standing and what was spent.
  A rate stated as a reference rate plus a margin is written as their sum on the day the list gives the reference (MCB
  Mauritius: its 6.90% prime lending rate plus 13.50%); a rate that differs by the security behind the card is the one
  for a card against salary, the game holding no pledged deposit (National Bank of Oman); a fee waived by a count of
  transactions is charged in full, the game not counting them (DSK Bank); where the bank publishes no card's interest,
  another bank's card is taken (Oman). A variable rate whose reference value the document doesn't give is written as
  the bank's own stated average (BBVA México's 59.52%). The compile refuses a rate above 25% a month or 300% a year as a
  misreading (100 and 10 until Nubank's 19.99% a month). Where a regulator's observatory prices every bank's card in a place (the IEDOM
  and IEOM for the French overseas territories), each bank's international deferred-debit card is kept, a charge card,
  their revolving credit not being in the table. A government charge the bank applies to the card each year is
  written as a yearly fee (AIB's 30-euro stamp duty). A debit card drawing on an overdraft limit isn't a credit card (BSP's Silver and Gold Visa Debit in the Cook Islands, Samoa and Tonga), and a card offered only to the place's residents is the one taken (First Hawaiian Bank's United card on Guam and in the CNMI). A rate stated only as a floor is written at the floor, the bank naming no higher one (Swedbank Latvia's 'from 20%'); a fee that falls in steps with spending is charged in full below the step that waives it (PKO's 80 zlotys, 40 from 6,000 spent, none from 7,200); a rate that steps up with the balance is written at its first step (Ziraat's 3.25% a month under 30,000 lira). A renewal fee charged once per the card's validity is written as its yearly share (Bank of Palestine's $25 every two years, 12.50 a year); a card whose charges are debited from the account by authorization is paid in full (Isracard); a risk-based fee is written at its stated top, as a rate is (Nedbank's credit facility service fee, up to R69 a month); a bank's own schedule published by its regulator is the bank's (the Bank of Maldives' through the Maldives Monetary Authority). The first SLATE's card was a limit and a balance per family, with no bank behind it; its interest and fees weren't
  researched. Matrix (2026-10-30): 158 researched, 88 blocked, 6 proven, none pending: every country and territory's cards are researched or a blocker naming all five methods. A card charging a fixed sum per step of balance instead of interest isn't modeled (Kapital Bank's Birbank Star, 10 manat per 500 carried), so a bank charging interest is taken (ABB's TamKart); a fee that's a share of the card's limit isn't written, the game's cards keeping no limit (Stanbic IBTC's 1% management fee, BCEL's 0.5% approval fee). The blockers of 2026-10-30 record the Wayback Machine as it stands: archive.org's availability API answers and lists snapshots for most of the pages, and web.archive.org, which serves them, is refused (no answer over HTTPS, 403 over HTTP), so a snapshot named there is the first thing to read if that egress opens. Most of the 88 are places whose banks issue debit, prepaid or Islamic cards only, or price a card without publishing its rate.

The passports' form (decided 2026-10-28, the engine's reader being the Papers page: apply, pay, wait, hold a
passport valid so many years). Each research file has `routes`, one per way the office takes an application: `id`,
`where` (`home` or `abroad`), `speed` (`standard` or `urgent`), `within` (the longest it takes as the office
publishes it, a whole number of minutes, hours, days, working days, weeks or months, or null where it publishes none; where
it differs by office, the longest), optional `months` (a route offered only in some months, as Malta's seasonal fee),
and `label` (the office's own words, not compiled). Each passport band has `from`/`under` ages, optional `pages`,
`validYears` (or null) and `pay`: by route, the total the applicant pays in the currency (components summed, as
Luxembourg's chancery tax or Trinidad's expedite surcharge), or null where it isn't known. Two bands may meet the
same applicant only with different pages or validity (Guatemala's five or ten years, Pakistan's 36 or 72 pages). A
file in the research's own words (a `fees` map) or with fees in a unit that isn't a currency (Uruguay's UI) isn't
compiled and stays pending; South Africa's (the fee depends on how long the old passport has left) waits for the
form to take that condition. A territory whose people hold another country's passport has a file naming it
(`issuedBy`), with `onlyRoutes` where only some of the issuer's routes are open to it: Puerto Rico, the US Virgin
Islands, Guam and the Northern Mariana Islands (United States citizens, 8 U.S.C. §§ 1402, 1406, 1407 and the
Covenant's § 303), American Samoa (United States nationals, § 1408, who are issued its passport, 22 U.S.C. § 212),
French Guiana (the French people, Constitution art. 72-3, at the fee in Guyane), Guadeloupe, Martinique, Réunion and
Mayotte (overseas departments, where France's laws apply as of right, art. 73, at the fee in France), and Christmas
Island, the Cocos (Keeling) Islands and Norfolk Island (external Territories, to which Australia's Citizenship Act
and Passports Act extend). A territory that holds its sovereign's passport at fees of its own has a file of its own:
Åland (Finland's passport at the fees the Government of Åland sets), New Caledonia, French Polynesia and Wallis and
Futuna (France's passport with the collectivity's own tax stamp in francs CFP), and the Dutch and British
territories researched. Saint-Pierre-et-Miquelon has a file of its own from its préfecture's page, and Saint-Martin
holds France's passport at France's fee, as its Collectivité says; Saint-Barthélemy holds it abroad only, the stamp paid on the island being unread; the Cook
Islands, Niue and Tokelau hold New Zealand's. Western Sahara holds Morocco's (the owner's ruling of 2026-10-28 for its
holidays, which its prices and passports follow); the British Indian Ocean Territory, Pitcairn and South Georgia hold
the United Kingdom's, applied for from abroad (GB's file gained the online route from outside the UK, from the
Passport (Fees) Regulations 2022 as S.I. 2026/311 amended them). Every file is in the form (2026-10-28): Australia's now has the
Department's 2026 fee notice, Uruguay's the peso amounts its procedure page gives from 1 July 2026, and South
Africa's the first issue's tariff (an early renewal's double tariff waits for the person to hold a passport). A first issue against a renewal isn't in the form yet, so Austria's free first
passport under 2 is left unknown and the United States' renewal by mail isn't offered; the field comes back when the
person (layer 4) says whether the applicant already holds a passport. Reduced fees by status (Poland's pupils,
Estonia's and Denmark's pensioners) are charged at the full fee until those statuses or ages are read. The game says what it doesn't know: a country not kept, a fee, a validity, a time.

What layer 2 holds so far:

- `world.gazetteer` (`src/world/gazetteer/`): GeoNames' dump of 2026-10-26, as the owner chose it ("Use today's
  GeoNames release, keep going"), vendored in `vendor/geonames/` with each file's SHA-256 pinned and compiled by
  `tools/geonames/` (a zip reader of its own, as `tools/tzdb/` has a tar reader): 252 countries and territories,
  3,865 first-level regions, 171,654 populated places in 246 countries (R-0032 to R-0034). Each place keeps its name,
  its plain-letter spelling where it differs, its region, its coordinates, its IANA zone, its population and its
  height (the elevation model's, or the recorded elevation where the model has none; unknown for 371 places); a
  country's places are a file of their own, fetched when someone looks at that country. The town search ranks the
  name itself, then names starting with it, then a word starting with it, then names holding it, larger places
  first, accents and case aside. A test runs the clock and the sun at every one of the 171,654 places.
- `world.map` (`src/world/map/`): Natural Earth's 1:110m countries, release 5.1.2 (R-0035; public domain), vendored and
  pinned, compiled by `tools/naturalearth/` with the engine's own projection (equirectangular, as the first SLATE's)
  to SVG paths and framing boxes for the 175 countries drawable at that scale; Northern Cyprus is drawn as Cyprus and
  Somaliland as Somalia, the countries GeoNames lists their towns in. The kept arithmetic of pointing at it: the
  wrapped longitude, framing a country with a floor and inside the world, hairline borders and markers one size at
  any zoom, a marker found a turn either way across the antimeridian. The 77 countries too small to draw stay in the
  lists. A test marks every one of the 171,654 places.
- Coverage matrix A (`matrix/COUNTRIES.md`), generated by the gate's coverage check: the 252 countries down, every
  engine with a matrix on the country axis across, each cell that engine's status for that country. Every later
  engine that reads a place fills a column of it.
- `world.clock` (`src/world/clock/`): the clock as the player meets it (KEEP entry 18). Its slice keeps whether it's
  playing, the part of a real second carried and the real time played (the card's "time played"). Play and pause are
  commands; `elapse(life, realMs)` moves the life a second for each real second while playing; `advance(life, s)`
  jumps; both stop at the first commitment that wants the player and pause there. The clock reads no real time: the
  screen hands it the milliseconds from a monotonic source. `reading(instant, place)` gives the local date, time and
  zone, the season (astronomical, by hemisphere: USNO's equinoxes and solstices for every year 1800 to 2100, R-0036,
  computed from NOAA's formulas outside them, within 12 min 39 s of USNO's, measured over all 301 years) and the
  local day's sunrise and sunset. A test reads the clock at every one of the 171,654 places.
- `world.weather` (`src/world/weather/`, compiled by `tools/wmo/`): stations with each month's mean daily maximum
  and minimum, precipitation, days of at least 1 mm and sunshine where given, from the official sets in an order:
  the WMO's 1991-2020 normals (R-0037), its 1961-1990 normals (R-0038), its 1981-2010 normals where a Member's file
  gives what those lack (Ecuador's sunshine, R-0044), then national services' own publications (Météo-France's
  fiches for the overseas territories, Monaco and Andorra, R-0043; Taiwan's CWA, R-0045; the Met Office's Channel
  Islands averages, R-0048; Anguilla's Statistics Department's rainfall by year, averaged over 1991-2020 by WMO-No.
  1203's rule, R-0075; Tonga's Meteorological Service's station sheets, R-0076; tables read by hand from a scan or a
  paper, pinned to the file: Bermuda's sunshine R-0049, Nepal's R-0057, Saint-Barthélemy's and Saint-Martin's R-0060,
  Meteo Curaçao's Bonaire summary R-0074), then the Deutscher Wetterdienst's worldwide
  normals (R-0062) and its Klimatafeln (R-0063), then the WMO's World Weather Information Service (R-0042), then
  averages computed from NOAA's GHCN-Daily records by WMO-No. 1203's rules (R-0073: a month's value only from a
  month complete enough, an average only where 80% of its period's years have one; it fills Suriname's rain days and
  Pitcairn's temperatures, the other stations' records too broken). Each set
  after the first stands only for what a country has from none before it. Research tools in `tools/research/` fetch
  each source into `research/sources/` (whole, with the date read); the compiler checks every file's SHA-256. A town
  takes each normal from the nearest station of its own country (1991-2020 first), or, where its country has none,
  from the nearest abroad, which the player is told (`aboutWeather`: `weather.borrowed` where every normal is
  borrowed, `weather.borrowed-part` where some are; `weather.model` names the town nearest the station and its
  years, `weather.model-undated` where the source gives none). Stations are named for the player by the gazetteer's
  town nearest them in their country within 50 km, else by their own name. Temperatures are carried to the town's
  height at 6.5 °C a km (R-0039); precipitation is snow at or below 1.0 °C (R-0040). The day itself is the game's own
  model around the normals (R-0041). The coverage matrix (`coverage/weather-countries.json`) is generated by
  `tools/wmo/coverage.ts` from the stations and the register, and a test holds it to them byte for byte.
- `world.holidays` (`src/world/holidays/`): each country's public holidays, the days off its law or its
  government's list names, nationally and by first-level region (the gazetteer's region keys), from 2026 (the
  owner's start date) to 2100 (the last year the Naval Observatory gives the equinoxes for). Rules
  (`countries.json`, typed in `rules.ts`) give a day by date, by Easter (the Western by Oudin's algorithm, held to
  the Naval Observatory for 2000 to 2150, R-0107; the Orthodox by the Julian computus, held to the American
  Carpatho-Russian Orthodox Diocese for 2000 to 2037, R-0108), by the nth or last weekday, the weekday on or after
  or before a day, a day of another calendar (Umm al-Qura, Hebrew, Korean, Persian, Ethiopian: ICU 77.1; Chinese: the Hong Kong
  Observatory's tables, ICU's being a day off at six month starts, Chinese New Year 2027 and 2030 among them; compiled to
  each month's first day, 2000 to 2100, by `tools/calendars/`, R-0106), the day of an equinox at an
  offset (the clock's, R-0036), or the dates a government announced; with years from and until, years excepted,
  regions, a weekday's alternative day, a condition on another day's weekday, a shift by Easter, and the country's
  substitute days (next or previous free day, or off as well, as Japan's, or onto another holiday's day where
  each is kept by its own date, as the United States'; or for one on another's weekday, passing over given weekdays,
  as South Korea's) or the holiday's own; a rule may hold every so many years
  (election days). Japan's days between two holidays are kept. Spain's communities choose theirs year by year:
  `announcedTo` keeps only the law's fixed days after the last year announced, and the player is told
  (`holidays.unannounced`); a region set year by year has its own (`regionsAnnouncedTo`: Georgia's governor,
  Tennessee's). The United States keeps the federal days (5 U.S.C. 6103) everywhere and each state's and
  D.C.'s own state-office days in its region. Canada's provinces and territories each keep their own employment
  standards law's days in place of the Canada Labour Code's (`regional`); Prince Edward Island's and Yukon's
  sites refuse this environment, so they keep the Code's, are blocked in the register (world.holidays.blocked.CA.09,
  .CA.12) and the player is told (`holidays.region-unkept`). A country not kept is told as such
  (`holidays.unkept`); a town's own holidays aren't kept (`holidays.local`, KEEP entry 19's map stopping at
  regions). Each country's lists are read into `research/sources/holidays/<code>.json` and cited
  as `world.holidays.<code>` (R-0110 on); the tests hold the rules to every list. The countries done are the
  researched rows of the coverage matrix (`coverage/holidays-countries.json`), generated by `tools/holidays/` and
  held by a test. A source this environment couldn't reach is named in its title with what the host answered
  (Bremen's and the Saarland's sites, RIS, the juris portals).
- `world.prices` (`src/world/prices/`): each country's price level for what households buy, the World Bank's PPP
  conversion factor for households' final consumption (PA.NUS.PRVT.PP, World Development Indicators as updated on
  2026-10-08, R-0373: the International Comparison Program's 2021 measure, carried to later years by the World Bank),
  in the country's own currency per US dollar spent in the United States; a country's level is its latest year from
  2024 on (2025 for 168, 2024 for Afghanistan, The Gambia, Equatorial Guinea and Qatar). `priceIn(country, dollars)`
  is what costs that many dollars in the United States, in the country's currency, rounded half to even to its minor
  unit; `aboutPrices` tells the player where a country's prices aren't kept (`prices.unkept`). The currency is the
  gazetteer's (GeoNames' CurrencyCode held to ISO 4217 list one, R-0032 and R-0026: Bulgaria's the euro, the
  Netherlands Antilles none), checked against the World Bank's own name for each economy's currency unit. The World
  Bank's files are vendored in `vendor/worldbank/` with their SHA-256 pinned and compiled by `tools/prices/`, which
  also writes the coverage (`coverage/prices-countries.json`). A country the World Bank last priced at the 2021
  benchmark is carried to 2025 as the World Bank carries its own (its help desk, R-0374): the benchmark level times
  the change in the country's consumer price index (annual means of its published months or quarters, from its own
  statistics office, `research/sources/prices/<code>.json`, `world.prices.<code>`) over the CPI-U's (R-0375: the
  Bureau of Labor Statistics' months; October 2025 wasn't collected, so 2025's mean is of eleven, 321.943, the
  Bureau's own annual average), to twelve places. Where an office hasn't yet published 2025 but has 2024, the level
  is carried to 2024 against the CPI-U's 2024 (313.689), as the World Bank keeps a 2024 level where it has no 2025. Done so: Argentina (INDEC), Andorra (the Departament
  d'Estadística's monthly A142 releases on sig.govern.ad; estadistica.ad's portal blocks a browser), Kosovo (ASK's
  HICP, PxWeb), Aruba (CBS's December releases, the months placed by their chart positions), Curaçao (CBS's series
  since 1970, 2023 = 100) and Sint Maarten (STAT's quarters); for these two the World Bank's guilder level stands in
  Caribbean guilders, replaced one for one on 31 March 2025 (the central bank, quoted by the Curaçao Chronicle; its
  own site answers with a Cloudflare challenge); Bermuda (the Department of Statistics' December reports), the
  Cayman Islands (the ESO's quarters), Barbados (the Statistical Service's rebased RPI, February 2021 uncollected),
  the Faroes (Hagstova's quarters), Greenland (its half-years), French Polynesia (the ISPF's 24 monthly notes) and
  New Caledonia (the ISEE's workbook, base December 2021, linked back), Puerto Rico (the Department of Labor's
  series, published by the Statistics Institute), Guam (the Bureau of Statistics and Plans' quarters) and Micronesia
  (FSM Statistics' Q4 2025 workbook, the whole revised series), Tuvalu (the Central Statistics Division's release
  tables), DR Congo (the INS index as the central bank's series page carries it) and Taiwan (the DGBAS macro
  database, base 2021). Taiwan, Anguilla and Montserrat have no World Bank indicator but have the International
  Comparison Program's own 2021 benchmark (the ICP 2021 database, source 90, with each economy's currency in its
  metadata), vendored and pinned with R-0374; where both price an economy the indicators' value is taken (the two
  agree outside the Eurostat-OECD programme). Bonaire is in the Program but is only a part of the Caribbean
  Netherlands (BQ), so it isn't used for BQ as a whole. Anguilla (the Statistics Department's workbook, quarters)
  and Montserrat (its monthly workbooks) are carried from the Program's level. A country the Program doesn't price
  but a spatial survey does is priced against the country it was compared with (`relative` in its file): that
  country's World Bank level times the survey's gap, carried from the survey's year by the two indices. Done so:
  Guadeloupe, Martinique, Guyane and La Réunion, from INSEE's 2022 spatial price survey (Insee Première n° 1958,
  Fisher gaps to metropolitan France of 15.8, 13.8, 13.7 and 8.9%), their monthly indices from INSEE's December 2025
  Flash workbooks and metropolitan France's annual index from INSEE's BDM (`fr-metro-cpi`). France's level is for
  France as a whole (the departments are about 3% of it). Mayotte (R-0450) likewise, from the survey's gap for it
  (10.3%, its only measure, which leaves rents out); its index changed method in January 2023 (base December 2021,
  INSEE's BDM idbank 010760786), the new method having run in parallel through 2022, so its 2022 is given through
  2023 (`changes` in its `from`: each 2023 month over one plus INSEE's year-on-year change at constant method), not
  by INSEE's junction series, which is the old method's movement. By the owner's ruling of
  2026-10-28, a territory with no price-level measure of its own keeps the level of the country whose currency and
  market it shares (`of` in its file; `peg` where its pound is at par with another's, cited from its own law or
  government): Liechtenstein (Switzerland's), Monaco, Saint Barthélemy, Saint Martin, Saint Pierre and Miquelon and
  the French Southern Territories (France's), the Vatican (Italy's), Svalbard (Norway's), Åland (Finland's), Cocos,
  Christmas Island and Norfolk Island (Australia's), Pitcairn, the Cook Islands, Niue and Tokelau (New Zealand's),
  Western Sahara (Morocco's), Guernsey, Jersey, the Isle of Man and South Georgia (the United Kingdom's), Gibraltar
  and Saint Helena (the United Kingdom's, their pounds at par by the Currency Notes Act 2011 s. 6 and the St Helena
  Government), Wallis and Futuna (New Caledonia's: the same CFP franc, supplied through Nouméa) and the British Indian
  Ocean Territory (the United States': its currency is the dollar and its settlement a US base). The last four
  parents were the agent's reading of the ruling, reported to the owner. The Falklands wait: their pound's parity
  is in the Falkland Islands Government's pages and Currency Ordinance 1987, and falklands.gov.fk is outside this
  environment's allowed network. The Caribbean Netherlands take the ICP's level for Bonaire (household consumption,
  in US dollars; `benchmark` in the file names the Program's economy), most of BQ's people, carried by CBS's Bonaire
  index (84046ENG): a measure the ruling's premise didn't know of, so used in place of a parent's.

What layer 1 holds:

- `core.time` (`src/core/time/`): IANA tzdb 2026e compiled as zic compiles it (`tools/tzdb/`), every zone's history
  1800 to 2200, local time and instants with DST gaps and repeats, the calendar's arithmetic, and sunrise and
  sunset by NOAA's method; held to the system zic and zdump, to Node's ICU, to NOAA's own spreadsheet (one part in
  a hundred billion) and to USNO's tables (within 0.57 minutes). Register R-0001 to R-0023.
- `core.rng` (`src/core/rng/`): SplitMix64 over FNV-1a 64 keys (seed, decider, keys), each against its reference
  (R-0024, R-0025). No decider is registered yet: the first arrives with the weather (layer 2).
- `core.money` (`src/core/money/`): whole minor units, the 155 currencies of ISO 4217 list one (R-0026, R-0027),
  exact rational arithmetic, half-even rounding, largest-remainder allocation, exchange always an estimate with its
  dated, cited rate.
- `core.frame` (`src/core/frame/frame.ts`): a life as plain data (the frame: seed, moment, schedule, notices; and
  each engine's slice); commands, kinds of scheduled item and kinds of notice declared once, each command and
  happening with the slices it reads and writes, and held to them at run time (reading an undeclared slice, or
  changing one only read, stops it; written slices are copied, the rest shared); the passage of time, which brings
  each scheduled thing about at its moment in order and stops at a commitment that wants the player; `commandIndex()`
  lists every command with its reads and writes for the feature matrix.
- `core.text` (`src/core/text/`): `t()` over `catalog.json`, slots filled with words the caller supplies, never left
  empty. 19 lines so far, all placeholder wording (the persistence and server refusals), listed in `matrix/TEXT.md`.
- `core.persistence` (`src/core/persistence/`): the store contract; the device store (IndexedDB, local storage
  where there is none, gzip with the `slate.gz1:` mark, a copy kept before every write, the life's key written last
  and whole, letting a life go keeping it as the copy); the server store over the three backend functions, mirrored
  on the device; the server's own checks and the three functions (`server/`), with the schema version pinned there a
  second time and a test holding the two equal. APP_VERSION 0.1.0 (the package's version), SCHEMA_VERSION 1.

What layer 0 holds:

- `docs/`: the owner's package, moved from the root with `git mv` (byte for byte, 100% renames), locked by SHA-256
  in `registry/owner-docs.lock.json` with `CLAUDE.md` (54 files). `CLAUDE.md`'s paths were updated for the move;
  none of its rules changed.
- The toolchain, pinned exactly and matched in the lockfile: TypeScript 6.0.3, React 19.3.0, Vite 8.3.4, Vitest
  4.1.12, ESLint 10.12.0 with typescript-eslint 8.71.1, Stryker 10.0.0, tsx 4.23.15; Node 22.22.0; npm 11.6.2 keeps
  the lockfile, npm 10 resolves it too. Overrides: `qs` 6.16.1 (security; 6.16.0 until GHSA-6pq8-jhm2-2vcw, 2026-10-28) and `vitest` 4.1.12 (its own pin, so
  every peer request for Vitest resolves to it).
- The gate (`gate/`), run as `npm run gate` (fast: every commit, by `.githooks/pre-commit`; red stops the commit;
  `.githooks/commit-msg` writes the verdict into the message as a `Gate:` trailer), `npm run gate:full` (adds
  mutation testing; proves a layer; CI runs it on every push), and `npm run gate:write` (rewrites `matrix/`).
  Its checks, each with fixture tests that show it biting:
  - toolchain: every package exactly pinned, the tools the build order names present, the lockfile agreeing,
    npm and Node pinned.
  - owner-docs: the owner's documents unchanged, and nothing joining `docs/` unlocked.
  - build-order: every source file in a layer; no layer started before the one under it is proven; proofs
    contiguous and at commits this branch carries; imports only downward, and never outside `src/`.
  - text-inventory: every player-facing line in `src/core/text/catalog.json`, each said somewhere in the source,
    none in the engine's vocabulary (`registry/voice.json`, from KEEP entry 2); placeholder wording unfinished from
    layer 6 on; the inventory for the owner's rewrite generated at `matrix/TEXT.md`.
  - research-register: every entry found (primary source, page, date read, value), secondary (naming the primary
    it quotes), blocked (all five methods of KEEP entry 7 tried and dated, and the line telling the player what
    isn't modeled), or the game's own figure (its reason and its label to the player); no fact held twice; no date
    after today.
  - typecheck, lint (with SLATE's own rules: no raw text in JSX, every control names its feature, every value shown
    sits inside an element naming its feature; no `Math.random`, `Date.now` or `new Date()` in the app), tests.
  - feature-matrix: every feature on a page (`data-feature`), with `@slate:reads`, `@slate:bites` and
    `@slate:downstream` anchors resolved to file and line (downstream outside the files that draw it), and a
    passing falsifier (`tests/support/falsify.ts`) for the bite and for the downstream effect, whose outcome is
    state, never a sentence. Generated at `matrix/FEATURES.md`.
  - coverage: every engine declared with its matrices; one row per key of each axis, no more, no fewer; the country
    axis held to the owner's 252 and the place axis to 170,911; an engine that reads a place covers the country
    axis and names a passing test over every place; every row researched, proven, blocked or the game's, cited and
    held by a passing test, or pending (incomplete). Generated at `matrix/COVERAGE.md`.
  - handoff: this file's sections, and the layer it names agreeing with the ledger.
  - generated: everything in `matrix/` exactly what the checks produce.
  - audit (full gate only): `npm audit`; any known advisory in the installed tree is red, named by its page.
  - mutation (full gate only): Stryker over the gate's own code, static constants included; break threshold 100%.
- Development tools, set up 2026-10-27 at the owner's request: Graphify (CLI, project skill, hooks, a local code
  graph in `graphify-out/`, not committed) and the plugins Superpowers, Agent Skills, Impeccable, Caveman and
  Ponytail. `tools/setup/README.md` says what persists and how; `.claude/rules/dev-tools.md` says which rules win
  where theirs overlap the owner's (the owner's always do). `bash tools/setup/verify.sh` checks a session. They
  persist only once the owner pastes `tools/setup/cloud-setup.sh` into the environment's Setup script.

## Next step

1. The weather's blockers
   (`world.weather.blocked.<code>`, R-0051 on) each say what is to be tried again where it can be reached (the
   web archives, the services whose sites didn't answer from here: Djibouti's, Lesotho's, the Comoros', Palestine's,
   Montserrat's).
2. Holidays: no country is pending (2026-10-28). What stays open is listed below: each blocker's sources to try
   again, the archive snapshots (allowed by the owner on 2026-10-28), and the per-country open points. Then prices (layer 2's
   next engine), then proving layer 2. The notes kept from the holidays' research, for adding or revising a country:
   each from its law or its government's own list, fetched and read
   (never a search summary), with first-level regions where they keep their own (Australia's, Brazil's, India's,
   Mexico's, Malaysia's ...); the United States' territories (Puerto Rico, Guam, the Virgin Islands, American Samoa,
   the Northern Marianas) are countries of the map of their own. Prince Edward Island's and Yukon's to be tried
   again (their blockers say where). Islamic feasts: the announced dates where announced, Umm al-Qura with `announcedTo` beyond.
   Make-up working days (China's and others') aren't modeled yet; they belong with the business days their readers keep. Where a country's
   sources can't be reached, a blocker after all five methods. Leads still open: Austria (RIS bot check; Vienna's
   page timed out), Luxembourg (Code du travail L.232-2 on Legilux), Finland (sources behind Cloudflare), Portugal's
   regions (Azores: Whit Monday; Madeira: 1 July and 26 December).
   How a country is added: its rules into `src/world/holidays/countries.json` (the `Rule` and `Substitute` types of
   `rules.ts`); its sources and the lists they name into `research/sources/holidays/<CC>.json` (`country`, `sources`
   with `url`, `title`, `read`, `said`, and `kind: 'secondary'` with `quotes` where not the institution's own, and
   `lists` of `{regions?, year, days: [[iso, name]]}`, a day twice where two holidays share it, years from 2026); its
   register entry `world.holidays.<CC>` (`found` if any source is primary, else `secondary`; `value` the file, its
   sha256, the lists and years); then `npx tsx tools/holidays/build.ts` for the coverage, the list count in the
   holidays test's `expect(read)`, and the gate. A blocker is `world.holidays.blocked.<CC>` (or `.<region>`) with
   the five methods' attempts, as R-0149.
   Where each pending country stands (read, blocked, still to read), dated 2026-10-27:
   - Archive snapshots that would likely unblock a country, to fetch now that the owner allows them (2026-10-28); web.archive.org itself doesn't answer from this environment (every connection reset in the TLS handshake, 2026-10-28, while archive.org's availability API answers), so the owner may add it under the environment's Network access, Allowed domains. ST: visitsaotomeprincipe.st/pt/
     feriados (16 June 2026, Lei 8/2025's sixteen days); HT: Le Relief's Carnival article (10 May 2026); IQ: t4p.co's
     article on Law 12/2024's list (16 February 2025); IR: calendar.ut.ac.ir (12 July 2026; no .ir host answers here); GQ: Ahora EG's article quoting Decreto 9/2007 (17 April 2025); FO: Starvsfelagið's handbook list of the halgidagar (8 June 2026); BS: the Public Holidays Act's PDF on laws.bahamas.gov.bs (18 July 2026).
   - HT, SL, ST, CV, SO, IQ, IR, LA, MM, AF, KP, MW, SZ, LS, GM, SS, CF, GQ, GW, SJ, FO, BS, VC, SR, BN, BT, ER, TJ: blocked 2026-10-27 (R-0322 on); retry each blocker's sources., TJ (2026-10-28: article 3's current
     text and 2026's transfers unread; its 2012 text and the Labour Code are read, see below).
   - AT: RIS bot-check; wien.gv.at times out -> retry
   - LU: guichet page moved; try legilux Code du travail L.232-2
   - PT: regional days (Azores Pentecost Monday; Madeira 1 July, 26 December) need the regional decrees
   - FI: tyosuojelu bot-check; finlex new URLs; church act + Independence Day law
   - FO: blocked 2026-10-28: Anordning 441/1923's text is unread (logir.fo renders blank headless); the only list,
     Starvsfelagið's handbook, refuses curl (HTTP 455), and the classifier rules a browser past such a refusal
     circumvention, so it's not a source. Retry: frítíðarlóg 30/1986, gov.fo, Vinnuhúsið.
   - GL: done; SJ: blocked (see below and the blocked list).
   - US.NH: nh.gov (DAS, courts, employee portal, education), gc.nh.gov and Justia all refuse (403) on 2026-10-27;
     state employees' day after Thanksgiving unread. US.TN: tn.gov 403.
   - PR: done 2026-10-27 from OATRH's Memorando Especial 12-2026 (2027's list; docs.pr.gov/files/OATRH/...) and
     art. 387's Sunday rule. 2026's memo (ME 14-2025?) not found on the moved site: hold 2026 to it when found.
   - AR: done 2026-10-27: Ley 27.399 (art. 6 moves the four movable days), Decreto 1103/2026 (the Pope's visit:
     9 Nov national, 10 Nov Córdoba and CABA, 11 Nov Provincia de Buenos Aires), and each province's own days its law
     calls a holiday for the whole province (Jujuy, La Rioja, Mendoza, Salta, San Juan, San Luis, Santa Cruz,
     Santiago del Estero, Tierra del Fuego from their texts; Catamarca from FeriadosAR, its digest behind Cloudflare).
     No laborables left out (national and provincial). Formosa blocked (jusformosa.gob.ar 503; try again). La Rioja's
     4 Aug and 12 Nov have no law found: retry Ley 6886's amendments. Jujuy's Ley 5005/1987 unread.
   - PY: done 2026-10-27 from Ley 7544/2025 (bacn.gov.py) and the 2026 decrees (6215's scan; the 1 Mar, 29 Sep and
     30 Jun World Cup decrees through ABC Color and Récord; presidencia.gov.py does not answer). Announced to 2026:
     the executive may still add up to two days in 2026.
   - MY: done 2026-10-27 (R-0315): the Cabinet's HKA 2026 and 2027 tables, the days added in 2026 (RTM), Act 369
     s. 3 for the eleven Sunday regions (engine `following`), Sabah Cap. 56 s. 3(3) and Sarawak Cap. 8 (lawnet
     L.N. 69 and 202 of 2026). Kedah, Kelantan and Terengganu blocked for their Friday replacement rule only
     (R-0312 to R-0314, line holidays.region-unmoved): retry the state portals and the Act 369 text. 2028: the
     Cabinet's HKA 2028 when issued (kabinet.gov.my/hari-kelepasan-am/); Sarawak's 2026 amendment bill (automatic
     replacement) when in force.
   - XK: done 2026-10-27 from Law 03/L-064 (gzk.rks-gov.net ActID=2539, form post for the PDF) and the Education
     Ministry's 2025-26 school-calendar draft for the Bajrams' 2026 dates (konsultimet.rks-gov.net). Bajrams from 2027
     are Umm al-Qura's: read the Republican Holidays Commission's 2027 calendar (due by end of October 2026). MK: done 2026-10-27 (see below).
     MD, GE: done 2026-10-27 (see below).
   - ME: done 2026-10-27 from the 2022 consolidated law (data.gov.me); the 2023 amendments (Njegoš Day two days, a
     state holiday) through the press: retry sluzbenilist.me (504) for 3/23 and 30/23.
   - BA: done 2026-10-27 for the Federation (SFRJ law, Government decisions: announced to 2026) and Srpska (its Law on
     Holidays, the Day of the Republic by decision), through Paragraf Lex BA and FENA (fbihvlada.gov.ba answers;
     its decisions not found there). Brčko blocked: the act behind its faiths' days for all not found.
   - KZ: done 2026-10-27 from old.adilet.zan.kz (the Law on Holidays as amended 11.06.2026, the Labour Code art. 84;
     the new adilet.zan.kz is a script page) and the Labour Ministry's word that 2026 has no transfers. Later years'
     transfers are the Ministry's (Labour Code art. 85(3)): announced to 2026.
   - GH: done 2026-10-27 from the Interior Ministry's 2026 statements and the Executive Instruments as GNA, Citi and
     others report them (mint.gov.gh needs a script; Graphic answers 406). Boxing Day 2026 is a Saturday: if an E.I.
     adds Monday 28 December, add it. Read Act 601 and Act 1142's Schedules when reachable (judy.legal is paywalled).
   - TZ, PW: blocked 2026-10-27. TZ: the Act's days are on BoT's 2025 list; 2026's Eid el-Fitr (20 or 21 March), Eid
     el-Hajj and Maulid as announced are not found (TanzLII documents behind Cloudflare). PW: 1 PNC § 701 read (RPPL
     10-15's scan on palaugov.pw); whether 1 June and 1 October are legal holidays, and by what act, not found.
   - GS: done 2026-10-27 from the Commissioner's notice in Gazette No. 1 of 2026 (laws.gov.gs; s. 73 of the
     Interpretation and General Clauses Ordinance 1977); announced to 2026: read 2027's notice in Gazette No. 1 of 2027.
   - IO, TF: blocked 2026-10-27 (BIOT's ordinances define no holidays; the TAAF publish none).
   - NU: done 2026-10-27 from the Public Service Commission's circulars (gov.nu/public-service-circulars); Boxing Day
     2026 is a Saturday: add the December circular's day in lieu if it gives one. The Public Holidays law unread.
   - VU: lead: gov.vu/index.php/events/holidays lists the national days and the six provinces' own days (Shefa 18
     Jun, Penama 16 Sep, Sanma 24 Sep, Torba 2 Oct, Tafea 8 Oct, Malampa 10 Oct) but for 2020; no 2026 order found.
   - MH: done 2026-10-27 from the Public Holidays Act 1988 version 2 (rmiparliament.org legislation, by title); the
     Public Service Commission may direct otherwise (s. 902): read the Chief Secretary's yearly memo when found.
   - NR: done 2026-10-27 from the 2026 Gazettes (nauru.gov.nr/government-information-office/government-gazette:
     G.N. 28/2026's schedule and each day's declaration; text searched over all 2026 issues). Read 2027's schedule
     (G.N. early January 2027) for Eigigu and Remembrance Days' dates.
   - SB: done 2026-10-27 from Gazette No. 157 of 2025 (Notice 805) and No. 114 of 2026 (Notice 689): the gazette PDFs under
     solomons.gov.sb/wp-content/uploads answer though the site's pages are behind Sucuri; find them by web search.
   - NC: done 2026-10-27 from the DTENC's AIT art. 74 list and CPME's 2026 calendar (Lp. 232-1 itself unread; juridoc moved).
   - JM: done 2026-10-27 from the Holidays (Public General) Act's Schedule (mlss.gov.jm PDF); Good Friday and
     Christmas Day through the Gleaner's reading of the Act (laws.moj.gov.jm answers 503): read the Act's text there.
   - MS: done 2026-10-27 from the Public Holidays Act 2024 (parliament.ms) and 2026's proclamations (gov.ms, the
     AG's Chambers' S.R.O. list). Announced to 2026: read 2027's birthday proclamation there.
   - BS: lead 2026-10-27: Ch. 36 (LRO 1/2017, laws.bahamas.gov.bs/cms/images/LEGISLATION/PRINCIPAL/1938/1938-0015/
     1938-0015_2.pdf) read: only a Sunday holiday moves (to the next day); its Schedule still says 12 October. Open:
     the National Heroes Act 2007 (second Monday in October?), and whether 10 Jan and 26 Dec 2026 (Saturdays) moved
     by order (aggregators say Mondays 12 Jan, 28 Dec); 2026's posted Gazettes (84) have no holiday order.
   - BW: lead 2026-10-27: gov.bw/public-holidays (expired TLS; read through the fetcher) lists 2026 without 2 January;
     Cap. 03:07's text not read (botswanalaws.com members only, its 2006 Act PDF 404, NATLEX 403).
   - GY: done 2026-10-27 from Cap. 19:07 (L.R.O. 1/2012) and the Minister's 2026 notifications: the e-Gazette
     (officialegazette.gov.gy, a JS app: search in a browser render, files at /api/pdf/<id>, the notices in each
     week's Legal Supplement B, the last page) and moha.gov.gy. Commonwealth Day (s. 3, first Monday of August)
     appears in no 2026 notice and isn't kept. 2027: the notices as they're published.
   - MN: done 2026-10-27 from the holidays law (legalinfo.mn lawId=399, art. 4.1), the Government's 2026 moves
     (mlsp.gov.mn: Bituun 17 Feb; cabinet.gov.mn: 16-17 July) and Zindaa for the lunar days' 2026 dates. Announced
     to 2026: the Mongolian lunar calendar isn't in the engine; 2027's Tsagaan Sar, Düichen and Chinggis days and
     any moves need reading then.
   - KG: done 2026-10-27 from the Labour Ministry's 2026 working calendar (Google Drive link on mlsp.gov.kg) and its
     posts (found through mlsp.gov.kg/wp-json/wp/v2/posts?search=); Kurman Ait through 24.kg. Announced to 2026: the
     2027 calendar (order No. 197 of 20.08.2026) counts 8 non-working January days against its list's 7; read the
     Labour Code (cbd.minjust.gov.kg resets) or a Cabinet transfer to settle it.
   - AM: done 2026-10-27 from arlis.am: the holidays law (ՀՕ-200 as restated by ՀՕ-345-Ն, 24 July 2026; the January
     2026 text after ՀՕ-1-Ն), Labour Code arts. 156-157, and decision N 109-Ն (4 May 2026). Other 2026 Government
     non-working days (law art. 39) not found by search: list arlis's 2026 decisions if a way to query them is found.
   - AZ: done 2026-10-27 from the Labour Code art. 105 (baku-ih.gov.az's copy), Cabinet decision No. 362 (nk.gov.az
     PDF) and the Labour Ministry's 2026 calendar through muhasibat.az (sosial.gov.az fails TLS). Announced to 2026:
     read 2027's Novruz/Ramazan/Qurban decision (nk.gov.az, December 2026).
   - BY: done 2026-10-27 from ilex.by's summary of Decree No. 157 and resolution No. 397 (pravo.by, government.by,
     mintrud.gov.by refuse). Announced to 2026: read 2027's transfer resolution when the Council of Ministers adopts it.
   - TJ: lead 2026-10-27: the Law on holidays as of 2012 (icnl.org copy: art. 3 non-working 1 Jan, 8 Mar, 21-24 Mar,
     1 May, 9 May, 27 Jun, 9 Sep, 6 Nov, Ramazon and Qurbon by the religious authority) and the Labour Code art. 89.5
     (a weekend day on a holiday moves to the next working day; continent-online.com) read. Open: the current text
     (ncz.tj, amended to 17.06.2026, answers 503), 2026's Ramazon date and any Government transfers (khovar.tj 410,
     adlia.tj 503); Qurbon 27 May 2026 per the Council of Ulema through Avesta.
   - TM: done 2026-10-27 from the Labour Code art. 81 (mejlis.gov.tm/single-code/12) and the President's 2026 decrees
     (turkmenistan.gov.tm, found with its /ru/poisk?key= search). Announced to 2026: read 2027's bayram decrees there.
   - MD: done 2026-10-27 from art. 111 as the trade unions' confederation quotes it (legis.md refuses), 1 June from
     the 2026 lists (diez.md, Radio Moldova), and Gagauzia's four days (gagauzia.md, guogagauzii.md, LAF). Government
     transfers bind only public bodies (left out); hram days are local. Transnistria keeps the Republic's days. Read
     art. 111 itself and the People's Assembly's current resolution (halktoplushu.md) when reachable.
   - GE: done 2026-10-27 from the Labour Code art. 30 as Relocation.ge lists it (matsne.gov.ge and parliament.ge
     refuse); read art. 30 itself when matsne answers. Government ordinances bind administrative bodies only.
   - MK: done 2026-10-27 from the Law on Holidays' 2026 list as Makfax and Duma print it (vlada.mk, mtsp.gov.mk reset;
     slvesnik.com.mk fails TLS). Faith and community days left out. Ramazan Bayram from 2027 is Umm al-Qura's:
     replace with the Government's yearly list when read.
   - AD: done 2026-10-27 from the Government's 2026 calendar notice (govern.ad), La Massana's page and La Vall
     Associats' list of the comuns' 2026 edicts (BOPA uses keyed APIs). Whole-parish days only; one village's days
     are left out (Ordino's 5-6 July and 16 September "a Ordino" read as the village). Announced to 2026.
   - CX, CC: blocked 2026-10-27: the Administrator's 2026 bulletins (infrastructure.gov.au community-bulletin-ci- and
     -cki-public-holidays-2026.pdf, A20 and A21/2025) exist but the host resets; retry them first.
   - DZ: done 2026-10-27 from APS's reports of the joint Labour/Civil Service communiqués (found with aps.dz/fr/search
     ?q=chômée et payée) and Legal Doctrine's text of Loi 63-278. 1 Moharam 1448 (16 June) derived from Achoura's
     notice; read its own communiqué if found. Announced to 2026.
   - MA: done 2026-10-27 from mmsp.gov.ma's table of décret 2-77-169, the Fête de l'Unité decrees (MAP) and the Habous
     ministry's 2026 announcements through MAP (mapexpress.ma/?s= search). Announced to 2026. EH (Western Sahara):
     not yet decided which law the map applies there; the owner may want to rule.
   - EG: done 2026-10-27 from the 2026 decrees as Amwal Al Ghad and Arab Finance report them (en.amwalalghad.com's
     /wp-json/wp/v2/posts?search= finds each). Announced to 2026. Read Ministerial Decree 294 of 2025's list (for
     Sinai Liberation Day and the private sector's Eid al-Fitr length) when found.
   - MR: lead 2026-10-27: ami.mr's WP API (slow; allow 150 s) gives the Presidency's 2026 decrees (2 January; 28
     and 29 May "عطلة معوضة") and the crescent committee's dates (Eid al-Fitr Fri 20 March; Dhu al-Hijja 1 = 18 May,
     Eid al-Adha 27 May; 1 Muharram Wed 17 June; Mawlid Wed 26 August). Missing: the decree listing the fêtes
     légales (whether 25 May and each Eid's length); Japan's embassy calendar (mr.emb-japan.go.jp/files/100941532.pdf)
     answers 403.
   - BF: done 2026-10-27: loi 001-2026/ALT of 9 January 2026 (Burkina24 quoting the minister), 3 January under the
     2015 law, and 2026's FAIB dates and ministry communiqués through burkina24.com's WP API. Announced to 2026.
   - TD: done 2026-10-27: décret 413/97 as amended in 2019 (an employer's guide quoting both lists; Alwihda for
     the Sunday rule), the Civil Service ministry's 2026 communiqués through tchadinfos.com's WP API. Announced to
     2026.
   - GA: done 2026-10-27: décret 00727/1998 as amended in 2004 (its text not online; its days are the Labour
     ministry's communiqués citing it, through agpgabon.ga's and gabonmediatime.com's WP APIs) and 30 August from
     décret 0096/2024. Announced to 2026.
   - BJ: done 2026-10-27: loi 90-019 (La Nouvelle Tribune quoting it) and the ministry's communiqués through
     beninwebtv.bj's WP API; the traditional religions' days 8 and 9 January 2026 by communiqué. Announced to 2026.
   - NE: done 2026-10-27: loi 97-20 as amended by ordonnances 2024-33 and 2026-12, every 2026 day from the
     ministry's communiqués in Le Sahel (lesahel.org WP API; search "Communiqué"). Announced to 2026.
   - ML: done 2026-10-27: loi 05-040 (WageIndicator quoting arts. 1-3), 14 January by the 2023 decree, and the
     Labour ministry's 2026 communiqués through bamada.net's WP API. Announced to 2026.
   - GN: done 2026-10-27: décret D/2022/0526 (Guinéenews's report lists all twelve days and art. 2's moves), 2026
     from the ministry's communiqués (guineenews.org, woulanews.com WP APIs). Announced to 2026.
   - TG: done 2026-10-27: the government portal republicoftogo.com (/content/search?searchText=) reports each
     day as a public holiday; the law's own list not found. Announced to 2026.
   - MG: done 2026-10-27 from décret 2026-006 and the added days (2025-1974, 2026-1822, 2026-2212); Eids from the
     press. Open: the national culture day's date (art. 3, set by the Ministère de la Communication et de la Culture;
     not found at CNLEGIS or in Les Nouvelles) and the Taombaovao date when the Concertation Nationale fixes one.
   - CM: done 2026-10-27 from loi 73/5 as amended (Cameroon Tribune 53913, le360 quoting art. 2) and the BVMAC's 2026
     notices (bvm-ac.org WP API). Presidential decrees (art. 4) for religious days on a Sunday and bridge days: none
     found for 2026.
   - CG: done 2026-10-27: loi 2-94's nine days as WageIndicator cites §1er (the law's own text isn't online; the
     ministry's 2026 Whit Monday communiqué cites art. 1), and the 2026 arrêtés found in all 43 Journal officiel
     issues at sgg.cg/JO/2026/ (2 January, 16 April). Retry the law's text (its rule for a day on a Sunday, if any, is
     unread: none is kept); the arrêtés for later 2026 issues.
   - ET: done 2026-10-27: Proclamation 1334/2024 (MetaAppz's English text), the Ethiopic days computed from the
     Ethiopic calendar, Orthodox Easter, and 2026's Islamic days from Fana (fanamc.com/english/?s=, its WP API is
     closed). Announced to 2026.
   - CD: done 2026-10-27: ordonnance 23-042 (droitcongolais.info's copy of the J.O. text; art. 2: a Sunday's day is
     the Saturday before) and the ministry's 2026 communiqués as Congo Profond reports them (3 January, 19 January for
     Saturday 17 January, 1 April). 17 May 2026's communiqué not found: kept by art. 2 on Saturday 16 May.
   - SH: done 2026-10-27 for Saint Helena island (SH.02): its Ordinance (2016 revision, 2024 amendment) and the
     Chief Secretary's 2026 and 2027 notices, found through sainthelena.gov.sh/wp-json/wp/v2/media?search=holidays;
     the country's days are those Ascension's Ordinance shares. Ascension (SH.01) and Tristan (SH.03) blocked: no
     2026 notice or list (ascension.gov.ac resets; tristandc.com reports King's Day, Anniversary Day, Ratting Day).
   - KN: done 2026-10-27: Cap. 23.23 (revised 2002) and the Nevis Island Administration's 2026 list
     (nia.gov.kn/public-holidays/) for the proclaimed Carnival and Culturama days. Announced to 2026; Buckley's
     Uprising day is to be added from 2027 (SKNIS, 29 January 2026).
   - VA: done 2026-10-27: the Curia personnel regulation's art. 52 (press.vatican.va, in force 2026) with canon
     1246's holy days (no bishops' conference, so none moved); the Pope's days are Leo XIV's (8 May, 17 September).
   - AO: done 2026-10-27: Lei 10/11 and Lei 11/18 at lex.ao (its llms.txt indexes 2020-2026 diplomas: no later
     holiday law; presidential tolerâncias de ponto would be added by decree when found there).
   - MZ: lead 2026-10-27: the holiday article of the Labour Law (Lei 13/2023) not found online; 2026's "tolerâncias
     de ponto" (jornalnoticias.co.mz WP API) are the civil service's only. A Sunday holiday moves to Monday (DLA
     Piper on Lei 23/2007).
   - CV: lead 2026-10-27: national days by Decreto-Lei 18/84 (per aggregators; unread); each concelho (the map's
     regions) keeps a municipal day set by its assembly (boe.incv.cv Boletim Oficial). governo.cv's tolerâncias are
     the public administration's only.
   - BD: done 2026-10-27: MoPA's 2026 list (general holidays only) through the Daily Star Bangla; 2026's later
     notices at mopa.gov.bd (/pages/go-ultimates?page=N&page_size=100; PDFs in a legacy font, read as images):
     election days 11-12 Feb for private offices too, 7 November yearly. Eids per bdnews24. Announced to 2026.
   - UG: lead 2026-10-27: the Public Holidays Act (Cap. 174, revised 2023) is on ULII (Cloudflare; old.ulii resets;
     commons.laws.africa 404); 2026's election days 15-16 January (s. 2(2), chimpreports.com WP API). Open: Schedule
     2's list, a Sunday rule, and the Idds' 2026 dates.
   - KW: done 2026-10-27: Law 6/2010 art. 68's private-sector days (WageIndicator's quotation) on the Cabinet's
     2026 dates (timeskuwait.com WP API); public-sector extra days left out. Announced to 2026.
   - SN: done 2026-10-27: loi 74-52 (read in the Assembly's file at vie-publique.sn), Tamxarit from loi 83-54 (the
     scan read as an image), 1 February gone by loi 89-41, the Grand Magal by loi 2013-10 (Dakaractu); 2026's
     Islamic days are CONACOC's through APS; 19 January the President's day off. Announced to 2026.
   - BR: done 2026-10-27: national laws in every state, each state's own from the courts' and prosecutors' 2026
     calendars (the AASP tracker at aasp.org.br/produtos-servicos/expediente-forense/feriados-forenses-2026/ links each
     court's act). Acre announced to 2026 (Lei 2.126/2009 moves some days by a rule not read). Rio's Carnival Tuesday,
     Corpus Christi, Paraíba's 5 August, Santa Catarina's Sunday Data Magna and Tocantins's 2026 move rest on the
     press: read their laws (alerj, tjpb, alesc, diariooficial.to.gov.br) when reachable.
   - CL: done 2026-10-27: Leyes 19.668, 20.148, 20.299 (BCN texts via docs.chile.justia.com; 2.977, 20.663 and
     21.357 answer 403 there), the DT's consults (art. 35 ter's 17/20 September), Meganoticias' 2026 list; the
     solstice day is the clock's at UTC-4 (listed to 2100). Arica y Parinacota's 7 June kept; Chillán's 20 August
     (two communes) left out. Election days (Ley 18.700 art. 169) are holidays: add them for 2027+ when called.
   - EC: lead 2026-10-27: RO 906 (esacc.corteconstitucional) and the Código del Trabajo art. 65 (2023 codification,
     ambienteyenergia.gob.ec) read: national days and moves known. Open: each province's provincialización day
     (region-level local days by special laws; Decreto 346 moved Cotopaxi's 2026 day to 2 April) and the 2026
     decrees (249, 507: 20 Nov non-working). The SRI's monthly lists (sri.gob.ec ... Feriados mes actual.pdf) time
     out here; try again, they name each province's days.
   - VE: done 2026-10-27: LOTTT art. 184 (Acceso a la Justicia's transcription), the Ley de Fiestas Nacionales
     (Justia, from SAIL) and the national Gaceta's 2026 decrees (gacetaoficial.gob.ve: its advanced search,
     /gacetas/filtro-avanzado?texto=, finds Decreto 5.276, 18 March non-working). The states' and municipalities' own
     days (art. 184 d) blocked (world.holidays.blocked.VE.states): every state keeps the national ones, told so.
   - AU: done 2026-10-27, each state's own Act in its region; South Australia blocked (its sites, AustLII and the
     Fair Work Ombudsman refuse this environment): retry legislation.sa.gov.au's Public Holidays Act 2023. Victoria's
     2027 Grand Final Friday, WA's 2028 King's Birthday and the ACT's and NSW's declarations for 2028: add when set.
   - CN: done 2026-10-27 (the State Council's 2026 notice; the 2024 measures from 2027); Xinjiang's, Ningxia's and
     Guangxi's own 2026 days. 2027: the State Council's notice (due about November 2026) and the three regions'
     notices; Xinjiang's (令174号), Ningxia's and Guangxi's (令98号) measures, to keep their days past the notices;
     whether Hainan's 三月三 or Qinghai's ethnic days are given to all of a province (none found).
   - NC: holidays by Code du travail NC art. Lp. 232-1 and arrêté n°3893-T du 2 mai 1991 (pacificdata 403; juridoc
     code PDF moved 404); Fête de la Citoyenneté 24 Sept. Retry juridoc for the current code PDF.
   - PM: whether the French Code du travail L3133-1 (and any local day) applies in Saint-Pierre-et-Miquelon
     unconfirmed (service-public F2405 doesn't mention SPM); check Légifrance territorial scope / DCSTEP SPM. WF:
     only secondary lists (28 Apr St Pierre Chanel, 29 Jul Fête du Territoire?, 29 Jun?). Retry.
   - RU: done 2026-10-27: art. 112, decrees 1466 (2026) and 1187 (2027), and 24 regions' own days from ConsultantPlus's
     table for 2026 (kontur-extern.ru, document 41/250002). 2027: the regions' yearly acts (Islamic days, Radonitsa,
     Sagaalgan, Shagaa, Naadym ...) and Kalmykia's Zul for 2026; read the new year's table when ConsultantPlus issues
     it.
   - ME: law read at paragraf.me (text as of 2021: Jan 1, May 1, May 21, Jul 13, each two days; Sunday rules art.
     3); Njegošev dan 13 Nov added end of 2021 (RSE, N1) - the current consolidated text (Službeni list CG) not
     yet read; 2022 Sunday dispute (government: Monday working). No 2026/2027 ministry list found (gov.me search
     JS, mfa.gr 403). Retry: sluzbenilist.me, gov.me Ministarstvo rada notices.
   - IN: done 2026-10-27 from the RBI matrix (refetch: POST the form once per office) and three territories' own
     orders; Haryana, Punjab, Andaman and Nicobar and Ladakh blocked (their sites don't answer): retry each. 2027:
     the RBI's matrix and the states' notifications when issued.
   - BW: gov.bw/public-holidays has the 2026 list but its TLS cert is expired / name-mismatched (not bypassed);
     Bank of Botswana page not found; BSE notice (bse.co.bw/wp-content/uploads/2026/05/120526-PUBLIC-
     NOTICE_FRIDAY-15-MAY-2026-DECLARED-PUBLIC-HOLIDAY-AND-NON-TRADING-DAY-ON-THE-BSE.pdf): 15 May 2026 declared
     (Mogae memorial). Read the Public Holidays Act (Cap. 03:07) text: Jan 2?, Holy Saturday, President's Day +
     Tuesday, Botswana Day + 1 Oct, Sunday rules.
   - RW: done 2026-10-27 from Presidential Order No. 54 of 2017 (RwandaLII) and gov.rw's 2026 list (which omits
     2 January, the Eids and Saturday substitutes; the Order rules). Eids are Umm al-Qura's: read the Rwanda Muslims'
     Association's yearly announcements when found.
   - ZM: done 2026-10-27: Cap. 272's Schedule and Sunday rule (Laws.Africa's 1996 consolidation), SI 33/2007 (Women's
     Day), the committee report on N.A.B. 76 of 2026 (parliament.gov.zm: its certificate chain is incomplete; completed
     from the leaf's AIA link, cacerts.rapidssl.com, verification kept) naming the s. 3 days, and 2026's declared days
     (News Diggers). Open: whether N.A.B. 76 passed (it drops the Monday for a Sunday); KK Day's and Easter Monday's
     own notices; the 2027 days.
   - AS: no ASG 2026 holiday schedule found (americansamoa.gov); Samoa News: government closed 1-2 Jan 2026 by
     governor's announcement. Read A.S.C.A. § 1.0501 (legal holidays: Flag Day 17 Apr, White Sunday Monday?,
     Manu'a Cession Day 16 Jul?) and the governor's notices. Retry.
   - VI: lead 2026-10-27: the § 171(a) list read in the Division of Personnel's 2020 Employee Handbook (dopusvi.org;
     21 days, a Sunday's the Monday, no Saturday rule) and vi.gov's 2025-26 proclamation; open: whether Juneteenth
     (Bill 35-0009, Senate 2023) became law, and § 171's current text (Justia behind Cloudflare). Carnival and
     festival days are administrative leave for government staff only.
     2026-10-27: vi.gov's WP API (/wp-json/wp/v2/posts?search=holiday) has the Governor's 2025-26 schedule (§ 171
     days named: 25-26 Dec, 1 Jan, 6 Jan) and 2026's Easter (Holy Thursday, Good Friday, Easter Monday) and Juneteenth
     (offices closed Fri 19 June) notices; whether Juneteenth is now in § 171 is still open.
   - GL: lead 2026-10-27: no Greenlandic holiday act found; an Inatsisartut § 37 question (ina.gl 019_2023) calls
     21 June the only national holiday; Info Norden's page is behind Cloudflare.
   - DJ: done 2026-10-27: arrêté 77-347 as amended (77-609, 78-0226, 80-0931), read at journalofficiel.dj (WP: the
     texte-juridique type, /wp-json/wp/v2/search), and 2026's Islamic days as La Nation reports them (WP API).
   - LY: done 2026-10-27 from Law 5/2012's table (the gazette scan at security-legislation.ly), Hijri days by Umm
     al-Qura. Open: the Prime Minister's 2026 decisions (lawsociety.ly, behind Cloudflare: 55 for 17 February, 117 for
     Eid al-Fitr with a fourth day for public employees) and Libya's own sighting dates.
   - SY: done 2026-10-27: Decree 188/2025's list (Asharq quoting SANA's text; sana.sy doesn't answer), Eid al-Adha
     2026 from the Presidency's notice (Al-Ain: 26-30 May), the other Hijri days by Umm al-Qura. Open: the 2026 Eid
     al-Fitr notice; the north-east's administration keeps its own (not modeled).
   - YE: done 2026-10-27 from Law 2/2000 (Mohamah.net's text): its feasts by Umm al-Qura, art. 4's day in place of
     a holiday on a Friday or on another holiday (the next day that is neither). Open: the weekend (Friday only in the
     law; Friday-Saturday in practice since 2013? unconfirmed), and the Sanaa authorities' own days in the governorates
     they hold (not modeled: the law of the Republic is kept everywhere).
   - MR: done 2026-10-27: loi 92-018 (the Fonction publique ministry's legal texts page, /ar/techriye), the National
     Moon Committee's 2026 dates and the Presidency's compensation-day decrees (ami.mr WP API); from 2027 the Hijri
     days by Umm al-Qura. 1 January isn't in the law (2 January 2026 was decreed "following" it): not kept.
   - UG: done 2026-10-27 from the Public Holidays Act's Schedule 2 (Cap. 174, 2023 revision; Laws.Africa's commons
     host, commons.laws.africa/akn/ug/act/1965/23/eng@2023-12-31.pdf, past ULII's Cloudflare). Hijri days by Umm al-Qura.
     Open: the President's s. 2(2) days for 2026 (NRM Liberation Day 26 January and the 15 January election day are
     reported by aggregators only).
   - BI: done 2026-10-27 from décret 100/150 of 7 June 2021 (the 2006 list as amended, presidence.gov.bi WP API; a
     scan, read by eye). Aïd el-Adha 27 May 2026 is the Presidency's own report; Aïd el-Fitr by Umm al-Qura. Art. 4's
     Sunday move is discretionary ("lorsqu'il paraîtra inopportun") and no moved day is found among the Presidency's
     decrees (2025's 6 April and 8 June fell on Sundays): not kept. Open: whether Monday 2 November 2026 is given.
   - KM: done 2026-10-27 from décret 25-147/PR of 19 December 2025 (munganyo.km, the Union's register of decrees;
     it repeals the 1996 to 2006 decrees). 2026's Ramadan days from Beit-Salam: Ramadan's first day 19 February and
     the Aïd 21 March make the three days after its 29th 20 to 22 March; Ide El Kabir 28 May (the Presidency's address
     of that date) and its morrow. The New Year 1448 and the Maoulid by Umm al-Qura (16 June, 25 August): open, since
     the New Year address is dated 16 June and 2025's holiday fell the day after its celebration, so 17 June may be the
     day kept. Art. 3's bridge days are declared one by one: not kept.
   - GL: done 2026-10-27: helligdagsloven (lovbkg. 1023/2012, nalunaarutit.gl, in force there) protects "folkekirkens
     helligdage" without listing them; Greenland keeps Denmark's list (borger.dk, as the DK row) plus Store bededag,
     which Naalakkersuisut says the Danish abolition doesn't reach (§ 37 answer 019/2023). Open: the National Day, 21
     June, which the alcohol act (Inatsisartutlov om alkohol, § 2 stk. 7) defines as a helligdag for alcohol sales,
     with the eves and Epiphany, and which Info Norden (Cloudflare) calls a day off by agreement: not kept.
   - NF: done 2026-10-27 from the Employment Act 1988 (NI), s. 9 (Compilation No. 8, 20 September 2022, Federal
     Register of Legislation). The Sovereign's Birthday steps a week where 8 June is a Saturday (its Monday is then
     Bounty Day's): those years, 2030 to 2097, are dates.
   - SX: done 2026-10-28 from the Government's own Public Holiday Schedule (sintmaartengov.org, 2026 to 2028, so
     announcedTo 2028; Carnival Day, the day before the Grand Parade, is set year by year: dates). Emancipation Day's
     Sunday move from the Government's 2017 correction (Labour Regulation art. 23(3a), via St. Maarten News); Labour
     Day's from the Arbeidsregeling 2000's art. 23 (ABKennisbank). The current consolidated art. 23 is unread.
   - GD: done 2026-10-28 from the Cabinet Office's "Grenada's Public Holidays - 2026" (gov.gd, September 2025), with its
     rule that a holiday on a Sunday is observed on the Monday after; Carnival Monday and Tuesday are set yearly: dates.
     The Public Holidays Act on laws.gov.gd sits behind a cookie challenge (a bot check): not read.
   - EC: done 2026-10-28 from the Viceministerio de Turismo's calendar 2025-2030 (Expreso's copy; turismo.gob.ec
     doesn't answer), announcedTo 2030: its moves (Tue to Mon, Wed/Thu to Fri, Sat to Fri, Sun to Mon; 1 January,
     Carnival, Good Friday and Christmas unmoved) and the 2-3 November pair's, checked year by year against it, plus
     Decreto Ejecutivo 249's 2 January 2026. Its 2030 Pichincha line is wrong (24 May 2030 is a Friday). Open: the
     pair's rule where 2 November is a Wednesday (2033), which the calendar doesn't show; the LOSEP's text is unread.
   - MZ: done 2026-10-28 from Lei n.º 13/2023 (Lei do Trabalho), art. 105, in the Boletim da República the Tribunal
     Supremo hosts (ts.gov.mz): nine days, a Sunday's day off deferred to the next day. Art. 106's tolerâncias de ponto
     are granted one by one by the Minister: not kept.
   - LB: done 2026-10-28 from décret 15215/2005 as amended (the Prime Minister's office's holiday table, pcm.gov.lb,
     plain http) and its 2026 memos (read through the memo list's own pager): both Easters' Good Friday and Easter
     Monday (memos 7/2026 and 14/2025), 4 August by décret 8007/2021, the Hijri days as the memos closed them (Fitr 20
     to 23 March, Adha 27 to 29 May, Ashura 26 June) and declared closures (9 April, 25 May). From 2027 the Hijri days
     by Umm al-Qura. Saturday closures for special-schedule offices (14 February, 15 August, the Easters' coinciding
     Saturday) aren't days off: not kept.
   - EH: done 2026-10-28 by the owner's ruling (asked 2026-10-28, answered "Morocco's everywhere"): Western Sahara's
     22 places, east of the berm too, keep Morocco's holidays (`{"of": "MA"}`, as Åland keeps Finland's).
   - SD: done 2026-10-28 from the Council of Ministers' General Secretariat's notices on the government portal
     (sudan.gov.sd, WordPress API): 1 January, Fitr 19 to 24 March, Adha 26 to 30 May, the Hijri New Year 17 June, the
     Mawlid 25 August. 25 December is kept as 2025's notice made it nationwide; 2026's isn't out yet (open). The
     Eastern churches' Christmas days are the communities' own: not kept. From 2027 the Hijri days by Umm al-Qura,
     one day each; no holidays law was found.
   - MW: blocked 2026-10-27: the Act's Schedule is read only as consolidated at 31 December 2014 (commons.laws.africa
     /akn/mw/act/1967/11/eng@2014-12-31.pdf); the Gazette orders since (Africa Day, Chakufwa Chihana Day, Eid al-Adha?)
     and 2026's orders are unread. Laws.Africa's commons host also serves other LIIs' consolidations past their bot
     checks (Uganda's 2023 revision): try it for each African country before blocking.
   - TN: done 2026-10-27: décret présidentiel 2021-223 (legislation-securite.tn's JORT text) and the 2026 Islamic
     days as the Mufti and the Prime Minister's office announced them (Kapitalis WP API). 2027: the same announcements.
   - BQ: Regeling feestdagen ambtenaren BES (stcrt-2019-63152, read): Bonaire 30 Apr Dia di Rincon, 6 Sep Dia di
     Himno y Bandera; Statia: day after carnival parade, 16 Nov Statia Day; Saba: day after carnival parade, first
     Friday of December Saba Day. Base list = Rechtspositiebesluit ambtenaren BES art. 37(j) (wetten.overheid.nl
     HTTP/2 error; Stb 2019-458 removed the carnival day from 37j) - for civil servants; the general rule for all
     workers (Arbeidswet BES? / Rijksdienst CN yearly list) still to read; carnival dates per island per year.
   - KE: done 2026-10-27 through the press (Kenya Law's Act behind an AWS WAF check; interior.go.ke's TLS chain
     fails): both 2026 Idds by Gazette notice (Standard, Star), s. 4's Sunday rule (kenyans.co.ke), the 2024 Mazingira
     Day (president.go.ke). Read the Act's Schedule from Kenya Law when it answers.
   - NI: done 2026-10-27: art. 66 of Ley 185 as reformed on 18 January 2026 (fourteen days), as Confidencial quotes
     it (asamblea.gob.ni 403). Art. 67's local asuetos (Managua 1 and 10 August) are a town's, not kept.
   - MS: no official 2026 list found (gov.ms site search empty; only aggregators). Retry gov.ms press releases and
     the Montserrat Gazette.
   - MH, PW, FM: MH's Public Holidays Act 1988 on PacLII (403; the austlii mirror resets) and the Register-IRI list
     (TLS chain fails, not bypassed); PW and FM only aggregators (FM's states keep their own days). Retry.
   - Gulf sites with incomplete chains (qcb.gov.qa, kln.gov.my): completed from the certificate's own issuer URL
     (scratchpad aia.sh), verification on.
   - GG: done 2026-10-27; Alderney blocked (alderney.gov.gg not answering, Guernsey Legal Resources behind Cloudflare):
     retry for its list (first Monday of August, Homecoming Day 15 December, no Liberation Day per the press).
   - IM: blocked 2026-10-27 (gov.im and legislation.gov.im reject requests, tynwald.org.im 403): retry gov.im's
     bank holidays page and the Bank Holidays Act 1989.
   - GD: Bank Holidays Act Cap. 25 read with Acts 2/2017 and 11/2025 (grenadaparliament.gd); open: whether the 2023
     bill making Carnival Tuesday a full day passed, and whether 19 October (National Heroes Day) was proclaimed for
     2025 and 2026; S.R.O. 2/2026 gives Carriacou and Petite Martinique (GD.10) 16 February 2026. Retry.
   - VN, ID, PK and others read through the press where the ministry's own page is unreachable: their sources say
     which.
   - NG: Boxing Day isn't in the Act's Schedule; the Minister declares it yearly, and 2026's wasn't declared by
     2026-10-27. Add it when it is.
   - IR: calendar.ut.ac.ir, president.ir and rc.majlis.ir don't answer. CK: no official list (island Gospel Days are regional). CW, SX: the governments' lists not found. BS:
     bahamas.gov.bs answers 403. SC: no official list. SJ: whether Norway's holiday law applies on Svalbard is
     unconfirmed. Retry each.
   - BG: justice.government.bg, gli.government.bg answer 503; the Council of Ministers made 31 December 2025 and
     2 January 2026 days off (GLI node 13797). Retry.
   - PH: national read (Proc 1006 for 2026, Proc 1427 for 2027; the Eids by Proc 1189 and 1264); BARMM's own
     (Bangsamoro Holidays Act 2023, 2026's proclamations) to read from the official texts, then write.
   - BN: no official 2026 list (jpm.gov.bn has no holiday circular; the gazette not found). AZ: Cabinet decision 362
     (2 December 2025, nk.gov.az) read for Novruz and the Eids; the Labour Code's art. 105 unread (e-qanun.az html
     403). KH: 2027's sub-decree (16 September 2026) reported, its list not read: add when read.
   - CX, CC, NF: the Administrator's bulletins (infrastructure.gov.au/sites/default/files/documents/community-
     bulletin-ci-public-holidays-2026.pdf, -cki-, and the 2027 ones A14 and A15 of 2026) exist, but the host resets
     every connection here (as fairwork.gov.au does); Norfolk's under the Norfolk Island Continued Laws (Public
     Holidays) Ordinance 2016. Retry.
   - KI: 2026 done from the Beretitenti's order of 18 December 2025 (president.gov.ki Gazettes & Instruments);
     announced to 2026. Read the Public Holidays Ordinance (Cap. 81) s. 2 (PacLII refuses) to keep its own days
     after, and add each year's order (published each December).
   - Attempts by country this session (for their blockers when every method has failed) are in the scratch log
     summarised here: NU (gov.nu circulars read to October; its law not found), AG (portal out of date; Act
     needed), ZW and MW (LII documents behind Cloudflare), VI (court's § 171(a) list read; weekend rule unread),
     IQ, LY, BT, TL, NF: sites refuse or hold no list.
   - TV: the Public Holidays Act (Cap. 4.50, 2022 Revised Edition) read at tuvalu-legislation.tv
     (/cms/images/LEGISLATION/PRINCIPAL/1937/1937-0005/1937-0005_2.pdf): Schedule and s. 2's weekend rules; National
     Children's Day is the 1st Monday after White Sunday, whose date in Tuvalu no source found gives. SB: Sucuri JS
     challenge (not circumvented).
   - Two sources found: a page's own public data list read as the page reads it (Mauritius's SharePoint list, Qatar's
     Ministry of Justice API) is fine; an API that needs a key embedded in a site's script (Andorra's BOPA) is not.
3. Prices: no country is pending (2026-10-28; `coverage/prices-countries.json`). The 22 blocked (`world.prices.blocked.<code>`,
   R-0428 to R-0449, the player told by `prices.unkept`), each with what to try again: those no programme prices and
   no survey compares (Cuba, North Korea, Venezuela, Yemen: the ICP's next round, ESCWA's work on Yemen); those whose
   office publishes no index or can't be reached (Eritrea, Turkmenistan, Nauru, Sudan, Syria, Eswatini (gov.sz
   resets the connection; its 2026 inflation reports exist), the Turks and Caicos (a Sucuri firewall), the British
   Virgin Islands (no CPI on gov.vg since its move)); those whose index doesn't span 2021 to 2025 on one footing
   (American Samoa: its folders don't open, Q4 2021 unread; the Northern Marianas: SPC's series is 2022 to 2024;
   the Marshall Islands: EPPSO's listing answers with a "humans_" cookie script, latest Q4 2023; Myanmar: the CSO's
   2012 = 100 index to June 2022 only; Saint Kitts and Nevis: the annual table's 2024 is dated 12/04/2024 and the
   ECCB answers 403; the US Virgin Islands: no 2025 review, December 2023 given on two unstated bases; South Sudan:
   releases January 2023 to May 2025; Somalia: the new CPI from 2025 isn't linked to the Mogadishu index; Zimbabwe:
   the ZWG index from April 2024 isn't linked to the ZWL series); and the Falklands, whose pound's parity with
   sterling is on falklands.gov.fk, which this environment's network doesn't allow (the owner can add it under the
   environment's Network access, Allowed domains; with it the Falklands keep the United Kingdom's level by the
   owner's ruling, as Saint Helena does). Snapshots that exist in the Internet Archive for 16 of them (AS, FK, KN,
   MM, MP, SD, SO, SS, SY, TC, TM, VE, VG, VI, YE, ZW; each named in its blocker) may now be read (the owner's ruling of 2026-10-28), once
   web.archive.org answers from this environment. The rules for adding a country stand: an index from the country's own office (`research/sources/
   prices/<CC>.json`, its register entry, then `npx tsx tools/prices/build.ts`); an office's quarters or half-years
   serve as its months do, and a month it didn't collect is left out as it leaves it out; a territory using
   another's prices by law or market keeps that country's level only by the owner's ruling (given 2026-10-28).
   Sub-national levels (the US Bureau of Economic Analysis' regional price parities, and others where a country
   publishes them) are open research for after the countries. Prices move with the years: the levels are the World
   Bank's for 2025 (2024 for four), and the game opens in 2026; carrying them forward by inflation is open (the
   World Bank's CPI series is sparse past 2024).
4. Done 2026-10-28: the proof of layer 2, `npm ci` and `npm run gate:full` in a fresh clone at `53f8e0227dfe`,
   green in 5,717 s, recorded in `registry/layers.json`. A full mutation run takes about 85 minutes here (464 static mutants rerun the whole suite; 8,284 tested), inside
   this environment's two-hour limit for a command and CI's 180 minutes (`.github/workflows/gate.yml`, raised from 60
   on 2026-10-28: every run since the world engines grew had been cancelled at 60).
5. Layer 3's research, begun 2026-10-28 while layer 2's proof ran (layer 2 is now proven, so layer 3's code may begin
   under the gate's build-order check): passports by issuing country, each in
   `research/sources/papers/passports/<CC>.json` (`papers.passports.<CC>`, R-0451 on): the ordinary passport's fees
   by age and channel, its validity, the standard processing time and the urgent services, from the passport office's
   own pages or, where those refuse this client, the law that sets them, a mission abroad's fee page, or the press
   quoting the office (cited as secondary, naming the primary). 222 researched, none pending (2026-10-28); each
   file's note says what stays open (many processing times and validities; the fee at home where only a mission's
   fee abroad was read, as Qatar, Equatorial Guinea, Eritrea, Yemen, Haiti, Afghanistan, Antigua, Syria, Tunisia and
   Zambia; fees in two currencies). Ways of reading that worked where a host refused: the institution's documents on
   another host; the state's legal database (Kazakhstan's adilet, Madagascar's CNLEGIS, Mali's SGG, Monaco's Journal,
   Bahrain's LLOC, Oman's qanoon.om, Andorra's BOPA rendered, Nicaragua's La Gaceta through its own PDF viewer,
   Suriname's scanned Gazette read from the page image); a service registry (Bulgaria's IISDA, Lithuania's MIGRIS and
   Turkmenistan's migration service rendered, Togo's service portal, Mauritania's ANRPTS); an embassy's own fee page;
   a missing intermediate certificate completed from the certificate's AIA URL, verification kept on.
   23 blocked after all five methods (`papers.passports.blocked.<CC>`, R-0614 on, notModeled `passports.unkept`):
   BO BT BY CF CG DJ EG GW IR KG KM KP LY NR PS PW SL SO SZ TC TO TV UZ (Kiribati resolved 2026-10-29). Egypt's press gives three different 2026
   fee sets and none cites the decision, so no fee is taken. A blocker resolved later (AG BL KI OM SD SY TN ZM) keeps its
   entry as the record of the earlier attempts; the researched entry decides the row. Retried 2026-10-28 without
   success: Belarus's embassies (reset), Bolivia's in Vienna (502), Bhutan (every host dead), Sierra Leone (a captcha,
   not passed), Eswatini (reset), the Pacific missions and legislation hosts. The archive method: archive.org's
   availability API answers (429 when asked often; space the calls), but fetching any web.archive.org snapshot is
   refused by this environment's egress policy (403), so the owner's archive ruling waits on web.archive.org being
   allowed under the environment's Network access. Snapshots that exist and would likely unblock: slid.gov.sl
   (2026-02-11), mfa.gov.bt/faqs (2026-09-24), gov.sz's travel documents page (2026-08-15),
   falepilipathway.gov.au/support-tuvalu (2026-10-07), interieur.gouv.cg (2025-12-06), the Palestinian Cabinet's
   service guide (2025-11-02), immigration.gov.so/services (2026-08-31), naenara.com.kp (2026-10-17).
   Every blocker (222 of them, all engines) was tried again on 2026-10-29 and its attempts appended in the register:
   each host it cites probed again (those still failing recorded so), the World Bank's PPP series checked again for
   the price levels (no new values), and each blocker's snapshot asked of web.archive.org (every connection resets:
   the host has to be added under the environment's Network access, Allowed domains, before the owner's archive
   ruling can be used). Resolved: Kiribati's passports (the ministry's brochure, read through the fetch tool) and
   Liberia's holidays (the observance laws as the Ministry of Information's 2025-2026 proclamations quote them,
   Sunday holidays kept on the Monday as proclaimed, New Year's Day and Christmas from WageIndicator citing the
   embassy's list). Tonga's 2011 fee regulations are on PacLII, which answers with a Cloudflare block.
   Identity cards and citizenship: done 2026-10-29 (above); the cards' null fees and citizenship's post-2024 reforms
   to try again. Next: visas, residence and work permissions (each an engine with its own matrix), then the banks.
6. Before the game is called done (layer 7, verification), at the owner's word on 2026-10-29: the gate enforces the
   owner's Title Case rule (`.claude/rules/title-case.md`, taken from the first SLATE, `montrealroots/1221`). Port
   `titleCaseLabel` and `readsAsProse` from 1221's `src/engine/core/text.ts` into `src/core/text/`, and make the
   text check fail every label (a catalog line, a heading, button, tab or title, and a name from the data shown as a
   label) that isn't Title Case, as 1221's `tools/title-case.mjs --check` and `tools/label-sweep.mjs` did, with
   their exceptions (prose, acronyms, internal capitals, digit-led words, real names as their owners spell them).
   The game isn't done until this check is in the gate and green.

## Verification evidence

- Layer 2's proof: `npm ci` then `npm run gate:full` in a fresh clone of the branch at `53f8e0227dfe`, green in
  5,717 s on 2026-10-28: toolchain (19 packages), owner-docs (54), build-order (282 source files), text-inventory
  (29 lines), research-register (446 entries), typecheck, lint, 1,305 of 1,305 tests, feature-matrix, coverage (12
  engines, 0 rows pending), handoff, audit (0 advisories), mutation 100.00% (8,284 of 8,284 killed, static mutants
  included), generated. The first attempt, at `626a65a`, was red on the audit (`qs`) and was cut off by this
  environment's one-hour limit for a background command during mutation; both are resolved below.
- Layer 1's proof: `npm ci` then `npm run gate:full` in a fresh clone of the branch at `dd447a897c68`, green in
  605 s: the same checks as below, with 4,479 of 4,479 mutants killed (the frame's slice-name rule added six).
- Layer 1, before its proof: `npm run gate:full` green in the working tree on 2026-10-26 in 595 s: toolchain (19
  packages), owner-docs (54), build-order (19 source files), text-inventory (19 lines, all placeholder),
  research-register (31), typecheck, lint, 1,124 of 1,124 tests, feature-matrix, coverage (6 engines, 0 rows
  pending), handoff, audit (0 advisories), mutation 100.00% (4,473 of 4,473 mutants killed, the gate's and the
  core's together, static mutants included), generated. The proof itself is the same run in a fresh clone.
- Layer 0's proof: `npm ci` then `npm run gate:full` in a fresh clone of the branch at `2ff094d439ad`, green in 289 s:
  toolchain (18 packages), owner-docs (54 documents), build-order, text-inventory, research-register, typecheck,
  lint, 202 of 202 tests, feature-matrix, coverage, handoff, mutation 100.00%, generated.
- Mutation testing over the gate (gate/**/*.ts, the lint plugin, the falsify helper), static mutants included:
  2,167 killed, 0 survived, 0 without coverage, 13 excluded by in-line `Stryker disable` comments, each stating why
  the mutant can't change an outcome (a fallback for a file just listed, an empty catch that returns undefined just
  the same, a sort this filesystem makes redundant but others need). The score went 84.02% (first real run) to
  97.70% to 99.67% to 100%; the survivors on the way were tests asserting too little (fixed by exact findings and
  whole generated documents), redundant code (simplified away), one real imprecision in the shown-value lint rule
  (it stopped looking at the first non-JSX parent; it now looks at every enclosing element), and one stale default.
- The falsifier's ledger and Vitest's report agree on test names, shown end to end by a test that runs a real Vitest
  suite in a child process; a falsifier recorded in a test that then fails is not counted.

## Assumptions

- The package moves under `docs/` (BUILD-ORDER layer 0 says so); `CLAUDE.md` stays at the root, where Claude Code
  reads it, with its paths updated. The first SLATE's exact tool versions aren't in the package, so the toolchain is
  the newest release of each tool that was at least two weeks old on 2026-10-26 and compatible with the rest:
  TypeScript 6 (typescript-eslint doesn't support 7), Vitest 4 (Stryker supports Vitest 5 only from 10.1.0,
  released 2026-10-23). A security fix outranks the two-week rule: Vitest 4.1.12 (2026-10-15) is in for that.
- jsdom and Testing Library are left out until layer 5 needs them (jsdom 30 needs Node 22.22.2; this machine has
  22.22.0): a tool nothing uses isn't installed.
- "Every commit runs it; a red gate blocks the next layer": a red gate stops the commit; an incomplete one (declared
  work not done, such as pending coverage rows) is let through and recorded in the commit message, so research can
  be checkpointed; only a green full gate proves a layer.
- The gate checks the working tree, not only what's staged; stage everything meant for the commit.
- Feature anchors bind to the next line of code when the anchor's line starts as a comment; a line that starts with
  a block comment and then holds code counts as a comment line.
- The axis sources (`src/world/gazetteer/countries.json`, `place-ids.json`) are where layer 2 is expected to put the
  gazetteer; if layer 2 settles elsewhere, `registry/axes.json` moves with it.

- Layer 1's decisions, each reversible and each the plainer reading of the package:
  - This build keeps its lives under its own keys and database (`slate.life.N`, `slate.copy.N`, IndexedDB
    `slate-lives`), not the first SLATE's (`slate.save.N`, database `slate`): those saves are of a world model this
    build doesn't have (Yale, the career, the body), so it can't open them, and it leaves them untouched. With that,
    the first SLATE's "moving store" (which carried its local-storage saves into IndexedDB) has nothing to move and
    isn't carried.
  - The first schema is the only one, so nothing is older: the "older version" branch, bringing a life forward, and
    the copy made before it (the contract's `backup()`) arrive with the second schema version, when something calls
    them. A life from a newer build is refused, so it stays safe.
  - The save's meta holds the life's id, its place, the schema and app versions, the playtime, and `card` (the
    words the slots screen shows, written by the layers that know them). The world's moment is read from the life
    itself, not copied into the meta.
  - A write never makes an unreadable life the copy (the first SLATE's write copied whatever was there, so a damaged
    life could take a good copy's place); letting a life go already followed that rule.
  - The server's checks keep the shape, size, version, place, forward-progress and once-only rules; the ledger
    balance and the other-life-record checks come back with banking (layer 3), when a ledger exists. Timestamps
    nothing read (`checked_at`, `deleted_at`, `applied_at`) aren't written. The three functions are written as
    handlers over the slice of the Base44 SDK they use; the Deno entry files that wrap them are deployment, which
    waits on the owner's word.
  - Every refusal reaches the player as a line of the catalog, the server's included: the server answers with a
    line id, and the app says the line.
  - The startup screen's four stages are its engine and are built with the screen (layer 5), on this store.
  - Each notice kind will need its line in the catalog; the gate check for that comes with the first notice.
- `fake-indexeddb` 6.2.5 (2025-11-07) is the only package layer 1 added, to test the IndexedDB store against real
  IndexedDB semantics in Node.

- Layer 2's decisions so far:
  - The map's count of places is 171,654 (GeoNames of 2026-10-26), by the owner's word that day; it replaces the
    170,911 the locked package names (the first SLATE's snapshot). `registry/axes.json` records the decision, and
    the package's documents are left as the owner wrote them.
  - Six of the 252 have no populated place of their own: Antarctica, Bouvet Island, Heard Island and McDonald
    Islands, the United States Minor Outlying Islands, and two states that no longer exist and GeoNames still lists,
    Serbia and Montenegro and the Netherlands Antilles. They stay in every list (the owner's 252); the screens will
    let a country with no towns be chosen as itself.
  - The gazetteer takes no currency from GeoNames, whose list still gives Bulgaria the lev a year after the euro: a
    country's currency comes from ISO 4217 (R-0026) when the money engines need it.
  - The seasons are astronomical (they begin at the equinoxes and solstices, the south the opposite of the north,
    the equator reckoned with the north): the season and the daylight "from the town's latitude and the date", as
    KEEP entry 18 has it. The tropics' wet and dry seasons belong to the climate, with the weather.
  - A declaration made again with the same shape (a module loaded again, as Vite's hot reload and the test runner
    do) replaces itself; a different one under a taken name is still refused. Notice kinds, being names only, may be
    declared again.
  - The clock reads to the last day but one of 2200 (the time engine's span ends with 2200, and a day's reading needs
    the next midnight).
  - A station given no place on Earth in the source (three, with the placeholder -98.6, -986.6) is left out; a
    station whose Member covers several of the gazetteer's countries is placed by the nearest town among them (so
    Antigua's misplaced airport stays Antigua's).
  - Module-level tables in the compilers carry a Stryker disable: Stryker 10.0.0 doesn't load a module again for
    each of their mutants, so it can't see them; the byte-for-byte tests hold them (shown by changing one by hand).
  - GeoNames' licence (CC BY 4.0) asks for credit; a line saying where the places come from goes on a screen in
    layer 5.

## Blockers and open issues

- The tests used to leave each temporary directory they made (the gate's fixtures, the tools' changed-file checks)
  in the system's temporary directory; with mutation runs they filled this container's disk (about 189,000
  directories, 29 GB, under `/tmp/slate-*`). Fixed on 2026-10-26: `tests/tmp-setup.ts` gives each run one directory of
  its own and removes it when the run ends. The leftovers from before were not removed: the session's permissions
  don't allow a sweep of `/tmp`, and that is the owner's to allow (`rm -rf /tmp/slate-*` clears them). On
  2026-10-27 they left 443 MB free and a gate run failed for want of disk (ENOSPC); deleting the session's own
  scratch files brought it to 843 MB, and the sweep was refused again.
- Resolved 2026-10-26, the owner's two open issues:
  - The `qs` advisories (GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g), reached through Stryker's
    `typed-rest-client`, which pins `qs` 6.15.1 exactly: fixed by overriding `qs` to 6.16.0, the first release
    outside all three ranges. The audit then also named two in Vitest 4.1.11's `@vitest/mocker`
    (GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp), fixed by Vitest 4.1.12. `npm audit`: 0 vulnerabilities, and the full
    gate now runs it, so a new advisory turns the gate red.
  - npm 10's crash (`Cannot read properties of null (reading 'edgesOut')`): its cause was Vite 8's optional peer
    `@vitejs/devtools`, whose own peers ask for Vitest; with no lockfile, npm 10 reached for Vitest 5 there and
    crashed in its peer-set resolver. Overriding `vitest` to its own pin ties every such request to 4.1.12; a fresh
    `npm install` with no lockfile now succeeds under npm 10.9.4, as do `npm ci` and adding a package.
- Resolved 2026-10-28, found by layer 2's first proof run: `npm audit` named GHSA-6pq8-jhm2-2vcw (`qs` up to 6.16.0,
  a TypeError thrown by `qs.stringify` with `arrayFormat: 'comma'`), fixed by overriding `qs` to 6.16.1. The same run
  was stopped at this environment's two-hour limit for a command with mutation testing at 82%: the suite, instrumented,
  took 217 s, and each static mutant reruns all of it. The runs over every place of the map (about 45 s of the 70 s
  suite) moved to `*.places.test.ts` files, which the gate's test step runs on every commit and mutation testing leaves
  out, as it does the zone oracles (`vitest.stryker.config.ts`); the coverage rows and `registry/engines.json` cite
  them by their new names. The full run without them took 83.5 minutes and left four
  mutants in `src/world/weather/weather.ts` that only the every-place run had caught, by timing out: the pool cache
  and the nearest-station search's early stop, which change speed, not results. Two unit tests now hold them (the
  same pool comes back; a thousand stations are found from fewer than twenty looked at).
- Stryker 10.0.0 reports a mutant that breaks a test file at load as surviving rather than killed (fixed in 10.1.0);
  `gate/test/eslint-plugin.test.ts` asserts the plugin's shape apart from the rule cases so such mutants are caught.

## Questions for the owner

Answered 2026-10-28 (prices): a territory with no price-level measure of its own (no World Bank or ICP level, no
spatial survey) takes the level of the country whose currency and market it shares, as is, named per territory (the
owner chose "Parent's level as is" over carrying the parent's level by the territory's own index, or blocking them).
Answered 2026-10-28 (archives): "You can use archived screenshots and also keep going." Archived copies of a
source (the Wayback Machine's snapshots) may be read, cited with the snapshot's own URL and its capture date, the
live page's URL in the title. Answered 2026-10-28: Western Sahara keeps Morocco's holidays everywhere. Noted
2026-10-28: the auto-mode classifier ruled that opening in a browser a page that refuses this game's requests is
bot-check circumvention, so no source is read that way (the Faroes' was withdrawn). Answered 2026-10-26: the map's count of places is today's GeoNames release (171,654); the start date
is 1 January 2026 (the owner: "January 1st, 2026."), asked when the holidays and prices engines reached it, so
both are researched as in force for 2026 and carried forward by their rules. Still to be asked when the build
reaches them: the premise's detail, home on the first morning, Sleep as a clock action.
