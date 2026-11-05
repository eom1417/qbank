import { TriageModels } from '../../../../contracts/sources.js';
import type { JobRow } from '../adapters/import-repository.js';
import type { SourcesDeps } from './deps.js';
import { enhanceOf } from './manage-imports.js';
import { enrichQuestions } from './enrich-questions.js';
import { triageRows, type TriageSettings } from './triage-source.js';

/** The job's role models; a job from before M19 has none and uses its one model everywhere. */
const modelsOf = (job: JobRow): TriageModels => {
  const parsed = TriageModels.safeParse(job.ai_roles);
  return parsed.success ? parsed.data : {};
};

/** Opens every model of the job's team on its instance, or null when one cannot run. */
async function teamOf(
  deps: Pick<SourcesDeps, 'ai'>,
  ownerId: string,
  target: { instanceId: string; model: string | null; models: TriageModels },
): Promise<TriageSettings['team'] | null> {
  const open = (model: string | undefined) => {
    const chosen = model ?? target.model;
    return deps.ai.openOwned(ownerId, {
      instanceId: target.instanceId,
      ...(chosen ? { model: chosen } : {}),
    });
  };
  const { models } = target;
  const [first, second, judge, improver] = await Promise.all(
    [models.first, models.second, models.judge, models.improver].map(open),
  );
  if (!first || !second || !judge || !improver) return null;
  return { first, second, judge, improver };
}

/**
 * The import's last AI step (DEC-33, DEC-34): the saved questions of the source are organized,
 * improved as the job asks, and enriched. Returns the AI outcome.
 */
export async function triageImport(deps: SourcesDeps, job: JobRow, sourceId: string) {
  const team = job.ai_provider_id
    ? await teamOf(deps, job.owner_id, {
        instanceId: job.ai_provider_id,
        model: job.ai_model,
        models: modelsOf(job),
      })
    : null;
  if (!team) return { aiOutcome: 'not_ready' };
  const owner = { ownerId: job.owner_id, now: deps.clock.now() };
  const settings = { team, enhance: enhanceOf(job) };
  const rows = await deps.questions.questionsOfSource(job.owner_id, sourceId);
  const report = await triageRows(deps, owner, rows, settings);
  const settled = await deps.questions.questionsOfSource(job.owner_id, sourceId);
  const enriched = await enrichQuestions(deps, owner, settled, {
    writer: team.judge,
    enhance: settings.enhance,
  });
  return { aiOutcome: report.failure ?? enriched ?? 'done' };
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
