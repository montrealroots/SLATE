/**
 * SLATE — clear a save slot.
 *
 * Clearing a slot is not a deletion. The payload is moved aside and kept as a
 * backup, and the row is marked cleared, so a player who empties the wrong
 * slot can get their universe back. Nothing a player has lived is destroyed
 * because they tapped the wrong thing.
 */

import { createClientFromRequest } from 'npm:@base44/sdk';
import { GuardError, failure, ok, requireSlot } from '../../shared/guard.js';

export default async function (req) {
  try {
    if (req.method !== 'POST') throw new GuardError('This endpoint takes POST.', 405);

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, status: 401, error: 'You are not signed in.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const slot = requireSlot(body.slot);

    const [row] = await base44.entities.SlateSave.filter({ slot });
    if (!row) return Response.json(ok({ slot, cleared: false, reason: 'That slot was already empty.' }));

    // Clearing has to release the slot as well as empty it. The forward
    // progress guard compares against whatever the row still claims, so a
    // cleared row that kept its save id, its clock and its playtime would
    // refuse the next universe started in that slot. The backup survives.
    await base44.entities.SlateSave.update(row.id, {
      backup_payload: row.payload || row.backup_payload || '',
      backup_world_date_label: row.payload
        ? (row.world_date_label || '')
        : (row.backup_world_date_label || ''),
      payload: '',
      save_id: '',
      world_now: 0,
      playtime_seconds: 0,
      deleted_at: new Date().toISOString(),
    });

    return Response.json(ok({ slot, cleared: true, recoverable: Boolean(row.payload || row.backup_payload) }));
  } catch (error) {
    const body = failure(error);
    return Response.json(body, { status: body.status });
  }
}
