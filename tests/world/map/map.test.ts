import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import { boxFromCorners, frameBox, loadMap, mapLoader, markerIn, markerRadiusAt, projectPoint, strokeAt, viewBoxOf, wholeWorld, wrapLongitude, type WorldMap } from '../../../src/world/map/map.ts';

const S = { width: 2000, height: 1000 };

describe('the projection', () => {
  it('folds a longitude into one turn, keeping 180 at the eastern edge', () => {
    expect([wrapLongitude(0), wrapLongitude(190), wrapLongitude(-190), wrapLongitude(540), wrapLongitude(180), wrapLongitude(-180), wrapLongitude(900), wrapLongitude(-540), wrapLongitude(179.5)]).toEqual([0, -170, 170, 180, 180, -180, 180, -180, 179.5]);
  });
  it('puts longitude across and latitude down, the poles at the edges', () => {
    expect(projectPoint(0, 0, S)).toEqual({ x: 1000, y: 500 });
    expect(projectPoint(90, -180, S)).toEqual({ x: 0, y: 0 });
    expect(projectPoint(-90, 180, S)).toEqual({ x: 2000, y: 1000 });
    expect(projectPoint(95, 0, S)).toEqual({ x: 1000, y: 0 });
    expect(projectPoint(-95, 360, S)).toEqual({ x: 1000, y: 1000 });
  });
});

describe('framing a view', () => {
  it('reads stored corners either way round', () => {
    expect(boxFromCorners([10, 20, 30, 60])).toEqual({ x: 10, y: 20, width: 20, height: 40 });
    expect(boxFromCorners([30, 60, 10, 20])).toEqual({ x: 10, y: 20, width: 20, height: 40 });
    expect(wholeWorld(S)).toEqual({ x: 0, y: 0, width: 2000, height: 1000 });
  });
  it('pads a box, grows its short side to the surface\'s shape, and keeps it inside the world', () => {
    expect(frameBox({ x: 900, y: 450, width: 200, height: 50 }, S)).toEqual({ x: 850, y: 400, width: 300, height: 150 });
    expect(frameBox({ x: 900, y: 400, width: 50, height: 200 }, S)).toEqual({ x: 625, y: 350, width: 600, height: 300 });
    expect(frameBox({ x: 0, y: 0, width: 200, height: 100 }, S, 0)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(frameBox({ x: 1950, y: 980, width: 40, height: 10 }, S, 0, 100)).toEqual({ x: 1900, y: 950, width: 100, height: 50 });
  });
  it('never makes a view smaller than the floor, nor larger than the world', () => {
    expect(frameBox({ x: 1000, y: 500, width: 1, height: 1 }, S)).toEqual({ x: 940.5, y: 470.5, width: 120, height: 60 });
    expect(frameBox({ x: 0, y: 0, width: 2000, height: 1000 }, S)).toEqual({ x: 0, y: 0, width: 2000, height: 1000 });
    expect(frameBox({ x: 0, y: 0, width: 1900, height: 100 }, S, 0.1)).toEqual({ x: 0, y: 0, width: 2000, height: 1000 });
  });
  it('writes a view as a viewBox, to a hundredth', () => {
    expect(viewBoxOf({ x: 1.234, y: 5, width: 10.005, height: 3.333 })).toBe('1.23 5 10.01 3.33');
  });
  it('keeps borders a hairline and markers one size at any zoom', () => {
    expect([strokeAt(wholeWorld(S), S), strokeAt({ x: 0, y: 0, width: 200, height: 100 }, S), strokeAt({ x: 0, y: 0, width: 0.5, height: 1 }, S)]).toEqual([1.4, 0.25, 0.25]);
    expect(strokeAt({ x: 0, y: 0, width: 1000, height: 500 }, S)).toBe(0.7);
    expect([markerRadiusAt(wholeWorld(S), S), markerRadiusAt({ x: 0, y: 0, width: 200, height: 100 }, S), markerRadiusAt({ x: 0, y: 0, width: 1000, height: 500 }, S)]).toEqual([10, 1.8, 5]);
  });
  it('marks a point in a view a turn either way, or not at all outside it', () => {
    expect(markerIn(wholeWorld(S), S, 0, 0)).toEqual({ x: 1000, y: 500 });
    expect(markerIn({ x: 1900, y: 400, width: 200, height: 100 }, S, 0, -175)).toEqual({ x: projectPoint(0, -175, S).x + 2000, y: 500 });
    expect(markerIn({ x: -100, y: 400, width: 200, height: 100 }, S, 0, 175)).toEqual({ x: projectPoint(0, 175, S).x - 2000, y: 500 });
    expect(markerIn({ x: 0, y: 0, width: 100, height: 100 }, S, 0, 0)).toBeNull();
    expect(markerIn({ x: 900, y: 0, width: 200, height: 100 }, S, 0, 0)).toBeNull();
    expect(markerIn({ x: 900, y: 600, width: 200, height: 100 }, S, 0, 0)).toBeNull();
    expect(markerIn({ x: 900, y: 500, width: 200, height: 0 }, S, 0, 0)).toEqual({ x: 1000, y: 500 });
    // A point on a view's left or right edge is in it; one beside the view, though level with it, isn't.
    expect(markerIn({ x: 1000, y: 0, width: 100, height: 1000 }, S, 0, 0)).toEqual({ x: 1000, y: 500 });
    expect(markerIn({ x: 900, y: 0, width: 100, height: 1000 }, S, 0, 0)).toEqual({ x: 1000, y: 500 });
    expect(markerIn({ x: 0, y: 0, width: 100, height: 1000 }, S, 0, 0)).toBeNull();
  });
});

describe('the outlines', () => {
  it('load once, keyed by the gazetteer\'s codes, every drawn country with its box', async () => {
    const map = await loadMap();
    expect(loadMap()).toBe(loadMap());
    const drawn = Object.keys(map.countries);
    expect(drawn).toHaveLength(175);
    expect(drawn.every((c) => (COUNTRY_CODES as string[]).includes(c))).toBe(true);
    for (const code of drawn as (keyof WorldMap['bounds'])[]) {
      const [x1, y1, x2, y2] = map.bounds[code] as number[];
      expect(0 <= (x1 as number) && (x1 as number) <= (x2 as number) && (x2 as number) <= 2000 && 0 <= (y1 as number) && (y1 as number) <= (y2 as number) && (y2 as number) <= 1000, code).toBe(true);
    }
  });
  it('a load that failed is tried again', async () => {
    let calls = 0;
    const load = mapLoader(() => ((calls += 1) === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ width: 1, height: 1, countries: {}, bounds: {} })));
    await expect(load()).rejects.toThrow('offline');
    expect(await load()).toEqual({ width: 1, height: 1, countries: {}, bounds: {} });
    expect(await load()).toEqual({ width: 1, height: 1, countries: {}, bounds: {} });
    expect(calls).toBe(2);
  });
});

