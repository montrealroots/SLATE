/**
 * SLATE — server-side guards.
 *
 * These run on the server so the browser is never the authority on what a save
 * may contain. They deliberately check only what can be checked cheaply and
 * without the simulation engine: shape, ownership, monotonic time, size, and
 * the two invariants that matter most and are structural rather than a matter
 * of judgement — money summing to zero, and one save not containing another's
 * records.
 *
 * They are not a re-simulation. A determined player editing their own save can
 * still make their own game strange; what these prevent is a corrupt or
 * cross-contaminated write landing in storage and a retry being applied twice.
 */

/**
 * Save format version this deployment understands.
 *
 * Must equal SAVE_SCHEMA_VERSION in src/engine/domain/model.ts. It cannot
 * import it — this runs on Deno, not in the bundle — so the two are held
 * together by a test instead. If they drift, the backend rejects every save
 * the client writes, which is exactly what the guard is for and exactly what
 * you do not want to find out in production.
 */
export const SUPPORTED_SCHEMA_VERSION = 94;

/** A save larger than this is refused rather than silently truncated. */
export const MAX_PAYLOAD_BYTES = 24 * 1024 * 1024;

export class GuardError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'GuardError';
    this.status = status;
  }
}

/** Slot must be one of the three, as an integer. */
export function requireSlot(value) {
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
    throw new GuardError(`Slot must be 1, 2 or 3. Received ${JSON.stringify(value)}.`);
  }
  return slot;
}

/** Parses the payload and checks the invariants the server can verify. */
export function inspectPayload(payload, expectedSlot) {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new GuardError('The save payload was missing or empty.');
  }
  // Measured in bytes as sent, UTF-8 (from 2026-10-12): until then the string's length, its UTF-16 code units, was said
  // as bytes, and a save of accented names was under-measured.
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new GuardError(`That save is ${bytes} bytes, over the ${MAX_PAYLOAD_BYTES} byte limit.`, 413);
  }

  let universe;
  try {
    universe = JSON.parse(payload);
  } catch (error) {
    throw new GuardError(`The save payload was not readable: ${error.message}`);
  }

  const meta = universe?.meta;
  if (!meta || typeof meta.id !== 'string' || meta.id.length === 0) {
    throw new GuardError('The save has no meta.id, so there is nothing to prove it is a coherent universe.');
  }
  if (typeof meta.schemaVersion !== 'number') {
    throw new GuardError('The save does not say what format it is in.');
  }
  if (meta.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    throw new GuardError(
      `That save is in format ${meta.schemaVersion} and this deployment understands ${SUPPORTED_SCHEMA_VERSION}. `
      + 'Refusing to store it rather than risk damaging it.',
      409,
    );
  }
  if (expectedSlot !== undefined && Number(meta.slot) !== expectedSlot) {
    throw new GuardError(`The save says it belongs to slot ${meta.slot}, but it was sent to slot ${expectedSlot}.`);
  }
  if (typeof universe.now !== 'number' || !Number.isFinite(universe.now)) {
    throw new GuardError('The save has no world clock.');
  }

  // Money is conserved by construction: every posting in every transaction
  // sums to zero, so the whole ledger sums to zero. This is the one check
  // worth doing on every write, because a save that fails it is already wrong.
  let postingTotal = 0;
  let postingCount = 0;
  for (const txn of universe.transactions ?? []) {
    let txnTotal = 0;
    for (const posting of txn.postings ?? []) {
      if (!Number.isInteger(posting.amount)) {
        throw new GuardError(`Transaction ${txn.id} has a fractional posting. Money is always whole cents.`);
      }
      txnTotal += posting.amount;
      postingTotal += posting.amount;
      postingCount++;
    }
    if (txnTotal !== 0) {
      throw new GuardError(`Transaction ${txn.id} does not balance: its postings sum to ${txnTotal}.`);
    }
  }
  if (postingTotal !== 0) {
    throw new GuardError(`The ledger does not balance: ${postingCount} postings sum to ${postingTotal}, expected 0.`);
  }

  // One save is one universe. A record carrying another save's id means two
  // worlds have been mixed, and that is not something to store and sort out later.
  const foreign = findForeignRecord(universe, meta.id);
  if (foreign) {
    throw new GuardError(
      `A ${foreign.collection} record in this save belongs to save '${foreign.saveId}', not '${meta.id}'. `
      + 'Refusing the write: that is cross-save contamination.',
      409,
    );
  }

  return {
    universe,
    meta,
    saveId: meta.id,
    worldNow: universe.now,
    playtimeSeconds: Number(meta.playtimeSeconds) || 0,
    // The same UTF-8 count the limit above was measured in (from 2026-10-24, brief 26): until then this stayed at the
    // string's length after 2026-10-12 moved the limit, so the row's payload_bytes and the slot's size under-measured a
    // save of accented names, by a byte a character.
    bytes,
  };
}

/** The first record found that belongs to a different save, if any. */
function findForeignRecord(universe, saveId) {
  for (const [collection, value] of Object.entries(universe)) {
    if (!value || typeof value !== 'object') continue;
    const entries = Array.isArray(value) ? value : Object.values(value);
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && typeof entry.saveId === 'string' && entry.saveId !== saveId) {
        return { collection, saveId: entry.saveId };
      }
    }
  }
  return null;
}

/**
 * A save may not travel backwards. The clock only runs forwards and playtime
 * only accumulates, so a write claiming otherwise is either a stale tab
 * finishing late or a replayed request, and either way it must not overwrite
 * newer progress.
 */
export function requireForwardProgress(existing, incoming) {
  if (!existing) return;
  if (existing.save_id && existing.save_id !== incoming.saveId) {
    throw new GuardError(
      `Slot ${incoming.meta.slot} already holds save '${existing.save_id}'. `
      + 'Clear the slot before starting a different universe in it.',
      409,
    );
  }
  const priorWorld = Number(existing.world_now);
  if (Number.isFinite(priorWorld) && incoming.worldNow < priorWorld) {
    throw new GuardError(
      'That save is older than the one already stored — its world clock is behind. '
      + 'Refusing to overwrite newer progress with it.',
      409,
    );
  }
  const priorPlaytime = Number(existing.playtime_seconds);
  if (Number.isFinite(priorPlaytime) && incoming.playtimeSeconds + 1 < priorPlaytime) {
    throw new GuardError(
      'That save has less playtime than the one already stored. Refusing to overwrite newer progress with it.',
      409,
    );
  }
}

/** Standard envelope, so every function answers the same shape. */
export function ok(data) {
  return { ok: true, ...data };
}

export function failure(error) {
  const status = error instanceof GuardError ? error.status : 500;
  return {
    ok: false,
    status,
    error: error instanceof GuardError ? error.message : 'The server could not complete that request.',
  };
}
