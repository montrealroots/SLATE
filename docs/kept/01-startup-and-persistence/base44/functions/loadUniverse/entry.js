/**
 * SLATE — read a save.
 *
 * Row-level security scopes every read to the signed-in player, so naming
 * somebody else's slot returns nothing rather than their universe. Asking for
 * the backup returns the payload kept before the last write.
 */

import { createClientFromRequest } from 'npm:@base44/sdk';
import { failure, ok, requireSlot } from '../../shared/guard.js';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, status: 401, error: 'You are not signed in.' }, { status: 401 });

    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const wantsBackup = String(body.backup ?? url.searchParams.get('backup')) === 'true';

    // No slot means: tell me what is in all three.
    const rawSlot = body.slot ?? url.searchParams.get('slot');
    if (rawSlot === undefined || rawSlot === null || rawSlot === '') {
      const rows = await base44.entities.SlateSave.filter({});
      return Response.json(ok({
        slots: [1, 2, 3].map((slot) => {
          const row = rows.find((r) => Number(r.slot) === slot);
          if (!row) return { slot, occupied: false, hasBackup: false };
          // A cleared slot is empty and keeps its save as the backup (`clearSlot`), so it says so, and Your Saves offers
          // Restore Backup as the Delete dialog promised (from 2026-10-24, brief 27: until then a cleared row was skipped
          // as if it weren't there, so the listing said no backup while restoring it would have worked).
          if (row.deleted_at || !row.payload) {
            return { slot, occupied: false, hasBackup: Boolean(row.backup_payload), backupDateLabel: row.backup_world_date_label || undefined };
          }
          return {
            slot,
            occupied: Boolean(row.payload),
            hasBackup: Boolean(row.backup_payload),
            backupDateLabel: row.backup_world_date_label || undefined,
            saveId: row.save_id,
            schemaVersion: row.schema_version,
            characterName: row.character_name,
            careerLabel: row.career_label,
            locationLabel: row.location_label,
            worldDateLabel: row.world_date_label,
            netWorthLabel: row.net_worth_label,
            playtimeSeconds: row.playtime_seconds,
            bytes: row.payload_bytes,
          };
        }),
      }));
    }

    const slot = requireSlot(rawSlot);
    const [row] = await base44.entities.SlateSave.filter({ slot });
    if (!row) return Response.json(ok({ slot, payload: null }));

    const payload = wantsBackup ? row.backup_payload : row.payload;
    return Response.json(ok({
      slot,
      saveId: row.save_id,
      schemaVersion: row.schema_version,
      payload: payload || null,
      fromBackup: wantsBackup,
    }));
  } catch (error) {
    const body = failure(error);
    return Response.json(body, { status: body.status });
  }
}
