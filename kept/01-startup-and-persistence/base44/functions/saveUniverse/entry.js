/**
 * SLATE — write a save.
 *
 * The browser never writes a save directly. It sends the universe here, the
 * server checks what it can check, and only then does anything land in
 * storage. What the server enforces:
 *
 *  - the caller is signed in, and row-level security scopes every row to them,
 *    so naming another player's slot reaches nothing;
 *  - the slot is one of the three;
 *  - the payload parses, is within size, and is in a format this build reads;
 *  - every transaction balances and the whole ledger sums to zero;
 *  - no record inside belongs to a different save;
 *  - the world clock and playtime have not gone backwards, so a stale tab
 *    cannot overwrite newer progress;
 *  - the previous payload is kept as a backup before being replaced.
 *
 * An idempotency key makes a retry safe: the same key writes once and returns
 * the same answer, so a dropped connection never costs or duplicates anything.
 *
 * Restore Backup (`restore: true`, from 2026-10-05) swaps the slot's stored
 * backup and its save, server-side: the backup becomes the save and the save
 * the backup, so a restore can itself be undone. The browser sends no payload
 * for it; the server reads its own copy and checks it as it would any write.
 * Until then the browser re-sent the backup as an ordinary write, which the
 * idempotency key replayed (a backup written by this build) or the clock check
 * refused (an older one), so a restore never took on Base44.
 */

import { createClientFromRequest } from 'npm:@base44/sdk';
import {
  GuardError, failure, inspectPayload, ok, requireForwardProgress, requireSlot,
} from '../../shared/guard.js';

/** A save's row from a checked payload. */
function rowOf(slot, payload, incoming) {
  return {
    slot,
    save_id: incoming.saveId,
    payload,
    schema_version: incoming.meta.schemaVersion,
    world_now: incoming.worldNow,
    playtime_seconds: incoming.playtimeSeconds,
    character_name: incoming.meta.characterName ?? '',
    career_label: incoming.meta.careerLabel ?? '',
    location_label: incoming.meta.locationLabel ?? '',
    world_date_label: incoming.meta.worldDateLabel ?? '',
    net_worth_label: incoming.meta.netWorthLabel ?? '',
    app_version: incoming.meta.appVersion ?? '',
    payload_bytes: incoming.bytes,
    integrity: {
      postings_balance: true,
      save_id_consistent: true,
      checked_at: new Date().toISOString(),
    },
    deleted_at: null,
  };
}

export default async function (req) {
  try {
    if (req.method !== 'POST') throw new GuardError('This endpoint takes POST.', 405);

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, status: 401, error: 'You are not signed in.' }, { status: 401 });

    const body = await req.json().catch(() => {
      throw new GuardError('The request body was not valid JSON.');
    });

    const slot = requireSlot(body.slot);

    if (body.restore === true) {
      const [existing] = await base44.entities.SlateSave.filter({ slot });
      if (!existing?.backup_payload) throw new GuardError('There is no backup to restore.', 404);
      const restored = inspectPayload(existing.backup_payload, slot);
      const saved = await base44.entities.SlateSave.update(existing.id, {
        ...rowOf(slot, existing.backup_payload, restored),
        backup_payload: existing.payload || '',
        backup_world_date_label: existing.world_date_label || '',
      });
      return Response.json(ok({ id: saved.id, slot, saveId: restored.saveId, bytes: restored.bytes, restored: true, backupAvailable: Boolean(existing.payload) }));
    }

    const incoming = inspectPayload(body.payload, slot);

    // A retried write must not run twice.
    if (body.idempotencyKey) {
      const [receipt] = await base44.entities.SlateCommandReceipt.filter({
        save_id: incoming.saveId,
        idempotency_key: body.idempotencyKey,
      });
      if (receipt) return Response.json(ok({ replayed: true, ...(receipt.result ?? {}) }));
    }

    const [existing] = await base44.entities.SlateSave.filter({ slot });
    requireForwardProgress(existing, incoming);

    const row = rowOf(slot, body.payload, incoming);

    let saved;
    if (existing) {
      // Keep what was there before, so a bad write is always recoverable.
      saved = await base44.entities.SlateSave.update(existing.id, {
        ...row,
        backup_payload: existing.payload || existing.backup_payload || '',
        // The date travels with the payload it describes, so the slot screen can
        // say how far back a restore goes without reading a whole universe.
        backup_world_date_label: existing.payload
          ? (existing.world_date_label || '')
          : (existing.backup_world_date_label || ''),
      });
    } else {
      saved = await base44.entities.SlateSave.create(row);
    }

    const result = {
      id: saved.id,
      slot,
      saveId: incoming.saveId,
      bytes: incoming.bytes,
      backupAvailable: Boolean(existing?.payload),
    };

    if (body.idempotencyKey) {
      await base44.entities.SlateCommandReceipt.create({
        save_id: incoming.saveId,
        idempotency_key: body.idempotencyKey,
        command_kind: 'save.write',
        result,
        applied_at: new Date().toISOString(),
      });
    }

    return Response.json(ok(result));
  } catch (error) {
    const body = failure(error);
    return Response.json(body, { status: body.status });
  }
}
