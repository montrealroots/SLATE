# Depth audit, layer 3: money (2026-10-30)

Department: `src/core/money`, `src/money/{banks,cards,credit,rates,means}`, `tools/money/*`, `research/sources/money/*`.
Held against BUILD-ORDER layer 3 ("every country's banks, fee sheets, account formats, cards, credit records; the
currency the life is kept in; the family's starting means"), KEEP 14 and 18, and the first SLATE's banking
(`/home/user/1221/src/engine`, catalogued function by function in `/home/user/1221/docs/BANKING-FUNCTIONS.md`: 306
functions, 173 built there). Read only; counts are from scripts over `research/sources/money/*` run 2026-10-30.

## The headline

The money department is five catalogs and one card simulation. **There is no bank account.** Nothing opens one,
nothing holds a balance, nothing charges the banks' fees, nothing puts the family's means anywhere, nothing pays a card
from anything, and nothing exchanges money. In the first SLATE the account was the centre (double-entry ledger
`core/ledger.ts`, `systems/banking.ts`, 1,126 lines) and everything else hung off it. Until an account ledger exists,
three of the five engines have no consumer and the card bites nothing real:

| Export | Read by (outside its own module and tests) |
|---|---|
| `banksIn`, `keepsBanks`, `aboutBanks`, banks' `feeFor` (`src/money/banks/banks.ts:44-80`) | nothing |
| `meansOf`, `aboutMeans` (`src/money/means/means.ts:35`) | nothing |
| `rateOn`, `exchangeOn`, `aboutRate` (`src/money/rates/rates.ts:23-47`) | nothing (`exchangeOn` only calls `rateOn`) |
| `creditIn`, `aboutCredit` | nothing; `reportAfter`, `record`, `clear`, `standingOf` are read by `cards/account.ts` |
| `cardsIn`, cards' terms | `cards/account.ts` |
| `card.returned` (`cards.ts:68`), `limitFee(..., 'raise')` (`cards.ts:225`) | nothing: no payment can be returned, no raise exists |

`matrix/FEATURES.md` says "Features: 0", so none of this is caught yet. Layers 4 and 5 will supply readers, but the
ledger, the account and the movement of money between them are layer 3's (BUILD-ORDER: "banking ... the currency the
life is kept in; the family's starting means"). They aren't layer 5's.

---

## 1. Bank accounts (`money.banks`)

What it holds (`tools/money/banks/compile.ts:30-50`): bank name, one everyday account name, and fees that carry an
amount, a period (month, two months, quarter, half year, year), dated changes, and waivers (deposits, lowest balance,
average balance, age under or from, national). Matrix: 222 researched, 24 blocked, 6 proven.

### Gaps, ranked by how often a life meets them

1. **No account engine (daily, every life).** No open, balance, deposit, withdrawal, transfer, statement or fee run. The
   banks' `feeFor` says it "is what the ledger will read each period" (HANDOFF l.278), but the ledger doesn't exist.
   - Needs: a double-entry ledger in `src/core/money` (a balance is the sum of postings, the house rule), plus
     `account.open`, `account.deposit`, `account.withdraw`, `account.transfer` and a monthly `account.statement` kind
     that charges `feeFor` with a real `Standing`: deposits, lowest and average daily balance kept per day.
   - The card's interest shortcut (`account.ts:30`, statement-day balance) waits on the same daily balances.
   - 1221: `core/ledger.ts`, `systems/banking.ts`.
2. **One bank per country (every life, at creation).** 211 of 222 countries have exactly one bank. Seven have two, one
   has three, two have four, one has five. The thirteen countries the first SLATE banked in had 63 banks
   (`1221/src/engine/content/banks-thirteen.ts`: US 5, CA 5, MX 4, GB 5 ...). The new build has one each (US: Chase).
   - KEEP 14's "Your Bank" is then a choice that ends the same way every time, which zero decoration forbids.
   - Needs: the country's main banks (three or more where they publish), like the cards' main-bank pass.
3. **No savings account and no interest (monthly, every life with means).** The means engine puts a band's wealth "in
   savings" (`means.ts:6-10`), but the banks engine has no savings product, rate, compounding or crediting.
   - The first SLATE had all of these (`content/banks.ts:92-131`): `rate`, `quoted` (APY, AER, TAE or GAT), `compounds`,
     `creditsEvery`, `rateFrom`, `tiers`, `rateUpTo`, `intro`, `changes`, `bonus`, `pays` and `taxFree`, and the
     savings fee and its waivers. It also had interest on checking (BANKING-FUNCTIONS A103).
   - Needs: per bank a `savings` product (name, fees, rate as stated, its basis, compounding, crediting period, tiers,
     floors and ceilings, withdrawal limits with the fee past them), and `rate` on the current account where it pays.
4. **No overdraft, no returned payment (NSF), no fees regardless of balance (often, for the poorer bands).**
   - KEEP 18 says the first SLATE had "returned-payment rules for thirteen countries". The new form has no place for any
     of them. Only the card form has `returned`, and nothing reads it.
   - 1221 had all of these: `Bank.returned` (fee, `gapDays`, `ifShortAtLeast`; Canada's $10 cap from 12 March 2026),
     `content/banks-lending.ts`, and `systems/lending.ts`.
   - 1221's overdraft covered:
     - arranged overdrafts: limit, rate or range, free buffer, fee;
     - overdraft by the item: fee per item, items per day, de-minimis, cure window, Reg E opt-in;
     - unarranged overdrafts: France's commission, Germany's tolerated rate, Spain's capped descubierto, NZ's fee;
     - charge-off after sixty days to collections, with the record marked.
   - Needs:
     - `returned: {fee, perDays?, under?}` per account, and a ledger that refuses a payment it can't make;
     - `overdraft: {kind: 'arranged'|'item'|'none', limitRule?, rate?, fee?, perItem?, maxPerDay?, deMinimis?, cure?, optIn?}`;
     - a country-level cap where the law sets one.
5. **No debit card (daily).** The everyday card in most of the world is the account's debit card. The new build has
   only credit cards. A debit card's yearly fee is dropped ("A card's yearly or quarterly price belongs to the card",
   HANDOFF l.305-306), but no debit card engine takes it.
   - 1221: `Bank.card` (yearly, per purchase, `freeUnder`, the card year's timing; `banks.ts:197-205`) and its foreign
     use (`systems/abroad.ts`, `cardFeeAbroad`, `atmAbroad`).
   - Needs: `debit: {fees, foreignShare?, perPurchase?, atm?}` per account.
6. **No cash or ATM fees (weekly).** 1221 had own-machine and other-machine fees, the machine owner's surcharge (US
   $3.22, AU A$2.63), the daily ATM limit, the counter fee, and the Post Office in the UK (`content/cash.ts`,
   `systems/cash.ts`).
   - Needs: `atm: {own?, other?, daily?}` and `counter?` per account, and a cash wallet in the ledger.
7. **Per-transaction and turnover charges are dropped.** "A charge on turnover ... or per transaction isn't a fee the
   game counts" (HANDOFF l.304). Where a bank's whole price is per transaction (much of Africa and Latin America), the
   game charges nothing and the account reads free. 89 of 241 accounts compile with no fee at all.
   - Needs: `perTransaction: {kind: 'transfer'|'withdrawal'|'purchase', fee|percent, free?: n}`, read by the ledger's
     postings.
8. **Opening conditions (once a life, at the first morning).** The form has no minimum opening deposit, no age to open
   alone, no documents asked (passport, national ID, residence permit, proof of address), and no residents-only rule.
   - KEEP 4 makes the bank opening a reader of the legal name and the papers ("a bank opening ... reads it"). Layer 3's
     papers engines exist (`src/papers/ids`, `passports`), but nothing links them to an account.
   - 1221: `bankmoves.ts` (`OPENING`, US-persons-only banks, review days, opening deposit, card arrival days) and
     `homeaccounts.ts` (opening age).
   - Needs: `opens: {age?, deposit?, documents: [...], residentsOnly?, reviewDays?}`.
9. **Waivers the form can't express.** These are charged in full today:
   - 1221 had `firstMonths`, `openingMonth`, `linkedAverageAtLeast` (Chase's $5,000 is across linked accounts, but the
     new build reads it as the one account's average), `purchasesAtLeast`, `depositsAlso` (bills or purchases as well
     as wages), a `reduced` fee that isn't a full waiver, and `deposits: 'wages'|'electronic'` (`content/banks.ts:36-90`).
   - The card form already has `first`. The account form lacks it.
   - Fee timing is also missing: `feePosts`, Germany's quarterly closing (A88), and a fee charged in the month after.
10. **Transfers and money between currencies (monthly once a life has two banks or crosses a border).**
    - 1221 had own-account transfers, transfers between banks in the sending bank's days, and payments abroad with the
      sending fee, the FX margin, the receiving fee and the business days in both countries (`bankmoves.ts`,
      `abroad.ts`).
    - The new build has neither rails nor fees. `exchangeOn` gives a mid-rate with no bank margin.
    - Needs per bank: `transfer: {domestic?, instant?, abroad?: {fee, margin?, days?}}`. The margin, when unpublished,
      is a blocker, not a figure.
11. **Account life (yearly or rarer).** 1221 had these; none is in the form:
    - dormancy and its fee (`Bank.dormant`), and the quiet-month fee (`Bank.quietMonth`);
    - unclaimed money by country (`content/accountlife.ts`);
    - the 14-day cooling-off (A12, C6);
    - term deposits with early-break penalties (`accountlife.ts`);
    - round-ups (`content/roundups.ts`);
    - lost, stolen and fraud liability by law (`content/security.ts`: US $50/$500, EU €50, UK £35, AU $150);
    - pending items and holds (A95, A96, A140).

    Lower rank, but each is something a life meets in its first years.
12. **Interest tax withheld by the bank.** 1221 had `CountryBanking.interestTax` (flat rate, allowance, brackets,
    refund). Tax is held by the owner's ruling, so this is out of scope until earnings come in. It is listed only
    because savings interest would need it the moment it exists.

### Shallow rows (banks)

- 211 single-bank countries, the thirteen deep countries included.
- 89 of 241 accounts have no fee; part of that is the per-transaction reading in gap 7.
- 24 blocked: CU, KP, RU, IR, SY, YE, ER, SO, SL, MR, ST, KM, GA, CG, CF, EH, FK, VA, TV, CC, PN, TK, GS, TF.

**Verdict: not complete.** It is a fee catalog, one bank deep, with no account behind it. Built from it: overdraft
and returned payments, savings and interest, ATM and cash, the debit card, opening conditions, transfers, and more
banks per country.

---

## 2. Account formats (BUILD-ORDER l.3 "account formats"; KEEP 18 "account formats")

- **Not built.** HANDOFF l.281 reads KEEP 14's cut of "Before Yale" as cutting "the account number's format by
  country". But KEEP 18, written after it, still lists account formats under "Required" for Your Money, and BUILD-ORDER
  layer 3 names them. The owner's documents are in tension here. The HANDOFF settled it without asking, so this is a
  question for the owner, with the zero-decoration test attached.
- An account number earns its place only if something reads it. The reader is the transfer engine: which rail a
  payment takes (SEPA, SWIFT, ACH, Faster Payments, SPEI) decides its fee and days. Without a reader it's decoration.
- 1221 had the depth floor:
  - `core/banknumbers.ts`, 318 lines: IBAN mod-97, Spain's CCC control digits, France's RIB key, the CLABE, the
    kennitala, the ABA routing check, Belgium's check, Italy's CIN, Finland's Luhn, a national check by country;
  - `content/banks-world-iban.ts`: BBAN structures for the IBAN countries and each bank's code in them;
  - `systems/banknumber.ts`: Australia's BSB state digit;
  - real routing, sort and BSB codes per bank.
- Needs: `format` per country (IBAN length and BBAN, or the national scheme), each bank's code, and a rail per country.
  Built only if the owner keeps it and a transfer engine reads it.

---

## 3. Cards (`money.cards`, `src/money/cards/cards.ts`, `account.ts`)

The strongest engine:
- 2,385 cards in 174 countries.
- The form holds rate and range, steps, charge card, fees and waivers, issue, `limitFees`, intro, cash, FX, minimum,
  grace, late, over-limit, returned, penalty, tax and the limit multiple.
- Its statement cycle is real and at 100% mutation.

### Gaps, ranked

1. **The missing minimum turns a revolving card into a pay-in-full card.**
   - `minimumDue` returns the whole balance when the card has no `minimum` (`cards.ts:211`). `account.ts:233` asks it,
     and `dueDate` marks it late (`account.ts:249-258`).
   - 1,375 of 2,222 revolving cards have no minimum. In 67 countries no card has one; worst are BR 218, US 64, CR 59,
     CL 51, EC 39, CA 37.
   - So a US Chase holder who pays 90% of the statement gets the $40 late fee, the 29.99% penalty rate and a mark on the
     record. That is the opposite of the real card.
   - Chase's minimum is in its Cardmember Agreement, not the Pricing & Terms box the research read (the US file's note
     says "the boxes state ... no minimum payment").
   - Needs: research the agreement for each card's minimum. Until it's read, the card should be told as "minimum not
     known", not charged as pay-in-full.
