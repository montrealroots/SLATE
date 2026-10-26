/**
 * SLATE — race and ethnicity, for the character the player makes.
 *
 * This is who the character is, and nothing else. It carries no attribute, no
 * skill, no advantage and no penalty; nothing in the simulation reads it, and
 * nothing ever will read it to decide what happens to somebody. It is here
 * because a person has one and a character sheet that cannot say so is
 * describing somebody who does not exist.
 *
 * More than one can be true at once, so this is a set rather than a choice.
 * The categories are broad on purpose — they are the coarse groupings national
 * statistics agencies publish, which is the only reason a fixed list is
 * defensible at all — and because no fixed list is ever going to fit
 * everybody, there is a place to say it in your own words instead.
 *
 * It is set once, at creation, and only for the player. The game does not ask
 * it of anybody else and does not infer it from anywhere: not from a name, not
 * from a country, not from a city.
 */

export interface Ethnicity {
  id: string;
  /** What it is called on the picker. */
  label: string;
}

export const ETHNICITIES: readonly Ethnicity[] = [
  { id: 'american-indian', label: 'American Indian Or Alaska Native' },
  { id: 'asian', label: 'Asian' },
  { id: 'black', label: 'Black Or African' },
  { id: 'hispanic', label: 'Hispanic Or Latino' },
  { id: 'mena', label: 'Middle Eastern Or North African' },
  { id: 'pacific', label: 'Native Hawaiian Or Pacific Islander' },
  { id: 'white', label: 'White' },
  { id: 'other', label: 'Another Race Or Ethnicity' },
];

export const ETHNICITY_BY_ID: Readonly<Record<string, Ethnicity>> = Object.fromEntries(
  ETHNICITIES.map((one) => [one.id, one]),
);

/** The one that opens a box to write in. */
export const ETHNICITY_OTHER = 'other';

export const ETHNICITY_NOTE =
  'Choose as many as are true. It’s part of who your character is and nothing more: it changes no '
  + 'ability, nothing in the game uses it, and the game never guesses it from a name or a country. '
  + 'Leave it blank if you’d rather not say.';

/** How a set of them reads on a page, in the order the list is written. */
export function describeEthnicity(ids: readonly string[], own: string | undefined): string {
  const named = ETHNICITIES
    .filter((one) => ids.includes(one.id))
    .map((one) => (one.id === ETHNICITY_OTHER && own?.trim() ? own.trim() : one.label));
  return named.length > 0 ? named.join(', ') : '—';
}
