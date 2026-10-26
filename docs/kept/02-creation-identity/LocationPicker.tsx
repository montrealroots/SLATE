/**
 * Choosing a place in the world.
 *
 * SLATE knows every country, every first-level subdivision of every country,
 * and every populated place of a thousand people or more — a hundred and
 * seventy thousand of them. A flat dropdown is useless at that size, so this
 * narrows: the map or the country list, then the state or province, then the
 * town itself by name.
 *
 * Only the country you are looking at is ever fetched. Picking Italy pulls
 * Italy's ten thousand towns and nothing else, once.
 *
 * Two of these can sit on one form — where you live and where you are from —
 * so every control here is named from `idPrefix` rather than hard-coded, and
 * each keeps its own country, region and search.
 */

import { useEffect, useId, useMemo, useState } from 'react';
import {
  CITIES, COUNTRIES, REGIONS, cityCount, countryOfPlace, isCountryLoaded, loadCountryCities,
} from '@/engine/content/geography';
import type { City } from '@/engine/content/geography';
import { WorldMap } from './WorldMap';

/** How many matches to render at once. Enough to choose from, cheap to draw. */
const VISIBLE_MATCHES = 60;

/**
 * The region select's first option, a country's name with the article a sentence gives it (from 2026-10-20, brief 17):
 * "Anywhere In The United States", "Anywhere In The Cayman Islands", "Anywhere In France". Until then it was "Anywhere in
 * United States", and the search that found nothing told the player to choose it by that name. A name the gazetteer
 * already writes with its article ("The Netherlands") keeps it; the name itself is never re-cased.
 */
export function anywhereIn(country: string | undefined): string {
  if (!country) return 'Anywhere In The Country';
  const the = !/^The\s/.test(country)
    && (/^(United |Netherlands|Philippines|Bahamas|Gambia|Maldives|Czech Republic|Dominican Republic|Central African Republic|Democratic Republic|Republic of)/.test(country)
      || /(Islands|Territory|Emirates|Antilles)$/.test(country));
  return `Anywhere In ${the ? 'The ' : ''}${country}`;
}

