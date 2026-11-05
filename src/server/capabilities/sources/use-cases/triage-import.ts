import { TriageModels } from '../../../../contracts/sources.js';
import type { JobRow } from '../adapters/import-repository.js';
import type { SourcesDeps } from './deps.js';
import { triageRows, type TriageSettings } from './triage-source.js';

/** The job's role models; a job from before M19 has none and uses its one model everywhere. */
const modelsOf = (job: JobRow): TriageModels => {
  const parsed = TriageModels.safeParse(job.ai_roles);
  return parsed.success ? parsed.data : {};
};

/** Opens every role of the job's triage on its instance, or null when one cannot run. */
async function triageRolesOf(
  deps: Pick<SourcesDeps, 'ai'>,
  ownerId: string,
  target: { instanceId: string; model: string | null; improve: boolean; models: TriageModels },
): Promise<TriageSettings | null> {
  const open = (model: string | undefined) => {
    const chosen = model ?? target.model;
    return deps.ai.openOwned(ownerId, {
      instanceId: target.instanceId,
      ...(chosen ? { model: chosen } : {}),
    });
  };
  const [first, second, judge, improver] = await Promise.all([
    open(target.models.first),
    open(target.models.second),
    open(target.models.judge),
    target.improve ? open(target.models.improver) : Promise.resolve(null),
  ]);
  if (!first || !second || !judge || (target.improve && !improver)) return null;
  return { first, second, judge, improver };
}

/**
 * The import's last AI step (DEC-33): the saved questions of the source are improved (when the
 * job asks) and their answers settled. Returns the AI outcome and how many still need a person.
 */
export async function triageImport(deps: SourcesDeps, job: JobRow, sourceId: string) {
  const roles = job.ai_provider_id
    ? await triageRolesOf(deps, job.owner_id, {
        instanceId: job.ai_provider_id,
        model: job.ai_model,
        improve: job.ai_improve,
        models: modelsOf(job),
      })
    : null;
  if (!roles) return { aiOutcome: 'not_ready' };
  const owner = { ownerId: job.owner_id, now: deps.clock.now() };
  const rows = await deps.questions.questionsOfSource(job.owner_id, sourceId);
  const report = await triageRows(deps, owner, rows, roles);
  return { aiOutcome: report.failure ?? 'done' };
}

/**
 * A re-check job (DEC-33): the source's saved questions are triaged again with the job's AI,
 * without reading the file (its original may be gone). Returns the job's final values.
 */
export async function recheckOutcome(deps: SourcesDeps, job: JobRow) {
  await deps.imports.update(job.id, { stage: 'verifying', updated_at: deps.clock.now() });
  const { aiOutcome } = await triageImport(deps, job, job.source_id);
  const rows = await deps.questions.questionsOfSource(job.owner_id, job.source_id);
  const review = rows.filter((row) => row.status === 'needs_review').length;
  const stage = review > 0 || aiOutcome !== 'done' ? 'needs_review' : 'completed';
  return {
    stage,
    questions_found: rows.length,
    questions_review: review,
    ai_outcome: aiOutcome,
  } as const;
}
