import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { ATTRIBUTES_START, chooseAttributes, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import { boxOfficeFactor, MIN_RELEASES, chooseGenres, genreOf, GENRES, GENRES_START, lovesOrRefuse, type GenresSlice } from '../../../src/person/genres/genres.ts';
import { optionMaterial, planProject, PRODUCING_START, projectOf, raised, releaseFilm, shootProject, target, type ProducingSlice } from '../../../src/person/producing/producing.ts';
import { SCRIPTS_START, writeScript, type ScriptsSlice } from '../../../src/person/work/work.ts';
import { BFI_UNIT, cited, compile, DEFINITIONS, GROUPS, idOf, MARKET, OUTPUT, serialize, type Genres } from '../../../tools/person/genres/compile.ts';
import { falsifyAny } from '../../support/falsify-core.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const SEED = '0123456789abcdef';
/** The five the first research left without a definition, defined since (R-4619, refreshed 2026-11-01). */
const LATE = ['Action Comedy', 'Buddy Comedy', 'Holiday', 'Hood Film', 'Psychological Horror'];

/** KEEP entry 12's 149, in its order. */
const KEEP_12 =
  "Absurdist, Action, Action Comedy, Adventure, Alternate History, Animated, Anime, Anthology, Apocalyptic, Art House, Avant-Garde, Backstage Musical, Biker, Biographical, Black Comedy, Blaxploitation, Body Horror, Buddy Comedy, Buddy Cop, Caper, Chanbara, Chase, Children's, Christmas, Comedy, Coming Of Age, Concert Film, Conspiracy Thriller, Cosmic Horror, Costume Drama, Courtroom Drama, Creature Feature, Crime, Cyberpunk, Dance, Dark Fantasy, Detective, Disaster, Docudrama, Docufiction, Documentary, Domestic Drama, Drama, Dystopian, Eco-Horror, Epic, Erotic Thriller, Espionage, Experimental, Exploitation, Fairy Tale, Family, Fantasy, Farce, Film Noir, Folk Horror, Found Footage, Gangster, Giallo, Gothic Horror, Grindhouse, Hangout, Heist, Historical Drama, Historical Fiction, Holiday, Hood Film, Horror, Horror Comedy, Isekai, Jidaigeki, Jukebox Musical, Kaiju, Kitchen Sink Drama, Legal Drama, Magical Realism, Martial Arts, Medical Drama, Melodrama, Military, Mockumentary, Monster Movie, Mumblecore, Musical, Mystery, Nature Documentary, Neo-Noir, Neorealism, New Wave, Nordic Noir, Occult, Parody, Period Drama, Picaresque, Police Procedural, Political Drama, Political Thriller, Post-Apocalyptic, Prison Film, Psychological Horror, Psychological Thriller, Queer Cinema, Revenge, Road Movie, Rockumentary, Romance, Romantic Comedy, Romantic Drama, Samurai, Satire, Science Fantasy, Science Fiction, Screwball Comedy, Sea Adventure, Silent Film, Slapstick, Slasher, Slice Of Life, Social Realism, Space Opera, Spaghetti Western, Splatter, Sports, Spy, Steampunk, Stoner Comedy, Superhero, Supernatural, Surrealist, Survival, Swashbuckler, Sword And Sandal, Sword And Sorcery, Techno-Thriller, Teen, Thriller, Time Travel, Tokusatsu, Tragedy, Tragicomedy, True Crime, Vampire, War, Werewolf, Western, Whodunit, Wuxia, Yakuza, Zombie".split(', ');

type Definitions = Parameters<typeof compile>[0];
type Market = Parameters<typeof compile>[1];
const research = () => ({ d: cited(ROOT, DEFINITIONS) as Definitions, m: cited(ROOT, MARKET) as Market });
// Read where it is used, not as the module loads, so a mutant of OUTPUT fails a test rather than the file.
const data = () => JSON.parse(readFileSync(join(ROOT, 'src/person/genres/genres.json'), 'utf8')) as Genres;

describe('the genres compile', () => {
  it("places each of KEEP entry 12's 149 genres in a BFI group", () => {
    expect(KEEP_12).toHaveLength(149);
    expect(Object.keys(GROUPS)).toEqual(KEEP_12);
    const BFI_GROUPS = Object.keys(data().bfi.groups);
    for (const name of KEEP_12) expect(BFI_GROUPS, name).toContain(GROUPS[name]);
    expect(LATE.map((n) => GROUPS[n])).toEqual(['Action', 'Comedy', 'Family', 'Drama', 'Horror']);
  });

  it('is the file the engine reads, from the files the register cites', () => {
    const { d, m } = research();
    expect(serialize(compile(d, m))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect([OUTPUT, DEFINITIONS, MARKET, BFI_UNIT]).toEqual([
      'src/person/genres/genres.json',
      { fact: 'person.identity.genres', file: 'research/sources/person/identity/genres.json' },
      { fact: 'person.identity.background', file: 'research/sources/person/identity/background.json' },
      'share of gross box office and of releases',
    ]);
    expect(serialize({ genres: {}, bfi: { groups: {}, all: { releases: 1, gross: 2 } } })).toBe('{\n "genres": {},\n "bfi": {\n  "groups": {},\n  "all": {\n   "releases": 1,\n   "gross": 2\n  }\n }\n}\n');
  });

  it("takes the BFI's releases and gross by group", () => {
    const { d, m } = research();
    const g = compile(d, m);
    expect(g.bfi.all).toEqual({ releases: 900, gross: 994.3 });
    expect(g.bfi.groups['Action']).toEqual({ releases: 148, gross: 265.8 });
    expect(g.bfi.groups['Music']).toEqual({ releases: 1, gross: 0 });
    expect(Object.keys(g.bfi.groups)).toHaveLength(18);
  });

  it('cites each definition and its sources, under an id made from the name', () => {
    const { d, m } = research();
    const g = compile(d, m);
    expect(Object.keys(g.genres)).toHaveLength(d.genres.length);
    const art = d.genres.find((x) => x.name === 'Art House');
    expect(g.genres['art-house']).toEqual({
      name: 'Art House',
      definition: art?.definition,
      sources: art?.sources.map((s) => ({ url: d.sources[s.src]?.url, title: d.sources[s.src]?.title })),
      bfi: 'Drama',
    });
    expect(g.genres['art-house']?.sources).toHaveLength(2);
    expect([idOf("Children's"), idOf('Coming Of Age'), idOf('Avant-Garde'), idOf('Sword And Sandal'), idOf('Science Fiction'), idOf('Neo-Noir')]).toEqual(['childrens', 'coming-of-age', 'avant-garde', 'sword-and-sandal', 'science-fiction', 'neo-noir']);
    expect(idOf("A'b  c--d")).toBe('ab-c-d');
  });

  it('refuses a genre with no group, no definition or a group the market has not, a placed name the research neither defines nor blocks, and a missing figure', () => {
    const { d, m } = research();
    const withGenre = (x: object) => ({ ...d, genres: [...d.genres, { name: 'Drama', definition: 'x', sources: [], ...x }] });
    expect(() => compile(withGenre({ name: 'Opera' }), m)).toThrow('Opera has no market group');
    expect(() => compile({ ...d, genres: d.genres.map((x) => (x.name === 'Drama' ? { ...x, definition: '' } : x)) }, m)).toThrow('Drama has no definition');
    const groups = GROUPS as Record<string, string>;
    const was = groups['Drama'] as string;
    try {
      groups['Drama'] = 'Opera';
      expect(() => compile(d, m)).toThrow("Drama's BFI group Opera isn't the BFI's");
    } finally {
      groups['Drama'] = was;
    }
    expect(d.blockers).toEqual([]);
    expect(() => compile({ ...d, genres: d.genres.filter((x) => x.name !== 'Zombie') }, m)).toThrow('Zombie is neither defined nor a blocker in the research');
    expect(compile({ ...d, genres: d.genres.filter((x) => x.name !== 'Zombie'), blockers: [...d.blockers, { item: 'Zombie' }] }, m).genres['zombie']).toBeUndefined();
    expect(() => compile(d, { figures: m.figures.filter((f) => f.value['unit'] !== BFI_UNIT) })).toThrow(`the research has no genre-market figure in ${BFI_UNIT}`);
    const other = { figures: m.figures.map((f) => (f.value['unit'] === BFI_UNIT ? { ...f, item: 'family-in-the-business' } : f)) };
    expect(() => compile(d, other)).toThrow(`the research has no genre-market figure in ${BFI_UNIT}`);
  });

  it("reads a file only once the register's SHA-256 for it holds", () => {
    const dir = mkdtempSync(join(tmpdir(), 'genres-'));
    mkdirSync(join(dir, 'research'));
    const at = { fact: 'person.x', file: 'x.json' };
    writeFileSync(join(dir, 'x.json'), '{"a":1}');
    const register = (entries: object[]) => writeFileSync(join(dir, 'research/register.json'), JSON.stringify({ entries }));
    const sha = createHash('sha256').update('{"a":1}').digest('hex');
    register([{ fact: 'person.x', value: { file: 'x.json', sha256: sha } }]);
    expect(cited(dir, at)).toEqual({ a: 1 });
    register([{ fact: 'person.x', value: { file: 'x.json', sha256: '0'.repeat(64) } }]);
    expect(() => cited(dir, at)).toThrow("x.json isn't the file the register cites");
    for (const entries of [[{ fact: 'person.y', value: { file: 'x.json', sha256: sha } }], [{ fact: 'person.x', value: { file: 'y.json', sha256: sha } }], [{ fact: 'person.x' }], [{ fact: 'person.x', value: { file: 'x.json' } }]]) {
      register(entries);
      expect(() => cited(dir, at), JSON.stringify(entries)).toThrow("x.json isn't cited by the register");
    }
  });
});

describe('the genres', () => {
  it('offers every one of the 149 genres, each with its cited definition', () => {
    expect(Object.keys(GENRES)).toHaveLength(149);
    expect(Object.values(GENRES).map((g) => g.name)).toEqual(KEEP_12);
    for (const g of Object.values(GENRES)) {
      expect(g.definition, g.name).not.toBe('');
      expect(g.sources.length, g.name).toBeGreaterThan(0);
      for (const s of g.sources) expect(s.url, g.name).toMatch(/^https?:\/\//);
    }
    expect(LATE.map((n) => genreOf(idOf(n)).name)).toEqual(LATE);
    expect(genreOf('science-fiction')).toBe(GENRES['science-fiction']);
    for (const id of ['constructor', 'toString', '', 'Drama']) expect(() => genreOf(id)).toThrow(`there's no genre ${id}`);
  });

  it("earns at the BFI's gross per release of its group against all films' (2023)", () => {
    const all = 994.3 / 900;
    expect(boxOfficeFactor('action')).toBeCloseTo(265.8 / 148 / all, 12);
    expect(boxOfficeFactor('animated')).toBeCloseTo(194.7 / 55 / all, 12);
    expect(boxOfficeFactor('documentary')).toBeCloseTo(3.2 / 85 / all, 12);
    expect(boxOfficeFactor('concert-film')).toBe(boxOfficeFactor('documentary'));
    // Family's two releases, Fantasy's seven, Romance's sixteen: too few to decide (MIN_RELEASES); Suspense's 34 count, Horror's 37.
    expect(MIN_RELEASES).toBe(30);
    expect(boxOfficeFactor('family')).toBe(1);
    expect(boxOfficeFactor('fantasy')).toBe(1);
    expect(boxOfficeFactor('romance')).toBe(1);
    expect(boxOfficeFactor('horror')).toBeCloseTo(71 / 37 / all, 12);
    expect(boxOfficeFactor('drama')).toBeCloseTo(157.5 / 320 / all, 12);
    // Weighed by the releases, the groups the genres are in earn the average release's.
    const placed = [...new Set(Object.values(GENRES).map((g) => g.bfi))];
    expect(placed).not.toContain('Music');
    const releases = Object.values(data().bfi.groups).reduce((t, g) => t + g.releases, 0);
    expect(releases).toBe(900);
    expect(() => boxOfficeFactor('opera')).toThrow("there's no genre opera");
  });
});

type Writing = { attributes: AttributesSlice; scripts: ScriptsSlice; genres: GenresSlice };
const chosen = (loved: string[]) => dispatch(begin(SEED, 0, { genres: structuredClone(GENRES_START) }), chooseGenres, { loved });
const writer = (loved: string[]): Life<Writing> => {
  const l = begin(SEED, 0, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START), genres: structuredClone(GENRES_START) });
  return dispatch(dispatch(l, chooseGenres, { loved }), chooseAttributes, { role: 'screenwriter', all: 50, each: {} });
};

describe('the genres a person loves', () => {
  it('are chosen, at least one and any number, each once, and chosen again replace the last', () => {
    expect(GENRES_START).toEqual({ loved: [] });
    expect(chosen(['drama']).slices.genres.loved).toEqual(['drama']);
    const every = Object.keys(GENRES);
    expect(chosen(every).slices.genres.loved).toEqual(every);
    expect(dispatch(chosen(['drama', 'horror']), chooseGenres, { loved: ['western'] }).slices.genres.loved).toEqual(['western']);
    expect(() => chosen([])).toThrow('at least one genre is loved');
    expect(() => dispatch(begin(SEED, 0, { genres: structuredClone(GENRES_START) }), chooseGenres, { loved: 'drama' as unknown as string[] })).toThrow('at least one genre is loved');
    expect(() => chosen(['drama', 'opera'])).toThrow("there's no genre opera");
    expect(() => chosen(['Holiday'])).toThrow("there's no genre Holiday");
    expect(() => chosen(['drama', 'horror', 'drama'])).toThrow('a genre is loved once');
  });

  it("are the genres the work is in: anything else is refused, as is any work before they're chosen", () => {
    expect(() => lovesOrRefuse({ loved: ['drama'] }, 'horror')).toThrow("Horror isn't a genre the person loves");
    expect(() => lovesOrRefuse({ loved: [] }, 'horror')).toThrow("the genres haven't been chosen");
    expect(() => lovesOrRefuse({ loved: ['drama'] }, 'opera')).toThrow("there's no genre opera");
    expect(() => lovesOrRefuse({ loved: [] }, 'opera')).toThrow("there's no genre opera");
    expect(lovesOrRefuse({ loved: ['drama', 'horror'] }, 'horror')).toBeUndefined();
    const l = writer(['drama', 'horror']);
    expect(dispatch(l, writeScript, { form: 'short', genre: 'horror', days: 5 }).slices.scripts.written[0]?.genre).toBe('horror');
    expect(() => dispatch(l, writeScript, { form: 'short', genre: 'comedy', days: 5 })).toThrow("Comedy isn't a genre the person loves");
  });

  it('genres.choose: a writer writes only in a genre loved', () => {
    const scripts = (loved: string[]) => {
      try {
        return dispatch(writer(loved), writeScript, { form: 'feature', genre: 'horror', days: 60 }).slices.scripts.written.length;
      } catch {
        return 0;
      }
    };
    falsifyAny({ feature: 'genres.choose', claim: 'bites', says: 'a writer who loves horror writes a horror script; one who loves only drama is refused it', base: ['drama'], twin: ['drama', 'horror'], outcome: scripts });
  });

  it("genres.choose: the producer's film earns as its loved genre's market does", () => {
    type Producing = { attributes: AttributesSlice; producing: ProducingSlice; genres: GenresSlice };
    const doubled = (genre: string) => {
      let l: Life<Producing> = dispatch(
        dispatch(begin(SEED, 0, { attributes: structuredClone(ATTRIBUTES_START), producing: structuredClone(PRODUCING_START), genres: structuredClone(GENRES_START) }), chooseGenres, { loved: [genre] }),
        chooseAttributes,
        { role: 'producer', all: 70, each: {} },
      );
      for (let id = 1; id <= 30; id += 1) {
        l = dispatch(dispatch(l, optionMaterial, { days: 5, genre }), planProject, { project: id, budget: '20000000' });
        const producing = structuredClone(l.slices.producing);
        const p = projectOf(producing, id);
        p.raised['equity'] = { currency: 'GBP', minor: target(p) - raised(p) };
        l = dispatch(dispatch({ ...l, slices: { ...l.slices, producing } }, shootProject, { project: id }), releaseFilm, { project: id });
      }
      return l.slices.producing.projects.filter((p) => p.release?.doubled === true).length;
    };
    expect(doubled('documentary')).toBe(0);
    falsifyAny({ feature: 'genres.choose', claim: 'downstream', says: "a producer who loves family films earns twice their budget back more often than one who loves documentaries, as the BFI's gross per release of each has it", base: 'documentary', twin: 'family', outcome: doubled });
  });

  it('is run through the frame, declaring what it reads and writes', () => {
    expect(commandIndex().filter((x) => x.id === 'genres.choose')).toEqual([{ id: 'genres.choose', reads: [], writes: ['genres'] }]);
  });
});

describe('the line for the game\'s own figures', () => {
  it("tells the player its own figures are the game's", async () => {
    const { MODEL_LINE } = await import('../../../src/person/genres/genres.ts');
    const { t } = await import('../../../src/core/text/text.ts');
    expect(MODEL_LINE).toBe('genres.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own");
  });
});
