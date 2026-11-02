# The rest of layer 4: identity, background, genres, the portrait (plan, 2026-11-01)

The owner, 2026-11-01: "Continue on to the rest of layer 4." BUILD-ORDER layer 4 still owes: identity (names, pronouns,
Billed As, birth date and age, birthplace, citizenship, languages, race or ethnicity), background (the family's trade,
where you grew up; the family's means is built, `money.means`), the 149 genres, and the portrait. Each field is built
only with a reader that changes an outcome the player meets (KEEP entries 3, 4, 9, 12, 13; the owner's rulings in
HANDOFF's questions). The premise is now known: the life is a Writer, Producer, Director and Actor (or Actress), so the
readers withdrawn with the first SLATE's career engine (KEEP entry 11) can be written again on the new role engines.

## The person (`person.identity`, slice `identity`)

Made once at creation (`identity.make`), the one place a life's birth date, birthplace, citizenship and names are held
(layer 3's papers and money commands take the holder's birth date, zone and citizenship as arguments, "layer 4's person
holds them"; they read them from here).

| Field | Its readers (what changes for the player) | Research needed |
|---|---|---|
| Legal name (first, middle, last) | the papers and accounts the life holds carry it; a union refuses a professional name another member uses (the billing name must differ) | the unions' professional-name rules |
| Preferred name (billing) | the credit on every script, film and part; the union's professional name | as above; the guilds' credit-name rules |
| Sex (Female, Male; the owner, 2026-11-01: "Add a Sex field") | papers.ages (military service by sex), citizenship by descent from the father only, a passport's sex marker; the parts written for an actor or an actress and the acting awards' categories, with Billed As | the awards' category rules (casting part) |
| Pronouns | every line that speaks of the player (the text catalog's fills); settle Billed As | none (the owner's) |
| Billed As (Actor, Actress) | which parts are written for the player (breakdowns by gender); the acting awards' categories, where split | the share of parts by gender; awards' category rules |
| Birth date, age | papers.ages (majority for a contract, working age, a child performer's permit, military service by sex); the parts written for the player's playing age | the share of parts by age; playing age's rule |
| Birthplace | citizenship at birth (papers.citizenship); the languages suggested; the home market | the languages of each place (all 252) |
| Citizenship | permission to work where the part, the film or the job is (papers.work); funders' and incentives' nationality rules | funders' nationality rules (BFI, CNC, Telefilm, Screen Australia) |
| Languages (several, each with a level) | naturalisation's language test (papers.citizenship); parts written for a speaker of a language | the share of parts asking a language |
| Race or ethnicity (optional, several) | breakdowns that name an ethnicity, as they are written (an "any ethnicity" part reads nothing); the programmes and institutions whose eligibility names it; never an ability, a judgment of work, a pay rate or a chance of being good (KEEP entry 4's line) | breakdown practice and shares; programmes' eligibility and rates |

## Background (`person.background`)

| Field | Its readers | Research needed |
|---|---|---|
| The family's trade | a family in the business is a start of contacts (the screenwriter's networking, the actor's first agent meeting); the trade and the family's means | the share of each role's workers whose family was in the business, and what it gives; household wealth by occupation |
| Where you grew up | the accent the life starts with (parts that ask an accent); the languages, refined; the home market | breakdowns asking an accent; regional casting |

## The 149 genres

Each genre's cited definition (re-researched to the source: the first SLATE's citations are not reachable from this
session) and its readers: the genre a script, a film or a part is in, which moves the market figures the genre carries
(its share of spec sales, of releases and box office, by country where published); what the player's love of a genre
changes is designed when the market figures are in.

## The portrait

The first headshot: a submission sends it, a casting platform asks it; a life with none can't self-tape a submission
until it has one; a session's cost and how long a headshot stays current, from the platforms and the photographers'
published rates.

## Order

1. Research (parallel subagents, `workbench/briefs/BRIEF-identity-research.md`), each result checked by the lead.
2. The identity and background engines, reading what is built; their readers in the role engines and the papers.
3. The genres' matrix and their readers.
4. Prove layer 4: the full gate in a fresh clone.
