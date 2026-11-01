import { COUNTRY_CODES } from '../../src/world/gazetteer/gazetteer.ts';
import { PERMITS_START, type PermitsSlice } from '../../src/person/permits/permits.ts';

/**
 * A permits slice for tests of a role's own work, where the permit isn't what is tested: a permit granted and in force
 * for decades in every country, so the work abroad is never refused for want of one. The permits engine's own tests hold
 * the refusals.
 */
export const permitsEverywhere = (): PermitsSlice => ({
  ...structuredClone(PERMITS_START),
  applications: COUNTRY_CODES.map((country, i) => ({ id: i + 1, at: 0, country, role: 'actor', engagement: 0, renews: null, by: 'worker', premium: false, fees: null, decided: { at: 0, until: 4_000_000_000 } })),
});
