import { DetectionIssue } from '../../../../contracts/detection.js';
// M34 P6: what a pipeline import keeps for review (its units, 7 days, Q23) and what its report
// says beyond the counts: the family, pages of unknown shape (Q44), whether the family has been
// measured (Q59), and the questions in review by reason.
import { z } from 'zod';
import { ModelTier, type PipelineReport } from '../../../../contracts/sources.js';
import type { JobRow } from '../adapters/import-repository.js';
import { unknownShapePages } from '../domain/pipeline/roles.js';
import type { SourcesDeps } from './deps.js';
import type { PipelineReading } from './read-with-pipeline.js';

/** How long a job's units stay for the review editor (Q23, FR-06-008). */
const BLOCK_DAYS = 7;
/** Only this family was measured against its truth so far (P0): any other is said (Q59). */
const MEASURED_FAMILIES: ReadonlySet<string> = new Set(['annotated_notes']);

const Facts = z.object({
  family: z.string().nullable(),
  unknownPages: z.array(z.number().int()),
  issues: z.array(DetectionIssue).default([]),
});

/** Keeps the run's units with their roles; returns the job's facts for its report. */
export async function keepBlocks(
  deps: SourcesDeps,
  job: Pick<JobRow, 'id' | 'owner_id'>,
  read: Pick<PipelineReading, 'blocks' | 'family' | 'issues'>,
): Promise<string> {
  const expiresAt = new Date(deps.clock.now().getTime() + BLOCK_DAYS * 24 * 60 * 60_000);
  await deps.blocks.replace({ ownerId: job.owner_id, jobId: job.id, expiresAt }, read.blocks);
  const facts = {
    family: read.family,
    unknownPages: unknownShapePages(read.blocks),
    issues: read.issues ?? [],
  };
  return JSON.stringify(facts);
}

/** The job's starting tier (Q14), when it has one. */
export function tierOf(job: Pick<JobRow, 'ai_tier'>): ModelTier | null {
  const parsed = ModelTier.safeParse(job.ai_tier);
  return parsed.success ? parsed.data : null;
}

function reasonCounts(rows: readonly { status: string; review_reasons: string[] }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== 'needs_review') continue;
    for (const reason of row.review_reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/** The pipeline part of a job's report; null for the other modes. */
export async function pipelineReport(
  deps: SourcesDeps,
  job: Pick<JobRow, 'owner_id' | 'source_id' | 'ai_mode' | 'pipeline_facts'>,
): Promise<PipelineReport | null> {
  if (job.ai_mode !== 'pipeline') return null;
  const facts = Facts.safeParse(job.pipeline_facts);
  const family = facts.success ? facts.data.family : null;
  const saved = await deps.questions.questionsOfSource(job.owner_id, job.source_id);
  return {
    family,
    measured: family !== null && MEASURED_FAMILIES.has(family),
    unknownPages: facts.success ? facts.data.unknownPages : [],
    reviewReasons: reasonCounts(saved),
  };
}

/** Capture issues are source facts, independent of whether an AI provider was selected. */
export function detectionIssues(job: Pick<JobRow, 'pipeline_facts'>): DetectionIssue[] {
  const facts = Facts.safeParse(job.pipeline_facts);
  return facts.success ? facts.data.issues : [];
}