2. **The limit is typed by the player, and so is the income (zero decoration, mandate rule 2).**
   - `card.open` takes `limit: string` and `income: string` (`account.ts:129-130`). The income is checked only where
     `card.limit` exists (`account.ts:140`), and **no card in 2,385 has `limit`**. So the income is asked and read by
     nothing, and the limit is "a number typed where a sum belongs".
   - KEEP 14 lists "the card's limit" among the family's figures. HANDOFF l.435-437 gives it to the cards engine
     "where a bank states its rule", and no bank does.
   - 1221 had `limitFor` by record band, `APPROVE_FROM` 620, an inquiry cost, six-monthly raises of a fifth, and a cut
     to 70% after a late payment (`systems/cardlife.ts:50-97`, `credit.ts:414-473`). Those were labelled SLATE's
     estimates.
   - Needs: eligibility terms many banks do publish: minimum age, minimum income (Singapore's MAS floor, the UAE's and
     India's banks state monthly minimums), residents only, and a starting or minimum limit (`limit: {min?, max?,
     times?}`). Where nothing is published, a game rule said as the game's, set by the record and the means, never a
     typed figure.
3. **No eligibility or approval.** Any card opens for anyone: no age, no income, no residency, and no credit history.
   A 16-year-old with nothing opens a Sapphire Reserve. This needs the eligibility form above, plus the credit history
   in section 4.
4. **The payment comes from nowhere.**
   - `card.pay` reduces the balance without debiting anything (`account.ts:183-201`).
   - A charge card's statement is "taken from the account each month" (`cards.ts` doc), but no account exists, so it
     is only asked as a minimum. Autopay is missing (C19).
   - `returned` is therefore unreachable.
   - Needs: the ledger in section 1, `card.pay` from a named account, and autopay (full, minimum or fixed) on the due
     date.
5. **The penalty rate never lifts, and nothing ends a card.**
   - `h.late = true` is set and never cleared (`account.ts:255`).
   - There's no close, no default, no charge-off, no collections and no suspension.
   - 1221 had: US penalty APR at 60 days late, lifted after six on-time payments (Reg Z), the intro rate ended, default
     and acceleration, charge-off to collections, hardship, UK persistent debt (C11, C12, C15, C52, C75, C76;
     `systems/credit.ts`).
   - Needs: `penalty: {after?: days late, lifts?: on-time months}`, a `chargeOff` days rule per country, and
     `card.close`.
6. **Interest on statement-day balance, not the average daily balance with daily compounding.** This is a shortcut
   already noted (`account.ts:30`). 1221 did the average daily balance and daily compounding (C43, C50). It waits on
   the ledger's daily balances.
7. **Terms the form has no place for:**
   - the cash limit (C82);
   - a balance transfer's rate and fee (written nowhere: "Balance transfer APRs and fees ... aren't written");
   - instalment plans (C34);
   - rewards and cashback (C39), the commonest reason a card is chosen, so the choice between cards ends the same way
     on rewards;
   - payment allocation by law (US Reg Z §1026.53, done in 1221's `cash.ts`);
   - the country's legal caps on rate and late fee, which 1221's `content/cards.ts` kept per country (Canada's
     criminal rate, Japan's Interest Rate Restriction Act, France's taux d'usure);
   - a limit raise, which `limitFees 'raise'` waits on.
8. **Fee waivers by bank balance are never met.** `statement` passes `deposits`, `lowest` and `average` as zero
   (`account.ts:224`). Only one card uses such a waiver today. It waits on the ledger.
9. **The card's bank isn't the account's bank.**
   - In 78 of the 172 countries that have both, no card's bank name matches the account's bank. Examples: CN account
     "中国银行", card "Bank of China"; BW "FNB" against "FNB Botswana"; AE Emirates NBD against FAB, HSBC and Mashreq.
   - Banks aren't one shared entity with an id, which breaks "one model, no second copy" (mandate rule 7).
   - A charge card paid from "the account" needs an account at that bank.
   - Needs: a bank registry keyed by id that both engines cite.

### Shallow rows (cards)

Countries whose cards lack a term:
- minimum: 87 of 174 have it;
- grace: 64;
- late: 97;
- returned: 50;
- penalty: 36;
- over-limit: 68;
- `limit`: 0.

Six countries' cards carry none of minimum, grace, late, cash, FX, penalty or returned: CD, GF, IE, WF, YE, YT.

The deep thirteen are missing these terms:

| Country | Missing |
|---|---|
| US | grace, minimum, over-limit (Chase's boxes say "None"), limit |
| CA | grace, late, minimum |
| FR | cash, grace, late, minimum, over-limit, penalty, returned |
| JP | FX, grace, late, minimum, penalty, returned |
| IE | everything but rate and fees |
| ES | grace, late, penalty, returned |
| MX | FX, grace, minimum, penalty, returned |

- 53 countries have one issuer, 52 have two.
- 72 are blocked.
- HANDOFF says "the 158 files written before then hold their rate and fees only", re-read in task 18; the term counts
  above are what remains.

**Verdict: not complete.**
- One wrong outcome: no minimum is charged as pay-in-full, for 1,375 cards.
- One mandate breach: a typed limit and an unread income.
- Built from it: eligibility and the limit rule, payment from an account, the penalty's lifting, default and close,
  and the missing terms above.

---

## 4. Credit records (`money.credit`)

Holds the bureau, the days to report, the years kept, and `clears`. Matrix: 140 researched (2 of them `none`),
106 blocked, 6 proven. Standing: 1000 less 250 for each live mark (`credit.ts:63,82`).

### Gaps, ranked

1. **No history is the best record.** A new adult with no file stands at 1000 and is priced at the bottom of every
   range (`priced`). In real life a thin file is refused or priced at the top: the US, Canada, the UK and Australia all
   score "no history" low or not at all.
   - KEEP 14 lists "credit record" among the family's figures. HANDOFF l.436 sets it to "starts with no late payment",
     which is the best.
   - 1221 had a starting score, `NO_CARD.aging`, and growth with on-time months (`credit.ts:1277-1278, 1540-1560`).
   - Needs: the file's `history` (months reported, accounts open) as an input to standing, and the bureaus' published
     treatment of a thin file.
2. **Only a late card payment moves the record.** Nothing moves it for:
   - on-time payments (positive data, reported in most of the 140);
   - utilization (1221's "over thirty percent costs");
   - hard inquiries on applying (1221's `INQUIRY`);
   - defaults, collections and charge-offs, which are kept longer in many laws;
   - an overdraft sent to collections, or a loan.
   - Needs:
     - per country, `positive: boolean` (whether the registry keeps positive data, which is published);
     - `default: {days, keep}` (charge-off and default rules are commonly statutory);
     - `inquiry: {keep}` (FCRA two years; the UK's twelve months), so a reader can bite.
3. **The scale is the game's, everywhere.** Many bureaus publish their scale and bands. FICO is 300-850, Equifax Canada
   300-900, Experian UK 0-999, CIBIL 300-900, Schufa a percentage. A life in those countries meets their number.
   - 1221 showed the US scale in the US and Canada and a word elsewhere (`credit.ts:316, 683`).
   - Needs: `scale: {min, max, bands?}` per bureau where published, with the game's 0-1000 mapped into it and said as
     the game's.
4. **`report` is the game's 30 days in 71 of 138 kept countries** (`reportGame`), among them MX, BR, AR, CN, NO, SE,
   DK, NZ, SG, ZA and TR. `clears` is in only 4.
5. **The years kept run from the report, not from the first delinquency.** FCRA counts seven years from the first
   delinquency (the US file's note says so); `record` counts from `at`, the report day (`credit.ts:70`). That's thirty
   days off on a seven-year keep. Minor.

**Verdict: not complete.**
- One wrong outcome: no history reads as the best.
- The record bites only through late card payments.
- 71 rows use the game's days.

---

## 5. Exchange rates (`money.rates`) and the currency the life is kept in

Holds 144 Treasury series to 2026-09-30, pegs, BYN, CFP. Matrix: 229 researched, 22 proven, 1 blocked (KPW).

### Gaps, ranked

1. **Nothing reads it.** `exchangeOn` has no caller (section 0). Spending in another currency on a card takes an amount
   "what it came to in the card's" (`account.ts:150`), so the rate isn't applied.
   - Needs: `card.spend` and the ledger's foreign postings convert through `exchangeOn`. The estimate flag reaches the
     player, which KEEP 14 requires ("exchange rates are estimates").
2. **The currency the life is kept in has no engine.**
   - KEEP 14: "the money is kept in the currency of the place the life starts".
   - The means engine returns the WID figures' currency (Liberia and Zimbabwe in USD). Nothing decides the life's
     currency or converts the family's means into it.
   - Home on the first morning is the owner's open question. The function that takes that answer and fixes the save's
     currency (and the account's) is still missing.
   - 1221 had `saveCurrency` and `inSaveMoney` (`systems/banking.ts`), and `held` native balances
     (`core/ledger.ts`).
3. **Rates stop at 2026-09-30** (147 series end there; three on 2026-10-15; one on 2025-12-31). Every later day holds
   the last quarter's rate, for good. That's an honest estimate, but past the research date nothing moves.
   - KEEP 18 asks for "how pay and prices move in it". No engine moves prices, pay or rates in time:
     - `world.prices` is carried to 2025 by CPI and holds there;
     - `money.means` is 2024 with "no inflation is added" (HANDOFF l.434);
     - rates are 2026.

     So the first morning mixes 2024, 2025 and 2026 money. Rule 7 says money never contradicts.
   - Needs:
     - one base date for every figure (the start), carried by each country's own CPI where published (the prices
       engine's method), and by a published projection (the IMF WEO, a central bank's target) beyond the last outturn,
       said as an estimate;
     - a blocker where none is published;
     - the Treasury's quarterly update read each quarter as it comes.
4. **No bank spread.** A bank's buy and sell rate and its card scheme rate differ from the mid-rate. Where a bank
   publishes its rate or margin, it belongs in the banks form (§1 gap 10). Elsewhere it stays a stated estimate.
5. **Display.** `currencies.json` has the ISO name and minor units only; 1221's `content/currency.ts` had the symbol,
   its side and the decimals shown. That's for layer 5, but the data is a fact to research (CLDR) and has no home yet.

**Verdict: the research is complete (one blocker). It has no reader, no life currency, and no movement in time.**

---

## 6. Family means (`money.means`)

Holds the WID 2024 average post-tax disposable income and net personal wealth per adult, by six bands. Matrix: 211
researched, 35 blocked, 6 proven.

### Gaps, ranked

1. **Net personal wealth isn't money in savings.** WID's `hweal` takes in housing, business assets and pension wealth,
   net of debt. The engine puts the whole band average into a savings account on the first morning (`means.ts:6-10`):
   - US Modest: $96,386;
   - US Comfortable: $503,066;
   - US Inherited: $19,311,290 in cash.

   It also gives the life the band's average adult's own wealth, not what a family passes to a young adult.
   - Needs: the financial-asset or deposit components where WID or the national wealth survey publishes them (WID's
     wealth composition, the US SCF, the ECB HFCS, the UK WAS), and a stated game rule for the share a family passes on.
     Otherwise the figure is shown for what it is.
2. **Debt is dropped.** In 201 of 211 countries the bottom band's savings is 0 because its average net wealth is
   negative (US p0p20 average -$21,480). The engine floors it at nothing.
   - A family that owes gives no debt. No student loan or family debt reaches the life.
   - Needs: the debt component, read where published, and a ledger that can hold a liability.
3. **KEEP 14's other family figures aren't set.** "Checking, savings, credit record, the card's limit": the record
   starts clean (section 4, gap 1) and the limit is typed (section 3, gap 2). Neither is the family's.
4. **2024 money in a 2026 start, with no inflation** (section 5, gap 3).
5. **"Per adult, equal-split" against a household's checking.** A month of the band's average income per adult is
   defensible as the game's reading. It is labelled so.

**Verdict: researched and complete as a catalog, with no reader.** The savings figure is the wrong quantity (all wealth
as cash). Debt, the record and the limit aren't the family's.

---

## 7. Core money (`src/core/money/money.ts`)

Integer minor units, ISO 4217, half-to-even rounding, allocate, and exchange marked as an estimate. Sound.
- Missing for layer 3: the ledger (postings that sum to a balance, a transaction balancing to zero, a liability).
- Missing: a native `held` figure for an account in another currency than the life's (1221 `core/ledger.ts`).

---

## Owner's asks not met (BUILD-ORDER layer 3, KEEP 14 and 18)

| Ask | State |
|---|---|
| Every country's banks | 1 bank in 211 countries; 24 blocked |
| Fee sheets | Holding fees only. No per-transaction, ATM, overdraft, transfer or debit card fees |
| Account formats | Not built. HANDOFF reads KEEP 14 as cutting it; KEEP 18 and BUILD-ORDER still require it. **Ask the owner** |
| Returned-payment rules (KEEP 18) | Not in the bank form; the card's `returned` is unread |
| Checking, savings (KEEP 14) | Means gives figures; no account holds them, no savings product, no interest |
| Credit record (KEEP 14) | Built; the family doesn't set it; no history reads as best |
| The card's limit (KEEP 14) | Typed by the player; no rule, no family figure |
| The currency the life is kept in | No engine decides it or converts into it |
| How pay and prices move in it (KEEP 18) | Nothing moves in time; 2024, 2025 and 2026 figures side by side |
| Exchange as estimates said to be estimates | `Exchanged.estimate: true` exists; nothing calls it |

## What to build first (by how often a life meets it)

1. The ledger and the everyday account. It is the reader of banks' `feeFor`, of means, of rates, and of the card's
   payment.
2. Each card's minimum, researched (stop charging no-minimum cards as pay-in-full), and the limit and eligibility rule.
3. Overdraft and returned payment, savings interest, and the debit card with ATM fees, in the bank form.
4. Credit history (thin file, positive data, inquiries, default) and the bureaus' scales.
5. More banks per country, a shared bank registry, the life's currency, and one base date carried by CPI.
6. Account formats and transfers between banks, once the owner rules on account formats.
