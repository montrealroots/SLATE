import type { PERFORMERS } from './compile.ts';

/**
 * Where the person research (research/sources/person/ages/<CC>.json, register person.ages.<CC>, read 2026-11-01) finds
 * what layer 3's own file left unread (2026-11-01, at the owner's "Start the age readers once this lands"): the key of
 * the age in the file's figure of each item, so the age is read from that file and held in no second one.
 * - `majority`: the key of the age in its `majority` figure; `regions`: region keys, each read at its own key there;
 * - `from`: the key of the general working age in its `minimumWorkAge` figure (a dotted key reads inside a value);
 * - `performers`: what that law says of a younger performer, the game's reading of the figures' findings (the comment
 *   beside it says from which); `permit`, as the law or its office names it, verbatim in the file's figures;
 *   `permitFrom`, the key of the youngest age in its `childPerformers` figure;
 * - `settles`: why the person research's figure stands over a differing one layer 3 holds; without it, a reading of a
 *   field layer 3 already holds is refused.
 * Not read: Indonesia's majority (two readings, unsettled), Iran's (by sex, in lunar years), the Comoros' (the 2005
 * Family Code's article not read), Nigeria's (by state, contested); a working age with no performer's rule found
 * (Afghanistan, Burkina Faso, Burundi, Belarus, Bhutan, Cabo Verde, Congo, Ethiopia, Fiji, Gabon, Guinea-Bissau, Iraq,
 * Cambodia, Moldova, Mozambique, Panama, Sint Maarten, Tajikistan, Tanzania), or none general (Cayman, New Zealand,
 * Palau, Norfolk Island, Tuvalu's school-year rule, Australia's and Canada's by state, which the form holds by country);
 * the light-work ages and hours, which the youth engine reads from the same files.
 */
export interface Reading {
  readonly majority?: string;
  readonly regions?: readonly string[];
  readonly from?: string;
  readonly performers?: (typeof PERFORMERS)[number];
  readonly permit?: string;
  readonly permitFrom?: string;
  readonly settles?: string;
}

const AGE = { majority: 'age' } as const;
const OF_AGE = { majority: 'majority' } as const;

export const READINGS: Readonly<Record<string, Reading>> = {
  AF: AGE,
  // Minors are barred outright from theatres, cinemas and like places; no performer's permit.
  AO: { ...AGE, from: 'general', performers: 'barred' },
  AU: { regions: ['AU.01', 'AU.04', 'AU.07', 'AU.08'] },
  BF: AGE,
  BH: OF_AGE,
  BI: AGE,
  BJ: OF_AGE,
  BL: OF_AGE,
  BO: AGE,
  // No child under sixteen employable save by parents in light domestic or farm work; no law sanctions performing.
  BS: { ...AGE, from: 'general', performers: 'barred' },
  BT: AGE,
  BW: AGE,
  BY: AGE,
  // No licence: a child performer is held to the Labour Act's general limits, none under twelve.
  BZ: { ...AGE, from: 'general', performers: 'barred' },
  CA: { regions: ['CA.08', 'CA.10'] },
  // The Labour Code makes no exception for performing.
  CD: { from: 'generalFrom', performers: 'barred' },
  CI: AGE,
  CM: AGE,
  // The Children and Adolescents Code's absolute bar under fifteen reaches a performer's hiring; no exception.
  CR: { from: 'general', performers: 'barred' },
  // Fifteen and sixteen by exception with the parents' consent, the general rule a performer is held to.
  CU: { ...AGE, from: 'general', performers: 'permit', permit: 'consentimiento de los padres o tutores', permitFrom: 'lowestAge' },
  CW: AGE,
  CY: AGE,
  // No permit or artistic exception below sixteen.
  DJ: { from: 'general', performers: 'barred' },
  DO: AGE,
  // No permit for a child performer; the general rule reaches all work.
  EG: { ...AGE, from: 'general', performers: 'barred' },
  // Morocco's Labour Code: the labour inspector's written authorisation for each minor actor or performer under eighteen.
  EH: { ...AGE, from: 'minimumAge', performers: 'permit', permit: "autorisation écrite préalable de l'agent chargé de l'inspection du travail" },
  // The Labour Proclamation makes no exception for performing.
  ER: { from: 'generalFrom', performers: 'barred' },
  ET: OF_AGE,
  GD: AGE,
  // Under sixteen only with a legal representative's or the guardianship authority's consent; under fourteen in art among the fields named.
  GE: { from: 'general', performers: 'permit', permit: 'consent of their legal representative or a custody/guardianship authority' },
  GG: AGE,
  GL: AGE,
  // No child-performer permit; no exception for performing.
  GM: { from: 'general', performers: 'barred' },
  GN: AGE,
  GQ: AGE,
  GR: AGE,
  GT: AGE,
  // Under fifteen in a performance only with the Minister's permit for that child, for a limited period.
  IL: { ...AGE, from: 'general', performers: 'permit', permit: 'היתר (Minister of Labour and Welfare)' },
  IQ: AGE,
  JE: AGE,
  // The State prohibits employing anyone under sixteen, for performing or otherwise.
  KP: { from: 'generalFrom', performers: 'barred' },
  KY: AGE,
  LK: AGE,
  LR: OF_AGE,
  LS: OF_AGE,
  LT: OF_AGE,
  // A child as a performer with a parent's written consent and the State Labour Inspectorate's permit; no lower age set.
  LV: { from: 'general', performers: 'permit', permit: 'Valsts darba inspekcijas atļauja' },
  // The labour inspector's written authorisation for each minor actor or performer under eighteen.
  MA: { from: 'general', performers: 'permit', permit: "autorisation écrite préalablement remise par l'agent chargé de l'inspection du travail" },
  // No exception for shows or filming in the bar on employing a child of school age.
  MC: { from: 'generalFrom', performers: 'barred' },
  MF: OF_AGE,
  NZ: AGE,
  PA: AGE,
  PK: AGE,
  PW: AGE,
  RE: OF_AGE,
  // MOM names no permit or exception for child performers; none allowed under thirteen, light duties only to fifteen.
  SG: { from: 'nonIndustrialFrom', performers: 'barred' },
  SL: AGE,
  // The new Labour Code makes no exception for performing.
  SN: { from: 'generalFrom', performers: 'barred' },
  // The Ministry's individual exception to the bar under fourteen, for artistic performances among others.
  SV: { from: 'generalFrom', performers: 'permit', permit: 'excepción individual (permiso) del Ministerio de Trabajo y Previsión Social' },
  // No child-performer permit; decree exceptions possible, none found for performing.
  TD: { from: 'general', performers: 'barred' },
  // No permit or exception for a child performer in the Labour Code.
  UA: { ...AGE, from: 'general', performers: 'barred' },
  UG: {
    from: 'childrenAct2016.minimumEmploymentAge',
    settles: "The Children (Amendment) Act 2016, substituting section 8 of the Children Act, sets the minimum age of employment at 16; it is later than the Employment Act 2006, section 32, that layer 3 read for 14, and the later Act's age stands.",
  },
  US: { regions: ['US.CA', 'US.NY'] },
  WS: AGE,
  // No exception for performing: the general rule reaches a child performer.
  YE: { from: 'generalFrom', performers: 'barred' },
};
