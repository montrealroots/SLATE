import type { CountryCode } from '../gazetteer/gazetteer.ts';

/**
 * The world map (KEEP entry 3, the place of birth), as geometry: Natural Earth's 1:110m outlines (register R-0035),
 * compiled by tools/naturalearth/ onto an equirectangular surface with this file's projection, and the arithmetic of
 * pointing at them. The projection is a way to point at a country, not a claim about area; nothing in the simulation
 * reads a coordinate of it. The outlines are fetched when a map is opened, not with the app.
 */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Surface {
  width: number;
  height: number;
}

export interface WorldMap extends Surface {
  /** SVG path data, by country code: the 175 countries big enough to draw at 1:110m. */
  countries: Partial<Record<CountryCode, string>>;
  /** [x1, y1, x2, y2] framing each drawn country. */
  bounds: Partial<Record<CountryCode, [number, number, number, number]>>;
}

/**
 * Longitude folded into [-180, 180], however many turns out it was. The antimeridian is both ends of the map; a point
 * given as 180 (or any turn of it from the east) stays at the right-hand edge, by the country it belongs to.
 */
export function wrapLongitude(longitude: number): number {
  const folded = ((((longitude + 180) % 360) + 360) % 360) - 180;
  // Stryker disable next-line EqualityOperator: only a turn of 180 folds to -180, so 0 is never the longitude here.
  return folded === -180 && longitude > 0 ? 180 : folded;
}

/** A longitude and latitude onto the surface: the projection, in one place. */
export function projectPoint(latitude: number, longitude: number, surface: Surface): { x: number; y: number } {
  const lat = Math.max(-90, Math.min(90, latitude));
  return { x: ((wrapLongitude(longitude) + 180) / 360) * surface.width, y: ((90 - lat) / 180) * surface.height };
}

export const wholeWorld = (surface: Surface): Box => ({ x: 0, y: 0, width: surface.width, height: surface.height });

/** Stored corners [x1, y1, x2, y2] as a box. */
export function boxFromCorners([x1, y1, x2, y2]: readonly [number, number, number, number]): Box {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

/**
 * A view of a box at the surface's shape, inside the surface: padded on every side, never smaller than a floor (a
 * country Monaco's size would otherwise be a view no bigger than a full stop), grown on its short side to the
 * surface's shape, never larger than the world, and slid back inside it rather than showing past its edge.
 */
export function frameBox(target: Box, surface: Surface, padding = 0.25, minimumWidth = surface.width * 0.06): Box {
  const aspect = surface.width / surface.height;
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  let width = Math.max(target.width * (1 + padding * 2), minimumWidth);
  let height = Math.max(target.height * (1 + padding * 2), minimumWidth / aspect);
  // Stryker disable next-line EqualityOperator: at the surface's shape, either branch leaves the box as it is.
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;
  // Stryker disable next-line EqualityOperator: exactly the world's width, clamping changes nothing.
  if (width > surface.width) {
    width = surface.width;
    height = width / aspect;
  }
  const x = Math.max(0, Math.min(surface.width - width, cx - width / 2));
  const y = Math.max(0, Math.min(surface.height - height, cy - height / 2));
  return { x, y, width, height };
}

/** A box as an SVG viewBox, to a hundredth. */
export function viewBoxOf(box: Box): string {
  const r = (n: number) => Number(n.toFixed(2));
  return `${r(box.x)} ${r(box.y)} ${r(box.width)} ${r(box.height)}`;
}

/** The zoom a view is at: how many times the whole world's width it shows. */
const zoomOf = (view: Box, surface: Surface) => surface.width / Math.max(view.width, 1);

/** A border's width at this zoom, so it stays a hairline whether the view is the world or one province of it. */
export const strokeAt = (view: Box, surface: Surface): number => Number(Math.max(0.25, 1.4 / zoomOf(view, surface)).toFixed(3));

/** A marker's radius at this zoom, likewise the same size on the screen at any zoom. */
export const markerRadiusAt = (view: Box, surface: Surface): number => Number(Math.max(1.8, 10 / zoomOf(view, surface)).toFixed(3));

/**
 * Where a point lands in a view, looked for a turn of the world either way (the antimeridian being both edges), or
 * null when it's outside the view.
 */
export function markerIn(view: Box, surface: Surface, latitude: number, longitude: number): { x: number; y: number } | null {
  const p = projectPoint(latitude, longitude, surface);
  const x = [p.x, p.x + surface.width, p.x - surface.width].find((v) => v >= view.x && v <= view.x + view.width);
  return x === undefined || p.y < view.y || p.y > view.y + view.height ? null : { x, y: p.y };
}

/** A loader that fetches the outlines once and shares them; a fetch that failed is tried again the next time. */
export function mapLoader(load: () => Promise<WorldMap>): () => Promise<WorldMap> {
  let pending: Promise<WorldMap> | undefined;
  return () => {
    if (pending === undefined) {
      pending = load();
      pending.catch(() => {
        pending = undefined;
      });
    }
    return pending;
  };
}

export const loadMap = mapLoader(async () => (await import('./world-map.json')).default as WorldMap);
