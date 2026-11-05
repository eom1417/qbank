import type { TriageModels } from '../../../contracts/sources.js';

/** How hard the triage works (DEC-33): stronger models cost more of the subscription. */
export type TriageQuality = 'high' | 'balanced' | 'economy' | 'custom';

type Tier = 'large' | 'medium' | 'small';

/** Model families by tier; a model's tier is the family its slug names. */
const FAMILIES: Record<Tier, readonly string[]> = {
  large: ['opus'],
  medium: ['sonnet'],
  small: ['haiku'],
};

/** Which tier plays each role at each quality: two different solvers, a stronger judge. */
const PLANS: Record<Exclude<TriageQuality, 'custom'>, Record<keyof TriageModels, Tier>> = {
  high: { first: 'large', second: 'medium', judge: 'large', improver: 'medium' },
  balanced: { first: 'medium', second: 'small', judge: 'large', improver: 'small' },
  economy: { first: 'small', second: 'small', judge: 'medium', improver: 'small' },
};

/** The newest model of a tier: the kit lists an instance's current models first. */
function newestOf(slugs: readonly string[], tier: Tier): string | undefined {
  return slugs.find((slug) => FAMILIES[tier].some((family) => slug.includes(family)));
}

/**
 * The model of each role for a quality, from the models the instance offers. A provider whose
 * families are unknown (or a missing tier) leaves the role on the instance's default model.
 */
export function presetModels(
  quality: Exclude<TriageQuality, 'custom'>,
  slugs: readonly string[],
): TriageModels {
  const plan = PLANS[quality];
  const models: TriageModels = {};
  for (const role of Object.keys(plan) as (keyof TriageModels)[]) {
    const model = newestOf(slugs, plan[role]);
    if (model) models[role] = model;
  }
  return models;
}
