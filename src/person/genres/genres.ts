import { defineCommand, type Json } from '../../core/frame/frame.ts';
import DATA from './genres.json' with { type: 'json' };
import type { LineId } from '../../core/text/text.ts';

/**
 * The genres a life's work is in (BUILD-ORDER layer 4; KEEP entry 12: every genre on the Genres page, each with its
 * cited definition, R-4619). The player chooses the genres they love, at least one and as many as are true; the game
 * reads the page as the genres one's work is in, so a script is written and material is optioned only in a genre loved
 * (the game's reading, person.genres.model).
 *
 * A genre's market is the market's own genre group's (R-4622; tools/person/genres/compile.ts places each genre in one):
 * a film's box office, as the BFI's UK and Ireland gross per release of its primary genre (2023) against all films'
 * (an animated film took 3.2 times the average release, a documentary a thirtieth of it); the producer's release reads
 * it, for the producer works in the UK.
 *
 * A genre's effect on a spec's sale is not modeled: no source counts the specs written by genre, so the trackers' deal
 * counts (Go Into The Story, R-4622) can't be turned into odds.
 */

/** The line that tells the player these figures are the game's own (person.genres.model). */
export const MODEL_LINE: LineId = 'genres.model';

export interface Genre {
  name: string;
  definition: string;
  sources: { url: string; title: string }[];
  bfi: string;
}

export const GENRES: Readonly<Record<string, Genre>> = DATA.genres;
const BFI: { groups: Readonly<Record<string, { releases: number; gross: number }>>; all: { releases: number; gross: number } } = DATA.bfi;

export interface GenresSlice {
  /** The genres the person loves, by id. */
  loved: string[];
}

export const GENRES_START: GenresSlice = { loved: [] };

export function genreOf(id: string): Genre {
  if (!Object.hasOwn(GENRES, id)) throw new Error(`there's no genre ${id}`);
  return GENRES[id] as Genre;
}

/** The fewest releases a BFI group must have in the year for its gross per release to count (the game's threshold: below it, one hit or one flop decides the group). */
export const MIN_RELEASES = 30;

/**
 * A film's box office in its genre against the average release's: the BFI's gross per release of its group over all
 * films'; a group of fewer than MIN_RELEASES releases counts as the average.
 */
export function boxOfficeFactor(id: string): number {
  const g = BFI.groups[genreOf(id).bfi] as { releases: number; gross: number };
  // Stryker disable next-line EqualityOperator: no BFI group has exactly MIN_RELEASES releases, so < and <= read the data alike.
  if (g.releases < MIN_RELEASES) return 1;
  return g.gross / g.releases / (BFI.all.gross / BFI.all.releases);
}

/** The work is in a genre the person loves; refused where it isn't, or before any is chosen. */
export function lovesOrRefuse(s: GenresSlice, id: string): void {
  const g = genreOf(id);
  if (s.loved.length === 0) throw new Error("the genres haven't been chosen");
  if (!s.loved.includes(id)) throw new Error(`${g.name} isn't a genre the person loves`);
}

export interface ChooseArgs {
  [key: string]: Json;
  loved: string[];
}

/** Chooses the genres the person loves: at least one, each once, any number. */
function choose(s: { genres: GenresSlice }, a: ChooseArgs): void {
  if (!Array.isArray(a.loved) || a.loved.length === 0) throw new Error('at least one genre is loved');
  for (const id of a.loved) genreOf(id);
  if (new Set(a.loved).size !== a.loved.length) throw new Error('a genre is loved once');
  s.genres.loved = [...a.loved];
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declaration is held by the
// test that lists each command with what it reads and writes; what it does is mutated above.
export const chooseGenres = defineCommand<{ genres: GenresSlice }, ChooseArgs>({ id: 'genres.choose', reads: [], writes: ['genres'], run: choose });
