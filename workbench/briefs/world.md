# Depth audit, layer 2: the world (2026-10-30)

Auditor: world department. Read-only. Scope: `src/world/{gazetteer,map,clock,weather,holidays,prices}`, their tools
(`tools/geonames`, `tools/naturalearth`, `tools/wmo`, `tools/holidays`, `tools/calendars`, `tools/seasons`,
`tools/prices`, `tools/research`), `research/sources/` for them, `coverage/*-countries.json`, held to BUILD-ORDER
layer 2, KEEP 17 to 19, and the first SLATE (`/home/user/1221/src/engine`). Each measurement below was taken with a
script over the repository's own data. Nothing was edited.

## The finding that comes first: wrong data in the weather stations

These are not missing dimensions. They are errors in `src/world/weather/stations.json` that a life in these countries
meets every day. No test checks that a station lies in the country it is filed under.

| What | Evidence | Effect a player meets |
|---|---|---|
| **Malawi: all 15 stations in the wrong hemisphere.** For 1961-1990, `parse6190` prefers the Member's own coordinates (`tools/wmo/compile.ts:399-400`). Malawi's own coordinates say `0942N`. WMO Pub. 9 in the same line says `0942S` (`STNMETA.DAT`: `1MW67421 … 10942N03316E … 0942S03316E`). | Chitipa is filed at +9.70, Thyolo at +16.15. Every one of them is 2,157 to 2,923 km from any Malawian place. | Every Malawian town takes its nearest Malawian station, which is now the northernmost one. Blantyre (15.8°S) reads **Chitipa**, 2,840 km away in the engine's geometry, which is the wrong end of the country. |
| **DR Congo filed with the Republic of the Congo's stations.** NCEI's 1991-2020 file labels WMO block 644xx (Pointe-Noire, Dolisie, Brazzaville, Impfondo, Ouesso, and 6 more) as `Dem._Rep._Congo`, and the compiler trusts that label (`compile.ts:119`). | CD has 11 stations of 1991-2020, all in Congo-Brazzaville. `poolFor` (`weather.ts:93-99`) prefers 1991-2020, so it never reads the DRC's own Klimatafeln stations (Lubumbashi, Kisangani, Bukavu and others). | Lubumbashi reads **Brazzaville**, 1,578 km away. The player is told the averages were "measured near Kinshasa from 1991 to 2020" (the station is named after the CD town nearest it). Kisangani reads Impfondo. The Republic of the Congo itself falls back to 1961-1990. |
| **USSR-era stations filed as Russia.** In the 6190 data, Member `RA` maps to `['RU']` only (`compile.ts:151`). | Leninabad, Khorog, Kurgan-Tyube (Tajikistan), Termez, Fergana, Tamdy-Bulak (Uzbekistan), Kushka (Turkmenistan), Karsakpaj (Kazakhstan), Vasilevichi (Belarus) and Nikolaev (Ukraine) are all filed `RU`. | Tajikistan keeps one station of its own. Khujand reads **Dushanbe**, 202 km away and across a mountain range, while the Khujand station (Leninabad) sits filed under Russia. |
| **Two more misplaced stations.** Dominican Republic `A. LA UNION` sits at 33°50′W (the Member's own coordinates); it should be about 70°W. Ukraine `KROVOJ ROG` sits at 43.03°N (Pub. 9); it should be about 47.9°N. | One is 3,627 km into the Atlantic. The other is in the Black Sea. | None while other stations stand nearer, but no check would catch the next one. |

**What the form needs:**
- A compile-time check that every station lies within a set distance of a place in its own country. Islands and
  territories need a carve-out.
- A station's country taken from its location wherever the label and the location disagree. The compiler already
  does this for territories.
- A test that fails on any station whose hemisphere disagrees with Pub. 9.
- With those in place, re-derive the coverage for MW, CD, CG, TJ, UZ and TM.

---

## world.clock (`src/world/clock/clock.ts`)

What it holds:
- Play and pause.
- `elapse(realMs)`, one second of the life per real second.
- `advance(seconds)`, which stops at the first commitment that wants the player.
- The local reading: date, time, zone, astronomical season, sunrise and sunset.

All of it is proven at every place.

Gaps, in order of how often a life meets them:

1. **A commitment the clock stops at can never be passed.** This happens at every commitment.
   - `pass` stops at any wanting item with `at <= to` (`src/core/frame/frame.ts:284`). The item stays on the schedule
     "until a command deals with it", and no such command exists. Items carry no duration (`frame.ts:16-21`).
   - So after the first stop, Play and Advance stop again at once, forever. No `wants: true` kind exists yet, so no test
     meets it.
   - The first SLATE had Go and Stand Here, `carryOnTo` through the commitment's own hours, per-kind stop choices and
     refusals (`1221 world/clock.ts:93-131`).
   - **Needs:** `durationMinutes` on an item; a generic `attend`/`stand` command pair (and a `defineStop` hook); `advance`
     carrying on after an answer to where it was headed.
2. **Advance can only jump by a number of seconds.**
   - The first SLATE's Advance menu jumped to wall-clock times in the town's zone, DST-safe: This Evening 18:00,
     Tonight 22:00, Tomorrow Morning 07:00 (the same date's 7:00 when pressed before dawn), Next Monday 09:00. It also had
     Next Event and Choose An Event (`1221 world/clock.ts:150-174` `nextAtHour`/`nextMondayAt`;
     `ui/shell/TimeControls.tsx:576-616`).
   - **Needs:** `advanceTo(life, instant)` plus local-hour targets computed through `core/time` with the town's zone;
     `nextCommitment(life)`.
3. **Real time loses whatever the device sleeps through.**
   - The doc comment specifies "a monotonic source" (`clock.ts:13-14`).
   - The first SLATE measured that `performance.now()` stops while a phone is locked or a machine sleeps. It moved the
     world clock to the wall clock and kept play time on the page clock (`1221 app/game-context.tsx:343-350`). It also
     paid a long gap back in bounded steps (`core/realclock.ts`, `MAX_STEP_MS`).
   - KEEP 18: "still ticking accurately as a real-time clock".
   - **Needs:** a world time fed from the wall clock (a clock set back counts as zero) apart from the time played; the
     contract written into `elapse`'s doc and tested.
4. **The season is astronomical everywhere.**
   - Australia and New Zealand reckon seasons from the first of the month (meteorological): spring from 1 September.
   - The tropics have wet and dry seasons, not winter. At 1.3°N, Singapore reads "winter" in December (`seasonAt`,
     `clock.ts:119`, "the equator reckons as the north").
   - Home's town line shows the season every day (KEEP 17).
   - **Needs:** a per-country season rule (astronomical / meteorological / wet-dry), researched from each national met
     service, with wet-dry months derivable from the station's `prcp` normals already held.
5. **No "On The Way".** A jump runs every scheduled item it passes and says nothing (`1221 TimeControls.tsx:216-229`
   listed them, and the clashes among them). **Needs:** `advance` to return the items it passed, for the screen to
   list.
6. **DST changes are never announced.** The engine has every transition (tzdb 2026e) but no notice ("clocks go back an
   hour tonight") for a life in a DST zone. This is met twice a year. **Needs:** a scheduled kind at each of the home
   zone's transitions.

Owner's open item, not a gap: Sleep as a clock action.

**Verdict:** the arithmetic is complete. The clock as the player meets it is not. Items 1 and 2 stop any life at its
first commitment.

---

## world.weather (`src/world/weather/weather.ts`, `tools/wmo/`)

What it holds:
- From each station: max and min temperature, precipitation, wet days and sunshine.
- The day's weather as a pure function of the seed, the station and the day: high, low, precipitation, and one of
  five conditions.
- A five-day forecast and a temperature curve through the day.

Coverage: 202 researched, 44 blocked, 6 proven.

1. **The station errors above.** MW, CD, CG, TJ, UZ and TM are affected every day.
2. **Temperature is in °C only.**
   - The United States (and the other Fahrenheit countries) read °F. The engine has no unit fact by country.
   - The first SLATE had `usesFahrenheit` and `usesMiles` (`1221 content/climate.ts:119-128`) and returned both
     `high` and `highC` (`systems/weather.ts:38-51`).
   - **Needs:** a researched per-country table of measurement units (temperature, distance), read by the screen.
3. **Conditions are poorer than the first SLATE's.** The new set is clear, partly cloudy, overcast, rain and snow
   (`weather.ts:173`).
   - The first SLATE also had Thunderstorm (from published thunder days by place, `content/thunder.ts`), Drizzle, Fog
     and Windy.
   - It also drew wind speed and humidity, and computed a heat index (`systems/weather.ts:27-29, 77-96, 280-290`).
   - The vendored 1961-1990 file (`vendor/wmo/6190/ALLNORMS.DAT.gz`) holds about 60 element and statistic codes, and
     the compiler reads 6 of them (`compile.ts:390`; the commonest unread are 1738, 1198, 0101, 1798, 0626 and 0620).
     The format document `DATA_FMT.TXT` that names them isn't vendored. WMO-No. 847's elements include humidity,
     vapour pressure, wind, cloud, and days of thunder, fog and snow; this needs checking against `DATA_FMT.TXT`.
   - **Needs:** `Param` extended (thunder days, mean wind, mean relative humidity or vapour pressure, fog days) and
     read from 6190, from the 9120 release's other files, and from national sets. Conditions extended to match.
4. **Wet days don't cluster.** Each day's rain draw is independent (`drawsOn`, `weather.ts:279-281`, keyed by the day
   alone). Only temperature carries over. Real wet and dry spells persist; the first SLATE blended each day's noise
   from the days around it. **Needs:** a two-state Markov chain fitted to the month's wet-day frequency, with the
   persistence cited (GHCN-Daily, already vendored, gives it per station).
5. **The sky is the same all day.** `temperatureAt` gives the hour's temperature, but rain, snow and the condition
   cover the whole day. The first SLATE had `hoursOn` and `weatherAt` ("a snow day whose spell ran out before dawn is
   overcast by breakfast", `systems/weather.ts:160-260`). Home's "now" shows the condition. **Needs:** hours of
   precipitation within the day.
6. **The nearest station can be very far.**
   - In 72 of 231 countries, the median town is more than 50 km from its nearest own station. Examples: CD 953 km
     (before the fix), ET 501, BO 418, AO 360, ZA 172, ID 152 (p90 765), VN 135, MX 87 (p90 303, 29 stations for 8,947
     places).
   - A town in a different climate from its station is told "measured near X" with no distance.
   - **Needs:** a distance at which the player is told the station is far; denser national normals for the worst rows
     (Mexico's SMN, Indonesia's BMKG, South Africa's SAWS, Vietnam, Ethiopia and Bolivia's services).
7. **Partly borrowed normals.**
   - 33 countries publish some normals and not others (sunshine missing in 22 of them, wet days in 13).
   - 19 publish no temperature at all; those are among the 44 blocked.
   - The player is told, which is correct; these are retry targets.
8. **Nothing reads the weather.** Read, bite, downstream: the first SLATE's readers went with the career and the body
   (KEEP 18). Under MANDATE rule 1, the weather is shown and decides nothing. **Needs:** a downstream reader, or an
   owner's ruling that the forecast is kept as information.
9. The forecast's error model is the game's own (R-0041). The national services publish forecast verification (for
   example, the NWS's mean absolute error by lead time), which could replace it. Low priority.

**Verdict:** not complete. Fix the station data first. Then units, conditions (thunder, wind, fog) and spell
persistence.

---

## world.holidays (`src/world/holidays/`)

What it holds:
- Rules: fixed dates, Easter (Western and Orthodox), the nth weekday, after and before a date, six calendars
  (Umm al-Qura, Hebrew, Chinese, Korean, Persian, Ethiopic), equinoxes and announced dates.
- Regions, substitutes, cycles and "between" days.
- Years 2026 to 2100.

Coverage: 195 researched, 51 blocked, 6 proven.

1. **Holidays vanish after the last announced year.**
   - 95 of 204 countries are `announcedTo: 2026`. Their moon-sighted, decreed or moved days are held as `dates` for
     2026 alone.
   - Measured with `holidaysIn`: in 76 countries the count falls from 2026 to 2027. In 25 countries the distinct
     holidays of 2030 are under 70% of 2026's, and five reach **zero**: Egypt 11 to 0, Kiribati 17 to 0, Madagascar
     17 to 0, Malaysia 13 to 0, Nepal 25 to 0. Sri Lanka goes from 26 to 4.
   - Egypt's law fixes several dates (7 January, 25 April, 1 May, 23 July, 6 October). All of them are held as 2026
     `dates`, so 2027 keeps none, while the line the player reads says it "keeps only those its law fixes".
   - Every life meets this in its second year.
   - **Needs:**
     - A law-fixed day as a `fixed` rule, plus a separate "moved by decree in year Y" override.
     - For a moon-sighted feast, a `lunar` rule on the nearest computed calendar, marked expected until announced.
     - The line to say the dates are expected.
2. **No weekly rest days.**
   - There is no country fact for the weekend. Each country's substitute rule names weekdays inline. Examples:
     Fri-Sat in Saudi Arabia, Kuwait and Egypt; Friday alone in Iran; Saturday in Nepal; Sat-Sun most places; Fri-Sat
     in the Malaysian states the engine calls `unmoved`.
   - Every business-day count needs this fact: banks, offices, passports' "working day".
   - **Needs:** `restDays: number[]` per country and region, researched (labour codes), with years from and until
     (the UAE changed in 2022).
3. **No business days, and nothing reads holidays.**
   - The first SLATE had `content/bankdays.ts` (`businessDay`, `afterBusinessDays`, `bankHoliday` by the bank's
     country and the holder's region) and `content/usholidays.ts` (the Federal Reserve's days: Sunday to Monday,
     Saturday not observed).
   - Those were read by `systems/bankmoves.ts:181`, `lending.ts:627,672,1012`, `payments.ts`, `permission.ts`
     (`businessDaysOn`), `identity.ts:145,334` and `papervisits.ts`.
   - The new build: `grep` finds no reader of `holidayOn`/`holidaysOf` outside `src/world`. Card due dates
     (`money/cards/account.ts:108-110`) ignore weekends and holidays. Passports' `'working day'` unit
     (`papers/passports/passports.ts:14`, used in 56 research files) is never counted against holidays.
   - **Needs:** `businessDay(country, region, day, keptBy)` and `addBusinessDays`, wired into the cards' due date (Reg Z
     12 CFR 1026.10(d)) and into the passports' times.
4. **No record of who keeps a day off.**
   - A `Holiday` is one kind (`rules.ts:136`). Real holidays differ in who closes for them:
     - US federal days bind federal offices only.
     - US state days bind state offices only (the engine's own wording).
     - The Federal Reserve closes on Columbus Day and Veterans Day.
     - Canada's bank holidays (Bills of Exchange Act) aren't its provinces' statutory days.
     - The Philippines separates regular holidays from special non-working days.
     - India has restricted holidays; Brazil has pontos facultativos.
   - The first SLATE typed `public | bank | school | optional | observance` (`1221 content/holidays.ts:18`).
   - **Needs:** `keptBy` on a rule (all employers / government offices / banks / optional).
5. **No make-up working days.**
   - China's 调休 makes weekend days working days around Spring Festival and National Day.
   - Russia, Belarus, Kazakhstan, Uzbekistan and Vietnam transfer days off by decree, making a Saturday a working day.
   - The form can add days off but not remove a rest day.
   - **Needs:** a `workday` rule (dates) that cancels a rest day.
6. **Religious calendars missing.** The Hindu lunisolar calendar (Diwali, Holi, Dashain, Tihar), the Buddhist lunar
   calendar (Sri Lanka's 12 to 13 Poya days, Thailand's Bucha days, Vesak), Balinese Saka (Nyepi), Tibetan and
   Mongolian (the HANDOFF says so), and sighting-based Islamic dates (Pakistan, Nigeria, Morocco, Indonesia and
   Malaysia sight the moon; Umm al-Qura is Saudi Arabia's). All of these are `dates` only. They are why the countries
   in item 1 collapse (LK, NP, MU, FJ, GY, TT, MY). BUILD-ORDER asks for "religious calendars". **Needs:** `CalendarId`
   extended, compiled by `tools/calendars/` from the institutions' own tables, as the HKO tables were.
7. **Vietnam's Tết.** It uses the Chinese calendar computed for UTC+8. Vietnam's calendar is reckoned at UTC+7, and
   in some years the new moon falls on different days (Tết 2007 is the known case). Verify 2026 to 2100 against the
   Vietnamese tables.
8. **No English names.**
   - In 30 countries the holiday names are in the local script alone (RU, CN, EG, KR, UA, GR, NP and others), while
     others are in English.
   - The first SLATE kept `name` and `englishName` (`1221 content/holidays.ts:20-27`). The voice rule applies.
   - **Needs:** an `english` name on every rule.
9. **Regional holidays not held.**
   - Portugal: the Azores' Dia da Região, and Madeira's 1 July and 26 December.
   - Belgium: the community days (11 July, 27 September, 15 November).
   - France: Alsace-Moselle's Good Friday and 26 December. These are second-level, so they can't be placed under
     KEEP 19's first-level map. The player should be told so.
   - 26 countries hold regional rules.
10. **Shallow rows.**
    - **38 countries rest on secondary sources only**: CZ LT RS HR SV HN GT TC PG TO KH CI BA GH BY GE MK DZ EG BF TD GA
      BJ NE ML GN ET KW ZW AS PS CM CD TN NI SY YE EC.
    - 159 countries' rules are held to one year's list (2026). Any rule that fires only in other years (a substitute,
      a cycle) is untested against an official list.
    - 51 blocked.

**Verdict:** the 2026 year is deep. Every later year collapses for a quarter of the map, and nothing downstream
reads a holiday. Items 1 to 3 come first.

---

## world.prices (`src/world/prices/prices.ts`)

What it holds: one number per country, the 2025 PPP for household consumption (2024 for four countries), and
`priceIn(country, usd)`.

Coverage: 224 researched, 22 blocked, 6 proven.

1. **Nothing calls `priceIn`, and there is nothing for it to multiply.** No US base prices exist (BLS Average Price
   Data, CPI item prices), and no engine prices a thing through it. Grep finds callers in tests only. Read, bite,
   downstream fails.
2. **Country level only; BUILD-ORDER asks for "by place".**
   - New York and rural Mississippi cost the same here, as do London and Sunderland.
   - Researched sub-national indices exist:
     - BEA Regional Price Parities (states and metro areas, with separate rent and goods).
     - ONS relative regional consumer price levels.
     - Japan's Statistics Bureau regional difference index, by prefecture.
     - Germany's BBSR regional price index.
   - The first SLATE priced by town (`costOfLivingIndex` and median rent in `1221 content/geography.ts:60-66`, and
     published rents in `content/rents.ts`).
   - **Needs:** a region (and metro) multiplier with its source; elsewhere the country level, said so.
3. **One level for everything.** Housing, food and transport differ widely within a country's PPP. ICP 2021 publishes
   PPPs by expenditure category. Rent is the cost a life meets most. **Needs:** a category on `priceIn` (at least
   housing / food / other).
4. **No time.**
   - The level is 2025's for every game year (2026 to 2100).
   - KEEP 18 asks "how pay and prices move" in a currency. Argentina, Türkiye and Nigeria move monthly.
   - The engine already reads CPI series for 21 countries (`research/sources/prices/`) but stops at 2025.
   - **Needs:** a dated level series and a stated rule for years beyond the last published one.
5. **The pricing currency.**
   - `priceIn` prices in the gazetteer's one currency.
   - Panama prices in PAB, but its notes are US dollars. Cambodia (USD beside KHR), Liberia (USD), Bhutan (INR) and
     Lesotho, Namibia and Eswatini (ZAR) also circulate a second legal tender.
   - **Needs:** a researched list of the currencies in common use (shared with money's layer 3).
6. **Shallow rows.**
   - 22 blocked: AS CU ER FK KN KP MH MM MP NR SD SO SS SY SZ TC TM VE VG VI YE ZW.
   - 25 territories kept at another's level by the owner's ruling. Jersey and Guernsey publish their own RPI, so they
     could be carried as the 21 benchmark countries are.

**Verdict:** a multiplier with no prices and no reader. "Cost of living by place" isn't built yet.

---

## world.gazetteer (`src/world/gazetteer/gazetteer.ts`) and the pickers

What it holds: 252 countries (name, currency), 3,865 regions (name), and 171,654 places (name, ASCII spelling, region,
coordinates, zone, population, height). Search ranks within one country.

1. **No alternative names.**
   - Search matches `name` and `ascii` only (`gazetteer.ts:128`).
   - "Cologne" finds Cologne, **Italy**, not Köln. "Kiev" and "Bombay" find nothing.
   - The vendored `cities1000.zip` carries GeoNames' alternatenames column (Köln's includes "Cologne"), and
     `tools/geonames` drops it.
   - The first SLATE had city aliases ("LA", "NYC") and country aliases (USA, Britain, England, Holland, DR Congo,
     UAE; `docs/kept/02-creation-identity/geography.ts:108-117`).
   - Met at creation (place of birth) and wherever a town is picked. **Needs:** an alternates field per place (English
     and Latin exonyms at least), and country aliases.
2. **No search across countries.** `search(places, query)` runs over one country's file. Typing "Paris" needs France
   chosen first. The first SLATE's picker also narrowed by country first. Owner's screen detail; low priority.
3. **No country facts.**
   - Languages, capital and drive side are in `vendor/geonames/countryInfo.txt` and unread.
   - The first SLATE's `Country` held languages, capital, continent, phone and `drivesOn` (`1221
     content/geography.ts:19-37`).
   - Only languages has a reader in scope (KEEP 9 and 20: the Languages engine, and where you grew up). **Needs:**
     languages by country, when layer 4 asks.

**Verdict:** complete for place, zone and coordinates. Alternative names are a real gap for the pickers.

## world.map (`src/world/map/map.ts`)

1. 77 countries and territories are too small to draw at 1:110m (Singapore, Malta, Bahrain, most of the Caribbean and
   Pacific), so they can't be pointed at on the map. They stay in the lists. Natural Earth's 1:50m set draws almost all
   of them. Met once, at creation.
2. Nothing in the simulation reads the map (by design: `map.ts:7`). Its reader is the picker (layer 5).

**Verdict:** complete for its purpose. Item 1 is optional depth.

---

## Summary, ranked across the department

1. Weather station errors (MW hemisphere, CD filed with CG's stations, USSR stations filed as RU): wrong weather every
   day in six countries. These are fixes, not new depth.
2. The clock can't pass a commitment (no Go/Stand Here, no duration) and can't advance to a local hour: blocks every
   life.
3. Holidays vanish after 2026 in 95 countries (5 reach zero); law-fixed days are held as one year's dates.
4. No weekend fact and no business days; nothing reads holidays (the first SLATE's bank days and their six readers are
   gone).
5. Prices: no reader, no base prices, country only, one category, frozen at 2025.
6. Weather: °C only, no thunder, wind, humidity or fog, rain draws independent day to day, the sky the same all day,
   stations far from towns in 72 countries.
7. Seasons astronomical everywhere: "winter" in Singapore, spring on 23 September in Sydney.
8. Holidays: no `keptBy`, no make-up working days, Hindu, Buddhist and sighted-Islamic calendars missing, no English
   names in 30 countries.
9. Gazetteer: no alternative names ("Cologne" finds Italy).
10. Real time measured on a monotonic clock, which loses the time a device sleeps (the first SLATE's lesson).
