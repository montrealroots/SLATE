/** Where the gate finds what it holds the build to. One place, so a check and its test can't disagree. */
export const PATHS = {
  packageJson: 'package.json',
  lockfile: 'package-lock.json',
  nvmrc: '.nvmrc',
  ownerDocsLock: 'registry/owner-docs.lock.json',
  layers: 'registry/layers.json',
  features: 'registry/features.json',
  pages: 'registry/pages.json',
  engines: 'registry/engines.json',
  axes: 'registry/axes.json',
  voice: 'registry/voice.json',
  names: 'registry/names.json',
  register: 'research/register.json',
  catalog: 'src/core/text/catalog.json',
  handoff: 'HANDOFF.md',
  src: 'src',
  matrixDir: 'matrix',
} as const;
