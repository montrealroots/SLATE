import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Compiles the languages a person can speak and the places they are spoken (src/person/identity/languages.json) from
 * the research (research/sources/person/identity/languages.json, register fact person.identity.languages: Unicode
 * CLDR 49's territories, their languages' population shares and official status; the languages' English names; the
 * CEFR's six levels), the file checked against the SHA-256 its register entry cites before a byte of it is read. A
 * territory CLDR doesn't list (the dissolved AN and CS) is left out, so the engine says it isn't kept; one where CLDR
 * determines no language (AQ, HM: "und") is kept with none.
 */
export const SOURCE = 'research/sources/person/identity/languages.json';
export const OUTPUT = 'src/person/identity/languages.json';

interface Spoken {
  lang: string;
  share: number;
  official: string | null;
}
interface Figure {
  item: string;
  value: Record<string, unknown>;
}
interface Research {
  figures: Figure[];
  territories: Record<string, Spoken[] | null>;
}
interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

export interface Languages {
  /** Each language's English name, by its BCP 47 code. */
  names: Record<string, string>;
  /** Each territory's languages, most spoken first as CLDR orders them, with the share of people who speak each. */
  territories: Record<string, { lang: string; share: number; official: boolean }[]>;
  /** The CEFR's levels, lowest first. */
  levels: string[];
}

export function readResearch(root: string): Research {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  // Stryker disable next-line OptionalChaining: the entry found names the file, so it has a value.
  const sha = register.entries.find((e) => e.fact === 'person.identity.languages' && e.value?.file === SOURCE)?.value?.sha256;
  if (sha === undefined) throw new Error(`${SOURCE} isn't cited by the register`);
  const bytes = readFileSync(join(root, SOURCE));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${SOURCE} isn't the file the register cites`);
  return JSON.parse(bytes.toString('utf8')) as Research;
}

const figure = (r: Research, item: string): Record<string, unknown> => {
  const f = r.figures.find((x) => x.item === item);
  if (f === undefined) throw new Error(`the research has no ${item}`);
  return f.value;
};

export function compile(r: Research): Languages {
  const allNames = figure(r, 'language-names')['names'] as Record<string, string>;
  const levels = (figure(r, 'levels')['cefr'] as { level: string }[]).map((l) => l.level);
  const territories: Languages['territories'] = {};
  const used = new Set<string>();
  for (const [cc, spoken] of Object.entries(r.territories)) {
    if (spoken === null) continue;
    // CLDR's "und" (no language determined) is where it counts no one's language (AQ, HM): nothing to speak or suggest.
    territories[cc] = spoken.filter((s) => s.lang !== 'und').map((s) => {
      if (!Object.hasOwn(allNames, s.lang)) throw new Error(`${cc} speaks ${s.lang}, which has no name`);
      used.add(s.lang);
      return { lang: s.lang, share: s.share, official: s.official !== null };
    });
  }
  const names = Object.fromEntries([...used].sort().map((code) => [code, allNames[code] as string]));
  return { names, territories, levels };
}

export const serialize = (l: Languages) => `${JSON.stringify(l, null, 1)}\n`;
