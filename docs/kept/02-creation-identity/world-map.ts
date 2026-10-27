/**
 * The world map, as geometry.
 *
 * Everything here is arithmetic on a fixed equirectangular surface: no React,
 * no DOM, no network beyond the one fetch. The outlines themselves are Natural
 * Earth's, projected at build time by tools/build-world-map.mjs and served from
 * public/geo, because an outline of every country on Earth belongs in a file
 * that is fetched when somebody opens a map rather than in the bundle.
 *
 * The projection is a convenience for pointing at a country, not a claim about
 * area. Greenland is the size Mercator's cousins always make it. Nothing in the
 * simulation reads these coordinates; they exist so a tap can become a country.
 */

/** A rectangle on the map surface. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldMapData {
  /** The surface the paths are drawn on. */
  width: number;
  height: number;
  projection: string;
  /** Provenance of the outlines. Shown to the player. */
  source: string;
  /** SVG path data by SLATE country id. */
  countries: Record<string, string>;
  /** Country names as the source spells them. SLATE's own names win. */
  names: Record<string, string>;
  /** [x1, y1, x2, y2] framing each country. */
  bounds: Record<string, [number, number, number, number]>;
}

/** Longitude and latitude onto the surface. The projection, in one place. */
export function projectPoint(
  latitude: number,
  longitude: number,
  surface: { width: number; height: number },
): { x: number; y: number } {
  const lon = wrapLongitude(longitude);
  const lat = Math.max(-90, Math.min(90, latitude));
  return {
    x: ((lon + 180) / 360) * surface.width,
    y: ((90 - lat) / 180) * surface.height,
  };
}

/**
 * Longitude folded back into [-180, 180], however many turns out it was.
 *
 * The antimeridian is both ends of the map at once. A point given as 180 stays
 * at the right-hand edge rather than being folded to the left one, so a marker
 * on it lands next to the country it belongs to instead of an ocean away.
 */
export function wrapLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) return 0;
  const folded = ((longitude + 180) % 360 + 360) % 360 - 180;
  return folded === -180 && longitude > 0 ? 180 : folded;
}

/** The whole surface as a box. */
export function wholeWorld(surface: { width: number; height: number }): Box {
  return { x: 0, y: 0, width: surface.width, height: surface.height };
}

/** A stored [x1, y1, x2, y2] pair of corners as a box. */
export function boxFromCorners(corners: readonly number[]): Box | null {
  const [x1, y1, x2, y2] = corners;
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return null;
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/**
 * A view of the given box, at the surface's shape, inside the surface.
 *
 * Three things at once, because they only make sense together: a country is
 * not the shape of the viewport, so the box grows to match; a country the size
 * of Monaco would be a view no bigger than a full stop, so it is never allowed
 * below a floor; and the result is slid back inside the surface rather than
 * showing empty space past the edge of the world.
 */
export function frameBox(
  target: Box,
  surface: { width: number; height: number },
  options: { padding?: number; minimumWidth?: number } = {},
): Box {
  const padding = options.padding ?? 0.25;
  const minimumWidth = options.minimumWidth ?? surface.width * 0.06;
  const aspect = surface.width / surface.height;

  const centreX = target.x + target.width / 2;
  const centreY = target.y + target.height / 2;

  let width = Math.max(target.width * (1 + padding * 2), minimumWidth);
  let height = Math.max(target.height * (1 + padding * 2), minimumWidth / aspect);

  // Grow the short side until the view is the shape of the viewport.
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;

  // Never larger than the world, and never outside it.
  if (width > surface.width) { width = surface.width; height = width / aspect; }
  if (height > surface.height) { height = surface.height; width = height * aspect; }

  const x = Math.max(0, Math.min(surface.width - width, centreX - width / 2));
  const y = Math.max(0, Math.min(surface.height - height, centreY - height / 2));
  return { x, y, width, height };
}

/** A box as an SVG viewBox attribute. */
export function viewBoxOf(box: Box): string {
  const round = (n: number) => Number(n.toFixed(2));
  return `${round(box.x)} ${round(box.y)} ${round(box.width)} ${round(box.height)}`;
}

/**
 * How thick a hairline should be drawn at this zoom.
 *
 * Strokes are scaled with the view so that borders stay a hairline whether the
 * view is the whole world or one province of it, rather than swelling into
 * blobs the moment somebody zooms in.
 */
export function strokeAt(box: Box, surface: { width: number }): number {
  const zoom = surface.width / Math.max(box.width, 1);
  return Number(Math.max(0.25, 1.4 / zoom).toFixed(3));
}

/** Marker radius, likewise kept the same visual size at any zoom. */
export function markerRadiusAt(box: Box, surface: { width: number }): number {
  const zoom = surface.width / Math.max(box.width, 1);
  return Number(Math.max(1.8, 10 / zoom).toFixed(3));
}

/** Where the outlines live. Fetched once; asking again is free. */
const MAP_URL = `${import.meta.env.BASE_URL}geo/world-map.json`;

let pending: Promise<WorldMapData> | null = null;

/**
 * Pulls the outlines in.
 *
 * One request for the whole world, shared by every map on the page and kept
 * for the rest of the session. A failure is left to the caller to report;
 * the map is a convenience and the country list works without it.
 */
export function loadWorldMap(): Promise<WorldMapData> {
  if (pending) return pending;
  pending = fetch(MAP_URL)
    .then((response) => {
      if (!response.ok) throw new Error('The world map couldn’t be loaded.');
      return response.json() as Promise<WorldMapData>;
    })
    .then((data) => {
      if (!data?.countries || !data.width || !data.height) {
        throw new Error('The world map file isn’t readable.');
      }
      return data;
    })
    .catch((error: unknown) => {
      pending = null;
      throw error instanceof Error ? error : new Error('The world map couldn’t be loaded.');
    });
  return pending;
}

/** Forgets the cached map. Tests only; nothing in the game calls it. */
export function forgetWorldMap(): void {
  pending = null;
}
