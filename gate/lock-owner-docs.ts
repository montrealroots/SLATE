import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { lockOf } from './checks/owner-docs.ts';
import { PATHS } from './lib/paths.ts';
import { openRepo } from './lib/repo.ts';

/**
 * Re-locks the owner's documents. Run only when the owner has changed their own documents, and say so in the
 * commit; the gate fails on any change to them until this is run, which is the point.
 */
const root = resolve(import.meta.dirname, '..');
const files = lockOf(openRepo(root));
writeFileSync(join(root, PATHS.ownerDocsLock), `${JSON.stringify({ note: 'The owner documents, held to their SHA-256. Re-lock only with the owner\'s change: npm run lock:owner-docs.', files }, null, 2)}\n`);
console.log(`Locked ${Object.keys(files).length} owner documents.`);
