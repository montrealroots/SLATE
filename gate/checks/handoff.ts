import { PATHS } from '../lib/paths.ts';
import type { Repo } from '../lib/repo.ts';
import { result, type CheckResult } from '../lib/types.ts';

/** The handoff an interrupted build resumes from: these sections, and the layer it names is the layer in progress. */
export const SECTIONS = [
  '## Where the build stands',
  '## Next step',
  '## Verification evidence',
  '## Assumptions',
  '## Blockers and open issues',
  '## Questions for the owner',
] as const;

export function checkHandoff(repo: Repo, layerInProgress: number | undefined): CheckResult {
  const r = result('handoff');
  const text = repo.read(PATHS.handoff);
  if (text === undefined) {
    r.red('the handoff file is missing', PATHS.handoff);
    return r;
  }
  for (const s of SECTIONS) if (!text.split('\n').some((l) => l.trim() === s)) r.red(`the handoff has no "${s}" section`, PATHS.handoff);
  const named = /^Layer in progress: (\d+)\b/m.exec(text)?.[1];
  if (named === undefined) r.red('the handoff says "Layer in progress: N"', PATHS.handoff);
  else if (layerInProgress !== undefined && Number(named) !== layerInProgress) {
    r.red(`the handoff says layer ${named} is in progress, but the ledger says ${layerInProgress}`, PATHS.handoff);
  }
  return r;
}
