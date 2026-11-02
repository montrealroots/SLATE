import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Compiles the genres a life's work is in (src/person/genres/genres.json) from the research, each file checked against
 * the SHA-256 its register entry cites before a byte of it is read:
 *
 * - research/sources/person/identity/genres.json (person.identity.genres, R-4619): each genre's definition, quoted from
 *   its cited source (KEEP entry 12). A genre the research has no definition for isn't compiled, so it isn't offered;
 *   one listed with an empty definition is refused.
 * - research/sources/person/identity/background.json (person.identity.background, R-4622): the market's own genre
 *   groups and their figures, the BFI's UK and Ireland box office by primary genre (2023).
 *
 * Each genre is placed in one of the BFI's groups (GROUPS, below). Where the group bears the genre's own name, the
 * source makes the placing; everywhere else it is the game's reading, held in the register entry person.genres.model.
 * A genre's effect on a spec's sale is not modeled: no source counts the specs written by genre, so the trackers' deal
 * counts (Go Into The Story, R-4622) can't be turned into odds.
 */
export const OUTPUT = 'src/person/genres/genres.json';
export const DEFINITIONS = { fact: 'person.identity.genres', file: 'research/sources/person/identity/genres.json' } as const;
export const MARKET = { fact: 'person.identity.background', file: 'research/sources/person/identity/background.json' } as const;

/** The BFI's figure, as the research names its unit. */
export const BFI_UNIT = 'share of gross box office and of releases';

/** Each of the 149 genres (KEEP entry 12): its BFI primary-genre group. */
export const GROUPS: Readonly<Record<string, string>> = {
  Absurdist: 'Comedy',
  Action: 'Action',
  'Action Comedy': 'Action',
  Adventure: 'Adventure',
  'Alternate History': 'Drama',
  Animated: 'Animation',
  Anime: 'Animation',
  Anthology: 'Drama',
  Apocalyptic: 'Science fiction',
  'Art House': 'Drama',
  'Avant-Garde': 'Drama',
  'Backstage Musical': 'Musical',
  Biker: 'Action',
  Biographical: 'Drama',
  'Black Comedy': 'Comedy',
  Blaxploitation: 'Action',
  'Body Horror': 'Horror',
  'Buddy Comedy': 'Comedy',
  'Buddy Cop': 'Action',
  Caper: 'Comedy',
  Chanbara: 'Action',
  Chase: 'Action',
  "Children's": 'Family',
  Christmas: 'Family',
  Comedy: 'Comedy',
  'Coming Of Age': 'Drama',
  'Concert Film': 'Documentary',
  'Conspiracy Thriller': 'Thriller',
  'Cosmic Horror': 'Horror',
  'Costume Drama': 'Drama',
  'Courtroom Drama': 'Drama',
  'Creature Feature': 'Horror',
  Crime: 'Crime',
  Cyberpunk: 'Science fiction',
  Dance: 'Musical',
  'Dark Fantasy': 'Fantasy',
  Detective: 'Crime',
  Disaster: 'Action',
  Docudrama: 'Drama',
  Docufiction: 'Drama',
  Documentary: 'Documentary',
  'Domestic Drama': 'Drama',
  Drama: 'Drama',
  Dystopian: 'Science fiction',
  'Eco-Horror': 'Horror',
  Epic: 'Drama',
  'Erotic Thriller': 'Thriller',
  Espionage: 'Thriller',
  Experimental: 'Drama',
  Exploitation: 'Horror',
  'Fairy Tale': 'Fantasy',
  Family: 'Family',
  Fantasy: 'Fantasy',
  Farce: 'Comedy',
  'Film Noir': 'Crime',
  'Folk Horror': 'Horror',
  'Found Footage': 'Horror',
  Gangster: 'Crime',
  Giallo: 'Horror',
  'Gothic Horror': 'Horror',
  Grindhouse: 'Action',
  Hangout: 'Comedy',
  Heist: 'Crime',
  'Historical Drama': 'Drama',
  'Historical Fiction': 'Drama',
  Holiday: 'Family',
  'Hood Film': 'Drama',
  Horror: 'Horror',
  'Horror Comedy': 'Horror',
  Isekai: 'Animation',
  Jidaigeki: 'Drama',
  'Jukebox Musical': 'Musical',
  Kaiju: 'Science fiction',
  'Kitchen Sink Drama': 'Drama',
  'Legal Drama': 'Drama',
  'Magical Realism': 'Drama',
  'Martial Arts': 'Action',
  'Medical Drama': 'Drama',
  Melodrama: 'Drama',
  Military: 'War',
  Mockumentary: 'Comedy',
  'Monster Movie': 'Horror',
  Mumblecore: 'Drama',
  Musical: 'Musical',
  Mystery: 'Suspense',
  'Nature Documentary': 'Documentary',
  'Neo-Noir': 'Crime',
  Neorealism: 'Drama',
  'New Wave': 'Drama',
  'Nordic Noir': 'Crime',
  Occult: 'Horror',
  Parody: 'Comedy',
  'Period Drama': 'Drama',
  Picaresque: 'Comedy',
  'Police Procedural': 'Crime',
  'Political Drama': 'Drama',
  'Political Thriller': 'Thriller',
  'Post-Apocalyptic': 'Science fiction',
  'Prison Film': 'Drama',
  'Psychological Horror': 'Horror',
  'Psychological Thriller': 'Thriller',
  'Queer Cinema': 'Drama',
  Revenge: 'Thriller',
  'Road Movie': 'Drama',
  Rockumentary: 'Documentary',
  Romance: 'Romance',
  'Romantic Comedy': 'Comedy',
  'Romantic Drama': 'Romance',
  Samurai: 'Action',
  Satire: 'Comedy',
  'Science Fantasy': 'Science fiction',
  'Science Fiction': 'Science fiction',
  'Screwball Comedy': 'Comedy',
  'Sea Adventure': 'Adventure',
  'Silent Film': 'Drama',
  Slapstick: 'Comedy',
  Slasher: 'Horror',
  'Slice Of Life': 'Drama',
  'Social Realism': 'Drama',
  'Space Opera': 'Science fiction',
  'Spaghetti Western': 'Western',
  Splatter: 'Horror',
  Sports: 'Drama',
  Spy: 'Action',
  Steampunk: 'Science fiction',
  'Stoner Comedy': 'Comedy',
  Superhero: 'Action',
  Supernatural: 'Horror',
  Surrealist: 'Drama',
  Survival: 'Thriller',
  Swashbuckler: 'Adventure',
  'Sword And Sandal': 'Adventure',
  'Sword And Sorcery': 'Fantasy',
  'Techno-Thriller': 'Thriller',
  Teen: 'Comedy',
  Thriller: 'Thriller',
  'Time Travel': 'Science fiction',
  Tokusatsu: 'Science fiction',
  Tragedy: 'Drama',
  Tragicomedy: 'Drama',
  'True Crime': 'Crime',
  Vampire: 'Horror',
  War: 'War',
  Werewolf: 'Horror',
  Western: 'Western',
  Whodunit: 'Suspense',
  Wuxia: 'Action',
  Yakuza: 'Crime',
  Zombie: 'Horror',
};

