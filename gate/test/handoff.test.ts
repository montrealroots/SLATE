import { describe, expect, it } from 'vitest';
import { SECTIONS, checkHandoff } from '../checks/handoff.ts';
import { all, fixture } from './fixture.ts';

const H = 'HANDOFF.md';
const handoff = (head: string, skip?: string, pad = '') => `# Handoff\n\n${head}\n\n${SECTIONS.filter((s) => s !== skip).map((s) => `${s}${pad}\n\ntext\n`).join('\n')}`;
const check = (text: string, layer: number | undefined) => checkHandoff(fixture({ [H]: text }).repo, layer);

describe('the handoff check', () => {
  it('passes a handoff with every section that names the layer in progress', () => {
    const r = check(handoff('Layer in progress: 1'), 1);
    expect(all(r)).toEqual([]);
    expect(r.check).toBe('handoff');
    expect(all(check(handoff('Layer in progress: 12'), 12))).toEqual([]);
  });
  it('accepts a heading with trailing spaces', () => {
    expect(all(check(handoff('Layer in progress: 1', undefined, '  '), 1))).toEqual([]);
  });
  it('fails each missing section', () => {
    for (const s of SECTIONS) expect(all(check(handoff('Layer in progress: 1', s), 1))).toEqual([`red ${H} | the handoff has no "${s}" section`]);
  });
  it('reads the layer from the start of a line only', () => {
    expect(all(check(handoff('Say Layer in progress: 3\nLayer in progress: 1'), 1))).toEqual([]);
  });
  it('fails the wrong layer, or none', () => {
    expect(all(check(handoff('Layer in progress: 0'), 1))).toEqual([`red ${H} | the handoff says layer 0 is in progress, but the ledger says 1`]);
    expect(all(check(handoff('Layer in progress: one'), 1))).toEqual([`red ${H} | the handoff says "Layer in progress: N"`]);
  });
  it('holds only the form when the ledger can\'t be read', () => {
    expect(all(check(handoff('Layer in progress: 4'), undefined))).toEqual([]);
  });
  it('fails without a handoff', () => {
    expect(all(checkHandoff(fixture({}).repo, 0))).toEqual([`red ${H} | the handoff file is missing`]);
  });
});
