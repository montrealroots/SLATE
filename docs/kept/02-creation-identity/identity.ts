/**
 * SLATE — proving who one is where it's asked (docs/WORLD.md, stage 1c), from
 * 2026-09-30, from `docs/research/world/research-documents-safetynet.json`.
 *
 * REAL ID: since 7 May 2025 the TSA has asked a REAL ID-compliant license or
 * ID card, or a passport, at its checkpoints. New York, Connecticut and
 * California charge the same for a REAL ID card as for one that isn't, and an
 * American state's ID card that SLATE issues to a citizen is REAL ID; one issued
 * to somebody who isn't is non-verified, Not For Federal Identification, as
 * Connecticut issues it (from 2026-10-16: until then every one was REAL ID).
 *
 * Until 2026-10-09 SLATE read more of it: that date, TSA ConfirmID's $45 for
 * ten days of travel to a traveler with neither, and Connecticut's upgrade of
 * a license before its renewal for its $30 duplicate fee (New York's and
 * California's off-cycle price wasn't read). ConfirmID at the checkpoint
 * (`atTheCheckpoint`, which read the date, the fee and the days), and Papers'
 * line naming its fee, went in that day's scope reset; the upgrade
 * (`documents.real_id`, which read its fee) went later that day. The four
 * figures only they read (`enforcedFrom`, `confirmIdUsd`, `confirmIdDays`,
 * `ctUpgradeUsd`) stayed, read by nothing, and went too (from 2026-10-12).
 * Now the only REAL ID figure a save reads is a starting license's REAL ID
 * share.
 *
 * A starting license is REAL ID at its state's published share of holders
 * (`docs/research/world/research-home-effects.json`): California's 58% (DMV,
 * May 2025), Connecticut's about 73% (its DMV, to CT Mirror), New York's
 * "more than half" of 8.6 million REAL ID and Enhanced holders (May 2026),
 * taken at half, its floor; another state's, the mean of the three. The TSA's
 * 94% of travelers by December 2025 counts passports too, and isn't a share
 * of licenses.
 *
 * A state ID card, for someone the state hasn't licensed to drive: New York's
 * non-driver ID, $14 for eight years under 62; Connecticut's, $28; California's,
 * $40, six birthdays. Each is REAL ID for a citizen.
 *
 * Connecticut's, from 2026-10-17 (`docs/research/world/research-ct-idcard.json`,
 * read on the state's pages on 2026-10-16): seven years to a birthday, the first
 * birthday at least seven years on, the one day CGS 1-1h(b)(2) ("not exceeding
 * seven years following the date of the applicant's next birthday") and the
 * DMV ("valid for 7 years"; a card "expires, which is on your birthday") both
 * allow; and it isn't handed over at the office but mailed, "within 20 business
 * days" of the appointment (Central Issuance), the temporary paper credential
 * given meanwhile not taken alone where an ID is asked ("won't accept the TPC as
 * a standalone document"). Until 2026-10-17 it ran six years from the day,
 * SLATE's figure for the state's "up to seven", and a citizen's was in force at
 * the counter. Whose holidays the twenty business days skip isn't said: SLATE
 * counts the federal ones.
 */

export const REAL_ID = {
  /** The share of a state's licenses that are REAL ID or Enhanced, where published. */
  share: { 'us-ca': 0.58, 'us-ct': 0.73, 'us-ny': 0.5 } as Readonly<Record<string, number>>,
} as const;

/** A state's REAL ID share, or the mean of those published. */
export const realIdShare = (jurisdiction: string): number => REAL_ID.share[jurisdiction] ?? Object.values(REAL_ID.share).reduce((a, x) => a + x, 0) / Object.values(REAL_ID.share).length;

/**
 * Beside them, from later on 2026-09-30 (`research-travel4.json`): Ontario's
 * Photo Card, CA$35 (ontario.ca); British Columbia's BCID, CA$35 (from
 * search summaries, ICBC's table not rendering); Mexico's INE credential,
 * free (INE), for a Mexican of 18; and Ireland's passport card, €35, for five
 * years or to the passport book's expiry, to a holder of an Irish passport.
 * The Ontario and BC cards' and the INE's terms weren't read, and they don't
 * expire in SLATE.
 */
export const ID_CARDS: Readonly<Record<string, { name: string; fee: number; years?: number; toBirthday?: boolean; mailedBusinessDays?: number; currency?: string; citizens?: string; age?: number; passportBook?: boolean }>> = {
  'us-ny': { name: 'Non-Driver ID Card', fee: 14, years: 8 },
  'us-ct': { name: 'Non-Driver Identification Card', fee: 28, years: 7, toBirthday: true, mailedBusinessDays: 20 },
  'us-ca': { name: 'Identification Card', fee: 40, years: 6 },
  'ca-on': { name: 'Ontario Photo Card', fee: 35, currency: 'CAD' },
  'ca-bc': { name: 'BCID', fee: 35, currency: 'CAD' },
  'mx-cmx': { name: 'Credencial Para Votar (INE)', fee: 0, currency: 'MXN', citizens: 'MX', age: 18 },
  ie: { name: 'Passport Card', fee: 35, years: 5, currency: 'EUR', citizens: 'IE', passportBook: true },
};
