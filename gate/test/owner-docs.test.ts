import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkOwnerDocs, lockOf, ownerFiles } from '../checks/owner-docs.ts';
import { all, fixture } from './fixture.ts';

const docs = { 'CLAUDE.md': '# rules\n', 'docs/MANDATE.md': 'the mandate\n', 'docs/kept/a.ts': 'export {};\n', 'src/x.ts': 'not the owner\'s\n' };
const LOCK = 'registry/owner-docs.lock.json';
const locked = () => fixture({ ...docs, [LOCK]: { files: lockOf(fixture(docs).repo) } });

describe('the owner documents', () => {
  it('are CLAUDE.md and everything under docs/, in order, and only those that exist', () => {
    expect(ownerFiles(fixture(docs).repo)).toEqual(['CLAUDE.md', 'docs/MANDATE.md', 'docs/kept/a.ts']);
    expect(ownerFiles(fixture({ 'docs/A.md': 'x' }).repo)).toEqual(['docs/A.md']);
    expect(lockOf(fixture({ 'CLAUDE.md': 'abc' }).repo)).toEqual({ 'CLAUDE.md': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' });
  });
});

describe('the owner-documents check', () => {
  it('passes them unchanged, and says how many', () => {
    const r = checkOwnerDocs(locked().repo);
    expect(all(r)).toEqual([]);
    expect(r.check).toBe('owner-docs');
    expect(r.notes).toEqual(['3 owner documents held to their hashes']);
  });
  it('fails a changed document', () => {
    const f = locked();
    writeFileSync(join(f.root, 'docs/MANDATE.md'), 'the mandate, edited\n');
    expect(all(checkOwnerDocs(f.repo))).toEqual(['red docs/MANDATE.md | an owner document changed without its lock being updated']);
  });
  it('fails a removed document', () => {
    const f = locked();
    rmSync(join(f.root, 'CLAUDE.md'));
    expect(all(checkOwnerDocs(f.repo))).toEqual(['red CLAUDE.md | an owner document is gone']);
  });
  it('fails a document joining docs/ unlocked', () => {
    const f = locked();
    writeFileSync(join(f.root, 'docs/NEW.md'), 'new\n');
    expect(all(checkOwnerDocs(f.repo))).toEqual(['red docs/NEW.md | a file joined the owner documents without being locked']);
  });
  it('fails without a lock, or with a malformed one', () => {
    expect(all(checkOwnerDocs(fixture(docs).repo))).toEqual([`red ${LOCK} | ${LOCK} is missing`]);
    for (const bad of [{ files: [] }, [], { other: {} }, 'null']) expect(all(checkOwnerDocs(fixture({ ...docs, [LOCK]: bad }).repo))).toEqual([`red ${LOCK} | the lock has no "files" object`]);
  });
});
