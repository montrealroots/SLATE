/** What the gate says about one rule: red is a rule broken, incomplete is declared work not yet done. */
export type Severity = 'red' | 'incomplete';

export interface Finding {
  severity: Severity;
  message: string;
  /** A file, or a file and line, when the finding has a place. */
  where?: string;
}

/** A generated file the check owns: written with --write, compared otherwise, so what's committed is always true. */
export interface Generated {
  path: string;
  content: string;
}

export interface CheckResult {
  check: string;
  findings: Finding[];
  notes: string[];
  generated: Generated[];
}

export type Verdict = 'green' | 'incomplete' | 'red';

export function verdictOf(results: readonly CheckResult[]): Verdict {
  const all = results.flatMap((r) => r.findings);
  if (all.some((f) => f.severity === 'red')) return 'red';
  return all.length > 0 ? 'incomplete' : 'green';
}

export function result(check: string): CheckResult & {
  red(message: string, where?: string): void;
  incomplete(message: string, where?: string): void;
  note(message: string): void;
  generate(path: string, content: string): void;
} {
  const r: CheckResult = { check, findings: [], notes: [], generated: [] };
  return Object.assign(r, {
    red(message: string, where?: string) {
      r.findings.push(where === undefined ? { severity: 'red', message } : { severity: 'red', message, where });
    },
    incomplete(message: string, where?: string) {
      r.findings.push(where === undefined ? { severity: 'incomplete', message } : { severity: 'incomplete', message, where });
    },
    note(message: string) {
      r.notes.push(message);
    },
    generate(path: string, content: string) {
      r.generated.push({ path, content });
    },
  });
}
