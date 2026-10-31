import { defineCommand, type Json } from '../../core/frame/frame.ts';
import data from './attributes.json';

/**
 * The person's attributes (BUILD-ORDER layer 4; the owner's rulings of 2026-10-31: attributes return for all four
 * roles, each role keeping its most-backed set, shown as a number, "Dialogue - 92", with an engine behind each). The
 * screenwriter's are the 27 named by at least four independent institutions in the research
 * (research/sources/person/attributes/screenwriter.json, R-4601; workbench/plans/screenwriter-attributes.md), each
 * tied to the research group it stands for.
 *
 * Each is a number from 0 to 100, 100 the most. The player sets where each starts when the life is made (the owner:
 * "there should be an option to pick how good I want to be"), each on its own or all at one level; and doing the work
 * raises what the work uses (the owner: "if its not maxed out then through doing work my skills/attributes get raised"),
 * faster from low and slower near the top, never past 100. Growth's pace is the game's own figure until the owner
 * balances it (register person.work.model).
 */

export type Role = keyof typeof data;
export type ScreenwriterAttribute = (typeof data.screenwriter)[number]['id'];

export interface Attribute {
  readonly id: string;
  /** As the player reads it. */
  readonly name: string;
  /** The research group it stands for, by its name there. */
  readonly research: string;
}

export const ROLES = Object.keys(data) as Role[];
export const ATTRIBUTES: Readonly<Record<Role, readonly Attribute[]>> = data;
export const MAX = 100;

/** The values held, by role, then attribute. A role is held once its values are chosen. */
export interface AttributesSlice {
  [role: string]: { [attribute: string]: number };
}

export const ATTRIBUTES_START: AttributesSlice = {};

/** An attribute's value as the player reads it: whole, rounded down, so 100 shows only once it's reached. */
export const shown = (value: number): number => Math.floor(value);

/** "Dialogue - 92". */
export function label(role: Role, id: string, value: number): string {
  return `${attributeOf(role, id).name} - ${shown(value)}`;
}

export function attributeOf(role: Role, id: string): Attribute {
  const found = (ATTRIBUTES[role] as readonly Attribute[] | undefined)?.find((a) => a.id === id);
  if (found === undefined) throw new Error(`${role} has no attribute ${id}`);
  return found;
}

/** A role's values, as chosen; refused where the role's values haven't been chosen. */
export function valuesOf(s: AttributesSlice, role: Role): Readonly<Record<string, number>> {
  const v = s[role];
  if (v === undefined) throw new Error(`the ${role}'s attributes haven't been chosen`);
  return v;
}

/** One value, held to the scale. */
const level = (n: unknown, what: string): number => {
  if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > MAX) throw new RangeError(`${what} is a whole number from 0 to ${MAX}`);
  return n as number;
};

export interface ChooseArgs {
  [key: string]: Json;
  role: string;
  /** Every attribute at one level. */
  all?: number;
  /** Each attribute's own level (every one of the role's), or levels over `all` for the ones named. */
  each?: Record<string, number>;
}

/** The levels chosen when the life is made: every attribute of the role, each from 0 to 100. */
export function chosen(args: ChooseArgs): Record<string, number> {
  const role = args.role as Role;
  const list = ATTRIBUTES[role] as readonly Attribute[] | undefined;
  if (list === undefined) throw new Error(`there's no role ${args.role}`);
  const each = args.each ?? {};
  for (const id of Object.keys(each)) attributeOf(role, id);
  const out: Record<string, number> = {};
  for (const a of list) {
    const v = each[a.id] ?? args.all;
    if (v === undefined) throw new Error(`${a.name} needs a level`);
    out[a.id] = level(v, a.name);
  }
  return out;
}

/** Sets where a role's attributes start, when the life is made. */
function choose(s: { attributes: AttributesSlice }, a: ChooseArgs): void {
  s.attributes[a.role] = chosen(a);
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declaration is held by the test
// that lists each command with what it reads and writes; what it does is mutated above.
export const chooseAttributes = defineCommand<{ attributes: AttributesSlice }, ChooseArgs>({ id: 'attributes.choose', reads: [], writes: ['attributes'], run: choose });
// Stryker restore all

/**
 * Work raises what it uses: each attribute by its share of the work (`use`, 0 to about 1.5 for a long stretch), the
 * nearer 100 the less, so a writer at 40 gains several times what one at 90 does from the same draft, and one at 100
 * gains nothing. `RATE` is the most one full use can add, from 0; the game's own figure (person.work.model).
 */
export const RATE = 4;

export function practise(values: Record<string, number>, use: Readonly<Record<string, number>>): void {
  for (const [id, u] of Object.entries(use)) {
    const v = values[id];
    if (v === undefined) throw new Error(`there's no attribute ${id} to raise`);
    values[id] = Math.min(MAX, v + RATE * Math.max(0, u) * ((MAX - v) / MAX));
  }
}
