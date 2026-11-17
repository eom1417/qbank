// M34 P6 (Q14): the light and strong models the import form may offer, per provider kind: the
// approved models of the pipeline's lessons, without one the weekly measurement unapproved (Q15).
import type { ApprovedModelsResponse } from '../../../../contracts/sources.js';
import { revokedKey } from '../adapters/measurements.js';
import { approvedModels, type ProviderKind } from '../domain/pipeline/approved-models.js';
import { imageKindLesson } from '../domain/pipeline/lessons/image-kind.js';
import { markLesson } from '../domain/pipeline/lessons/mark.js';
import type { SourcesDeps } from './deps.js';

const KINDS: readonly ProviderKind[] = ['claude', 'codex'];
const LESSONS = [markLesson.id, imageKindLesson.id];

export async function approvedTiers(
  deps: Pick<SourcesDeps, 'measurements'>,
): Promise<ApprovedModelsResponse> {
  const revoked = await deps.measurements.revoked();
  const tier = (kind: ProviderKind, name: 'light' | 'strong') => [
    ...new Set(
      LESSONS.flatMap((lesson) =>
        approvedModels(lesson, kind)[name].filter(
          (model) => !revoked.has(revokedKey(lesson, model)),
        ),
      ),
    ),
  ];
  return {
    kinds: Object.fromEntries(
      KINDS.map((kind) => [kind, { light: tier(kind, 'light'), strong: tier(kind, 'strong') }]),
    ),
  };
}
