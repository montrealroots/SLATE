import { describe, expect, it } from 'vitest';
import { checkLayers, layerInProgress, layerOf, parseLedger, type LayerLedger } from '../checks/layers.ts';
import { all, fixture } from './fixture.ts';

const C0 = 'a'.repeat(40);
const C1 = 'b'.repeat(40);
const L = 'registry/layers.json';
const layers = [
  { n: 0, name: 'Gate', dirs: ['gate'] },
  { n: 1, name: 'Core', dirs: ['src/core'], holdsEngines: true },
  { n: 2, name: 'World', dirs: ['src/world'], holdsEngines: true },
  { n: 3, name: 'Screens', dirs: ['src/ui'] },
  { n: 4, name: 'Late', dirs: ['src/ui/late'] },
];
const proof = (layer: number, commit = C0) => ({ layer, commit, date: '2026-10-26', evidence: 'gate green, full' });
const git = (known: string[] = [C0, C1]) => ({ isAncestorOfHead: (c: string) => known.includes(c) });
const ledgerOf = (proven: unknown[]) => ({ layers, proven });
const parsed = (proven: unknown[] = []): LayerLedger => {
  const p = parseLedger(ledgerOf(proven));
  if (!p.ok) throw new Error(p.why);
  return p.ledger;
};
const check = (files: Record<string, unknown>, proven: unknown[] = [proof(0), proof(1, C1)]) => checkLayers(fixture({ [L]: ledgerOf(proven), ...files }).repo, git());

describe('the layer ledger', () => {
  it('reads a well-formed ledger, its proofs and which layers hold engines', () => {
    const p = parseLedger(ledgerOf([proof(0)]));
    expect(p).toEqual({
      ok: true,
      ledger: {
        layers: [
          { n: 0, name: 'Gate', dirs: ['gate'], holdsEngines: false },
          { n: 1, name: 'Core', dirs: ['src/core'], holdsEngines: true },
          { n: 2, name: 'World', dirs: ['src/world'], holdsEngines: true },
          { n: 3, name: 'Screens', dirs: ['src/ui'], holdsEngines: false },
          { n: 4, name: 'Late', dirs: ['src/ui/late'], holdsEngines: false },
        ],
        proven: [{ layer: 0, commit: C0, date: '2026-10-26', evidence: 'gate green, full' }],
      },
    });
  });
  it('finds the layer in progress: the lowest not proven, or past the last when all are', () => {
    expect(layerInProgress(parsed())).toBe(0);
    expect(layerInProgress(parsed([proof(0), proof(1)]))).toBe(2);
    expect(layerInProgress(parsed([proof(1)]))).toBe(0);
    expect(layerInProgress(parsed([0, 1, 2, 3, 4].map((n) => proof(n))))).toBe(5);
  });
  it('rejects a malformed ledger, saying why', () => {
    const why = (v: unknown) => {
      const p = parseLedger(v);
      return p.ok ? 'ok' : p.why;
    };
    const one = (l: Record<string, unknown>) => ({ layers: [l], proven: [] });
    const proofAt = (p: Record<string, unknown>) => ({ layers: [{ n: 0, name: 'x', dirs: [] }], proven: [p] });
    expect(why([])).toBe('the ledger needs "layers" and "proven" arrays');
    expect(why({ layers: 1, proven: [] })).toBe('the ledger needs "layers" and "proven" arrays');
    expect(why({ layers: [], proven: 1 })).toBe('the ledger needs "layers" and "proven" arrays');
    expect(why({ layers: [], proven: [] })).toBe('ok');
    expect(why(one({ n: 1, name: 'x', dirs: [] }))).toBe('layer at index 0 must be { n: 0, name, dirs: string[] }');
    expect(why(one({ n: 0, name: '', dirs: [] }))).toBe('layer at index 0 must be { n: 0, name, dirs: string[] }');
    expect(why(one({ n: 0, name: 'x', dirs: 'gate' }))).toBe('layer at index 0 must be { n: 0, name, dirs: string[] }');
    expect(why(one({ n: 0, name: 'x', dirs: [1] }))).toBe('layer at index 0 must be { n: 0, name, dirs: string[] }');
    expect(why({ layers: ['x'], proven: [] })).toBe('layer at index 0 must be { n: 0, name, dirs: string[] }');
    expect(why(one({ n: 0, name: 'x', dirs: [], holdsEngines: 'yes' }))).toBe("layer 0's holdsEngines is true or false");
    const bad = 'proof at index 0 must be { layer, commit (40 hex), date (YYYY-MM-DD), evidence }';
    for (const p of [{ ...proof(0), commit: 'abc' }, { ...proof(0), commit: `x${C0}` }, { ...proof(0), commit: `${C0}x` }, { ...proof(0), commit: 'A'.repeat(40) }, { ...proof(0), commit: '' }, { ...proof(0), date: '2026-13-01' }, { ...proof(0), evidence: '' }, { ...proof(0), layer: '0' }, 'x']) {
      expect(why(proofAt(p as Record<string, unknown>))).toBe(bad);
    }
  });
  it('places a file by the directory that holds it most closely', () => {
    const ledger = parsed();
    expect(layerOf(ledger, 'src/ui/late/x.ts')?.n).toBe(4);
    expect(layerOf(ledger, 'src/ui/x.ts')?.n).toBe(3);
    expect(layerOf(ledger, 'src/core/time/zone.ts')?.n).toBe(1);
    expect(layerOf(ledger, 'src/core')?.n).toBe(1);
    expect(layerOf(ledger, 'src/corer/x.ts')).toBeUndefined();
    const reversed: LayerLedger = { layers: [{ n: 0, name: 'deep', dirs: ['a/b'], holdsEngines: false }, { n: 1, name: 'shallow', dirs: ['a'], holdsEngines: false }], proven: [] };
    expect(layerOf(reversed, 'a/b/c.ts')?.n).toBe(0);
    expect(layerOf(reversed, 'a/c.ts')?.n).toBe(1);
  });
});

