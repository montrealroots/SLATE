import type features from '../../registry/features.json';
import { falsifyAny, type FalsifySpec } from './falsify-core.ts';

/** A registered feature's id; naming one that isn't registered fails the typecheck. */
export type FeatureId = keyof typeof features;

export function falsify<I, O>(spec: FalsifySpec<I, O> & { feature: FeatureId }): void {
  falsifyAny(spec);
}
