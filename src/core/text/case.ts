/**
 * Title Case, the owner's rule from the first SLATE (`.claude/rules/title-case.md`; ported 2026-10-30 from
 * `montrealroots/1221`, `src/engine/core/text.ts`). Every label, heading, button, tab and title is Title Case: every
 * word starts with a capital, small words included ("Skip To Event", never "Skip to Event"). Prose isn't: a sentence
 * stays a sentence. The rule lives here once, so the screens that write a label and the gate that holds every label
 * to it can't disagree.
 *
 * Changed from 1221 in the port: a letter is any script's, not only A to Z (1221's `[a-z]` read "île" as starting at
 * its l and wrote "îLe"); and a word holding a slot for a value (`{country}`) is left as written, as 1221's
 * `tools/title-case.mjs` did and its `text.ts` didn't, since what fills the slot is a name already in its own case.
 */

/**
 * One word of a label with its first letter a capital, unless it's spelled as it is on purpose: no lower-case letter
 * at all (USA, 3D, £), a capital past its first letter (McKinsey, iPhone, P&L), a digit first ("97th", never "97Th"),
 * or a slot for a value. Leading brackets and quotes are skipped to find the first letter.
 */
export function titleCaseWord(word: string): string {
  if (!/\p{Ll}/u.test(word) || word.includes('{')) return word;
  const first = word.search(/[\p{L}\p{N}]/u);
  const lead = word.charAt(first);
  const rest = word.slice(first + 1);
  if (/\p{N}/u.test(lead) || /\p{Lu}/u.test(rest)) return word;
  return word.slice(0, first) + lead.toUpperCase() + rest;
}

/**
 * Whether a string is prose rather than a label: it ends in a full stop, a question mark or an exclamation mark, or
 * it's longer than nine words, either of which means somebody wrote a sentence. Title-casing one makes it worse.
 * Nothing at all reads as prose too, so an empty string is never called a label.
 */
export function readsAsProse(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || /[.?!]$/.test(trimmed) || trimmed.split(/\s+/).length > 9;
}

/** A label in Title Case, each word as `titleCaseWord` has it and every space kept; prose comes back untouched. */
export function titleCaseLabel(value: string): string {
  return readsAsProse(value) ? value : value.replace(/\S+/g, titleCaseWord);
}
