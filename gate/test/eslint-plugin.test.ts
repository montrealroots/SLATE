import { describe, expect, it } from 'vitest';
import slate from '../eslint/plugin.js';

// Apart from the rule cases (which register at load), so a plugin that fails to load is caught as a failing test.
describe('the SLATE lint plugin', () => {
  it('names itself and holds its three rules, each reporting a problem', () => {
    expect(slate.meta).toEqual({ name: 'eslint-plugin-slate' });
    expect(Object.keys(slate.rules)).toEqual(['no-raw-text', 'control-feature', 'shown-value-feature']);
    for (const rule of Object.values(slate.rules)) {
      expect(rule.meta?.type).toBe('problem');
      expect(rule.meta?.schema).toEqual([]);
      expect(typeof rule.create).toBe('function');
    }
    expect(slate.rules['no-raw-text'].meta?.messages).toEqual({ raw: 'Player-facing text comes from the text catalog through t(): "{{text}}".' });
    expect(slate.rules['control-feature'].meta?.messages).toEqual({ missing: 'A control names its feature: data-feature="<registered id>" ({{what}}).' });
    expect(slate.rules['shown-value-feature'].meta?.messages).toEqual({ unmarked: 'A value shown on a page sits inside an element with data-feature="<registered id>".' });
  });
});
