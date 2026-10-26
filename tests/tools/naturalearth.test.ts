import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOLDED, HEIGHT, OUTPUT, SOURCE, WIDTH, compileMap, project, readMap, ringPath, serialize } from '../../tools/naturalearth/compile.ts';

const ROOT = join(import.meta.dirname, '../..');
const COUNTRIES = new Set(Object.keys(JSON.parse(readFileSync(join(ROOT, 'src/world/gazetteer/countries.json'), 'utf8')) as object));
const square = (lon: number, lat: number, size = 1) => [[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]] as [number, number][];
const feature = (iso: string, adm: string, geometry: unknown) => ({ properties: { ISO_A2_EH: iso, ADM0_A3: adm }, geometry }) as never;

describe('the map compiler', () => {
  it('reproduces the outlines the engine reads, byte for byte, from Natural Earth 5.1.2', () => {
    expect(serialize(readMap(ROOT, COUNTRIES))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
  });
  it('draws 175 countries, each under a code the gazetteer lists; Northern Cyprus as Cyprus and Somaliland as Somalia', () => {
    const map = readMap(ROOT, COUNTRIES);
    const drawn = Object.keys(map.countries);
    expect(drawn).toHaveLength(175);
    expect(drawn.every((c) => COUNTRIES.has(c))).toBe(true);
    expect(Object.keys(map.bounds)).toEqual(drawn);
    expect(FOLDED).toEqual({ CYN: 'CY', SOL: 'SO' });
    expect([map.width, map.height]).toEqual([2000, 1000]);
    for (const code of ['US', 'FR', 'NO', 'XK', 'TW', 'CY', 'SO', 'EH']) expect(drawn, code).toContain(code);
    for (const code of ['MC', 'SG', 'VA', 'AD', 'MT']) expect(drawn, code).not.toContain(code);
  });
  it('projects longitude across and latitude down, to a tenth', () => {
    expect([WIDTH, HEIGHT]).toEqual([2000, 1000]);
    expect([project(-180, 90), project(180, -90), project(0, 0), project(2.35222, 48.85661)]).toEqual([[0, 0], [2000, 1000], [1000, 500], [1013.1, 228.6]]);
  });
  it('writes a ring as a closed path, leaving out a point no different at this precision', () => {
    expect(ringPath([[0, 0], [0.001, 0.001], [9, 0], [0, 0]])).toBe('M1000,500L1050,500L1000,500Z');
  });
  it('joins a country\'s polygons into one path, framed by one box', () => {
    const map = compileMap({ features: [
      feature('FR', 'FRA', { type: 'Polygon', coordinates: [square(0, 0)] }),
      feature('FR', 'FRA', { type: 'MultiPolygon', coordinates: [[square(10, 10)], [square(-10, -5, 2)]] }),
      feature('-99', 'CYN', { type: 'Polygon', coordinates: [square(30, 30)] }),
    ] }, new Set(['FR', 'CY']));
    expect(Object.keys(map.countries)).toEqual(['CY', 'FR']);
    expect(map.countries.FR?.split('M')).toHaveLength(4);
    expect(map.bounds.FR).toEqual([...project(-10, 11), ...project(11, -5)]);
    expect(map.bounds.CY).toEqual([...project(30, 31), ...project(31, 30)]);
  });
  it('refuses an outline with no country it can be drawn as', () => {
    expect(() => compileMap({ features: [feature('-99', 'XYZ', { type: 'Polygon', coordinates: [square(0, 0)] })] }, COUNTRIES)).toThrow('the outline XYZ has no country code and none is given it');
    expect(() => compileMap({ features: [feature('ZZ', 'ZZZ', { type: 'Polygon', coordinates: [square(0, 0)] })] }, COUNTRIES)).toThrow("the outline ZZZ is of ZZ, which the gazetteer doesn't list");
  });
  it('refuses a file that isn\'t the release the register cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'slate-ne-'));
    mkdirSync(join(root, 'vendor/naturalearth'), { recursive: true });
    copyFileSync(join(ROOT, SOURCE.file), join(root, SOURCE.file));
    writeFileSync(join(root, SOURCE.file), '{"features":[]}');
    expect(() => readMap(root, COUNTRIES)).toThrow(`${SOURCE.file} is not the file the register cites (sha256 `);
  });
});