describe('the build-order check', () => {
  it('passes code in the layer in progress, importing its own layer, the ones under it, and packages', () => {
    const r = check({
      'src/core/time/zone.ts': "import { other } from './other';\nexport const z = other;\n",
      'src/core/time/other.ts': 'export const other = 1;\n',
      'src/world/clock/clock.ts': "import { z } from '../../core/time/zone';\nimport type { Q } from '../../core/time/zone.ts';\nimport react from 'react';\nimport { readFileSync } from 'node:fs';\nexport const c = z;\n",
    });
    expect(all(r)).toEqual([]);
    expect(r.check).toBe('build-order');
    expect(r.notes).toEqual(['layer 2 in progress; 2 proven; 3 source files placed']);
  });
  it('writes the build order as it stands', () => {
    const r = check({});
    expect(r.generated).toEqual([
      {
        path: 'matrix/LAYERS.md',
        content: [
          '# The Build Order, As The Gate Holds It',
          '',
          'Generated by the gate from `registry/layers.json`; do not edit by hand.',
          '',
          '| Layer | Name | Directories | State |',
          '|---|---|---|---|',
          '| 0 | Gate | `gate` | proven 2026-10-26 at `aaaaaaaaaaaa` |',
          '| 1 | Core | `src/core` | proven 2026-10-26 at `bbbbbbbbbbbb` |',
          '| 2 | World | `src/world` | in progress |',
          '| 3 | Screens | `src/ui` | not started |',
          '| 4 | Late | `src/ui/late` | not started |',
          '',
        ].join('\n'),
      },
    ]);
    const none = checkLayers(fixture({ [L]: { layers: [{ n: 0, name: 'Voice', dirs: [] }, { n: 1, name: 'Two', dirs: ['a', 'b'] }], proven: [] } }).repo, git());
    expect(none.generated[0]?.content).toContain('| 0 | Voice | (none) | in progress |\n| 1 | Two | `a`, `b` | not started |');
  });
  it('fails a layer started before the one under it is proven', () => {
    expect(all(check({ 'src/world/clock/clock.ts': 'export {};\n' }, [proof(0)]))).toEqual(["red src/world/clock/clock.ts | layer 2 (World) has code, but layer 1 isn't proven yet"]);
  });
  it('fails a file outside every layer, without reading its imports', () => {
    expect(all(check({ 'src/stray.ts': "import { z } from './ui/x';\nexport {};\n" }))).toEqual(['red src/stray.ts | a source file sits outside every layer']);
  });
  it('fails an import upward, of a file, a .tsx, a directory index, or by dynamic import', () => {
    const r = check({
      'src/core/time/a.ts': "import { c } from '../../world/clock/clock';\nexport const a = c;\n",
      'src/core/time/b.ts': "import { V } from '../../world/clock/View';\nexport const b = V;\n",
      'src/core/time/c.ts': "import { i } from '../../world/clock';\nexport const c = i;\n",
      'src/core/time/d.ts': "import { j } from '../../world/zones';\nexport const d = j;\n",
      'src/core/time/e.ts': "export const e = async () => import('../../world/clock/clock');\n",
      'src/core/time/f.ts': "const f = require('../../world/clock/clock');\nexport { f };\n",
      'src/world/clock/clock.ts': 'export const c = 1;\n',
      'src/world/clock/View.tsx': 'export const V = 1;\n',
      'src/world/clock/index.tsx': 'export const i = 1;\n',
      'src/world/zones/index.ts': 'export const j = 1;\n',
    });
    expect(all(r)).toEqual([
      'red src/core/time/a.ts | layer 1 imports layer 2 (src/world/clock/clock.ts); imports run downward only',
      'red src/core/time/b.ts | layer 1 imports layer 2 (src/world/clock/View.tsx); imports run downward only',
      'red src/core/time/c.ts | layer 1 imports layer 2 (src/world/clock/index.tsx); imports run downward only',
      'red src/core/time/d.ts | layer 1 imports layer 2 (src/world/zones/index.ts); imports run downward only',
      'red src/core/time/e.ts | layer 1 imports layer 2 (src/world/clock/clock.ts); imports run downward only',
      'red src/core/time/f.ts | layer 1 imports layer 2 (src/world/clock/clock.ts); imports run downward only',
    ]);
  });
  it('reads imports from TypeScript only', () => {
    expect(all(check({ 'src/core/time/notes.css': "import x from '../../world/clock/clock';\n", 'src/core/time/notes.ts.md': "import x from '../../world/clock/clock';\n", 'src/world/clock/clock.ts': 'export {};\n' }))).toEqual([]);
  });
  it('passes an import of a file that sits outside every layer inside the app, which is red on its own', () => {
    expect(all(check({ 'src/core/time/a.ts': "import { s } from '../../stray';\nexport const a = s;\n", 'src/stray.ts': 'export const s = 1;\n' }))).toEqual(['red src/stray.ts | a source file sits outside every layer']);
  });
  it('fails the app importing anything outside itself', () => {
    expect(all(check({ 'src/core/time/zone.ts': "import { x } from '../../../gate/run';\nimport z from '../../../registry/features.json';\nexport const q = [x, z];\n" }))).toEqual([
      "red src/core/time/zone.ts | the app imports gate/run, which is outside the app",
      "red src/core/time/zone.ts | the app imports registry/features.json, which is outside the app",
    ]);
  });
  it('fails a proof with a gap, proofs in any order otherwise passing', () => {
    expect(all(check({}, [proof(1)]))).toEqual(['red registry/layers.json | layer 1 is recorded proven but layer 0 is not']);
    expect(all(check({}, [proof(1, C1), proof(0)]))).toEqual([]);
  });
  it('fails a proof at a commit the branch does not carry', () => {
    expect(all(check({}, [proof(0, 'c'.repeat(40))]))).toEqual([`red registry/layers.json | layer 0's proof names commit ${'c'.repeat(40)}, which this branch doesn't carry`]);
  });
  it('fails without a ledger, or with a malformed one', () => {
    expect(all(checkLayers(fixture({}).repo, git()))).toEqual([`red ${L} | ${L} is missing`]);
    expect(all(checkLayers(fixture({ [L]: { layers: 1 } }).repo, git()))).toEqual([`red ${L} | the ledger needs "layers" and "proven" arrays`]);
  });
});
