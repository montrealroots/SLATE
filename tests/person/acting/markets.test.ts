import { describe, expect, it } from 'vitest';
import { begin, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { fromMajor, type CurrencyCode } from '../../../src/core/money/money.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { t } from '../../../src/core/text/text.ts';
import { ATTRIBUTES_START, chooseAttributes, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  aboutMarket,
  ACTING_START,
  AGREEMENTS,
  COUNTRY,
  CRAFT,
  daysWorked,
  demands,
  experience,
  MARKET,
  MARKET_AGREEMENTS,
  marketOf,
  MARKETS,
  MEDIA,
  misfit,
  MISSING,
  onStage,
  partOf,
  pay,
  playPart,
  postBreakdown,
  scaleOf,
  TERMS,
  UNIT_DAYS,
  UNKEPT_LINE,
  type ActingSlice,
  type Agreement,
  type Audition,
  type Minimum,
  type Part,
} from '../../../src/person/acting/acting.ts';
import type { IdentitySlice } from '../../../src/person/identity/identity.ts';
import { PERMITS_START, type PermitsSlice } from '../../../src/person/permits/permits.ts';
import { UNIONS_START, type UnionsSlice } from '../../../src/person/unions/unions.ts';
import compiled from '../../../src/person/acting/markets.json' with { type: 'json' };
import { identity, person } from '../../support/person.ts';

type Acting = { attributes: AttributesSlice; acting: ActingSlice; identity: IdentitySlice; unions: UnionsSlice; permits: PermitsSlice };
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * SECONDS_PER_DAY;
const part = (agreement: Agreement, p: Partial<Part> = {}): Part => ({ agreement, budget: 5_000_000, seats: 0, lines: 20, term: 'day', length: 1, rehearsal: 0, asks: [], ...p });
const money = (c: CurrencyCode, n: string) => fromMajor(c, n);
const at = (a: Agreement, p: Partial<Part>, date: string, years = 0) => pay(part(a, p), date, years);

/** Every minimum as the research gives it (read from each market's file, 2026-11-01): medium, role, term, rehearsal, tiers, from, amount. */
const EXPECTED: Record<string, string[]> = {
'au-screen': [
  'f - day years0-4 2026-07-01 341.98',
  'f - day years5- 2026-07-01 359.3',
  'f - week years0-4 2026-07-01 1221.1',
  'f - week years5- 2026-07-01 1283.1',
  't - day years0-4 2026-07-01 293.13',
  't - day years5- 2026-07-01 307.99',
  't - week years0-4 2026-07-01 1221.1',
  't - week years5- 2026-07-01 1283.1',
],
'au-stage': [
  's - week years0-2 2026-07-01 1221.1',
  's - week years3- 2026-07-01 1283.1',
],
'br-rj-tv': [
  't - day 2025-11-01 750.18',
  't - month 2025-11-01 3742.14',
],
'br-sp-screen': [
  't lead day 2026-01-01 1438.14',
  't lead week 2026-01-01 5752.56',
  't supporting day 2026-01-01 700',
  't supporting week 2026-01-01 2800',
  't small day 2026-01-01 494.15',
  't small week 2026-01-01 1976.6',
  'f lead day 2026-01-01 1132.42',
  'f lead week 2026-01-01 4529.68',
  'f supporting day 2026-01-01 700',
  'f supporting week 2026-01-01 2726.24',
  'f small day 2026-01-01 500',
  'f small week 2026-01-01 1816',
],
'br-rj-stage': [
  's - day 2026-05-01 648.23',
  's - week 2026-05-01 1305.82',
  's - month 2026-05-01 3994.31',
],
'de-screen': [
  'f - day nth1-5 2025-01-01 1100',
  'f - day nth6- 2025-01-01 900',
  't - day nth1-5 2025-01-01 1100',
  't - day nth6- 2025-01-01 900',
],
'de-stage': [
  's - month years0-2 2026-04-01 3175',
  's - month years3- 2026-04-01 3385',
  's - month years0-2 2027-03-01 3240',
  's - month years3- 2027-03-01 3455',
  's - month years0-2 2028-01-01 3270',
  's - month years3- 2028-01-01 3490',
],
'de-guest': [
  's principal performance 2026-04-01 317.5',
  's principal day R performance 2026-04-01 158.75',
  's smaller performance 2026-04-01 254',
  's smaller day R performance 2026-04-01 127',
  's principal performance 2027-03-01 324',
  's principal day R performance 2027-03-01 162',
  's principal performance 2028-01-01 327',
  's principal day R performance 2028-01-01 163.5',
],
'dk-film': [
  'f - day 2010-01-01 3100',
],
'dk-tv': [
  't - day 2006-01-01 2600',
  't - month years5- 2006-01-01 38550',
  't - month years0-4 2006-01-01 33050',
],
'dk-soejle-a': [
  's - month 2026-08-01 30179.25',
],
'dk-copenhagen-stage': [
  's - month 2026-08-01 31395.92',
],
'es-screen': [
  't lead session 2026-01-01 888.19',
  't lead week 2026-01-01 3960.52',
  't lead month 2026-01-01 10561.05',
  't supporting session 2026-01-01 634.43',
  't supporting week 2026-01-01 2821.31',
  't supporting month 2026-01-01 7873.43',
  't featured session lines0-20 2026-01-01 507.51',
  't featured week lines0-20 2026-01-01 2099.62',
  't featured month lines0-20 2026-01-01 5948.97',
  't small session lines0-2 2026-01-01 202.98',
  't small week lines0-2 2026-01-01 839.83',
  't small month lines0-2 2026-01-01 2379.59',
  'f lead session budget750001- 2026-01-01 969.96',
  'f lead week budget750001- 2026-01-01 4383.42',
  'f lead month budget750001- 2026-01-01 11680.95',
  'f supporting session budget750001- 2026-01-01 706.37',
  'f supporting week budget750001- 2026-01-01 3141.43',
  'f supporting month budget750001- 2026-01-01 8766.78',
  'f featured session budget750001- lines0-20 2026-01-01 529.76',
  'f featured week budget750001- lines0-20 2026-01-01 2191.69',
  'f featured month budget750001- lines0-20 2026-01-01 6209.77',
  'f small session budget750001- lines0-2 2026-01-01 211.9',
  'f small week budget750001- lines0-2 2026-01-01 876.69',
  'f small month budget750001- lines0-2 2026-01-01 2483.91',
  'f lead session budget0-750000 2026-01-01 719.48',
  'f lead week budget0-750000 2026-01-01 3251.33',
  'f lead month budget0-750000 2026-01-01 8670.25',
  'f supporting session budget0-750000 2026-01-01 588.66',
  'f supporting week budget0-750000 2026-01-01 2617.85',
  'f supporting month budget0-750000 2026-01-01 7305.64',
  'f featured session budget0-750000 lines0-20 2026-01-01 457.84',
  'f featured week budget0-750000 lines0-20 2026-01-01 1891.93',
  'f featured month budget0-750000 lines0-20 2026-01-01 5366.52',
  'f small session budget0-750000 lines0-2 2026-01-01 183.15',
  'f small week budget0-750000 lines0-2 2026-01-01 756.76',
  'f small month budget0-750000 lines0-2 2026-01-01 2146.61',
  't lead day R 2026-01-01 65.14',
  't supporting day R 2026-01-01 65.14',
  't featured day R lines0-20 2026-01-01 52.12',
  't small day R lines0-2 2026-01-01 52.12',
  'f lead day R 2026-01-01 65.14',
  'f supporting day R 2026-01-01 65.14',
  'f featured day R lines0-20 2026-01-01 52.12',
  'f small day R lines0-2 2026-01-01 52.12',
],
'es-madrid-stage': [
  's lead day 2025-01-01 187.36',
  's lead month 2025-01-01 3628.52',
  's lead day R 2025-01-01 59.37',
  's supporting day 2025-01-01 121.06',
  's supporting month 2025-01-01 2394.19',
  's supporting day R 2025-01-01 59.37',
  's featured day 2025-01-01 90.87',
  's featured month 2025-01-01 1749.78',
  's featured day R 2025-01-01 59.37',
  's small day 2025-01-01 70.71',
  's small month 2025-01-01 1410.14',
  's small day R 2025-01-01 59.37',
  's lead day 2026-01-01 192.8',
  's lead month 2026-01-01 3733.75',
  's lead day R 2026-01-01 61.09',
  's supporting day 2026-01-01 124.57',
  's supporting month 2026-01-01 2463.62',
  's supporting day R 2026-01-01 61.09',
  's featured day 2026-01-01 93.51',
  's featured month 2026-01-01 1800.52',
  's featured day R 2026-01-01 61.09',
  's small day 2026-01-01 72.76',
  's small month 2026-01-01 1451.04',
  's small day R 2026-01-01 61.09',
],
'fr-film': [
  'f - day 2023-09-01 418.25',
  'f - week 2023-09-01 1266.7',
],
'fr-tv': [
  't - day length1-1 2024-02-01 301.97',
  't - day length2- 2024-02-01 286.37',
  't - day length1-1 2025-01-01 304.99',
  't - day length2- 2025-01-01 289.23',
],
'fr-subsidised-stage': [
  's - month length1-3 2026-08-01 2252.37',
  's - month length4- 2026-08-01 2143.56',
  's - performance length1-2 2026-08-01 162.75',
  's - performance length3- 2026-08-01 141.63',
  's - session R performance 2026-08-01 61.05',
],
'fr-private-stage': [
  's - performance seats0-200 nth1-24 2025-09-01 119.42',
  's - performance seats0-200 nth25-48 2025-09-01 101.2',
  's - performance seats0-200 nth49- 2025-09-01 87.03',
  's - month seats0-200 length2- 2025-09-01 2024',
  's - performance seats201-300 nth1-24 2025-09-01 126.5',
  's - performance seats201-300 nth25-48 2025-09-01 107.27',
  's - performance seats201-300 nth49- 2025-09-01 95.13',
  's - month seats201-300 length2- 2025-09-01 2210.21',
  's - performance seats301-600 nth1-24 2025-09-01 141.68',
  's - performance seats301-600 nth25-48 2025-09-01 120.43',
  's - performance seats301-600 nth49- 2025-09-01 106.26',
  's - month seats301-600 length2- 2025-09-01 2477.38',
  's - performance seats601- nth1-24 2025-09-01 156.86',
  's - performance seats601- nth25-48 2025-09-01 133.58',
  's - performance seats601- nth49- 2025-09-01 117.39',
  's - month seats601- length2- 2025-09-01 2744.54',
  's - day R 2025-09-01 84',
],
'ie-stage': [
  's - week 2008-10-01 464.26',
],
'in-screen': [
],
'it-screen': [
  'f lead day budget2000000- 2024-03-01 1100',
  'f supporting day budget2000000- nth1-7 2024-03-01 850',
  'f supporting day budget2000000- nth8- 2024-03-01 650',
  'f other day budget2000000- nth1-7 2024-03-01 650',
  'f other day budget2000000- nth8- 2024-03-01 450',
  't lead day 2024-03-01 1100',
  't supporting day nth1-7 2024-03-01 850',
  't supporting day nth8- 2024-03-01 650',
  't other day nth1-7 2024-03-01 650',
  't other day nth8- 2024-03-01 450',
  'f lead day budget0-1999999 2024-03-01 550',
  'f supporting day budget0-1999999 2024-03-01 425',
  'f other day budget0-1999999 2024-03-01 325',
],
'it-stage': [
  's - day 2018-04-01 68.22',
  's - day 2019-01-01 70.17',
  's - day 2020-01-01 72.78',
],
'jp-nhk': [
  't - episode 2014-04-01 21000',
],
'jp-live': [
],
'kr-kbs': [
  't grade-6 episode minutes60-60 2011-01-01 374220',
  't grade-8 episode minutes60-60 2011-01-01 509110',
  't grade-12 episode minutes60-60 2011-01-01 927070',
],
'kr-mbc-sbs': [
  't grade-6 episode minutes60-60 2012-01-01 381340',
  't grade-8 episode minutes60-60 2012-01-01 518830',
  't grade-12 episode minutes60-60 2012-01-01 944460',
  't grade-18 episode minutes60-60 2012-01-01 1615030',
],
'mx-televisa': [
  't lead episode minutes15-15 2024-03-01 1137',
  't lead episode minutes30-30 2024-03-01 1629',
  't lead episode minutes60-60 2024-03-01 2715',
  't lead episode minutes90-90 2024-03-01 4056',
  't lead episode minutes120-120 2024-03-01 5070',
  't lead episode minutes150-150 2024-03-01 6076',
  't lead episode minutes180-180 2024-03-01 7107',
  't co-lead episode minutes30-30 2024-03-01 1400',
  't co-lead episode minutes60-60 2024-03-01 2694',
  't co-lead episode minutes90-90 2024-03-01 3961',
  't co-lead episode minutes120-120 2024-03-01 4953',
  't co-lead episode minutes150-150 2024-03-01 5939',
  't co-lead episode minutes180-180 2024-03-01 6921',
  't first episode minutes15-15 2024-03-01 875',
  't first episode minutes30-30 2024-03-01 1257',
  't first episode minutes60-60 2024-03-01 1819',
  't first episode minutes90-90 2024-03-01 2966',
  't first episode minutes120-120 2024-03-01 3704',
  't first episode minutes150-150 2024-03-01 4430',
  't first episode minutes180-180 2024-03-01 5228',
  't second episode minutes15-15 2024-03-01 763',
  't second episode minutes30-30 2024-03-01 1093',
  't second episode minutes60-60 2024-03-01 1513',
  't second episode minutes90-90 2024-03-01 2169',
  't second episode minutes120-120 2024-03-01 2723',
  't second episode minutes150-150 2024-03-01 3254',
  't second episode minutes180-180 2024-03-01 3796',
  't third episode minutes15-15 2024-03-01 569',
  't third episode minutes30-30 2024-03-01 904',
  't third episode minutes60-60 2024-03-01 1275',
  't third episode minutes90-90 2024-03-01 1983',
  't third episode minutes120-120 2024-03-01 2469',
  't third episode minutes150-150 2024-03-01 2966',
  't third episode minutes180-180 2024-03-01 3460',
],
'mx-azteca': [
  't lead episode minutes15-15 2023-06-07 1085.3',
  't lead episode minutes30-30 2023-06-07 1556.42',
  't lead episode minutes60-60 2023-06-07 2559.31',
  't lead episode minutes90-90 2023-06-07 3860.74',
  't lead episode minutes120-120 2023-06-07 5118.62',
  't lead episode minutes180-180 2023-06-07 7677.93',
  't third episode minutes15-15 2023-06-07 533.32',
  't third episode minutes30-30 2023-06-07 844.29',
  't third episode minutes60-60 2023-06-07 1181.7',
  't third episode minutes90-90 2023-06-07 1845.63',
  't third episode minutes120-120 2023-06-07 2363.4',
  't third episode minutes180-180 2023-06-07 3545.11',
  't lead episode minutes15-15 2023-12-08 1116.31',
  't lead episode minutes30-30 2023-12-08 1600.89',
  't lead episode minutes60-60 2023-12-08 2632.43',
  't lead episode minutes90-90 2023-12-08 3971.05',
  't lead episode minutes120-120 2023-12-08 5264.87',
  't lead episode minutes180-180 2023-12-08 7897.3',
  't co-lead episode minutes15-15 2023-12-08 970.78',
  't co-lead episode minutes30-30 2023-12-08 1386.59',
  't co-lead episode minutes60-60 2023-12-08 2138.26',
  't co-lead episode minutes90-90 2023-12-08 3350.52',
  't co-lead episode minutes120-120 2023-12-08 4276.52',
  't co-lead episode minutes180-180 2023-12-08 6414.78',
  't first episode minutes15-15 2023-12-08 846.03',
  't first episode minutes30-30 2023-12-08 1202.67',
  't first episode minutes60-60 2023-12-08 1740.03',
  't first episode minutes90-90 2023-12-08 2827.55',
  't first episode minutes120-120 2023-12-08 3480.06',
  't first episode minutes180-180 2023-12-08 5220.09',
  't second episode minutes15-15 2023-12-08 716.48',
  't second episode minutes30-30 2023-12-08 1025.14',
  't second episode minutes60-60 2023-12-08 1415.38',
  't second episode minutes90-90 2023-12-08 2042.3',
  't second episode minutes120-120 2023-12-08 2830.75',
  't second episode minutes180-180 2023-12-08 4246.13',
  't third episode minutes15-15 2023-12-08 548.56',
  't third episode minutes30-30 2023-12-08 868.41',
  't third episode minutes60-60 2023-12-08 1215.46',
  't third episode minutes90-90 2023-12-08 1898.37',
  't third episode minutes120-120 2023-12-08 2430.93',
  't third episode minutes180-180 2023-12-08 3646.39',
],
'mx-other': [
],
'ng-screen': [
],
'nl-stage': [
  's lead month 2025-01-01 4619',
  's other month 2025-01-01 2973',
  's lead month 2026-01-01 4780',
  's other month 2026-01-01 3077',
],
'nl-screen': [
],
'no-film': [
  'f - day 2025-09-01 7583',
  'f - day 2026-09-01 7917',
],
'no-tv': [
  't - day length1-3 2025-09-01 6631',
  't - day length4- 2025-09-01 4735',
  't - year 2025-09-01 663225',
  't - day length1-3 2026-09-01 6923',
  't - day length4- 2026-09-01 4943',
  't - year 2026-09-01 692407',
],
'no-nrk': [
  't - day years0-4 length1-3 2019-05-01 6027',
  't - day years0-4 length4- 2019-05-01 4604',
  't - month years0-4 2019-05-01 54171',
  't - year years0-4 2019-05-01 677111',
  't - day years5- length1-3 2019-05-01 9482',
  't - day years5- length4- 2019-05-01 6771',
  't - month years5- 2019-05-01 94797',
  't - year years5- 2019-05-01 947824',
],
'no-stage': [
  's - year 2022-04-01 478584',
  's - year 2023-04-01 504906',
  's - year 2024-04-01 530151',
  's - year 2025-04-01 552470',
  's - year 2026-04-01 577115',
],
'nz-screen': [
],
'nz-court': [
  's lead week years0-5 2024-04-26 1292',
  's lead week years6- 2024-04-26 1800',
  's ensemble week years0-5 2024-04-26 1200',
  's ensemble week years6- 2024-04-26 1680',
  's supporting week years0-5 2024-04-26 1200',
  's supporting week years6- 2024-04-26 1600',
  's featured week years0-5 2024-04-26 1200',
  's featured week years6- 2024-04-26 1440',
  's chorus week years0-5 2024-04-26 1200',
  's chorus week years6- 2024-04-26 1360',
  's lead week years0-5 2025-04-26 1327.53',
  's lead week years6- 2025-04-26 1849.5',
  's ensemble week years0-5 2025-04-26 1233',
  's ensemble week years6- 2025-04-26 1726.2',
  's supporting week years0-5 2025-04-26 1233',
  's supporting week years6- 2025-04-26 1644',
  's featured week years0-5 2025-04-26 1233',
  's featured week years6- 2025-04-26 1479.6',
  's chorus week years0-5 2025-04-26 1233',
  's chorus week years6- 2025-04-26 1397.4',
],
'nz-atc': [
  's - week years0-5 2024-01-01 1200',
  's - week years6-14 2024-01-01 1400',
  's - week years15-24 2024-01-01 1600',
  's - week years25- 2024-01-01 1800',
],
'se-screen': [
  'f - day nth1-1 2026-06-01 6163',
  'f - day nth2-2 2026-06-01 5667',
  'f - day nth3- 2026-06-01 3754',
  'f - month length4- 2026-06-01 36247',
  't - day nth1-1 2026-06-01 6163',
  't - day nth2-2 2026-06-01 5667',
  't - day nth3- 2026-06-01 3754',
  't - month length4- 2026-06-01 36247',
],
'se-stage': [
  's - month years0-4 2026-04-01 23889',
  's - month years5- 2026-04-01 30141',
],
'se-private-stage': [
  's - performance 2026-04-01 1176',
  's - day R 2026-04-01 1176',
],
'se-free-stage': [
  's - month years0-4 2025-04-01 24223',
  's - day years0-4 2025-04-01 1312',
  's - performance years0-4 2025-04-01 1312',
  's - month years5- 2025-04-01 26849',
  's - day years5- 2025-04-01 1450',
  's - performance years5- 2025-04-01 1450',
  's - month years0-4 2026-04-01 24907',
  's - day years0-4 2026-04-01 1349',
  's - performance years0-4 2026-04-01 1349',
  's - month years5- 2026-04-01 27601',
  's - day years5- 2026-04-01 1491',
  's - performance years5- 2026-04-01 1491',
],
'za-all': [
],
};

const line = (m: Minimum) => {
  const when = Object.entries(m.when).map(([k, [lo, hi]]) => `${k}${lo}-${hi ?? ''}`).join(' ');
  return [m.medium[0], m.role ?? '-', m.per, m.rehearsal ? 'R' : '', (m.with ?? []).join(','), when, m.from, m.amount].filter((x) => x !== '').join(' ');
};

describe('the markets', () => {
  it("are each country's own, every minimum as the research gives it", () => {
    expect(MARKET_AGREEMENTS).toEqual(Object.keys(compiled.agreements));
    expect(AGREEMENTS).toEqual(['sag-aftra', 'pact-equity', 'uk-theatre', 'actra', ...MARKET_AGREEMENTS]);
    expect(Object.fromEntries(Object.entries(MARKETS).map(([cc, m]) => [cc, [m.language, m.zone, m.agreements.join(' ')]]))).toEqual({
      AU: ['en', 'Australia/Sydney', 'au-screen au-stage'],
      BR: ['pt', 'America/Sao_Paulo', 'br-rj-tv br-sp-screen br-rj-stage'],
      DE: ['de', 'Europe/Berlin', 'de-screen de-stage de-guest'],
      DK: ['da', 'Europe/Copenhagen', 'dk-film dk-tv dk-soejle-a dk-copenhagen-stage'],
      ES: ['es', 'Europe/Madrid', 'es-screen es-madrid-stage'],
      FR: ['fr', 'Europe/Paris', 'fr-film fr-tv fr-subsidised-stage fr-private-stage'],
      IE: ['en', 'Europe/Dublin', 'ie-stage'],
      IN: ['hi', 'Asia/Kolkata', 'in-screen'],
      IT: ['it', 'Europe/Rome', 'it-screen it-stage'],
      JP: ['ja', 'Asia/Tokyo', 'jp-nhk jp-live'],
      KR: ['ko', 'Asia/Seoul', 'kr-kbs kr-mbc-sbs'],
      MX: ['es', 'America/Mexico_City', 'mx-televisa mx-azteca mx-other'],
      NG: ['en', 'Africa/Lagos', 'ng-screen'],
      NL: ['nl', 'Europe/Amsterdam', 'nl-stage nl-screen'],
      NO: ['no', 'Europe/Oslo', 'no-film no-tv no-nrk no-stage'],
      NZ: ['en', 'Pacific/Auckland', 'nz-screen nz-court nz-atc'],
      SE: ['sv', 'Europe/Stockholm', 'se-screen se-stage se-private-stage se-free-stage'],
      ZA: ['en', 'Africa/Johannesburg', 'za-all'],
    });
    for (const [cc, m] of Object.entries(MARKETS)) {
      for (const id of m.agreements) {
        expect(MARKET[id], id).toEqual({ language: m.language, zone: m.zone });
        expect(COUNTRY[id], id).toBe(cc);
      }
    }
    expect(Object.fromEntries(MARKET_AGREEMENTS.map((id) => [id, (marketOf(id) as NonNullable<ReturnType<typeof marketOf>>).minimums.map(line)]))).toEqual(EXPECTED);
    // Where the research says no agreement sets an actor's pay, none is set: it is negotiated.
    const none = MARKET_AGREEMENTS.filter((id) => marketOf(id)?.none);
    expect(none).toEqual(['in-screen', 'jp-live', 'mx-other', 'ng-screen', 'nl-screen', 'nz-screen', 'za-all']);
    for (const id of none) expect(marketOf(id)?.currency, id).toBeNull();
    expect(Object.fromEntries(MARKET_AGREEMENTS.filter((id) => !none.includes(id)).map((id) => [id, marketOf(id)?.currency]))).toMatchObject({ 'au-screen': 'AUD', 'br-rj-tv': 'BRL', 'de-screen': 'EUR', 'dk-film': 'DKK', 'jp-nhk': 'JPY', 'kr-kbs': 'KRW', 'mx-televisa': 'MXN', 'no-film': 'NOK', 'nz-court': 'NZD', 'se-screen': 'SEK', 'ie-stage': 'EUR' });
    expect(marketOf('sag-aftra')).toBeUndefined();
    expect(marketOf('za-all')?.media).toEqual(['film', 'television', 'stage']);
    expect([TERMS, MEDIA]).toEqual([['day', 'week', 'month', 'year', 'session', 'performance', 'episode'], ['film', 'television', 'stage']]);
  });
});

describe("a market's part", () => {
  it("is paid at its agreement's minimum, by medium, role, term and tier", () => {
    // Australia's award: a Class 2 performer from five years in the work; feature film above other content.
    expect(at('au-screen', { medium: 'film', length: 2 }, '2026-07-01', 4)).toEqual(money('AUD', '683.96'));
    expect(at('au-screen', { medium: 'film', length: 2 }, '2026-07-01', 5)).toEqual(money('AUD', '718.60'));
    expect(at('au-screen', { medium: 'television' }, '2026-07-01', 5)).toEqual(money('AUD', '307.99'));
    expect(at('au-screen', { medium: 'television', term: 'week' }, '2031-01-01')).toEqual(money('AUD', '1221.10'));
    expect(() => at('au-screen', { medium: 'film' }, '2026-06-30')).toThrow('no minimum is known before 2026-07-01');
    expect(at('au-stage', { term: 'week', length: 3 }, '2026-07-01', 2)).toEqual(money('AUD', '3663.30'));
    expect(at('au-stage', { term: 'week', length: 3 }, '2026-07-01', 3)).toEqual(money('AUD', '3849.30'));
    // Brazil: São Paulo by role, a week at the discounted rate; Rio's stage by the day, week or month.
    expect(at('br-sp-screen', { medium: 'film', role: 'supporting', term: 'week', length: 2 }, '2026-01-01')).toEqual(money('BRL', '5452.48'));
    expect(at('br-sp-screen', { medium: 'television', role: 'lead' }, '2026-01-01')).toEqual(money('BRL', '1438.14'));
    expect(at('br-rj-stage', { term: 'month' }, '2026-05-01')).toEqual(money('BRL', '3994.31'));
    expect(at('br-rj-tv', { term: 'month', length: 2 }, '2025-11-01')).toEqual(money('BRL', '7484.28'));
    // Germany: the first five shooting days at the entry fee, each after at the lower; the stage's entry fee for the first three years.
    expect([5, 6, 7].map((length) => at('de-screen', { medium: 'television', length }, '2025-01-01'))).toEqual([money('EUR', '5500'), money('EUR', '6400'), money('EUR', '7300')]);
    expect(at('de-screen', { medium: 'film', length: 1 }, '2025-01-01')).toEqual(money('EUR', '1100'));
    expect([2, 3].map((years) => at('de-stage', { term: 'month' }, '2027-03-01', years))).toEqual([money('EUR', '3240'), money('EUR', '3455')]);
    expect(at('de-stage', { term: 'month' }, '2027-02-28', 2)).toEqual(money('EUR', '3175'));
    expect(at('de-guest', { role: 'smaller', term: 'performance', length: 4, rehearsal: 3 }, '2026-04-01')).toEqual(money('EUR', '1397'));
    expect(at('de-guest', { role: 'principal', term: 'performance', length: 2, rehearsal: 1 }, '2028-01-01')).toEqual(money('EUR', '817.50'));
    // Denmark: a less experienced actor's month under five years.
    expect([4, 5].map((years) => at('dk-tv', { term: 'month' }, '2026-01-01', years))).toEqual([money('DKK', '33050'), money('DKK', '38550')]);
    expect(at('dk-film', { length: 3 }, '2010-01-01')).toEqual(money('DKK', '9300'));
    expect(at('dk-soejle-a', { term: 'month' }, '2026-08-01')).toEqual(money('DKK', '30179.25'));
    expect(at('dk-copenhagen-stage', { term: 'month' }, '2026-08-01')).toEqual(money('DKK', '31395.92'));
    // Spain: reparto to 20 lines, small parts to 2; a low-budget film to €750,000; rehearsal days beside.
    expect(at('es-screen', { medium: 'television', role: 'featured', term: 'session', lines: 20 }, '2026-01-01')).toEqual(money('EUR', '507.51'));
    expect(() => partOf(part('es-screen', { medium: 'television', role: 'featured', term: 'session', lines: 21 }))).toThrow("there's no session minimum for that part");
    expect(at('es-screen', { medium: 'film', role: 'small', term: 'session', lines: 2 }, '2026-01-01')).toEqual(money('EUR', '211.90'));
    expect(() => partOf(part('es-screen', { medium: 'film', role: 'small', term: 'session', lines: 3 }))).toThrow("there's no session minimum for that part");
    expect(at('es-screen', { medium: 'film', role: 'lead', term: 'month', budget: 750_000 }, '2026-01-01')).toEqual(money('EUR', '8670.25'));
    expect(at('es-screen', { medium: 'film', role: 'lead', term: 'month', budget: 750_001 }, '2026-01-01')).toEqual(money('EUR', '11680.95'));
    expect(at('es-screen', { medium: 'television', role: 'lead', term: 'session', length: 3, rehearsal: 2 }, '2026-01-01')).toEqual(money('EUR', '2794.85'));
    expect(at('es-screen', { medium: 'film', role: 'featured', term: 'week', rehearsal: 1, budget: 0 }, '2026-01-01')).toEqual(money('EUR', '1944.05'));
    expect(at('es-madrid-stage', { role: 'lead', length: 10 }, '2025-12-31')).toEqual(money('EUR', '1873.60'));
    expect(at('es-madrid-stage', { role: 'lead', length: 10 }, '2026-01-01')).toEqual(money('EUR', '1928'));
    expect(at('es-madrid-stage', { role: 'small', term: 'month', rehearsal: 5 }, '2026-01-01')).toEqual(money('EUR', '1756.49'));
    // France: a single day's television engagement above a longer one's; the subsidised stage by the contract's length; the private stage by seats and the run.
    expect(at('fr-film', { term: 'week', length: 2 }, '2023-09-01')).toEqual(money('EUR', '2533.40'));
    expect(at('fr-tv', {}, '2025-01-01')).toEqual(money('EUR', '304.99'));
    expect(at('fr-tv', {}, '2024-12-31')).toEqual(money('EUR', '301.97'));
    expect(at('fr-tv', { length: 2 }, '2025-01-01')).toEqual(money('EUR', '578.46'));
    expect([3, 4].map((length) => at('fr-subsidised-stage', { term: 'month', length }, '2026-08-01'))).toEqual([money('EUR', '6757.11'), money('EUR', '8574.24')]);
    expect(at('fr-subsidised-stage', { term: 'performance', length: 2, rehearsal: 3 }, '2026-08-01')).toEqual(money('EUR', '508.65'));
    expect(at('fr-subsidised-stage', { term: 'performance', length: 3 }, '2026-08-01')).toEqual(money('EUR', '424.89'));
    expect(() => partOf(part('fr-subsidised-stage', { term: 'month', rehearsal: 1 }))).toThrow("there's no rehearsal minimum for that part");
    const priv = (seats: number, length: number, term: Part['term'] = 'performance', rehearsal = 0) => at('fr-private-stage', { seats, length, term, rehearsal }, '2025-09-01');
    expect(priv(200, 24)).toEqual(money('EUR', '2866.08'));
    expect(priv(200, 25)).toEqual(money('EUR', '2967.28'));
    expect(priv(201, 48)).toEqual(money('EUR', '5610.48'));
    expect(priv(300, 49)).toEqual(money('EUR', '5705.61'));
    expect([301, 600, 601].map((s) => priv(s, 1))).toEqual([money('EUR', '141.68'), money('EUR', '141.68'), money('EUR', '156.86')]);
    expect(priv(0, 2, 'month', 2)).toEqual(money('EUR', '4216'));
    expect(priv(601, 3, 'month')).toEqual(money('EUR', '8233.62'));
    expect(() => partOf(part('fr-private-stage', { term: 'month', length: 1 }))).toThrow("there's no month minimum for that part");
    // Ireland's theatre week, still 2008's.
    expect(at('ie-stage', { term: 'week', length: 4 }, '2026-11-01')).toEqual(money('EUR', '1857.04'));
    // Italy: groups 2 and 3 lower from the eighth day; a low-budget film under €2 million; the stage's day with its indemnity.
    expect(at('it-screen', { medium: 'film', role: 'supporting', length: 8, budget: 2_000_000 }, '2024-03-01')).toEqual(money('EUR', '6600'));
    expect(at('it-screen', { medium: 'film', role: 'supporting', length: 8, budget: 1_999_999 }, '2024-03-01')).toEqual(money('EUR', '3400'));
    expect([7, 8].map((length) => at('it-screen', { medium: 'television', role: 'other', length, budget: 0 }, '2024-03-01'))).toEqual([money('EUR', '4550'), money('EUR', '5000')]);
    expect(at('it-screen', { medium: 'television', role: 'lead', length: 10 }, '2024-03-01')).toEqual(money('EUR', '11000'));
    expect(at('it-stage', { length: 3 }, '2019-12-31')).toEqual(money('EUR', '210.51'));
    expect(at('it-stage', { length: 3 }, '2020-01-01')).toEqual(money('EUR', '218.34'));
    // Japan's NHK by the appearance; Korea's and Mexico's broadcasters by the episode's running time.
    expect(at('jp-nhk', { term: 'episode', length: 2 }, '2026-11-01')).toEqual(money('JPY', '42000'));
    expect(at('kr-kbs', { role: 'grade-12', term: 'episode', minutes: 60 }, '2026-11-01')).toEqual(money('KRW', '927070'));
    expect(at('kr-mbc-sbs', { role: 'grade-18', term: 'episode', minutes: 60, length: 2 }, '2012-01-01')).toEqual(money('KRW', '3230060'));
    for (const minutes of [30, undefined]) expect(() => partOf(part('kr-kbs', { role: 'grade-6', term: 'episode', ...(minutes === undefined ? {} : { minutes }) })), String(minutes)).toThrow("there's no episode minimum for that part");
    expect(at('mx-televisa', { role: 'lead', term: 'episode', minutes: 180 }, '2024-03-01')).toEqual(money('MXN', '7107'));
    expect(() => partOf(part('mx-televisa', { role: 'co-lead', term: 'episode', minutes: 15 }))).toThrow("there's no episode minimum for that part");
    expect(at('mx-azteca', { role: 'lead', term: 'episode', minutes: 60 }, '2023-12-07')).toEqual(money('MXN', '2559.31'));
    expect(() => at('mx-azteca', { role: 'co-lead', term: 'episode', minutes: 60 }, '2023-12-07')).toThrow('no minimum is known before 2023-12-08');
    // The Netherlands' stage by the role: Acteur II for a lead.
    expect(at('nl-stage', { role: 'lead', term: 'month' }, '2026-01-01')).toEqual(money('EUR', '4780'));
    expect(at('nl-stage', { role: 'other', term: 'month' }, '2025-12-31')).toEqual(money('EUR', '2973'));
    // Norway: a day's rate for one to three days, a lower for four or more; NRK's under five years' seniority.
    expect([3, 4].map((length) => at('no-tv', { length }, '2026-09-01'))).toEqual([money('NOK', '20769'), money('NOK', '19772')]);
    expect(at('no-tv', { term: 'year' }, '2026-09-01')).toEqual(money('NOK', '692407'));
    expect(at('no-nrk', { length: 3 }, '2026-01-01', 4)).toEqual(money('NOK', '18081'));
    expect(at('no-nrk', { length: 4 }, '2026-01-01', 5)).toEqual(money('NOK', '27084'));
    expect(at('no-nrk', { term: 'month' }, '2026-01-01', 5)).toEqual(money('NOK', '94797'));
    expect(at('no-film', {}, '2026-08-31')).toEqual(money('NOK', '7583'));
    expect(at('no-stage', { term: 'year' }, '2026-03-31')).toEqual(money('NOK', '552470'));
    // New Zealand: the Court Theatre's from six years' experience; Auckland Theatre Company's by its career tiers.
    expect([5, 6].map((years) => at('nz-court', { role: 'lead', term: 'week' }, '2025-04-26', years))).toEqual([money('NZD', '1327.53'), money('NZD', '1849.50')]);
    expect([5, 6, 14, 15, 24, 25].map((years) => at('nz-atc', { term: 'week' }, '2024-01-01', years))).toEqual(['1200', '1400', '1400', '1600', '1600', '1800'].map((n) => money('NZD', n)));
    // Sweden: the first day, the second and each after; a month only past 75 days.
    expect([1, 2, 3].map((length) => at('se-screen', { medium: 'film', length }, '2026-06-01'))).toEqual([money('SEK', '6163'), money('SEK', '11830'), money('SEK', '15584')]);
    expect(() => partOf(part('se-screen', { medium: 'television', term: 'month', length: 3 }))).toThrow("there's no month minimum for that part");
    expect(at('se-screen', { medium: 'television', term: 'month', length: 4 }, '2026-06-01')).toEqual(money('SEK', '144988'));
    expect(at('se-private-stage', { term: 'performance', length: 3, rehearsal: 2 }, '2026-04-01')).toEqual(money('SEK', '5880'));
    expect(at('se-free-stage', { term: 'day' }, '2026-04-01', 5)).toEqual(money('SEK', '1491'));
    expect(at('se-free-stage', { term: 'performance' }, '2026-03-31', 4)).toEqual(money('SEK', '1312'));
    expect(at('se-stage', { term: 'month' }, '2026-04-01', 5)).toEqual(money('SEK', '30141'));
    // Where no agreement sets the pay, it is the parties' to agree.
    for (const [a, medium] of [['in-screen', 'film'], ['jp-live', 'stage'], ['mx-other', 'film'], ['ng-screen', 'television'], ['nl-screen', 'film'], ['nz-screen', 'television'], ['za-all', 'stage']] as const) {
      expect(at(a, { medium, term: 'week' }, '2026-11-01'), a).toBeNull();
      expect(scaleOf(part(a, { medium })), a).toBeNull();
    }
  });

  it('is refused a medium, a role, a term or a rehearsal its agreement does not set', () => {
    expect(() => partOf(part('br-sp-screen', { role: 'lead' }))).toThrow('a part under br-sp-screen names its medium: film, television');
    expect(() => partOf(part('dk-film', { medium: 'stage' }))).toThrow('dk-film sets no terms for stage');
    expect(() => partOf(part('in-screen', { medium: 'stage' }))).toThrow('in-screen sets no terms for stage');
    expect(() => partOf(part('dk-film', { medium: 'radio' as 'film' }))).toThrow("there's no medium radio");
    expect(() => partOf(part('br-sp-screen', { medium: 'film' }))).toThrow('a part under br-sp-screen is one of its roles: lead, supporting, small');
    expect(() => partOf(part('br-sp-screen', { medium: 'film', role: 'extra' }))).toThrow('a part under br-sp-screen is one of its roles: lead, supporting, small');
    expect(() => partOf(part('au-screen', { medium: 'film', role: 'lead' }))).toThrow('au-screen sets no minimum by role');
    expect(() => partOf(part('dk-film', { term: 'week' }))).toThrow("there's no week minimum for that part");
    expect(() => partOf(part('dk-film', { rehearsal: 1 }))).toThrow("there's no rehearsal minimum for that part");
    expect(() => partOf(part('de-guest', { role: 'principal' }))).toThrow("there's no day minimum for that part");
    expect(() => pay(part('de-guest', { role: 'principal' }), '2026-04-01')).toThrow("there's no day minimum for that part");
    expect(() => pay(part('dk-film', { rehearsal: 1 }), '2026-04-01')).toThrow("there's no rehearsal minimum for that part");
    expect(() => partOf(part('mx-televisa', { role: 'lead', term: 'episode', minutes: 0 }))).toThrow('the minutes must be a whole number of at least 1 (0)');
    expect(partOf(part('mx-televisa', { role: 'lead', term: 'episode', minutes: 60 })).minutes).toBe(60);
    expect(partOf(part('in-screen', { medium: 'film', term: 'week', rehearsal: 1 })).rehearsal).toBe(1);
    expect(partOf(part('es-madrid-stage', { role: 'lead', rehearsal: 2 })).rehearsal).toBe(2);
    expect(partOf(part('au-stage', { term: 'week' })).term).toBe('week');
  });

  it('is played on stage where its medium is, and works its days by the term', () => {
    expect(onStage(part('au-stage'))).toBe(true);
    expect(onStage(part('za-all', { medium: 'stage' }))).toBe(true);
    expect(onStage(part('za-all', { medium: 'film' }))).toBe(false);
    expect(onStage(part('uk-theatre'))).toBe(true);
    expect(onStage(part('sag-aftra'))).toBe(false);
    expect(demands(part('es-madrid-stage', { role: 'lead', lines: 0 }))).toEqual([...CRAFT, 'appropriation-d-espace-sc-nique', 'speaking']);
    expect(demands(part('es-screen', { medium: 'film', role: 'lead', lines: 0 }))).toEqual([...CRAFT, 'acting-for-the-camera']);
    expect(UNIT_DAYS).toEqual({ day: 1, week: 5, month: 21, year: 220, session: 1, performance: 1, episode: 1 });
    expect(daysWorked(part('fr-subsidised-stage', { term: 'performance', length: 2, rehearsal: 3 }))).toBe(5);
    expect(daysWorked(part('fr-subsidised-stage', { term: 'month', length: 2 }))).toBe(42);
    expect(daysWorked(part('no-stage', { term: 'year' }))).toBe(220);
    expect(daysWorked(part('es-screen', { term: 'session', length: 3, rehearsal: 2 }))).toBe(5);
    expect(daysWorked(part('mx-televisa', { term: 'episode', length: 4 }))).toBe(4);
    expect(daysWorked(part('in-screen', { term: 'week', rehearsal: 1 }))).toBe(10);
    expect(daysWorked(part('uk-theatre', { term: 'week', length: 2, rehearsal: 1 }))).toBe(15);
  });

  it("reckons the actor's years in the work from the first part played", () => {
    const played = (at: number | null, id = 1): Audition => ({ id, at: 0, breakdown: 0, part: part('sag-aftra'), taped: true, score: 50, booked: true, work: at === null ? null : { at, quality: 50, pay: null } });
    const s = (...a: Audition[]): ActingSlice => ({ breakdowns: [], auditions: a });
    expect(experience(ACTING_START, day(2026, 1, 1))).toBe(0);
    expect(experience(s(played(null)), day(2026, 1, 1))).toBe(0);
    const life = s(played(day(2021, 3, 1), 1), played(day(2020, 6, 14), 2), played(null, 3));
    expect(experience(life, day(2026, 6, 13))).toBe(5);
    expect(experience(life, day(2026, 6, 14))).toBe(6);
    expect(experience(life, day(2020, 6, 14))).toBe(0);
    expect(experience(life, day(2021, 1, 1))).toBe(0);
  });

  it('tells the player what of a market isn\'t known', () => {
    expect(UNKEPT_LINE).toBe('acting.unkept');
    expect(MISSING).toEqual({
      agreements: 'some of the agreements parts are engaged under',
      rates: 'some of the minimums parts are paid',
      none: 'whether anything sets the pay where no agreement does',
      union: "the union's fees or whether a part needs it",
      language: 'the language parts are cast in',
      market: 'where most of the work is',
    });
    expect(aboutMarket('au-screen')).toBe(t(UNKEPT_LINE, { country: 'Australia', missing: "the union's fees or whether a part needs it, some of the minimums parts are paid and the language parts are cast in" }));
    expect(aboutMarket('de-guest')).toBe("Some of what a performer is paid or asked in Germany isn't known to this game yet: some of the minimums parts are paid.");
    expect(aboutMarket('in-screen')).toBe(t(UNKEPT_LINE, { country: 'India', missing: "whether anything sets the pay where no agreement does, the union's fees or whether a part needs it, some of the agreements parts are engaged under and the language parts are cast in" }));
    for (const a of ['dk-film', 'es-screen', 'it-stage', 'nl-stage', 'sag-aftra', 'actra'] as const) expect(aboutMarket(a), a).toBeUndefined();
    // Every market the register holds blockers for tells the player; none other does.
    const told = Object.keys(MARKETS).filter((cc) => aboutMarket((MARKETS[cc] as { agreements: readonly Agreement[] }).agreements[0] as Agreement) !== undefined);
    expect(told).toEqual(['AU', 'BR', 'DE', 'FR', 'IE', 'IN', 'JP', 'KR', 'MX', 'NG', 'NO', 'NZ', 'SE', 'ZA']);
  });
});

describe("a market's part, played", () => {
  const made = (now: number, who: IdentitySlice, auditions: Audition[]): Life<Acting> =>
    dispatch(begin('0123456789abcdef', now, { attributes: structuredClone(ATTRIBUTES_START), acting: { breakdowns: [], auditions }, identity: who, unions: structuredClone(UNIONS_START), permits: structuredClone(PERMITS_START) }), chooseAttributes, { role: 'actor', all: 50, each: {} });
  const booked = (p: Part, id = 1, work: Audition['work'] = null): Audition => ({ id, at: 0, breakdown: 0, part: p, taped: true, score: 50, booked: true, work });
  const NOW = day(2026, 7, 1);

  it("pays the minimum for the actor's years, where the person may work in the market's country", () => {
    const p = part('au-screen', { medium: 'film', length: 2 });
    const first = booked(part('sag-aftra'), 1, { at: day(2021, 7, 1), quality: 50, pay: null });
    const aussie = identity({ citizenship: ['AU'] });
    const play = (l: Life<Acting>) => dispatch(l, playPart, { audition: 2 }).slices.acting.auditions[1]?.work?.pay;
    expect(play(made(NOW, aussie, [first, booked(p, 2)]))).toEqual(money('AUD', '718.60'));
    expect(() => play(made(NOW - SECONDS_PER_DAY, aussie, [first, booked(p, 2)]))).toThrow('no minimum is known before 2026-07-01');
    expect(play(made(NOW, aussie, [{ ...first, work: { at: day(2021, 7, 2), quality: 50, pay: null } }, booked(p, 2)]))).toEqual(money('AUD', '683.96'));
    expect(() => dispatch(made(NOW, identity(), [first, booked(p, 2)]), playPart, { audition: 2 })).toThrow('the person may not work in AU without a permit');
    const none = made(NOW, identity({ citizenship: ['ZA'] }), [booked(part('za-all', { medium: 'stage', term: 'week', length: 2 }))]);
    expect(dispatch(none, playPart, { audition: 1 }).slices.acting.auditions[0]?.work?.pay).toBeNull();
  });

  it("is cast in the market's language, the age reckoned in its city", () => {
    const l = dispatch(made(NOW, identity(), []), postBreakdown, part('es-screen', { medium: 'film', role: 'lead', term: 'session' }));
    const b = l.slices.acting.breakdowns[0] as NonNullable<ActingSlice['breakdowns'][number]>;
    expect(b.language).toBe('es');
    expect(misfit(person(), { ...b, gender: 'open', ethnicity: 'open', ages: [0, 120] }, NOW)).toBe('the part is played in es, at C1 or better');
    expect(misfit(person({ languages: [{ lang: 'es', level: 'C1' }] }), { ...b, gender: 'open', ethnicity: 'open', ages: [0, 120] }, NOW)).toBeNull();
    // 23:00 UTC on 13 June 2026: Ada's 26th birthday already in Sydney, still the 13th in Los Angeles.
    const late = Date.UTC(2026, 5, 13, 23) / 1000;
    const aged = (a: Agreement) => misfit(person(), { id: 1, at: 0, part: part(a, { medium: 'film' }), gender: 'open', ethnicity: 'open', ages: [31, 40], language: 'en' }, late);
    expect(aged('au-screen')).toBeNull();
    expect(aged('sag-aftra')).toBe('the part is for 31 to 40, and you play 20 to 30');
  });
});
