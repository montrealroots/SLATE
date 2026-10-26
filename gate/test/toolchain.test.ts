import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkToolchain } from '../checks/toolchain.ts';
import { openRepo } from '../lib/repo.ts';
import { all, fixture } from './fixture.ts';

const DEPS = { react: '19.3.0', 'react-dom': '19.3.0' };
const DEV = { typescript: '6.0.3', vite: '8.3.4', vitest: '4.1.11', eslint: '10.12.0', '@vitejs/plugin-react': '6.1.2' };
const pkg = (over: Record<string, unknown> = {}) => ({ packageManager: 'npm@11.6.2', dependencies: DEPS, devDependencies: DEV, ...over });
const lockFor = (versions: Record<string, unknown>) => ({ lockfileVersion: 3, packages: Object.fromEntries(Object.entries(versions).map(([n, v]) => [`node_modules/${n}`, { version: v }])) });
const check = (p: Record<string, unknown>, files: Record<string, unknown> = {}) =>
  checkToolchain(fixture({ 'package.json': p, 'package-lock.json': lockFor({ ...DEPS, ...DEV }), '.nvmrc': '22.22.0\n', ...files }).repo);
const P = 'package.json';

describe('the toolchain check', () => {
  it('passes every tool pinned and locked, and says how many', () => {
    const r = checkToolchain(fixture({ 'package.json': pkg(), 'package-lock.json': lockFor({ ...DEPS, ...DEV }), '.nvmrc': '22.22.0' }).repo);
    expect(all(r)).toEqual([]);
    expect(r.check).toBe('toolchain');
    expect(r.notes).toEqual(['7 packages pinned exactly and matched in the lockfile']);
  });
  it('passes this repository', () => {
    expect(all(checkToolchain(openRepo(resolve(import.meta.dirname, '../..'))))).toEqual([]);
  });
  it('accepts versions of any width and refuses anything but x.y.z', () => {
    const locked = { ...DEPS, ...DEV, a: '10.11.12' };
    expect(all(check(pkg({ dependencies: { ...DEPS, a: '10.11.12' } }), { 'package-lock.json': lockFor(locked) }))).toEqual([]);
    const bad = { a: '^1.2.3', b: '1.2.3-beta.1', c: 'x1.2.3', d: 'latest', e: 1, f: '1.2' };
    expect(all(check(pkg({ dependencies: { ...DEPS, ...bad } })))).toEqual([
      `red ${P} | a is not pinned to an exact version (^1.2.3)`,
      `red ${P} | b is not pinned to an exact version (1.2.3-beta.1)`,
      `red ${P} | c is not pinned to an exact version (x1.2.3)`,
      `red ${P} | d is not pinned to an exact version (latest)`,
      `red ${P} | e is not pinned to an exact version (1)`,
      `red ${P} | f is not pinned to an exact version (1.2)`,
    ]);
  });
  it('pins npm exactly', () => {
    for (const ok of ['npm@11.6.2', 'npm@11.10.2', 'npm@11.6.12']) expect(all(check(pkg({ packageManager: ok })))).toEqual([]);
    for (const bad of ['npm@11', 'xnpm@11.6.2', 'npm@11.6.2x', 'yarn@4.0.0', undefined]) {
      expect(all(check(pkg({ packageManager: bad })))).toEqual([`red ${P} | packageManager must pin npm to an exact version (npm@x.y.z)`]);
    }
  });
  it('pins Node exactly', () => {
    expect(all(check(pkg(), { '.nvmrc': ' 22.22.0 \n' }))).toEqual([]);
    for (const bad of ['22', 'v22.22.0', '22.22.0.1', '']) expect(all(check(pkg(), { '.nvmrc': bad }))).toEqual(['red .nvmrc | .nvmrc must pin Node to an exact version']);
    expect(all(checkToolchain(fixture({ 'package.json': pkg(), 'package-lock.json': lockFor({ ...DEPS, ...DEV }) }).repo))).toEqual(['red .nvmrc | .nvmrc must pin Node to an exact version']);
  });
  it('requires every tool the build order names, a missing group included', () => {
    const { vitest: _v, ...noVitest } = DEV;
    expect(all(check(pkg({ devDependencies: noVitest })))).toEqual([`red ${P} | vitest is missing from devDependencies`]);
    expect(all(check(pkg({ dependencies: undefined })))).toEqual([`red ${P} | react is missing from dependencies`, `red ${P} | react-dom is missing from dependencies`]);
    expect(all(check(pkg({ devDependencies: undefined })))).toEqual(['typescript', 'vite', 'vitest', 'eslint', '@vitejs/plugin-react'].map((t) => `red ${P} | ${t} is missing from devDependencies`));
  });
  it('fails a group that is not an object', () => {
    expect(all(check(pkg({ dependencies: ['react'] })))).toEqual([`red ${P} | dependencies is not an object`, `red ${P} | react is missing from dependencies`, `red ${P} | react-dom is missing from dependencies`]);
  });
  it('fails a lockfile that holds another version, or none', () => {
    expect(all(check(pkg(), { 'package-lock.json': lockFor({ ...DEPS, ...DEV, vite: '8.3.3' }) }))).toEqual(['red package-lock.json | vite is pinned at 8.3.4 but the lockfile holds 8.3.3']);
    expect(all(check(pkg(), { 'package-lock.json': { lockfileVersion: 3, packages: { 'node_modules/react': 'x' } } }))).toEqual(
      ['react', 'react-dom', ...Object.keys(DEV)].map((n) => `red package-lock.json | ${n} is pinned at ${({ ...DEPS, ...DEV } as Record<string, string>)[n]} but the lockfile holds undefined`),
    );
  });
  it('fails an old, missing or malformed lockfile, and a malformed package.json', () => {
    expect(all(check(pkg(), { 'package-lock.json': { ...lockFor({ ...DEPS, ...DEV }), lockfileVersion: 2 } }))).toEqual(['red package-lock.json | package-lock.json must be lockfileVersion 3']);
    expect(all(checkToolchain(fixture({ 'package.json': pkg(), '.nvmrc': '22.22.0' }).repo))).toEqual(['red package-lock.json | package-lock.json is missing']);
    expect(all(check(pkg(), { 'package-lock.json': '[]' }))).toEqual(['red package-lock.json | package-lock.json is not an object']);
    expect(all(checkToolchain(fixture({ 'package.json': '[]' }).repo))).toEqual(['red package.json | package.json is not an object']);
    expect(all(checkToolchain(fixture({}).repo))).toEqual(['red package.json | package.json is missing']);
    expect(all(checkToolchain(fixture({ 'package.json': '{ x' }).repo))[0]).toMatch(/^red package\.json \| package\.json is not valid JSON: /);
  });
});
