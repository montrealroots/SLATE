/**
 * SLATE — top-level phase router.
 *
 * Startup, then the save slots, then either character creation or straight into
 * a world. Only one universe is ever live at a time.
 */

import { useCallback, useState } from 'react';
import { StartupSequence, type StartupResult } from '@/ui/startup/StartupSequence';
import { SaveSlots } from '@/ui/saves/SaveSlots';
import { CharacterCreation } from '@/ui/creation/CharacterCreation';
import { GameShell } from '@/ui/shell/GameShell';
import { GameProvider } from './game-context';
import { createSave, loadPlacesFor, loadSave, refreshMeta, type Simulation } from '@/engine';
import type { NewSaveConfig } from '@/engine/world/bootstrap';
import { PersistenceError, type SaveAdapter, type Slot } from '@/engine/persistence/adapter';
import type { SaveUniverse } from '@/engine/domain/model';

/**
 * Why a new life didn't start: a storage failure in its own words, which say what the slot holds; anything else a fault
 * before the save was written, so the slot holds nothing new (from 2026-10-17, brief 14: until then both read "That save
 * couldn’t be created: <the message>").
 */
export function startFailure(e: unknown): string {
  return e instanceof PersistenceError
    ? `Your new life couldn’t be saved, so it hasn’t started. ${e.message}`
    : 'Your new life couldn’t start because of an error in the game, and nothing was saved to the slot.';
}

/** Why a save didn't open, past the slots' own checks: a fault, its message in the console. */
export const OPEN_FAILURE = 'That save couldn’t be opened because of an error in the game. Restart SLATE to try again, or restore the slot’s backup if it has one.';

type Phase =
  | { kind: 'startup' }
  | { kind: 'saves'; startup: StartupResult }
  | { kind: 'creation'; startup: StartupResult; slot: Slot }
  | { kind: 'playing'; adapter: SaveAdapter; sim: Simulation };

export function SlateApp() {
  const [phase, setPhase] = useState<Phase>({ kind: 'startup' });
  const [error, setError] = useState<string | null>(null);

  const onReady = useCallback((startup: StartupResult) => {
    setPhase({ kind: 'saves', startup });
  }, []);

  const beginNew = useCallback((startup: StartupResult, slot: Slot) => {
    setPhase({ kind: 'creation', startup, slot });
  }, []);

  const start = useCallback(async (startup: StartupResult, slot: Slot, config: NewSaveConfig) => {
    try {
      // A seed derived from the slot and the moment of creation, so two saves
      // made from identical settings still become different worlds.
      //
      // This is the one place real time is legitimately read: it happens before
      // a universe exists, and it is entropy for a seed rather than a reading
      // of the world clock. Everything after this point goes through the clock.
      // eslint-disable-next-line no-restricted-syntax
      const seed = `${slot}-${config.firstName}${config.lastName}-${Date.now().toString(36)}`;
      // A life begun here begins with the guide, unless the player chose "I Know SLATE" (from 2026-10-12), and with the
      // clock paused either way.
      const sim = createSave(slot, seed, { ...config, tutorial: config.tutorial !== false, paused: true });
      // The home country's holidays, which its banks keep as business days.
      await loadPlacesFor(sim.universe);
      refreshMeta(sim);
      await startup.adapter.save(sim.universe);
      setPhase({ kind: 'playing', adapter: startup.adapter, sim });
    } catch (e) {
      // A storage failure is said in its own words; anything else is a fault, its message for a developer (from
      // 2026-10-17, brief 14: until then both read "That save couldn’t be created: <the message>").
      if (!(e instanceof PersistenceError)) console.error(e);
      setError(startFailure(e));
    }
  }, []);

  const resume = useCallback(async (startup: StartupResult, universe: SaveUniverse) => {
    try {
      // The gazetteer ships the world's larger places eagerly and the rest a
      // country at a time. A save made in a town that is not in the bundled
      // set has to have its country pulled in before anything reads the city,
      // or the school, the wage floor, the state assessment and the cost of
      // living all quietly fall back to the country. Creation and the pickers
      // already do this; resuming did not.
      await loadPlacesFor(universe);
      const sim = loadSave(universe);
      setPhase({ kind: 'playing', adapter: startup.adapter, sim });
    } catch (e) {
      console.error(e);
      setError(OPEN_FAILURE);
    }
  }, []);

  const exit = useCallback(async () => {
    if (phase.kind !== 'playing') return;
    const slots = await phase.adapter.listSlots().catch(() => []);
    setPhase({ kind: 'saves', startup: { adapter: phase.adapter, slots } });
  }, [phase]);

  if (error) {
    return (
      <div className="startup">
        <div className="startup-inner">
          <span className="clapper" role="img" aria-label="SLATE">🎬</span>
          <div className="callout callout-negative" style={{ textAlign: 'left' }}>
            <strong>Something went wrong.</strong>
            <p className="small" style={{ marginTop: 'var(--s1)' }}>{error}</p>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 'var(--s4)' }} onClick={() => window.location.reload()}>
            Restart SLATE
          </button>
        </div>
      </div>
    );
  }

  switch (phase.kind) {
    case 'startup':
      return <StartupSequence onReady={onReady} />;

    case 'saves':
      return (
        <SaveSlots
          adapter={phase.startup.adapter}
          initialSlots={phase.startup.slots}
          onNew={(slot) => beginNew(phase.startup, slot)}
          onContinue={(universe) => resume(phase.startup, universe)}
        />
      );

    case 'creation':
      return (
        <CharacterCreation
          slot={phase.slot}
          onCancel={() => setPhase({ kind: 'saves', startup: phase.startup })}
          onStart={(config) => void start(phase.startup, phase.slot, config)}
        />
      );

    case 'playing':
      return (
        <GameProvider sim={phase.sim} adapter={phase.adapter} onExit={() => void exit()}>
          <GameShell />
        </GameProvider>
      );
  }
}
