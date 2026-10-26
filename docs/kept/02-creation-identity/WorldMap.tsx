/**
 * Tapping a part of the world.
 *
 * A hundred and seventy-four country outlines, drawn once and pointed at.
 * Picking a country here does exactly what picking it from the list does — the
 * map is a second way in, not a second source of truth — and the list stays
 * the one that works with a keyboard, a screen reader, and for the small
 * states and territories this scale of outline simply does not contain.
 *
 * The map is fetched when it is opened and never bundled.
 */

import { useEffect, useMemo, useState } from 'react';
import { COUNTRIES, cityCount } from '@/engine/content/geography';
import {
  boxFromCorners, frameBox, loadWorldMap, markerRadiusAt, projectPoint,
  strokeAt, viewBoxOf, wholeWorld, type WorldMapData,
} from './world-map';

export function WorldMap({
  countryId, marker, onPick,
}: {
  /** The country currently chosen, highlighted and framed. */
  countryId: string;
  /** A point to mark — the chosen town, when there is one. */
  marker?: { latitude: number; longitude: number; name: string } | undefined;
  onPick: (countryId: string) => void;
}) {
  const [data, setData] = useState<WorldMapData | null>(null);
  const [problem, setProblem] = useState<string | undefined>();
  const [hovered, setHovered] = useState<string | undefined>();
  // The whole world, until somebody asks for a closer look. Framing the
  // chosen country on open would put every other country off the canvas,
  // which is the one thing a map for tapping countries must not do.
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWorldMap()
      .then((loaded) => { if (!cancelled) setData(loaded); })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProblem(error instanceof Error ? error.message : 'The world map couldn’t be loaded.');
        }
      });
    return () => { cancelled = true; };
  }, []);

  const ids = useMemo(() => (data ? Object.keys(data.countries).sort() : []), [data]);

  const view = useMemo(() => {
    if (!data) return null;
    const world = wholeWorld(data);
    if (!framed) return world;
    const corners = data.bounds[countryId];
    const box = corners ? boxFromCorners(corners) : null;
    return box ? frameBox(box, data) : world;
  }, [data, countryId, framed]);

  if (problem) {
    return (
      <div className="worldmap-shell worldmap-empty">
        <p className="hint" role="alert">{problem} Use the country list below instead.</p>
      </div>
    );
  }

  if (!data || !view) {
    return (
      <div className="worldmap-shell worldmap-empty">
        <p className="hint">Drawing the world…</p>
      </div>
    );
  }

  const nameOf = (id: string) => COUNTRIES.get(id)?.name ?? data.names[id] ?? id;
  const stroke = strokeAt(view, data);
  const readout = hovered ?? countryId;
  // The antimeridian is both edges of the map, so a marker just past it is
  // looked for a turn either way before it is given up on.
  const projected = marker ? projectPoint(marker.latitude, marker.longitude, data) : null;
  const inView = (x: number) => x >= view.x && x <= view.x + view.width;
  const markerX = projected === null
    ? null
    : [projected.x, projected.x + data.width, projected.x - data.width].find(inView) ?? null;
  const showMarker = projected !== null && markerX !== null
    && projected.y >= view.y && projected.y <= view.y + view.height;

  return (
    <div className="worldmap-shell">
      <div className="worldmap-bar">
        <span
          className="worldmap-readout truncate"
          title={readout
            ? `${nameOf(readout)}${cityCount(readout) > 0 ? ` · ${cityCount(readout).toLocaleString('en-US')} places` : ''}`
            : 'Tap anywhere on the map'}
        >
          {readout ? nameOf(readout) : 'Tap anywhere on the map'}
          {readout && cityCount(readout) > 0 && (
            <span className="dim"> · {cityCount(readout).toLocaleString('en-US')} places</span>
          )}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setFramed((on) => !on)}
          disabled={!data.bounds[countryId]}
        >
          {framed ? 'Whole World' : 'Zoom In'}
        </button>
      </div>

      <svg
        className="worldmap"
        viewBox={viewBoxOf(view)}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="World map. Tap a country to choose it."
        onPointerLeave={() => setHovered(undefined)}
      >
        <rect
          className="worldmap-sea"
          x={0} y={0} width={data.width} height={data.height}
        />
        {ids.map((id) => {
          const known = cityCount(id) > 0;
          return (
            <path
              key={id}
              d={data.countries[id]}
              className="worldmap-country"
              data-selected={id === countryId ? 'true' : undefined}
              data-empty={known ? undefined : 'true'}
              strokeWidth={stroke}
              role={known ? 'button' : undefined}
              tabIndex={-1}
              aria-label={known ? nameOf(id) : undefined}
              onPointerEnter={() => setHovered(id)}
              onClick={known ? () => onPick(id) : undefined}
            >
              <title>
                {known
                  ? nameOf(id)
                  : `${nameOf(id)}: no towns or cities on record`}
              </title>
            </path>
          );
        })}
        {showMarker && projected && markerX !== null && (
          <>
            <circle
              className="worldmap-marker-halo"
              cx={markerX} cy={projected.y} r={markerRadiusAt(view, data) * 2.2}
            />
            <circle
              className="worldmap-marker"
              cx={markerX} cy={projected.y} r={markerRadiusAt(view, data)}
            />
          </>
        )}
      </svg>

      <p className="worldmap-note xs dim">
        {marker ? `${marker.name} is marked. ` : ''}
        Outlines from {data.source} Countries too small to draw at this scale are still in the list below.
      </p>
    </div>
  );
}
