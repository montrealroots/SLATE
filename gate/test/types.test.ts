import { describe, expect, it } from 'vitest';
import { result, verdictOf } from '../lib/types.ts';

describe('a check result', () => {
  it('records red and incomplete findings, with their place only when given', () => {
    const r = result('x');
    r.red('a');
    r.red('b', 'f.ts');
    r.incomplete('c');
    r.incomplete('d', 'g.ts');
    r.note('n');
    r.generate('matrix/X.md', 'content');
    expect(r.findings).toStrictEqual([
      { severity: 'red', message: 'a' },
      { severity: 'red', message: 'b', where: 'f.ts' },
      { severity: 'incomplete', message: 'c' },
      { severity: 'incomplete', message: 'd', where: 'g.ts' },
    ]);
    expect(r.check).toBe('x');
    expect(r.notes).toStrictEqual(['n']);
    expect(r.generated).toStrictEqual([{ path: 'matrix/X.md', content: 'content' }]);
  });
  it('makes a verdict: any red is red, else any finding is incomplete, else green', () => {
    const green = result('a');
    const inc = result('b');
    inc.incomplete('x');
    const red = result('c');
    red.red('y');
    expect(verdictOf([])).toBe('green');
    expect(verdictOf([green])).toBe('green');
    expect(verdictOf([green, inc])).toBe('incomplete');
    expect(verdictOf([inc, red])).toBe('red');
    expect(verdictOf([red])).toBe('red');
  });
});
