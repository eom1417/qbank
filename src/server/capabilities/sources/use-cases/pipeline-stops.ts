import type { AiProvider } from '../../providers/index.js';
import type { JobRow } from '../adapters/import-repository.js';
import type { SourcesDeps } from './deps.js';
import { PAUSING } from './manage-imports.js';
import {
  readWithPipeline,
  sumUsage,
  type PipelineInput,
  type PipelineReading,
} from './read-with-pipeline.js';
import type { LessonDeps } from './run-lesson.js';

// What a pipeline import does when its AI stops (Z4, Q16, M36 Q115): pause on a full
// subscription, end after 7 days of pauses, and otherwise keep what the file prints.

/** No silent fallback (Z4): without its AI a pipeline job fails, and no rule reads the file. */
export const aiFailed = (code: 'ai_not_ready' | 'ai_failed' | 'no_quota', outcome: string) => ({
  stage: 'failed' as const,
  questions_found: 0,
  questions_review: 0,
  ai_outcome: outcome,
  error_code: code,
  ai_detail: null,
});

/** A job that would wait longer than this for its subscription in all ends instead (Q16). */
const MAX_PAUSE_MS = 7 * 24 * 60 * 60_000;

/**
 * A full subscription pauses the job where it is: it is taken again after `resumeAfter` and
 * goes on from the step cache, unless its pauses would pass 7 days in all: then it fails with
 * `no_quota`. Any other stop fails the job. Null when it paused.
 */
async function stoppedOutcome(
  deps: SourcesDeps,
  job: JobRow,
  read: PipelineReading,
  usage: string,
) {
  const stop = read.stopped;
  if (!stop) return undefined;
  if (PAUSING.has(stop.failure) && stop.resumeAfter) {
    const now = deps.clock.now();
    const paused = job.paused_ms + (stop.resumeAfter.getTime() - now.getTime());
    if (paused > MAX_PAUSE_MS) return { ...aiFailed('no_quota', stop.failure), ai_usage: usage };
    const at = { locked_until: stop.resumeAfter, paused_ms: paused, updated_at: now };
    await deps.imports.update(job.id, { ai_outcome: stop.failure, ai_usage: usage, ...at });
    return null;
  }
  return { ...aiFailed('ai_failed', stop.failure), ai_usage: usage };
}

/** The lessons' provider, keeping the last words a provider gave with a failure (M36 Q119). */
function recordingDetail(lessons: LessonDeps) {
  let last: string | null = null;
  const providerFor = (model: string): AiProvider => {
    const provider = lessons.providerFor(model);
    return {
      async generate(request) {
        const result = await provider.generate(request);
        if (!result.ok && result.detail) last = result.detail;
        return result;
      },
    };
  };
  return { lessons: { ...lessons, providerFor }, detail: () => last };
}

/**
 * Reads with the AI. When it stops for good (a refusal, M36 Q115) the file is read again with
 * no model approved: what the file prints is kept, what needed the AI waits in review, and the
 * lessons already answered come from the step cache. Null when the job paused (Q16).
 */
export async function readKeeping(
  deps: SourcesDeps,
  job: JobRow,
  lessons: LessonDeps,
  input: PipelineInput,
) {
  const said = recordingDetail(lessons);
  const read = await readWithPipeline(said.lessons, input);
  const usage = JSON.stringify(sumUsage(job.ai_usage, read.usage));
  const stopped = await stoppedOutcome(deps, job, read, usage);
  if (stopped === null) return null;
  if (stopped === undefined) return { read, usage, stoppedBy: null, detail: null };
  // A subscription full past its 7 days ends the job as before (Q16).
  if (stopped.error_code === 'no_quota') return { failed: stopped };
  const kept = await readWithPipeline({ ...lessons, approved: () => false }, input);
  return { read: kept, usage, stoppedBy: stopped.ai_outcome, detail: said.detail() };
}
