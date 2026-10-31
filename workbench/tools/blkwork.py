#!/usr/bin/env python3
# blkwork.py: write the work engine's blocker specs to blkw/<CC>.json (badd2.py then registers them)
import json, os, sys
D = '2026-10-29'
OUT = '/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad/blkw'
os.makedirs(OUT, exist_ok=True)
ARCHIVE = ('archive', "The Wayback Machine (web.archive.org) for the authority's pages", "This environment's egress refuses web.archive.org; no snapshot could be read.")
B = {
 'LT': ("What Lithuania asks of a foreign performer to work there: the permit and any exemption", [
  ('institution', 'Migration Department (migracija.lrv.lt) news on the 2024 amendments; Employment Service (uzt.lt)', 'Both answer this client with a bot challenge (403), by curl and by fetch.'),
  ('official-register', 'Register of Legal Acts (e-tar.lt) and the Seimas (e-seimas.lrs.lt): the Law on the Legal Status of Aliens, art. 58', 'Both answer with a bot challenge; the lrv.lt drafts of the 2023-2025 amendments likewise.'),
  ('web-search', "'Law on the Legal Status of Aliens 58 straipsnis atlikėjai', 'leidimas dirbti nereikalingas atlikėjai'", 'Only summaries saying art. 58 lists the exemptions and that the 2024 amendments name performers among them, without the conditions.'),
  ('trade-press', "'Lithuania foreign performers work permit exemption concerts'", "Law-firm notes and news on proposed entry bans; none quotes the performers' exemption or its conditions.")]),
 'JE': ("What Jersey asks of a performer from elsewhere to work there", [
  ('institution', 'Government of Jersey (gov.je) work permit and immigration pages', "The site's firewall blocks this client (Web Page Blocked, 500)."),
  ('official-register', 'Jersey Legal Information Board (jerseylaw.je): the Immigration Rules; States Assembly report R.75/2024 (statesassembly.gov.je)', 'jerseylaw.je answers 500, the Assembly 403.'),
  ('web-search', "'Jersey Immigration Rules permitted paid engagement', 'gov.je work permit entertainers'", "Only summaries of the 2024 move of permitted paid engagements into the Standard Visitor route, not the rule's text."),
  ('trade-press', "'Jersey entertainers work permit': Mondaq and Carey Olsen guides", 'Mondaq refuses this client (403); the 2022 law-firm guide predates the 2024 change.')]),
 'FO': ("What the Faroe Islands ask of a foreign performer to work there", [
  ('institution', 'Útlendingastovan (utlendingastovan.fo), which took over Faroese permits from 1 September 2024', 'The site answers this client 403 on every page tried.'),
  ('official-register', "SIRI's former Faroese pages on nyidanmark.dk (exemption from the work permit)", 'Removed since the Faroese authorities took over (404).'),
  ('web-search', "'Faroe Islands work permit exemption artists musicians three months'", 'Only the removed SIRI pages and third-party summaries of them.'),
  ('trade-press', "'Faroe Islands musicians work without permit festival'", 'Festival coverage only; nothing on permits.')]),
 'VE': ("What Venezuela asks of a foreign performer to work there", [
  ('institution', 'SAIME and the Foreign Ministry visa catalogue', "No artists' requirements published that this client could find."),
  ('official-register', 'Ley de Extranjería y Migración (2004), the OAS copy', 'The OAS host refuses this client (403).'),
  ('web-search', "'Venezuela visa transeúnte artista', 'SAIME requisitos artistas extranjeros'", 'Third-party summaries naming the Transeúnte Laboral visa; nothing on performers.'),
  ('trade-press', "'Venezuela foreign artists work visa'; the Colombian consulate's guide for immigrants in Caracas", "The consulate's guide refuses this client (403); no press source names the performers' route.")]),
 'NI': ("What Nicaragua asks of a foreign performer to work there", [
  ('institution', 'Dirección General de Migración y Extranjería (migob.gob.ni)', 'No page on foreign artists found.'),
  ('official-register', 'Ley 761 de Migración y Extranjería; Disposición Técnica 016-2006 (leybook.com copy)', "Only the 2006 tax disposition on foreign artists' shows was read; the migration rule wasn't found."),
  ('web-search', "'Nicaragua artistas extranjeros permiso migración'", 'Secondary summaries, and a 2024 report that the Interior Ministry regulates shows, without the migration route.'),
  ('trade-press', "'La Prensa Nicaragua Ministerio del Interior espectáculos artistas extranjeros requisitos'", "Requirements for organisers only; foreigners' own not detailed.")]),
 'SA': ("What Saudi Arabia asks of a foreign performer to work there", [
  ('institution', 'General Entertainment Authority (gea.gov.sa) and its Entertainment Portal (enter.sa)', 'gea.gov.sa refuses this client (403); enter.sa loads by script with nothing on visas.'),
  ('official-register', 'Ministry of Foreign Affairs visa portal (visa.mofa.gov.sa)', 'No performer category found by this client.'),
  ('web-search', "'Saudi Arabia entertainment visa performers', 'event visa artists Saudi'", "Event visas for visitors and the GEA's performer registration counts, not the performer's own route."),
  ('trade-press', "'Saudi performers registration Entertainment Portal': Arabian Business, Al Tamimi", "Arabian Business refuses this client (403); Al Tamimi's page answers 406.")]),
 'QA': ("What Qatar asks of a foreign performer to work there", [
  ('institution', 'Ministry of Interior and Hukoomi visa services', 'No current performer route found.'),
  ('official-register', "Qatar's laws portal (almeezan.qa) for the entry and residence law", 'Not reached by this client.'),
  ('web-search', "'Qatar temporary work visa performers events'", 'A 2019 event e-visa and a temporary work visa restricted in 2022 to government sectors; neither confirmed for performers.'),
  ('trade-press', "'Qatar event visa artists'; Clyde & Co's mobilisation guide", "Dated guides; none names the performers' route now.")]),
 'BH': ("What Bahrain asks of a foreign performer to work there", [
  ('institution', 'Labour Market Regulatory Authority (lmra.gov.bh): Order No. 2 of 2013 on temporary works of up to fifteen days', 'The LMRA refuses this client (403), by curl and by fetch.'),
  ('official-register', 'Nationality, Passports and Residence Affairs (npra.gov.bh) visas', 'Not reached.'),
  ('web-search', "'LMRA temporary work permit artists performers'", "Summaries of the 2013 order (occasional work at festivals up to fifteen days outside the LMRA law) and a 2017 note that the temporary permit was discontinued; the current text not read."),
  ('trade-press', "'Bahrain temporary work permits no longer available' (Fragomen, 2017)", 'Dated; says short-term workers now take a shorter work visa and residence permit.')]),
 'KY': ("What the Cayman Islands ask of a visiting performer to work there: the temporary work permit WORC has required since November 2022", [
  ('institution', 'Workforce Opportunities and Residency Cayman (worc.ky, my.egov.ky/web/worc): temporary work permit pages and FAQs', 'The site and its FAQs name the Temporary Work Permit form but carry no page on performers that this client could find.'),
  ('official-register', 'Cayman Islands legislation (Immigration (Transition) Regulations; SL 10 of 2023 on caymanlawschool.ky)', 'The copy of SL 10 of 2023 answers this client 403; the regulations themselves weren\'t reached.'),
  ('web-search', "'WORC visiting entertainers temporary work permit', 'Cayman temporary work permit performers police clearance'", 'Only press reports of WORC\'s announcement of 21 November 2022, not WORC\'s own text.'),
  ('trade-press', 'Cayman Compass (21 November 2022, 9 February 2023) and Cayman News Service (22 November 2022)', 'The Compass answers 403 and the News Service 503 or a reset connection, by curl and by fetch.')]),
 'TK': ("What Tokelau asks of a performer who isn't a New Zealand citizen to work there: the Tokelau Immigration Regulations 1991's work permit", [
  ('institution', "Tokelau's government (tokelau.org.nz) and the Office of the Administrator", 'No page on permits was found by search; the regulations are the source.'),
  ('official-register', 'New Zealand Legislation (legislation.govt.nz): the Tokelau Immigration Regulations 1991, both URL forms', 'The site answers this client with an empty 202 challenge by curl and 403 by fetch.'),
  ('web-search', "'Tokelau Immigration Regulations work permit', 'tokelau.org.nz permit to enter'", "Search summaries of the regulations (a work permit for up to three months, New Zealand citizens free), not the text."),
  ('trade-press', 'NZLII and PacLII copies of the regulations (tir1991325.pdf; ir1991187)', 'Both refuse this client (403).')]),
 'NU': ("What Niue asks of a foreign performer to work there: the Immigration Act 2011's work permit", [
  ('institution', 'Government of Niue (gov.nu): information, agencies and notice pages', 'No immigration or permit page found on the site.'),
  ('official-register', 'PacLII copies of the Immigration Act 2011 and Immigration Regulations 2011 (pacliirms.austlii.edu.au, paclii.org)', 'The hosts refuse this client (connection reset, 403).'),
  ('web-search', "'Niue work permit immigration requirements', 'Niue Chief Immigration Officer sponsor'", 'Only commercial summaries (a sponsor, a bond, up to 36 months), not the Act.'),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'CK': ("What the Cook Islands ask of a foreign performer to work there", [
  ('institution', 'Ministry of Foreign Affairs and Immigration (mfai.gov.ck, immigration.gov.ck): visa and permit criteria, FAQs, forms', 'The criteria and FAQ pages answer this client 403; the 2023 visas-and-permits PDF is gone (404).'),
  ('official-register', 'Entry, Residence and Departure Act 1971-72 and Immigration Act 2021 on PacLII', 'PacLII refuses this client (403).'),
  ('web-search', "'Cook Islands work permit entertainers', 'Cook Islands Immigration short-term work permit'", "A 2021 report of short-term specialist permits up to six months; nothing on performers."),
  ('trade-press', 'PINA and Islands Business on the 2021 policy revision', "Dated, and silent on performers and on New Zealand citizens' position.")]),
 'AS': ("What American Samoa asks of a performer from elsewhere to work there: Title 41's employment of aliens", [
  ('institution', "American Samoa's Attorney General and Immigration Office", 'No page of theirs on work authorisation found; press reports only of entry-permit changes.'),
  ('official-register', 'American Samoa Code Annotated Title 41 (asbar.org, ASCA 41.1005 Employment of aliens; paclii.org caai306)', 'asbar.org answers this client 403 with no body; PacLII 403.'),
  ('web-search', "'American Samoa Code 41.1005 employment of aliens', 'American Samoa work permit entertainers'", 'Commercial summaries of a registration card or the Attorney General\'s waiver, not the text, and nothing on United States citizens from elsewhere.'),
  ('trade-press', 'Samoa News on the Attorney General\'s entry policies', 'Entry permits only; no rule for performers or employment.')]),
 'TJ': ("What Tajikistan asks of a foreign performer to work there: the work permit under Government Resolution No. 529 of 2008 as amended", [
  ('institution', 'Ministry of Labour, Migration and Employment (mehnat.tj) and the Migration Service', "mehnat.tj's law files answer this client with a failed tunnel (502)."),
  ('official-register', "The Rules for issuing work permits (Resolution No. 529) and the Law on Labour Migration, on base.spinform.ru and FAOLEX", 'Only the 2013 amending resolution and older texts found; the current rules not read.'),
  ('web-search', "'Таджикистан разрешение на работу иностранцам артисты', 'Правила выдачи разрешения на работу 529'", 'Summaries of the 2008 rules and the Migration Service\'s status; nothing on performers or the current route.'),
  ('trade-press', 'OSCE migration reports and Central Asian press', 'Dated (2010–2013), on Tajik migrants abroad rather than foreigners in Tajikistan.')]),
 'TM': ("What Turkmenistan asks of a foreign performer to work there: the State Migration Service's permit under the Law On Migration", [
  ('institution', 'State Migration Service of Turkmenistan', 'No page on permits for foreigners found by this client.'),
  ('official-register', 'Law On Migration No. 290-IV (as of 11 April 2026) on prg.kz; Law On Employment (2016) on FAOLEX', 'The migration law is behind a login on prg.kz; the employment law (art. 23) says only that foreign labour is used on quotas set by the Cabinet.'),
  ('web-search', "'Туркменистан разрешение на трудовую деятельность иностранцам', 'Государственная миграционная служба Туркменистана иностранная рабочая сила'", 'Summaries of the 2013 amendments (permits from the State Migration Service, local workers first), not the text.'),
  ('trade-press', 'Press results among the same search', 'None on the rule.')]),
 'KW': ("What Kuwait asks of a foreign performer to work there", [
  ('institution', 'Kuwait Government Online (e.gov.kw): the Ministry of Information party permit service; Public Authority for Manpower', 'e.gov.kw answers this client 403; no PAM page on performers found.'),
  ('official-register', 'Ministerial Resolution No. 4 of 2025 on work permit fees; Ministry of Interior visa rules', 'Not reached; known only from consultancies\' summaries.'),
  ('web-search', "'Kuwait work permit artists performers', 'Kuwait entertainment visa singers'", 'General Article 18 work permit guides and a 2021 report of visit-visa conversion; nothing on performers.'),
  ('trade-press', 'Kuwait Times and Gulf News results among the same search', 'Permit cancellations and a 2021 visit-visa conversion; no rule for performers.')]),
 'PS': ("What Palestine asks of a foreign performer to work there", [
  ('institution', 'Palestinian Ministry of Labour (mol.pna.ps)', 'The site doesn\'t answer this client.'),
  ('official-register', 'Palestinian Labour Law No. 7 of 2000 (the foreign workers provisions)', 'No official copy reached; the Israeli entry permit\'s role not established either.'),
  ('web-search', "'Palestine Ministry of Labour work permit foreigners', 'Palestinian Labour Law foreign workers article'", 'A commercial guide only; no official text.'),
  ('trade-press', 'Press results among the same search', 'None on the rule.')]),
 'SY': ("What Syria asks of a foreign performer to work there", [
  ('institution', 'Ministry of Social Affairs and Labour (mosal.gov.sy)', 'The site answers 503.'),
  ('official-register', 'Syrian Labour Law No. 17 of 2010, foreigners\' employment provisions', 'No official copy reached.'),
  ('web-search', "'Syria work permit foreigners Ministry of Social Affairs and Labour', 'Syria foreign artists permit'", 'A trade council profile saying only that the Ministry\'s permission is needed; dated.'),
  ('trade-press', 'Press results among the same search', 'None on the rule.')]),
 'YE': ("What Yemen asks of a foreign performer to work there", [
  ('institution', 'Ministry of Social Affairs and Labour (mosal.gov.ye)', 'The site doesn\'t answer this client.'),
  ('official-register', 'Yemeni Labour Code No. 5 of 1995, foreign workers\' provisions', 'No official copy reached.'),
  ('web-search', "'Yemen work permit foreigners Labour Code Ministry of Social Affairs and Labour'", 'An ILO copy of the 1995 Labour Code, which no longer loads (404), and commercial summaries; nothing current, the divided administration unaddressed.'),
  ('trade-press', 'Press results among the same search', 'Saudi Arabia\'s rules for Yemenis, not Yemen\'s for foreigners.')]),
 'BT': ("What Bhutan asks of a foreign performer, Indian nationals included, to work there", [
  ('institution', 'Department of Immigration (doi.gov.bt): work permit pamphlet and checklist; Ministry of Foreign Affairs visa pages (mfa.gov.bt)', 'Both hosts drop this client\'s connection (reset, tunnel closed).'),
  ('official-register', 'Regulation on Foreign Workers; Immigration Act of Bhutan 2007', 'No copy reached.'),
  ('web-search', "'Bhutan foreign workers work permit Indian nationals', 'Department of Labour recruitment approval Bhutan'", 'Search summaries of the Department of Immigration\'s checklist (Department of Labour approval, an employment entry permit for Indians), not the pages themselves.'),
  ('trade-press', 'The Bhutanese and Kuensel on foreign workers', 'A 2016 National Council report on construction workers; nothing on performers.')]),
 'PK': ("What Pakistan asks of a foreign performer to work there", [
  ('institution', "Ministry of Interior and the Pakistan Online Visa System's categories; consulates' visa pages", 'No performer or entertainment category found; a consulate lists only film and documentary teams on the Ministry of Information\'s approval.'),
  ('official-register', 'Foreigners Act 1946 and the visa policy notifications', 'Nothing on performers found.'),
  ('web-search', "'Pakistan visa foreign artists performers', 'Interior Ministry NOC concert foreign singer'", 'Reports from 2012 to 2015 of Interior Ministry NOCs refused for Indian performers; no current rule.'),
  ('trade-press', 'Express Tribune and Dawn on foreign performers\' NOCs', 'Dated reports of individual refusals.')]),
 'MV': ("What the Maldives ask of a foreign performer to work there, and whether entertainers' work visas are issued now", [
  ('institution', 'Maldives Immigration and the Ministry of Economic Development\'s Xpat Online', 'No page on entertainers\' work visas found.'),
  ('official-register', 'Employment Act 2008 and the expatriate employment regulations', 'Not reached; nothing on entertainers.'),
  ('web-search', "'Maldives work visa foreign entertainers musicians resort'", 'News that visas for foreign musicians and entertainers were halted under a former administration and that the tourism industry asked in 2024 to restore them; nothing current.'),
  ('trade-press', 'The Edition, Adhadhu, PSM News (2021–2024)', 'The halt, the industry\'s appeal and the Musicians\' Union\'s opposition; no decision since.')]),
 'AF': ("What Afghanistan asks of a foreign performer to work there", [
  ('institution', 'Ministry of Labour and Social Affairs and the Ministry of Foreign Affairs\' visa pages', 'No current page on foreign workers reached.'),
  ('official-register', 'Regulation on the employment of foreign nationals (2015 and after)', 'No current text found; the authorities\' restrictions on music since 2021 left unaddressed by any rule found.'),
  ('web-search', "'Afghanistan work permit foreigners Ministry of Labour and Social Affairs'", 'A Kabul law firm\'s note on the Ministry\'s one-year permit and a 2024 report of permits issued to foreigners; nothing reconciling a performer\'s route with the authorities\' restrictions on music since 2021.'),
  ('trade-press', 'Press results among the same search (Daryo, 2024)', 'Permit counts only.')]),
 'BN': ("What Brunei asks of a foreign performer to work there", [
  ('institution', 'Department of Labour (labour.gov.bn) and the Immigration and National Registration Department', 'No page on performers or a performer\'s pass found.'),
  ('official-register', 'Employment Order 2009 and the Immigration Act (Chapter 17)', 'No official copy reached that names performers.'),
  ('web-search', "'Brunei work permit performers', 'Brunei foreign worker licence entertainers concert'", 'Commercial guides on the labour quota and foreign worker licence; nothing on performers.'),
  ('trade-press', 'Press results among the same search', 'None on the rule.')]),
 'MM': ("What Myanmar asks of a foreign performer to work there", [
  ('institution', 'Ministry of Labour and the Ministry of Immigration and Population', 'No current page on foreigners\' work authorisation reached.'),
  ('official-register', 'Employment and Skill Development Law and foreigners\' registration rules', 'Nothing on performers found; the post-2021 administration\'s rules unaddressed.'),
  ('web-search', "'Myanmar work permit foreigners 2025 Ministry of Labour foreign artists'", 'A 2017 guide saying Myanmar then lacked a comprehensive work permit system, a 2026 HR guide and reports of a draft law; nothing settled or official.'),
  ('trade-press', 'Frontier Myanmar and Open Development Mekong results among the same search', 'Reports of draft foreigner laws; not their outcome.')]),
 'TL': ("What Timor-Leste asks of a foreign performer to work there", [
  ('institution', 'SEFOPE and the Immigration Service (migracao.gov.tl)', 'SEFOPE\'s pages cover sending Timorese workers abroad; no inbound work visa page found.'),
  ('official-register', 'Law No. 11/2017 on Immigration and Asylum (work visa provisions)', 'No official copy reached.'),
  ('web-search', "'Timor-Leste work visa foreigners SEFOPE', 'Timor-Leste working visa requirements'", 'Consumer and commercial guides only.'),
  ('trade-press', 'Tatoli on foreign workers', 'Outbound labour programmes only.')]),
 'KP': ("What North Korea asks of a foreign performer to work there", [
  ('institution', 'DPRK government sites (naenara.com.kp)', 'Not reachable from this environment and carrying no immigration rules.'),
  ('official-register', 'DPRK Law on Entry and Exit of Foreigners', 'No text with work provisions found.'),
  ('web-search', "'North Korea foreign performers visa DPRK foreigners employment law'", 'NK News on the 2011 Foreign Investment Employment Law and a visa guide; nothing on performers.'),
  ('trade-press', 'NK News results among the same search', 'Employment law for foreign entities, not a performer\'s route.')]),
 'WS': ("What Samoa asks of a foreign performer to work there: the Immigration Act 2020's employment visa", [
  ('institution', 'Samoa Immigration (samoaimmigration.gov.ws)', "The site doesn't answer this client."),
  ('official-register', 'The immigration and labour statutes on PacLII (paclii.org, pacliirms.austlii.edu.au)', 'PacLII refuses this client (403 or a reset connection).'),
  ('web-search', "'Samoa Immigration Act 2020 employment visa entertainers', 'Samoa work permit performers'", 'Commercial guides only; no official text on a performer\'s route.'),
  ('trade-press', 'Press results of the same searches (RNZ Pacific, regional papers)', 'Nothing on the rule itself.')]),
 'TO': ('What Tonga asks of a foreign performer to work there', [
  ('institution', 'Ministry of Internal Affairs / Immigration (mic.gov.to)', "The site doesn't answer this client."),
  ('official-register', 'The immigration and labour statutes on PacLII (paclii.org, pacliirms.austlii.edu.au)', 'PacLII refuses this client (403 or a reset connection).'),
  ('web-search', "'Tonga work permit entertainers performers', 'Tonga immigration work permit'", 'Commercial guides only; no official text on a performer\'s route.'),
  ('trade-press', 'Press results of the same searches (RNZ Pacific, regional papers)', 'Nothing on the rule itself.')]),
 'KI': ('What Kiribati asks of a foreign performer to work there', [
  ('institution', 'Kiribati Immigration (immigration.gov.ki)', "The site doesn't answer this client."),
  ('official-register', 'The immigration and labour statutes on PacLII (paclii.org, pacliirms.austlii.edu.au)', 'PacLII refuses this client (403 or a reset connection).'),
  ('web-search', "'Kiribati work permit performers', 'Kiribati immigration work permit fee'", 'Commercial guides only; no official text on a performer\'s route.'),
  ('trade-press', "RNZ Pacific's report of a Samoan circus told on arrival in Kiribati to pay for work permits for each performer", 'The report doesn\'t reach this client (502); known only from a search summary.')]),
 'TV': ('What Tuvalu asks of a foreign performer to work there', [
  ('institution', 'Tuvalu Immigration', 'No site reachable by this client.'),
  ('official-register', 'The immigration and labour statutes on PacLII (paclii.org, pacliirms.austlii.edu.au)', 'PacLII refuses this client (403 or a reset connection).'),
  ('web-search', "'Tuvalu work permit foreigners', 'Tuvalu immigration employment'", 'Commercial guides only; no official text on a performer\'s route.'),
  ('trade-press', 'Press results of the same searches (RNZ Pacific, regional papers)', 'Nothing on the rule itself.')]),
 'NR': ('What Nauru asks of a foreign performer to work there', [
  ('institution', 'Government of Nauru (naurugov.nr)', "The site doesn't answer this client."),
  ('official-register', 'The immigration and labour statutes on PacLII (paclii.org, pacliirms.austlii.edu.au)', 'PacLII refuses this client (403 or a reset connection).'),
  ('web-search', "'Nauru work permit foreigners', 'Nauru immigration business visa work'", 'Commercial guides only; no official text on a performer\'s route.'),
  ('trade-press', 'Press results of the same searches (RNZ Pacific, regional papers)', 'Nothing on the rule itself.')]),
 'FM': ('What the Federated States of Micronesia ask of a foreign performer, a United States citizen included, to work there', [
  ('institution', "FSM national government (gov.fm) and the states' labour offices", "The national site carries no work permit page; the states' offices have none found."),
  ('official-register', 'The immigration and labour statutes on PacLII (paclii.org, pacliirms.austlii.edu.au)', 'PacLII refuses this client (403 or a reset connection).'),
  ('web-search', "'FSM nonresident work permit', 'Micronesia foreign worker permit state'", 'Commercial guides only; no official text on a performer\'s route.'),
  ('trade-press', 'Press results of the same searches (RNZ Pacific, regional papers)', 'Nothing on the rule itself.')]),
 'MH': ('What the Marshall Islands ask of a foreign performer, a United States citizen included, to work there', [
  ('institution', 'RMI Immigration (rmiimmigration.net) and the Labor Division', "The site doesn't answer this client."),
  ('official-register', 'The immigration and labour statutes on PacLII (paclii.org, pacliirms.austlii.edu.au)', 'PacLII refuses this client (403 or a reset connection).'),
  ('web-search', "'Marshall Islands work permit foreigners', 'RMI non-resident worker'", 'Commercial guides only; no official text on a performer\'s route.'),
  ('trade-press', 'Press results of the same searches (RNZ Pacific, regional papers)', 'Nothing on the rule itself.')]),
 'CU': ("What Cuba asks of a foreign performer to work there: the admission of contracted foreign artists as temporary residents", [
  ('institution', 'Ministry of Labour and Social Security (mtss.gob.cu) and MINREX consular pages (misiones.cubaminrex.cu)', 'The Ministry\'s site resets the connection; MINREX\'s fails certificate verification for this client.'),
  ('official-register', 'Decree-Law on Migration and its regulation (Gaceta Oficial, 2024)', 'No official copy reached.'),
  ('web-search', "'Cuba artistas extranjeros contratación permiso', 'Cuba visa de trabajo artistas extranjeros'", 'Commercial and aggregator summaries (contracted artists admitted as temporary residents), not the text.'),
  ('trade-press', 'Pact\'s country intelligence for producers; Frieze', 'Production applications lodged inside Cuba; nothing on the performer\'s own route.')]),
 'HT': ("What Haiti asks of a foreign performer to work there", [
  ('institution', 'Ministère des Affaires Sociales et du Travail (mast.gouv.ht)', 'The site fails through this client\'s proxy (502).'),
  ('official-register', 'Code du Travail, provisions on foreign workers', 'No official copy reached.'),
  ('web-search', "'Haïti permis de travail étranger MAST', 'Haiti work permit foreign artists'", 'Commercial guides only.'),
  ('trade-press', 'Press results among the same search', 'None on the rule.')]),
 'VA': ("What Vatican City asks of a performer from elsewhere to work there", [
  ('institution', 'Governorate of Vatican City State (vaticanstate.va) and its Labour Office', 'The site carries no page on foreign workers or performers.'),
  ('official-register', 'Vatican City State legislation (Acta Apostolicae Sedis supplements) on employment', 'Nothing on performers found.'),
  ('web-search', "'Vatican City employment foreigners', 'work in Vatican City permit'", 'Recruiters\' pages, and an Italian embassy note on an elective residence visa for those called to Vatican bodies, which no longer loads (404).'),
  ('trade-press', 'Press results among the same search', 'None on the rule.')]),
 'EH': ("What applies to a foreign performer working in Western Sahara, a territory Morocco administers in most part and whose status is disputed", [
  ('institution', "Morocco's Ministry of Employment and ANAPEC; the Sahrawi Republic's authorities", 'Neither says whether or how its rules apply in the territory.'),
  ('official-register', 'Moroccan labour code and its territorial application', 'No text stating its application there found.'),
  ('web-search', "'Western Sahara work permit foreigners', 'Laayoune foreign workers permit'", 'Commercial and film-production guides saying Morocco\'s visa and work channels apply where it administers and that the rest is unclear; no official source.'),
  ('trade-press', 'Press results among the same search', 'None on the rule.')]),
 'BW': ('What Botswana asks of a foreign performer to work there', [
  ('institution', 'Government of Botswana (gov.bw): the work permit and exemption services', "The work permit pages fail this client's certificate check; the exemption certificate page names no performers."),
  ('official-register', 'Immigration Act 2011 and Employment of Non-Citizens Act', 'No official copy reached.'),
  ('web-search', "'Botswana work permit exemption entertainment artists', 'Botswana short term work permit'", "Commercial guides and Africarrières' AI-written guide only, which aren't a source. A 2016 law firm alert describes a short-term permit then under moratorium."),
  ('trade-press', "Fragomen's 2016 alert on the short-term work permit programme (among the same search's results)", "Dated; the programme's current state not stated.")]),
 'LS': ('What Lesotho asks of a foreign performer to work there', [
  ('institution', 'Ministry of Home Affairs (homeaffairs.gov.ls)', "The site resets this client's connection."),
  ('official-register', 'Aliens Control Act and Labour Code Order 1992', 'No official copy reached.'),
  ('web-search', "'Lesotho work permit foreigners Ministry of Home Affairs Labour'", "Commercial guides and Africarrières' AI-written guide only, which aren't a source."),
  ('trade-press', 'Press results among the same search', 'None returned.')]),
 'SZ': ('What Eswatini asks of a foreign performer to work there', [
  ('institution', 'Government of Eswatini (gov.sz): Immigration Department and Ministry of Labour', "The site resets this client's connection."),
  ('official-register', 'Immigration Act 1982 and its regulations', 'No official copy reached.'),
  ('web-search', "'Eswatini work permit foreigners Temporary Residence Permit Immigration Act'", "Commercial guides and Africarrières' AI-written guide only, which aren't a source."),
  ('trade-press', 'Press results among the same search', 'None returned.')]),
 'MU': ('What Mauritius asks of a foreign performer to work there', [
  ('institution', "Ministry of Labour's Work Permit Unit (workpermit.labour.govmu.org) and the Economic Development Board (edbmauritius.org)", "The Work Permit Unit's site fails through this client's proxy (502); the EDB's pages cover occupation permits for professionals and investors, nothing on performers."),
  ('official-register', 'Non-Citizens (Employment Restriction) Act', 'No official copy reached.'),
  ('web-search', "'Mauritius work permit artistes performers Ministry of Labour'", "Commercial guides and Africarrières' AI-written guide only, which aren't a source. An expat guide's creative-industry section was cut off."),
  ('trade-press', 'Press results among the same search', 'None returned.')]),
 'MG': ('What Madagascar asks of a foreign performer to work there', [
  ('institution', "Direction Générale de l'Immigration et de l'Émigration (madagascar-immigration.gov.mg)", "The site fails through this client's proxy (502)."),
  ('official-register', 'Loi 2017-040 on immigration and the Labour Code (Loi 2003-044)', 'No official copy reached.'),
  ('web-search', "'Madagascar autorisation d'emploi étranger visa de travail artistes'", "Commercial guides and Africarrières' AI-written guide only, which aren't a source."),
  ('trade-press', 'Press results among the same search', 'None returned.')]),
 'SO': ('What Somalia asks of a foreign performer to work there', [
  ('institution', 'Ministry of Labour (mol.gov.so)', "Doesn't answer this client."),
  ('official-register', 'Foreign Employment Act (sominvest.gov.so copy)', 'Fails through the proxy (502).'),
  ('web-search', "'Sudan South Sudan Somalia Eritrea work permit foreigners Ministry of Labour'", "The Foreign Employment Act 2015 on the investment agency's site (sominvest.gov.so), which fails through this client's proxy (502)."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'SD': ('What Sudan asks of a foreign performer to work there', [
  ('institution', 'Ministry of Labour (mol.gov.sd)', "Doesn't answer this client."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Sudan South Sudan Somalia Eritrea work permit foreigners Ministry of Labour'", 'Nothing on Sudan.'),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'ER': ('What Eritrea asks of a foreign performer to work there', [
  ('institution', 'Ministry of Information (shabait.com)', "Answers, with nothing on foreigners' work permits."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Sudan South Sudan Somalia Eritrea work permit foreigners Ministry of Labour'", 'Nothing on Eritrea.'),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'ET': ('What Ethiopia asks of a foreign performer to work there', [
  ('institution', 'Ministry of Labour and Skills (mols.gov.et)', "Doesn't answer this client."),
  ('official-register', 'Labour Proclamation 1156/2019 on ILO NATLEX', 'Cloudflare blocks this client.'),
  ('web-search', "'Ethiopia work permit foreign nationals Ministry of Labour and Skills Labour Proclamation 1156/2019'", 'A UNHCR analysis citing art. 176 (its page answers 401) and commercial guides.'),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'LY': ('What Libya asks of a foreign performer to work there', [
  ('institution', 'Ministry of Labour (labour.gov.ly)', "Answers, with nothing on foreigners' work permits."),
  ('official-register', 'Law No. 24 of 2023 (lawsociety.ly)', 'Refuses this client (403).'),
  ('web-search', "'Libya work permit foreign workers Ministry of Labour'", "Commercial guides, and Law 24 of 2023 on the Libyan law society's database."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'SL': ('What Sierra Leone asks of a foreign performer to work there', [
  ('institution', 'Ministry of Labour and Social Security (mlss.gov.sl)', "Doesn't answer this client."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Libya work permit foreign workers Ministry of Labour; Sierra Leone Ministry of Labour work permit non-citizens'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'GM': ('What The Gambia asks of a foreign performer to work there', [
  ('institution', 'Gambia Immigration Department (gamimmigration.gov.gm, gid.gov.gm)', 'Neither answers this client.'),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Gambia Immigration Department alien card work permit foreigners Department of Labour'", "The Point's undated report (2011, from the search summary) of the Immigration PRO on residence permits A and B and their fees; nothing current on work."),
  ('trade-press', 'The Point (thepoint.gm)', 'Residence permits and fees only, dated.')]),
 'GN': ('What Guinea asks of a foreign performer to work there', [
  ('institution', "Agence Guinéenne pour la Promotion de l'Emploi (aguipe.gov.gn)", "Names an 'Obtenir un permis de travail' service, whose page this client couldn't reach (the site's routes answer 404 and its script doesn't render)."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Guinée Niger Tchad autorisation de travail étranger visa du contrat de travail AGUIPE ANPE'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'NE': ('What Niger asks of a foreign performer to work there', [
  ('institution', "Agence Nationale pour la Promotion de l'Emploi (anpe-niger.ne)", "Redirects; nothing on foreigners' work authorisation."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Guinée Niger Tchad autorisation de travail étranger visa du contrat de travail'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'TD': ('What Chad asks of a foreign performer to work there', [
  ('institution', "Office National pour la Promotion de l'Emploi (anpe-tchad.org)", "Doesn't answer this client."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Guinée Niger Tchad autorisation de travail étranger visa du contrat de travail'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'BF': ('What Burkina Faso asks of a foreign performer to work there', [
  ('institution', 'Ministère de la Fonction publique, du Travail (fonctionpublique.gov.bf)', "Doesn't answer this client."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Burkina Faso visa du contrat de travail travailleur étranger ANPE direction du travail'", "Commercial and AI-written guides only, which aren't a source. An old thesis on the 2008 Labour Code's ANPE authorisation."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'BJ': ('What Benin asks of a foreign performer to work there', [
  ('institution', 'Service public du Bénin (service-public.bj)', 'Answers, with no procedure for foreign workers found.'),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Bénin visa contrat de travail travailleur étranger ANPE autorisation d'embauche'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'TG': ('What Togo asks of a foreign performer to work there', [
  ('institution', 'Service public du Togo (service-public.gouv.tg)', 'Answers, with no procedure for foreign workers found.'),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Togo visa contrat de travail travailleur étranger direction générale du travail'", "Commercial and AI-written guides only, which aren't a source. The France–Togo agreement (GISTI copy) asks French nationals for a contract endorsed by Togo's labour ministry; a rule for one nationality only."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'ML': ('What Mali asks of a foreign performer to work there', [
  ('institution', 'Ministère du Travail (travail.gouv.ml)', "Doesn't answer this client."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Mali visa du contrat de travail travailleur étranger ANPE Direction nationale du travail'", "Commercial and AI-written guides only, which aren't a source. A Spanish embassy checklist for Spain's own visa."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'DJ': ('What Djibouti asks of a foreign performer to work there', [
  ('institution', 'Ministère du Travail (travail.gouv.dj)', "Doesn't answer this client."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Djibouti Comores Mauritanie permis de travail étranger autorisation ministère du travail'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'KM': ('What the Comoros asks of a foreign performer to work there', [
  ('institution', 'Présidence (beit-salam.km)', "Answers, with nothing on foreigners' work permits."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Djibouti Comores Mauritanie permis de travail étranger autorisation ministère du travail'", 'Nothing on the Comoros.'),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'MR': ('What Mauritania asks of a foreign performer to work there', [
  ('institution', "Ministère de l'Emploi (emploi.gov.mr)", "Answers, with nothing on foreigners' work authorisation found."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Djibouti Comores Mauritanie permis de travail étranger autorisation ministère du travail'", 'A UNHCR-archived francophone text describing a forty-day permit procedure, its country not confirmed.'),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'CF': ('What the Central African Republic asks of a foreign performer to work there', [
  ('institution', "Agence Centrafricaine pour la Formation Professionnelle et l'Emploi (acfpe.org)", "Answers, with nothing on foreigners' work authorisation."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Djibouti Comores Mauritanie permis de travail étranger; Centrafrique visa contrat travail étranger ACFPE'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'BI': ('What Burundi asks of a foreign performer to work there', [
  ('institution', 'Présidence (presidence.gov.bi)', "Redirects; nothing on foreigners' work permits."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Burundi Guinea-Bissau Equatorial Guinea São Tomé and Príncipe work permit foreigners Ministry of Labour'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'GW': ('What Guinea-Bissau asks of a foreign performer to work there', [
  ('institution', 'Government portal (gov.gw)', "Doesn't answer this client."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Burundi Guinea-Bissau Equatorial Guinea São Tomé and Príncipe work permit foreigners Ministry of Labour'", "Commercial and AI-written guides only, which aren't a source."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'GQ': ('What Equatorial Guinea asks of a foreign performer to work there', [
  ('institution', 'Government press office (guineaecuatorialpress.com)', "Answers, with nothing on foreigners' work permits."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Burundi Guinea-Bissau Equatorial Guinea São Tomé and Príncipe work permit foreigners Ministry of Labour'", "Commercial and AI-written guides only, which aren't a source. Fragomen's country page names an authorisation of recruitment from the Ministry of Labour, not read."),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
 'ST': ('What São Tomé and Príncipe asks of a foreign performer to work there', [
  ('institution', 'Government portal (gov.st)', "Redirects; nothing on foreigners' work permits."),
  ('official-register', "The country's labour code and immigration law", 'No official copy surfaced in the searches or reached by this client.'),
  ('web-search', "'Burundi Guinea-Bissau Equatorial Guinea São Tomé and Príncipe work permit foreigners Ministry of Labour'", 'Nothing on São Tomé and Príncipe.'),
  ('trade-press', 'Press results among the same searches', 'None on the rule.')]),
}
B = {k: v for k, v in B.items() if k in sys.argv[1:]} if len(sys.argv) > 1 else B
for cc, (sought, tries) in B.items():
    attempts = [{'method': m, 'tried': t, 'result': r, 'date': D} for m, t, r in tries + [ARCHIVE]]
    json.dump({'sought': sought, 'attempts': attempts}, open(f'{OUT}/{cc}.json', 'w'), ensure_ascii=False, indent=1)
    print(cc)
