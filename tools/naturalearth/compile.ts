import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectPoint } from '../../src/world/map/map.ts';

/**
 * Compiles the world map's outlines from Natural Earth's 1:110m countries, release 5.1.2, as the project publishes
 * them (register R-0035; public domain), checked against the pinned SHA-256 first. Each outline is projected onto an
 * equirectangular surface (longitude across, latitude down, as the first SLATE's map was) and written as SVG path
 * data under the gazetteer's country code, with the box that frames it. Natural Earth's two outlines with no ISO code
 * of their own go to the country GeoNames files their towns under: Northern Cyprus to Cyprus, Somaliland to Somalia.
 * The countries too small to draw at this scale have no outline and stay in the lists.
 */
export const SOURCE = {
  file: 'vendor/naturalearth/ne_110m_admin_0_countries.geojson',
  sha256: '6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f',
} as const;
export const OUTPUT = 'src/world/map/world-map.json';

export const WIDTH = 2000;
export const HEIGHT = 1000;

/** The outlines with no ISO code (ISO_A2_EH "-99"), by Natural Earth's ADM0_A3, and the country each is drawn as. */
export const FOLDED: Readonly<Record<string, string>> = { CYN: 'CY', SOL: 'SO' };

export interface WorldMap {
  width: number;
  height: number;
  /** SVG path data, by country code. */
  countries: Record<string, string>;
  /** [x1, y1, x2, y2] framing each country's outline. */
  bounds: Record<string, [number, number, number, number]>;
}

type Ring = [number, number][];
interface Feature {
  properties: { ISO_A2_EH: string; ADM0_A3: string };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
}

/** A longitude and latitude onto the surface by the map's own projection, to a tenth of a unit. */
export function project(lon: number, lat: number): [number, number] {
  const { x, y } = projectPoint(lat, lon, { width: WIDTH, height: HEIGHT });
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

/** One ring as a closed subpath, a point the same as the one before it (at this precision) left out. */
export function ringPath(ring: Ring): string {
  const points: [number, number][] = [];
  for (const [lon, lat] of ring) {
    const p = project(lon, lat);
    const last = points.at(-1);
    if (last === undefined || last[0] !== p[0] || last[1] !== p[1]) points.push(p);
  }
  return `M${points.map(([x, y]) => `${x},${y}`).join('L')}Z`;
}

export function compileMap(geojson: { features: Feature[] }, countries: ReadonlySet<string>): WorldMap {
  const paths = new Map<string, string[]>();
  const boxes = new Map<string, [number, number, number, number]>();
  for (const f of geojson.features) {
    const { ISO_A2_EH: iso, ADM0_A3: adm } = f.properties;
    const code = iso === '-99' ? FOLDED[adm] : iso;
    if (code === undefined) throw new Error(`the outline ${adm} has no country code and none is given it`);
    if (!countries.has(code)) throw new Error(`the outline ${adm} is of ${code}, which the gazetteer doesn't list`);
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const ring of polygons.flat()) {
      (paths.get(code) ?? paths.set(code, []).get(code) as string[]).push(ringPath(ring));
      for (const [lon, lat] of ring) {
        const [x, y] = project(lon, lat);
        const b = boxes.get(code);
        boxes.set(code, b === undefined ? [x, y, x, y] : [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]);
      }
    }
  }
  const codes = [...paths.keys()].sort();
  return {
    width: WIDTH,
    height: HEIGHT,
    countries: Object.fromEntries(codes.map((c) => [c, (paths.get(c) as string[]).join('')])),
    bounds: Object.fromEntries(codes.map((c) => [c, boxes.get(c) as [number, number, number, number]])),
  };
}

/** Reads the pinned release, refusing a file that isn't the one the register cites. */
export function readMap(root: string, countries: ReadonlySet<string>): WorldMap {
  const bytes = readFileSync(join(root, SOURCE.file));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== SOURCE.sha256) throw new Error(`${SOURCE.file} is not the file the register cites (sha256 ${sha})`);
  return compileMap(JSON.parse(bytes.toString('utf8')) as { features: Feature[] }, countries);
}

export const serialize = (m: WorldMap) => `${JSON.stringify(m)}\n`;