export function LocationPicker({
  cityId, onPick, idPrefix, map = true,
}: {
  cityId: string;
  onPick: (city: City) => void;
  /** Distinguishes this picker's controls from any other on the page. */
  idPrefix?: string;
  /** Whether to offer the map. */
  map?: boolean;
}) {
  const fallbackPrefix = useId();
  const prefix = idPrefix ?? fallbackPrefix;
  // A town too small to be bundled is not in memory until its country is, but
  // its id still names that country, so the picker opens on the right one and
  // pulls the country in. The United States is only for an id that names none.
  const selected = CITIES.get(cityId);
  const [countryId, setCountryId] = useState(selected?.countryId ?? countryOfPlace(cityId) ?? 'us');
  const [regionId, setRegionId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [loadedTick, setLoadedTick] = useState(0);
  const [mapOpen, setMapOpen] = useState(map);

  // Somebody else changed the selection — the birthplace following the home
  // town, a draft loading — so follow it rather than sitting on a stale country.
  useEffect(() => {
    const country = CITIES.get(cityId)?.countryId ?? countryOfPlace(cityId);
    if (country && country !== countryId) {
      setCountryId(country);
      setRegionId('');
      setQuery('');
    }
    // Only when the selection itself moves; changing the country by hand is
    // meant to leave the chosen city alone until a new one is picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  const countries = useMemo(
    () => COUNTRIES.all().slice().sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const regions = useMemo(
    () => REGIONS.all().filter((r) => r.parentId === countryId).sort((a, b) => a.name.localeCompare(b.name)),
    [countryId],
  );

  // Pull the chosen country's towns in, once.
  useEffect(() => {
    let cancelled = false;
    if (isCountryLoaded(countryId)) return;
    setLoading(true);
    setProblem(undefined);
    loadCountryCities(countryId)
      .then(() => { if (!cancelled) setLoadedTick((n) => n + 1); })
      .catch((error: unknown) => {
        // The fetch's own words are a developer's (from 2026-10-17, brief 14); the draft keeps the form through a reload.
        console.error(error);
        if (!cancelled) setProblem('That country’s towns couldn’t be loaded. Reload SLATE to try again: your answers so far are kept.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [countryId]);

  const matches = useMemo(() => {
    void loadedTick;
    const needle = query.trim().toLowerCase();
    const pool = CITIES.all().filter((c) => (
      c.countryId === countryId
      && (regionId === '' || c.parentId === regionId)
      && (needle === '' || c.name.toLowerCase().includes(needle))
    ));
    // The places most people mean come first: the biggest.
    pool.sort((a, b) => b.population - a.population || a.name.localeCompare(b.name));
    return pool;
  }, [countryId, regionId, query, loadedTick]);

  const known = cityCount(countryId);

  return (
    <div className="col gap-3">
      {map && (
        <div className="row-between wrap gap-2">
          <p className="xs dim" style={{ margin: 0 }}>
            {mapOpen
              ? 'Pick a country on the map, or find it in the list below.'
              : 'The map is hidden. The list below does the same thing.'}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((open) => !open)}
          >
            {mapOpen ? 'Hide Map' : 'Show Map'}
          </button>
        </div>
      )}

      {map && mapOpen && (
        <WorldMap
          countryId={countryId}
          marker={selected && selected.countryId === countryId
            ? { latitude: selected.latitude, longitude: selected.longitude, name: selected.name }
            : undefined}
          onPick={(picked) => {
            if (picked === countryId) return;
            setCountryId(picked);
            setRegionId('');
            setQuery('');
          }}
        />
      )}

      <div className="grid grid-2">
        <div className="field">
          <label htmlFor={`${prefix}-country`}>Country</label>
          <select
            id={`${prefix}-country`}
            value={countryId}
            onChange={(e) => { setCountryId(e.target.value); setRegionId(''); setQuery(''); }}
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id} data-source="gazetteer">{c.name}</option>
            ))}
          </select>
          <p className="hint">
            {known > 0
              ? `${known.toLocaleString('en-US')} town${known === 1 ? '' : 's'} and cit${known === 1 ? 'y' : 'ies'} on record.`
              : 'No towns or cities on record for this country.'}
          </p>
        </div>

        <div className="field">
          <label htmlFor={`${prefix}-region`}>State Or Region</label>
          <select
            id={`${prefix}-region`}
            value={regionId}
            onChange={(e) => { setRegionId(e.target.value); setQuery(''); }}
            disabled={regions.length === 0}
          >
            <option value="">
              {regions.length === 0 ? 'None' : anywhereIn(COUNTRIES.get(countryId)?.name)}
            </option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <p className="hint">
            {regions.length > 0
              ? `${regions.length} to choose from.`
              : 'There are no states or regions to choose from in this country.'}
          </p>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${prefix}-search`}>Town Or City</label>
        <input
          id={`${prefix}-search`}
          type="search"
          value={query}
          placeholder={loading ? 'Loading its towns…' : 'Start typing a town name'}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {problem && <p className="hint" role="alert">{problem}</p>}
      </div>

      <div className="picker-results" role="listbox" aria-label="Matching Places">
        {matches.length === 0 && !loading && (
          <p className="hint" style={{ padding: 'var(--s3)' }}>
            {/* Each variant says what's true of it (from 2026-10-19, brief 15): until then an empty search in a country
                with no towns read “No town or city matches “” there.”, and “widen the region” named no control. */}
            {query.trim() === ''
              ? 'There’s no town or city on record there.'
              : `No town or city matches “${query.trim()}” there. Try a different spelling${regionId ? `, or choose ${anywhereIn(COUNTRIES.get(countryId)?.name)}` : ''}.`}
          </p>
        )}
        {matches.slice(0, VISIBLE_MATCHES).map((c) => (
          <button
            type="button"
            key={c.id}
            role="option"
            aria-selected={c.id === cityId}
            className="picker-option"
            data-selected={c.id === cityId ? 'true' : undefined}
            onClick={() => onPick(c)}
          >
            <span className="picker-option-name truncate" title={c.name} data-source="gazetteer">{c.name}</span>
            <span
              className="picker-option-meta truncate"
              title={[
                REGIONS.get(c.parentId)?.name ?? COUNTRIES.get(c.countryId)?.name,
                c.population > 0 ? `${c.population.toLocaleString('en-US')} people` : '',
              ].filter(Boolean).join(' · ')}
            >
              {REGIONS.get(c.parentId)?.name ?? COUNTRIES.get(c.countryId)?.name}
              {c.population > 0 && ` · ${c.population.toLocaleString('en-US')} people`}
            </span>
          </button>
        ))}
        {matches.length > VISIBLE_MATCHES && (
          <p className="hint" style={{ padding: 'var(--s3)' }}>
            {(matches.length - VISIBLE_MATCHES).toLocaleString('en-US')} more match. Keep typing to narrow it down.
          </p>
        )}
      </div>
    </div>
  );
}
