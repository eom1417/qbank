import type { RecheckRequest } from '../../../../contracts/sources.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { SourcesDeps } from './deps.js';

/** Every model the re-check would use must be one the instance offers now. */
async function checkModels(deps: SourcesDeps, actor: Actor, input: RecheckRequest) {
  const models = [input.aiModel, ...Object.values(input.models)];
  for (const model of [undefined, ...models.filter(Boolean)]) {
    const target = { instanceId: input.aiProviderId, ...(model ? { model } : {}) };
    if (!(await deps.ai.estimateFor(actor.accountId, target)))
      throw new AppError('validation_failed', { aiProviderId: 'invalid_value' });
  }
}

/**
 * Queues a re-check of a source (DEC-33): its saved questions are improved (when asked) and
 * their answers settled again by the owner's AI. One job runs per source at a time; the report
 * is the import report. Returns the new job's id.
 */
export async function startRecheck(
  deps: SourcesDeps,
  actor: Actor,
  sourceId: string,
  input: RecheckRequest,
): Promise<string> {
  const source = isId(sourceId) ? await deps.imports.findSource(actor.accountId, sourceId) : null;
  if (!source || source.answers_for_source_id) throw notFound();
  if (await deps.imports.runningJobOf(source.id)) throw new AppError('not_retryable');
  await checkModels(deps, actor, input);
  const id = deps.newId();
  const now = deps.clock.now();
  await deps.imports.addJob({
    id,
    owner_id: actor.accountId,
    source_id: source.id,
    stage: 'queued',
    pages_total: 0,
    ai_provider_id: input.aiProviderId,
    ai_model: input.aiModel ?? null,
    ai_mode: 'recheck',
    ai_improve: input.improve,
    ai_roles: JSON.stringify(input.models),
    created_at: now,
    updated_at: now,
  });
  return id;
}
