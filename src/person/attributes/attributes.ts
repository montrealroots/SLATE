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
 * faster from low and slower near the top, never past 100, at the pace the research on writing skill gives: two decades
 * of practice to professional skill (Kellogg; Hayes's ten-year rule; R-4608).
 *
 * What each attribute means is the sources' (the owner: "I want those meanings to mean something and actually reflect
 * on the work"): its definition and the facets it is made of (research/sources/person/attributes/screenwriter-facets.json,
 * R-4607), each facet with the other attributes a source ties to it and the readers whose own criteria grade it. An
 * attribute acts through its facets: a facet a source ties to other attributes draws on them too.
 */

export type Role = keyof typeof data;
export type ScreenwriterAttribute = (typeof data.screenwriter)[number]['id'];

/** One part of what an attribute is, as the sources name it. */
export interface Facet {
  readonly id: string;
  /** As the player reads it. */
  readonly name: string;
  readonly meaning: string;
  /** The other attributes a source ties to it. */
  readonly draws: readonly string[];
  /** The readers the game models whose own criteria grade it. */
  readonly readers: readonly string[];
}

export interface Attribute {
  readonly id: string;
  /** As the player reads it. */
  readonly name: string;
  /** The research group it stands for, by its name there. */
  readonly research: string;
  /** What it is, in the sources' words, as the player reads it. */
  readonly definition: string;
  readonly facets: readonly Facet[];
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
 * What one facet of an attribute comes to for a person: the attribute itself, three quarters, and the attributes a
 * source ties to the facet, a quarter between them (all of it the attribute's own where none is tied). The shares are
 * the game's own (person.work.model).
 */
export function facetSkill(values: Readonly<Record<string, number>>, facet: Facet, own: string): number {
  const v = values[own] as number;
  if (facet.draws.length === 0) return v;
  return 0.75 * v + (0.25 * facet.draws.reduce((t, id) => t + (values[id] as number), 0)) / facet.draws.length;
}

/** What an attribute comes to through all its facets: their mean. */
export function skillOf(values: Readonly<Record<string, number>>, role: Role, id: string): number {
  const { facets } = attributeOf(role, id);
  return facets.reduce((t, f) => t + facetSkill(values, f, id), 0) / facets.length;
}

/**
 * The share of what's left to learn that a day of work teaches: a writer who worked every day for twenty years would go
 * from 10 to 80. The two decades are Kellogg's and Hayes's (R-4608); reading them as 10 to 80 is the game's own.
 */
export const DAILY = 1 - (20 / 90) ** (1 / (20 * 365));

/** Days of work raise each attribute they used, the nearer 100 the less, never past it. */
export function practise(values: Record<string, number>, ids: readonly string[], days: number): void {
  for (const id of ids) {
    const v = values[id];
    if (v === undefined) throw new Error(`there's no attribute ${id} to raise`);
    values[id] = MAX - (MAX - v) * (1 - DAILY) ** Math.max(0, days);
  }
}
