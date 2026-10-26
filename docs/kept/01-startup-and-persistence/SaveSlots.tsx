/**
 * SLATE — three save slots, three separate universes.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SaveAdapter, SaveSlotInfo, Slot } from '@/engine/persistence/adapter';
import type { SaveUniverse } from '@/engine/domain/model';
import { SAVE_SCHEMA_VERSION } from '@/engine/domain/model';
import { loadPlacesFor, openSlot, validateUniverse } from '@/engine';
import { APP_VERSION } from '@/engine/world/bootstrap';

export function SaveSlots({
  adapter, initialSlots, onNew, onContinue,
}: {
  adapter: SaveAdapter;
  initialSlots: SaveSlotInfo[];
  onNew: (slot: Slot) => void;
  onContinue: (universe: SaveUniverse) => void;
}) {
  const [slots, setSlots] = useState(initialSlots);
  const [busy, setBusy] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** What a check found wrong with a save, for a player who wants it: behind a disclosure, not in the sentence. */
  const [errorDetail, setErrorDetail] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Slot | null>(null);

  const reload = useCallback(async () => {
    try {
      setSlots(await adapter.listSlots());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [adapter]);

  useEffect(() => { void reload(); }, [reload]);

  const load = async (slot: Slot, fromBackup = false) => {
    setBusy(slot);
    setError(null);
    setErrorDetail([]);
    try {
      const opened = await openSlot(adapter, slot, { fromBackup });
      if ('error' in opened) {
        setError(opened.error);
        return;
      }
      const { universe } = opened;

      // The save's towns are known only once their countries are loaded.
      await loadPlacesFor(universe);
      const validation = validateUniverse(universe);
      // What the check found is a developer's words, kept behind What’s Wrong With It (from 2026-10-17, brief 14):
      // until then the sentence was "That save didn’t pass validation: <the first of them> (and n more)."
      if (!validation.ok) {
        setError(`The save in Slot ${slot} is damaged, so it can’t be opened.${slots.find((s) => s.slot === slot)?.hasBackup ? ' Press Restore Backup to open its backup instead.' : ''}`);
        setErrorDetail(validation.errors);
        return;
      }

      onContinue(universe);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (slot: Slot) => {
    setBusy(slot);
    try {
      await adapter.remove(slot);
      setConfirmDelete(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  /** Whose life a delete would end, where the slot can read the name. */
  const doomed = confirmDelete === null ? undefined : slots.find((s) => s.slot === confirmDelete)?.meta?.characterName;

  return (
    <div className="main">
      <div className="main-inner">
        <div className="center" style={{ marginBottom: 'var(--s7)', paddingTop: 'var(--s6)' }}>
          <div style={{ fontSize: 44, marginBottom: 'var(--s3)' }} aria-hidden="true">🎬</div>
          <div className="wordmark" style={{ fontSize: 32 }}>SLATE</div>
          <p className="muted">Three slots, three separate lives. What happens in one never touches the others.</p>
        </div>

        {error && (
          <div className="callout callout-negative" style={{ marginBottom: 'var(--s5)' }}>
            {error}
            {errorDetail.length > 0 && (
              <details style={{ marginTop: 'var(--s2)' }}>
                <summary className="xs">What’s Wrong With It</summary>
                <ul className="xs" style={{ margin: 'var(--s2) 0 0', paddingLeft: 'var(--s4)' }}>
                  {errorDetail.map((one) => <li key={one}>{one}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="slot-grid">
          {([1, 2, 3] as Slot[]).map((slot) => {
            const info = slots.find((s) => s.slot === slot) ?? { slot, occupied: false, hasBackup: false };
            const working = busy === slot;

            if (!info.occupied) {
              return (
                <div key={slot} className="slot slot-empty">
                  <div className="slot-number">Slot {slot}</div>
                  <p className="small dim center" style={{ maxWidth: 220 }}>
                    {info.hasBackup
                      ? 'Empty, but there’s a backup of the save that was here.'
                      : 'An empty slot. Press New Save to start a life here.'}
                  </p>
                  <div className="col gap-2" style={{ alignItems: 'center' }}>
                    <button className="btn btn-primary" onClick={() => onNew(slot)} disabled={working}>
                      New Save
                    </button>
                    {info.hasBackup && (
                      <>
                        <button className="btn btn-sm" onClick={() => void load(slot, true)} disabled={working}>
                          {working ? 'Opening…' : 'Restore Backup'}
                        </button>
                        <BackupNote label={info.backupDateLabel} center />
                      </>
                    )}
                  </div>
                </div>
              );
            }

            const meta = info.meta;
            // A finished life opens onto how it ended; the clock in it doesn’t run.
            const finished = meta?.endedAt !== undefined || /, Died At \d+$/.test(meta?.careerLabel ?? '');
            return (
              <div key={slot} className="slot">
                <div className="slot-number">Slot {slot}</div>

                {info.error ? (
                  <>
                    <div className="slot-name" style={{ fontSize: 'var(--size-md)' }}>Unreadable Save</div>
                    <p className="small negative">{info.error}</p>
                    <div className="col gap-2" style={{ marginTop: 'auto' }}>
                      {info.hasBackup && (
                        <>
                          <button className="btn" onClick={() => void load(slot, true)} disabled={working}>
                            Restore Backup
                          </button>
                          <BackupNote label={info.backupDateLabel} />
                        </>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(slot)} disabled={working}>
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="row gap-3" style={{ alignItems: 'center' }}>
                      {meta?.portrait && (
                        <img
                          className="headshot headshot-sm"
                          src={meta.portrait}
                          alt={`Headshot for ${meta.characterName}`}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div className="slot-name">{meta?.characterName}</div>
                        <div className="muted small">{meta?.careerLabel || '—'}</div>
                      </div>
                    </div>

                    <div className="slot-meta">
                      <div className="stat">
                        <span className="stat-label">Date</span>
                        <span className="small">{meta?.worldDateLabel || '—'}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Location</span>
                        <span className="small">{meta?.locationLabel || '—'}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Net Worth</span>
                        <span className="small mono">{meta?.netWorthLabel || '—'}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Played</span>
                        <span className="small mono">{formatPlaytime(meta?.playtimeSeconds ?? 0)}</span>
                      </div>
                    </div>

                    <div className="xs dim">
                      Version {meta?.appVersion ?? '—'} · Save Format {meta?.schemaVersion ?? '—'}
                      {meta && meta.schemaVersion < SAVE_SCHEMA_VERSION && ' · Updated When Opened'}
                      {info.bytes !== undefined && ` · ${formatBytes(info.bytes)}`}
                    </div>
                    {info.hasBackup && <BackupNote label={info.backupDateLabel} />}

                    <div className="col gap-2" style={{ marginTop: 'auto' }}>
                      <button className="btn btn-primary btn-block" onClick={() => void load(slot)} disabled={working}>
                        {working ? 'Opening…' : finished ? 'See How It Ended' : 'Continue'}
                      </button>
                      <div className="row gap-2">
                        {info.hasBackup && (
                          <button className="btn btn-sm grow" onClick={() => void load(slot, true)} disabled={working}>
                            Restore Backup
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm grow" onClick={() => setConfirmDelete(slot)} disabled={working}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p className="center dim xs" style={{ marginTop: 'var(--s7)' }}>
          SLATE {APP_VERSION} · Saved To {adapter.name}
          {adapter.serverAuthoritative ? ' · The Server Checks Each Save' : ''}
        </p>
      </div>

      {confirmDelete !== null && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirm Deletion">
            <div className="modal-head">
              <h2>Delete Slot {confirmDelete}?</h2>
            </div>
            <div className="modal-body">
              <p>
                {/* The life by its character’s name, where the slot can read one (from 2026-10-19, brief 15: until then
                    “This ends that universe. The character, everywhere they’ve been and everything that happened to
                    them is gone from the slot.”, the save’s own word for itself). */}
                {doomed
                  ? `This deletes ${doomed}’s life from the slot, with everything that happened in it.`
                  : 'This deletes the save in this slot.'}
              </p>
              <p className="muted small">
                {restorableAfterDelete(slots.find((s) => s.slot === confirmDelete))
                  ? 'SLATE keeps a backup, so if you change your mind, press Restore Backup on this slot to bring it back.'
                  : 'This slot has no backup, so you can’t bring it back afterwards.'}
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirmDelete(null)}>Keep It</button>
              <button className="btn btn-danger" onClick={() => void remove(confirmDelete)}>
                Delete Slot {confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * What restoring would go back to. A backup the player cannot date is a step
 * they cannot weigh, so the date is the whole point of the note; a stored save
 * from before the date was kept has to say that rather than invent one.
 */
function BackupNote({ label, center = false }: { label?: string; center?: boolean }) {
  return (
    <div className={`xs dim${center ? ' center' : ''}`}>
      {label ? `Backup from ${label}` : 'Backup from an unknown date'}
    </div>
  );
}

/**
 * Whether deleting this slot leaves something the player can bring back.
 * A readable save becomes its own backup on the way out; an unreadable one
 * does not, so it can only fall back to a backup that is already there.
 */
function restorableAfterDelete(info: SaveSlotInfo | undefined): boolean {
  if (!info) return false;
  return info.error ? info.hasBackup : info.occupied;
}

function formatPlaytime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
