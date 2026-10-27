import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { OUTPUT, RELEASE, SOURCES, parseAt, parseOn, parseRelease, parseSeconds, parseTzdb, parseYear, readRelease, serialize } from '../../tools/tzdb/compile.ts';
import { readTarGz } from '../../tools/tzdb/tar.ts';

const ROOT = join(import.meta.dirname, '../..');

/** A ustar archive, for the reader's tests: entries of a name, a type and content, with an optional prefix. */
function tar(entries: { name: string; prefix?: string; type?: string; body?: string }[], end = true): Buffer {
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const header = Buffer.alloc(512);
    header.write(e.name, 0);
    const body = Buffer.from(e.body ?? '');
    header.write(body.length.toString(8).padStart(11, '0'), 124);
    header.write(e.type ?? '0', 156);
    header.write('ustar', 257);
    if (e.prefix !== undefined) header.write(e.prefix, 345);
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  if (end) blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

describe('the tar reader', () => {
  it('reads regular files by name, with their prefix, past other entries', () => {
    const files = readTarGz(tar([{ name: 'a', body: 'one' }, { name: 'dir', type: '5' }, { name: 'b', prefix: 'p', body: 'x'.repeat(600) }, { name: 'c', type: '', body: 'old' }]));
    expect([...files.keys()]).toEqual(['a', 'p/b', 'c']);
    expect(files.get('a')?.toString()).toBe('one');
    expect(files.get('p/b')?.toString()).toBe('x'.repeat(600));
    expect(files.get('c')?.toString()).toBe('old');
  });
  it('ends at the data\'s end when no closing blocks were written', () => {
    expect([...readTarGz(tar([{ name: 'a', body: 'x'.repeat(512) }, { name: 'b', body: 'y' }], false)).keys()]).toEqual(['a', 'b']);
    expect(readTarGz(tar([{ name: 'a', body: 'x'.repeat(512) }], false)).get('a')?.length).toBe(512);
  });
  it('reads a size written with spaces before it', () => {
    const header = tar([{ name: 'a', body: 'abc' }]);
    expect(readTarGz(header).get('a')?.toString()).toBe('abc');
  });
  it('reads the release IANA published', () => {
    const files = readTarGz(readFileSync(join(ROOT, RELEASE.tarball)));
    expect(files.get('version')?.toString().trim()).toBe('2026e');
    for (const s of SOURCES) expect(files.has(s)).toBe(true);
  });
});

describe('the compiler', () => {
  it('reproduces the data the engine reads, byte for byte, from the release', () => {
    expect(serialize(readRelease(ROOT).data)).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
  });
  it('reads the whole release: 344 zones, 253 links, 135 rule sets', () => {
    const { data } = readRelease(ROOT);
    expect([data.version, Object.keys(data.zones).length, Object.keys(data.links).length, Object.keys(data.rules).length]).toEqual(['2026e', 344, 253, 135]);
  });
  it('refuses a tarball that is not the cited release', () => {
    const root = mkdtempSync(join(tmpdir(), 'slate-tz-'));
    mkdirSync(join(root, 'vendor/tzdb'), { recursive: true });
    writeFileSync(join(root, RELEASE.tarball), tar([{ name: 'version', body: '2026e\n' }]));
    expect(() => readRelease(root)).toThrow(/is not the release the register cites \(sha256 [0-9a-f]{64}\)/);
  });
  it('reads times, offsets and their kinds as zic does', () => {
    expect(['-', '0', '2', '2:00', '-2:30', '23:59:59', '24:00', '0:01', '-0:25:21', '12:3:4'].map(parseSeconds)).toEqual([0, 0, 7200, 7200, -9000, 86_399, 86_400, 60, -1521, 43_384]);
    expect([parseSeconds('1:00:00.5'), parseSeconds('1:00:01.5'), parseSeconds('1:00:00.51'), parseSeconds('1:00:00.49'), parseSeconds('-0:00:01.6')]).toEqual([3600, 3602, 3601, 3600, -2]);
    for (const bad of ['x', '1:', '1:234', ':30', '1:00:00:00', '+1', 'x1', '1x', '']) expect(() => parseSeconds(bad)).toThrow(`not a time: "${bad}"`);
    expect(() => parseAt('2:00x')).toThrow('not a time: "2:00x"');
    expect(() => parseAt('2s00')).toThrow('not a time: "2s00"');
    expect(['2:00', '2:00w', '2:00s', '2:00u', '2:00g', '2:00z', '-'].map(parseAt)).toEqual([
      { at: 7200, atType: 'w' }, { at: 7200, atType: 'w' }, { at: 7200, atType: 's' }, { at: 7200, atType: 'u' }, { at: 7200, atType: 'u' }, { at: 7200, atType: 'u' }, { at: 0, atType: 'w' },
    ]);
  });
  it('reads a day as a fixed day or a weekday rule', () => {
    expect(['5', 'lastSun', 'lastSat', 'Sun>=8', 'Fri<=1', 'Tue>=29', 'lastTh', 'Mo>=1', 'Wed>=1', 'lastW', 'Thursday<=7'].map(parseOn)).toEqual([
      { kind: 'dom', day: 5 }, { kind: 'last', weekday: 0 }, { kind: 'last', weekday: 6 }, { kind: 'geq', weekday: 0, day: 8 },
      { kind: 'leq', weekday: 5, day: 1 }, { kind: 'geq', weekday: 2, day: 29 }, { kind: 'last', weekday: 4 }, { kind: 'geq', weekday: 1, day: 1 },
      { kind: 'geq', weekday: 3, day: 1 }, { kind: 'last', weekday: 3 }, { kind: 'leq', weekday: 4, day: 7 },
    ]);
    for (const bad of ['5x', 'x5', 'Sun>=8x', ' Sun>=8', 'Sun=>8']) expect(() => parseOn(bad)).toThrow(`not a day: "${bad}"`);
    expect(() => parseOn('x>=8')).toThrow('not a weekday: "x"');
    expect(() => parseOn('xlastSun')).toThrow('not a day: "xlastSun"');
    expect(() => parseOn('Funday>=1')).toThrow('not a weekday: "Funday"');
    expect(() => parseOn('T>=1')).toThrow('not a weekday: "T"');
    expect(() => parseOn('Sun>8')).toThrow('not a day: "Sun>8"');
    expect(() => parseOn('lastS')).toThrow('not a weekday: "S"');
    expect(() => parseOn('last')).toThrow('not a day: "last"');
    expect(() => parseOn('x5')).toThrow('not a day: "x5"');
  });
  const parse = (text: string, other: Record<string, string> = {}) => parseTzdb(new Map(SOURCES.map((s) => [s, s === 'europe' ? text : other[s] ?? ''])), 'v');
  it('reads rules, zones with their continuation lines, and links', () => {
    const data = parse(
      [
        '# comment',
        'Rule\tEU\t1981\tmax\t-\tMar\tlastSun\t 1:00u\t1:00\tS # trailing',
        'Rule\tEU\t1996\tonly\t-\tOct\tlastSun\t 1:00u\t0\t-',
        'Rule\tX\t2000\to\t-\tJanuary\t1\t0\t-1:00\tGMT',
        'Zone\tEurope/Paris\t0:09:21 -\tLMT\t1891 Mar 16',
        '\t\t\t1:00\tEU\tCE%sT',
        '\t1:00\t1:00\tCEST\t1945 Sep 16  3:00s',
        '',
        '\t1:00\t-\t%z\t1950 May lastSun',
        'Link\tEurope/Paris\tEurope/Monaco',
      ].join('\n'),
    );
    expect(data.rules['EU']).toEqual([
      { from: 1981, to: null, month: 3, on: { kind: 'last', weekday: 0 }, at: 3600, atType: 'u', save: 3600, isdst: true, letters: 'S' },
      { from: 1996, to: 1996, month: 10, on: { kind: 'last', weekday: 0 }, at: 3600, atType: 'u', save: 0, isdst: false, letters: '' },
    ]);
    expect(data.rules['X']?.[0]).toEqual({ from: 2000, to: 2000, month: 1, on: { kind: 'dom', day: 1 }, at: 0, atType: 'w', save: -3600, isdst: true, letters: 'GMT' });
    expect(data.zones['Europe/Paris']).toEqual([
      { stdoff: 561, rule: { kind: 'none' }, format: 'LMT', until: { year: 1891, month: 3, on: { kind: 'dom', day: 16 }, at: 0, atType: 'w' } },
      { stdoff: 3600, rule: { kind: 'named', name: 'EU' }, format: 'CE%sT' },
      { stdoff: 3600, rule: { kind: 'fixed', save: 3600, isdst: true }, format: 'CEST', until: { year: 1945, month: 9, on: { kind: 'dom', day: 16 }, at: 10_800, atType: 's' } },
      { stdoff: 3600, rule: { kind: 'none' }, format: '%z', until: { year: 1950, month: 5, on: { kind: 'last', weekday: 0 }, at: 0, atType: 'w' } },
    ]);
    expect(data.links).toEqual({ 'Europe/Monaco': 'Europe/Paris' });
    expect(data.version).toBe('v');
    expect(parse('Zone\tA/B\t0\t0:00\tZ\t1990').zones['A/B']?.[0]?.rule).toEqual({ kind: 'fixed', save: 0, isdst: false });
  });
  it('ends a zone at a new rule or link, so their lines are not read as its own', () => {
    const data = parse(['Zone\tA/B\t0\t-\tZ\t1990', 'Rule\tR\t2000\tonly\t-\tJan\t1\t0\t0\t-', ' Link\tA/B\tA/C', 'Zone\tA/D\t0\t-\tZ'].join('\n'));
    expect(data.zones['A/B']).toHaveLength(1);
    expect(data.links).toEqual({ 'A/C': 'A/B' });
    expect(Object.keys(data.zones)).toEqual(['A/B', 'A/D']);
  });
  it('reads the files in order', () => {
    expect(Object.keys(parse('', { africa: 'Zone\tA/A\t0\t-\tZ', backward: 'Link\tA/A\tB/B', asia: 'Zone\tC/C\t0\t-\tZ' }).zones)).toEqual(['A/A', 'C/C']);
  });
  it('reads a rule name with a digit in it as a name, and an amount as a fixed save', () => {
    const data = parse(['Rule\tR1\t2000\tonly\t-\tJan\t1\t0\t0\t-', 'Zone\tA/B\t0\tR1\tZ\t1990', '\t0\t-0:30\tZ'].join('\n'));
    expect(data.zones['A/B']?.[0]?.rule).toEqual({ kind: 'named', name: 'R1' });
    expect(data.zones['A/B']?.[1]?.rule).toEqual({ kind: 'fixed', save: -1800, isdst: true });
  });
  it('writes no until on a line that has none', () => {
    const line = parse('Zone\tA/B\t0\t-\tZ').zones['A/B']?.[0];
    expect(line).toStrictEqual({ stdoff: 0, rule: { kind: 'none' }, format: 'Z' });
    expect(Object.keys(line ?? {})).toEqual(['stdoff', 'rule', 'format']);
  });
  it('reads a line that starts with a keyword and more as no keyword', () => {
    for (const head of ['Rules', 'Zonex', 'xZone', 'xLink', 'Linked', 'xRule', 'Rule1']) {
      expect(() => parse(`${head}\tA/B\tA/C`)).toThrow(`a line the compiler doesn't know: ${head}`);
    }
    // After a zone, a line starting without space is no continuation, whatever it holds.
    expect(() => parse('Zone\tA/B\t0\t-\tZ\t1990\n1:00\t-\tZ')).toThrow("a line the compiler doesn't know: 1:00");
    expect(() => parse('Zone\tA/B\t0\t-\tZ\t1990\nLeap\t1:00\t-\tZ')).toThrow("a line the compiler doesn't know: Leap");
    // An indented line is the zone's own unless it starts with a keyword, exactly.
    for (const head of ['xrule', 'rulex', 'zones', 'alink']) expect(() => parse(`Zone\tA/B\t0\t-\tZ\t1990\n\t${head}\t-\tZ`)).toThrow(`not a time: "${head}"`);
  });
  it('refuses a line with too few or too many fields rather than guess', () => {
    const rule = 'Rule\tR\t2000\tonly\t-\tJan\t1\t0\t0\t-';
    expect(() => parse(rule.split('\t').slice(0, 9).join('\t'))).toThrow('a rule line has 10 fields');
    expect(() => parse(`${rule}\tx`)).toThrow('a rule line has 10 fields');
    expect(() => parse('Rule')).toThrow('a rule line has 10 fields');
    expect(() => parse('Zone\tA/B\t0\t-')).toThrow('a zone line has 3 to 7 fields: 0 -');
    expect(() => parse('Zone\tA/B\t0\t-\tZ\t1990\tJan\t1\t0\tx')).toThrow('a zone line has 3 to 7 fields');
    expect(() => parse('Zone\tA/B\t0\t-\tZ\t1990\n\t0\t-')).toThrow('a zone line has 3 to 7 fields: 0 -');
    expect(parse('Zone\tA/B\t0\t-\tZ\t1990\tJan\t1\t0').zones['A/B']).toHaveLength(1);
    expect(() => parse('Zone\tA/B\t0\t-\tZ\t1990\tJu')).toThrow('not a month: "Ju"');
    expect(parse('Zone\tA/B\t0\t-\tZ\t1990\tMar').zones['A/B']?.[0]?.until).toEqual({ year: 1990, month: 3, on: { kind: 'dom', day: 1 }, at: 0, atType: 'w' });
    expect(() => parse('Link\tA/B')).toThrow('a link line has 3 fields');
    expect(() => parse('Link\tA/B\tA/C\tA/D')).toThrow('a link line has 3 fields');
  });
  it('reads "only" and "max" by their prefixes, never an empty field', () => {
    const year = (to: string) => parse(`Rule\tR\t2000\t${to}\t-\tJan\t1\t0\t0\t-`).rules['R']?.[0]?.to;
    expect([year('o'), year('on'), year('only'), year('ma'), year('max'), year('maximum'), year('2010')]).toEqual([2000, 2000, 2000, null, null, null, 2010]);
    for (const bad of ['m', 'mx', 'onlyx', '2010x', 'x2010']) expect(() => year(bad)).toThrow(`not a year: "${bad}"`);
    expect(() => parseYear('', 2000)).toThrow('not a year: ""');
    expect(() => parseYear('only', null)).toThrow('not a year: "only"');
    expect(parseYear('only', 2000)).toBe(2000);
  });
  it('stops at anything it would have to guess', () => {
    expect(() => parse('Zone\tA/B\t0\t-\tZ\nZone\tA/B\t0\t-\tZ')).toThrow('the zone A/B is defined twice');
    expect(() => parse('Zone\tA/B\t0\t-\t"Z Z"')).toThrow("quoted fields aren't handled");
    expect(() => parse('Leap\t2016\tDec\t31\t23:59:60\t+\tS')).toThrow("a line the compiler doesn't know: Leap");
    expect(() => parse('\t1:00\t-\tZ')).toThrow("a line the compiler doesn't know");
    expect(() => parse('Rule\tR\t2000\tsometime\t-\tJan\t1\t0\t0\t-')).toThrow('not a year: "sometime"');
    expect(() => parse('Rule\tR\t2000\tm\t-\tJan\t1\t0\t0\t-')).toThrow('not a year: "m"');
    expect(() => parse('Rule\tR\tonly\t2000\t-\tJan\t1\t0\t0\t-')).toThrow('not a year: "only"');
    expect(() => parse('Rule\tR\t2000\tonly\t-\tJu\t1\t0\t0\t-')).toThrow('not a month: "Ju"');
    expect(() => parseTzdb(new Map(), 'v')).toThrow('the release has no "africa"');
    expect(parse('Rule\tR\t-50\tmaximum\t-\tJa\t1\t0\t0\t-').rules['R']?.[0]).toMatchObject({ from: -50, to: null, month: 1 });
  });
});

describe('the release\'s files', () => {
  const files = (over: Record<string, string | undefined>) => new Map(Object.entries({ version: '2026e\n', ...Object.fromEntries(SOURCES.map((s) => [s, ''])), ...over }).flatMap(([k, v]) => (v === undefined ? [] : [[k, Buffer.from(v)] as const])));
  it('must say they are the cited version', () => {
    expect(parseRelease(files({})).version).toBe('2026e');
    expect(() => parseRelease(files({ version: '2026d\n' }))).toThrow('the tarball says it is 2026d, not 2026e');
    expect(() => parseRelease(files({ version: undefined }))).toThrow('the tarball says it is undefined, not 2026e');
  });
  it('must hold every source file', () => {
    expect(() => parseRelease(files({ europe: undefined }))).toThrow('the release has no "europe"');
    expect(parseRelease(files({ europe: 'Zone\tE/F\t0\t-\tZ' })).zones).toEqual({ 'E/F': [{ stdoff: 0, rule: { kind: 'none' }, format: 'Z' }] });
  });
});

describe('the release on disk', () => {
  it('is checked before it is read, whatever the path it was copied to', () => {
    const root = mkdtempSync(join(tmpdir(), 'slate-tz-'));
    mkdirSync(join(root, 'vendor/tzdb'), { recursive: true });
    copyFileSync(join(ROOT, RELEASE.tarball), join(root, RELEASE.tarball));
    expect(readRelease(root).data.version).toBe('2026e');
  });
});
