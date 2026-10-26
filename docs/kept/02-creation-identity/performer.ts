/**
 * SLATE — actor, or actress.
 *
 * They are two names for one craft, and the business has always kept them
 * apart, so the game does too. The player is one or the other, and the places
 * that name them use their word: Home, the rail and the save slot.
 *
 * How the title is decided: pronouns settle it where they can, he/him being
 * an actor and she/her an actress. They/them settles neither, so the player
 * picks. The creation screen opens that choice empty, because preselecting
 * one of two equals is what a default is, and neither of them is. Nobody's
 * title is ever guessed from their name.
 *
 * It is a word, not a stat. This said nothing branched on it but what they
 * are called, which stopped being true when the school's plays were cast
 * (`systems/school.ts`): a part written for an actor or an actress goes to
 * one, and the title says which the player is. It makes nobody better or
 * worse at anything.
 */

export type PerformerTitle = 'actor' | 'actress';

export const PERFORMER_TITLES: readonly PerformerTitle[] = ['actor', 'actress'];

/** The word itself, as a label prints it. */
export const PERFORMER_NOUN: Readonly<Record<PerformerTitle, string>> = { actor: 'Actor', actress: 'Actress' };

/**
 * The title a set of pronouns settles by itself, or undefined when it is the
 * player's to make. Case and spacing do not change the answer.
 */
export function settledTitle(pronouns: string): PerformerTitle | undefined {
  if (/^\s*he\b/i.test(pronouns)) return 'actor';
  if (/^\s*she\b/i.test(pronouns)) return 'actress';
  return undefined;
}

/**
 * The title pronouns imply when nobody stated one: what they settle, and
 * actor where they settle nothing.
 *
 * Only for a save that reaches the engine without a title, which the creation
 * screen never sends: one built straight from the engine, one written under
 * schema 80, which shed the title, or one from before the title was kept. A
 * fallback is not a default, and the screen does not use it.
 */
export function impliedPerformerTitle(pronouns: string): PerformerTitle {
  return settledTitle(pronouns) ?? 'actor';
}

/** Whether a stored value is one of the two words, for a save read back in. */
export function isPerformerTitle(value: unknown): value is PerformerTitle {
  return value === 'actor' || value === 'actress';
}
