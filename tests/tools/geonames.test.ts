import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { OUT, SOURCES, parseCountries, parsePlaces, parseRegions, readGazetteer, serialize } from '../../tools/geonames/compile.ts';
import { readZip } from '../../tools/geonames/zip.ts';

const ROOT = join(import.meta.dirname, '../..');

/** A zip built by hand: entries stored or deflated, written with a data descriptor as GeoNames writes them. */
function zip(entries: { name: string; body: string; method?: number; flags?: number; crc?: number; extra?: string; localExtra?: string; note?: string }[], comment = ''): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const body = Buffer.from(e.body);
    const method = e.method ?? 8;
    const data = method === 8 ? deflateRawSync(body) : body;
    const name = Buffer.from(e.name);
    const extra = Buffer.from(e.extra ?? '');
    const localExtra = Buffer.from(e.localExtra ?? '');
    const note = Buffer.from(e.note ?? '');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(e.flags ?? 0x0808, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(localExtra.length, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(e.flags ?? 0x0808, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(e.crc ?? crc32(body), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt16LE(note.length, 32);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, localExtra, data);
    centrals.push(central, name, extra, note);
    offset += 30 + name.length + localExtra.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(Buffer.byteLength(comment), 20);
  return Buffer.concat([...locals, dir, end, Buffer.from(comment)]);
}

describe('the zip reader', () => {
  it('reads deflated and stored entries by name, past a comment', () => {
    const files = readZip(zip([{ name: 'a.txt', body: 'hello hello hello' }, { name: 'é.txt', body: 'plain', method: 0 }], 'a comment'));
    expect([...files.keys()]).toEqual(['a.txt', 'é.txt']);
    expect(files.get('a.txt')?.toString()).toBe('hello hello hello');
    expect(files.get('é.txt')?.toString()).toBe('plain');
    expect(readZip(zip([])).size).toBe(0);
    // Extra fields, local and central, and an entry's own comment are stepped over.
    const extras = readZip(zip([{ name: 'a', body: 'one', extra: 'XXXXXXXX', localExtra: 'YYYYYY', note: 'a note' }, { name: 'b', body: 'two', extra: 'Z', note: 'n' }]));
    expect([...extras].map(([k, v]) => [k, v.toString()])).toEqual([['a', 'one'], ['b', 'two']]);
  });
  it('reads GeoNames\' dump', () => {
    const files = readZip(readFileSync(join(ROOT, SOURCES.places.file)));
    expect([...files.keys()]).toEqual(['cities1000.txt']);
    expect(files.get('cities1000.txt')?.length).toBe(32_037_359);
  });
  it('refuses what it can\'t read rather than guess', () => {
    expect(() => readZip(Buffer.from('not a zip at all, not even close'))).toThrow('not a zip archive: no end of central directory');
    expect(() => readZip(Buffer.alloc(10))).toThrow('not a zip archive');
    expect(() => readZip(zip([{ name: 'x', body: 'y', flags: 0x0809 }]))).toThrow('x is encrypted');
    expect(() => readZip(zip([{ name: 'x', body: 'y', method: 12 }]))).toThrow('x is compressed by method 12, which isn\'t read');
    expect(() => readZip(zip([{ name: 'x', body: 'y', crc: 1 }]))).toThrow("a damaged zip: x doesn't match its size and checksum");
    const shortened = zip([{ name: 'x', body: 'yyyy', method: 0 }]);
    shortened.writeUInt32LE(3, shortened.length - 22 - 46 - 1 + 24 + 0);
    expect(() => readZip(shortened)).toThrow('a damaged zip');
    const noCentral = zip([{ name: 'x', body: 'y' }]);
    noCentral.writeUInt32LE(0, noCentral.length - 22 - 47);
    expect(() => readZip(noCentral)).toThrow('a damaged zip: a central directory entry has no signature');
    const noLocal = zip([{ name: 'x', body: 'y' }]);
    noLocal.writeUInt32LE(0, 0);
    expect(() => readZip(noLocal)).toThrow('a damaged zip: x has no local header');
  });
  it('finds the end record however long the comment, up to the format\'s limit', () => {
    expect(readZip(zip([{ name: 'x', body: 'y' }], 'c'.repeat(0xffff))).get('x')?.toString()).toBe('y');
    // An end record further back than any comment could put it isn't the archive's end.
    expect(() => readZip(Buffer.concat([zip([{ name: 'x', body: 'y' }]), Buffer.alloc(0xffff + 1)]))).toThrow('not a zip archive: no end of central directory');
  });
});

const COUNTRY = (code: string, name: string) => [code, 'XXX', '000', 'XX', name, 'Capital', '1', '1', 'EU', '.xx', 'EUR', 'Euro', '1', '', '', 'xx', '1', '', ''].join('\t');
const PLACE = (over: Partial<Record<'id' | 'name' | 'ascii' | 'lat' | 'lon' | 'cls' | 'cc' | 'a1' | 'pop' | 'tz' | 'elev' | 'dem', string>> = {}) => {
  const p = { id: '1', name: 'Ville', ascii: 'Ville', lat: '45.5', lon: '-73.5', cls: 'P', cc: 'FR', a1: '11', pop: '1000', tz: 'Europe/Paris', elev: '', dem: '35', ...over };
  return [p.id, p.name, p.ascii, 'alt', p.lat, p.lon, p.cls, 'PPL', p.cc, '', p.a1, '', '', '', p.pop, p.elev, p.dem, p.tz, '2026-01-01'].join('\t');
};

describe('the compiler', () => {
  it('reproduces the gazetteer the engine reads, file for file and byte for byte', () => {
    const files = serialize(readGazetteer(ROOT));
    for (const [path, text] of files) expect(readFileSync(join(ROOT, OUT, path), 'utf8'), path).toBe(text);
    const written = readdirSync(join(ROOT, OUT, 'places')).map((f) => `places/${f}`);
    expect(written.sort()).toEqual([...files.keys()].filter((k) => k.startsWith('places/')).sort());
  });
  it('reads the whole dump: 252 countries, 3,865 regions, 171,654 places, in 246 countries', () => {
    const g = readGazetteer(ROOT);
    const placed = Object.keys(g.places);
    expect([Object.keys(g.countries).length, Object.keys(g.regions).length, Object.values(g.places).flat().length, placed.length]).toEqual([252, 3865, 171_654, 246]);
    expect(Object.keys(g.countries).filter((c) => !placed.includes(c)).sort()).toEqual(['AN', 'AQ', 'BV', 'CS', 'HM', 'UM']);
    expect(g.countries['US']).toEqual({ name: 'United States' });
    expect(g.regions['US.CA']).toEqual({ name: 'California' });
  });
  it('reads countries, refusing a line it doesn\'t know and a code listed twice', () => {
    expect(parseCountries(`#ISO\tcomment\n${COUNTRY('FR', 'France')}\n\n${COUNTRY('DE', 'Germany')}\n`)).toEqual({ FR: { name: 'France' }, DE: { name: 'Germany' } });
    for (const bad of [COUNTRY('F', 'France'), COUNTRY('fr', 'France'), COUNTRY('FRA', 'France'), COUNTRY('FR', ''), `${COUNTRY('FR', 'France')}\textra`, COUNTRY('FR', 'France').split('\t').slice(0, 18).join('\t')]) {
      expect(() => parseCountries(bad)).toThrow(`a country line the compiler doesn't know: ${bad}`);
    }
    expect(() => parseCountries(`${COUNTRY('FR', 'France')}\n${COUNTRY('FR', 'Francia')}`)).toThrow('the country FR is listed twice');
  });
  it('reads regions, each in a listed country, once', () => {
    const countries = { FR: { name: 'France' } };
    expect(parseRegions('FR.11\tÎle-de-France\tIle-de-France\t3012874\n', countries)).toEqual({ 'FR.11': { name: 'Île-de-France' } });
    for (const bad of ['FR.11\tName\tName', 'FR.11\tName\tName\t1\tx', 'FR11\tName\tName\t1', 'fr.11\tName\tName\t1', 'FR.\tName\tName\t1', 'FR.11\t\tName\t1', 'xFR.11\tName\tName\t1', 'FR.1a\tName\tName\t1', 'FR.11.2\tName\tName\t1']) {
      expect(() => parseRegions(bad, countries)).toThrow(`a region line the compiler doesn't know: ${bad}`);
    }
    expect(() => parseRegions('DE.01\tBaden\tBaden\t1', countries)).toThrow('the region DE.01 is in no listed country');
    expect(() => parseRegions('FR.11\tA\tA\t1\nFR.11\tB\tB\t2', countries)).toThrow('the region FR.11 is listed twice');
  });
  it('reads places, keeping a plain spelling only where it differs and a region only where it\'s listed', () => {
    const countries = { FR: { name: 'France' }, DE: { name: 'Germany' } };
    const regions = { 'FR.11': { name: 'Île-de-France' } };
    const text = [PLACE({ id: '20', name: 'Évry', ascii: 'Evry' }), PLACE({ id: '3', a1: '00' }), PLACE({ id: '100', cc: 'DE', a1: '', lat: '-90', lon: '180', pop: '0', tz: 'Europe/Berlin', dem: '-12' })].join('\n');
    expect(parsePlaces(`${text}\n`, countries, regions)).toEqual({
      FR: [
        { id: '3', name: 'Ville', ascii: '', region: '', latitude: '45.5', longitude: '-73.5', zone: 'Europe/Paris', population: 1000, elevation: '35' },
        { id: '20', name: 'Évry', ascii: 'Evry', region: 'FR.11', latitude: '45.5', longitude: '-73.5', zone: 'Europe/Paris', population: 1000, elevation: '35' },
      ],
      DE: [{ id: '100', name: 'Ville', ascii: '', region: '', latitude: '-90', longitude: '180', zone: 'Europe/Berlin', population: 0, elevation: '-12' }],
    });
  });
  it('takes a place\'s height from the elevation model, or the recorded elevation where the model has none, or leaves it unknown', () => {
    const at = (elev: string, dem: string) => parsePlaces(PLACE({ elev, dem }), { FR: { name: 'France' } }, {})['FR']?.[0]?.elevation;
    expect([at('', '35'), at('120', '35'), at('120', '-9999'), at('', '-9999'), at('-3', '-9999')]).toEqual(['35', '35', '120', '', '-3']);
  });
  it('refuses a place it would have to guess at', () => {
    const countries = { FR: { name: 'France' } };
    const bads = [
      PLACE({ id: 'x1' }), PLACE({ id: '1x' }), PLACE({ id: '' }), PLACE({ name: '' }), PLACE({ cls: 'A' }), PLACE({ lat: '90.1' }), PLACE({ lat: '-91' }), PLACE({ lat: 'N45' }), PLACE({ lat: '45.' }),
      PLACE({ lon: '180.5' }), PLACE({ lon: '-181' }), PLACE({ lon: '1e2' }), PLACE({ lon: '1234' }), PLACE({ pop: '-1' }), PLACE({ pop: '1.5' }), PLACE({ pop: 'x' }), PLACE({ tz: '' }), PLACE({ dem: '' }), PLACE({ dem: '1.5' }), PLACE({ dem: 'x1' }), PLACE({ elev: '1x' }), PLACE({ elev: 'x' }),
      `${PLACE()}\textra`, PLACE().split('\t').slice(0, 18).join('\t'),
    ];
    for (const bad of bads) expect(() => parsePlaces(bad, countries, {})).toThrow(`a place line the compiler doesn't know: ${bad}`);
    expect(() => parsePlaces(PLACE({ cc: 'ZZ' }), countries, {})).toThrow('the place 1 is in no listed country (ZZ)');
    expect(() => parsePlaces(`${PLACE()}\n${PLACE()}`, countries, {})).toThrow('the place 1 is listed twice');
  });
  it('writes each country\'s places as tab-separated lines, and the axis\'s index of every id', () => {
    const files = serialize({
      countries: { FR: { name: 'France' }, BE: { name: 'Belgium' } },
      regions: { 'FR.11': { name: 'Île' } },
      places: {
        FR: [{ id: '5', name: 'A', ascii: '', region: 'FR.11', latitude: '1', longitude: '2', zone: 'Europe/Paris', population: 9, elevation: '30' }],
        BE: [{ id: '7', name: 'B', ascii: 'b', region: '', latitude: '3', longitude: '4', zone: 'Europe/Brussels', population: 0, elevation: '' }],
      },
    });
    expect([...files.keys()]).toEqual(['countries.json', 'regions.json', 'places/BE.tsv', 'places/FR.tsv', 'place-ids.json']);
    expect(files.get('countries.json')).toBe('{\n "BE": {\n  "name": "Belgium"\n },\n "FR": {\n  "name": "France"\n }\n}\n');
    expect(files.get('places/FR.tsv')).toBe('5\tA\t\tFR.11\t1\t2\tEurope/Paris\t9\t30\n');
    expect(files.get('places/BE.tsv')).toBe('7\tB\tb\t\t3\t4\tEurope/Brussels\t0\t\n');
    expect(files.get('place-ids.json')).toBe('["7","5"]\n');
  });
  it('refuses a file that isn\'t the one the register cites', () => {
    for (const which of ['countries', 'regions', 'places'] as const) {
      const root = mkdtempSync(join(tmpdir(), 'slate-geo-'));
      mkdirSync(join(root, 'vendor/geonames'), { recursive: true });
      for (const s of Object.values(SOURCES)) copyFileSync(join(ROOT, s.file), join(root, s.file));
      writeFileSync(join(root, SOURCES[which].file), 'changed');
      expect(() => readGazetteer(root)).toThrow(`${SOURCES[which].file} is not the file the register cites (sha256 `);
    }
  });
});