interface Source {
  url: string;
  title: string;
}
interface Definitions {
  genres: { name: string; definition: string; sources: { src: number }[] }[];
  sources: Source[];
  blockers: { item: string }[];
}
interface Market {
  figures: { item: string; value: Record<string, unknown> }[];
}
interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

export interface Genre {
  name: string;
  definition: string;
  sources: Source[];
  /** The BFI's primary-genre group. */
  bfi: string;
}

export interface Genres {
  genres: Record<string, Genre>;
  /** The BFI's 2023 UK and Ireland releases and gross (£m) by primary genre, and all films'. */
  bfi: { groups: Record<string, { releases: number; gross: number }>; all: { releases: number; gross: number } };
}

/** A file's bytes, once the register's SHA-256 for it holds. */
export function cited(root: string, at: { fact: string; file: string }): unknown {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const sha = register.entries.flatMap((e) => (e.fact === at.fact && e.value?.file === at.file ? [e.value.sha256] : []))[0];
  if (sha === undefined) throw new Error(`${at.file} isn't cited by the register`);
  const bytes = readFileSync(join(root, at.file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${at.file} isn't the file the register cites`);
  return JSON.parse(bytes.toString('utf8'));
}

/** A genre's id: its name in lower case, an apostrophe dropped, every other run of non-letters a hyphen. */
export const idOf = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll("'", '')
    .replace(/[^a-z0-9]+/g, '-');

const figure = (m: Market, unit: string): Record<string, unknown> => {
  const f = m.figures.find((x) => x.item === 'genre-market' && x.value['unit'] === unit);
  if (f === undefined) throw new Error(`the research has no genre-market figure in ${unit}`);
  return f.value;
};

export function compile(d: Definitions, m: Market): Genres {
  const rows = figure(m, BFI_UNIT)['rows'] as Record<string, number[]>;
  const bfiGroups = Object.fromEntries(Object.entries(rows).map(([g, [releases, , gross]]) => [g, { releases: releases as number, gross: gross as number }]));
  const all = figure(m, BFI_UNIT);

  const defined = new Set(d.genres.map((g) => g.name));
  const blocked = new Set(d.blockers.map((b) => b.item));
  for (const name of Object.keys(GROUPS)) if (!defined.has(name) && !blocked.has(name)) throw new Error(`${name} is neither defined nor a blocker in the research`);

  const genres: Record<string, Genre> = {};
  for (const g of d.genres) {
    const bfi = GROUPS[g.name];
    if (bfi === undefined) throw new Error(`${g.name} has no market group`);
    if (g.definition === '') throw new Error(`${g.name} has no definition`);
    if (!(bfi in bfiGroups)) throw new Error(`${g.name}'s BFI group ${bfi} isn't the BFI's`);
    genres[idOf(g.name)] = { name: g.name, definition: g.definition, sources: g.sources.map((s) => ({ url: (d.sources[s.src] as Source).url, title: (d.sources[s.src] as Source).title })), bfi };
  }
  return { genres, bfi: { groups: bfiGroups, all: { releases: all['total_releases'] as number, gross: all['total_gross_gbp_millions'] as number } } };
}

export const serialize = (g: Genres) => `${JSON.stringify(g, null, 1)}\n`;
