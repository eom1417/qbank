import { z } from 'zod';
import { LessonUsage as UsageRow } from '../../../../contracts/sources.js';
import type { LessonUsage } from './run-lesson.js';

// The import report's AI usage (M34): one row per lesson and model, summed over the job's runs.

/** A job's earlier lesson usage plus this run's, summed per lesson and model, for the report. */
export function sumUsage(previous: unknown, usage: readonly LessonUsage[]): UsageRow[] {
  const earlier = z.array(UsageRow).safeParse(previous);
  const rows = new Map(
    (earlier.success ? earlier.data : []).map((row) => [`${row.lesson}\n${row.model}`, row]),
  );
  for (const call of usage) {
    const key = `${call.lesson}\n${call.model}`;
    const row = rows.get(key) ?? { ...call, calls: 0, inputTokens: 0, outputTokens: 0 };
    rows.set(key, {
      lesson: call.lesson,
      model: call.model,
      calls: row.calls + 1,
      inputTokens: row.inputTokens + call.inputTokens,
      outputTokens: row.outputTokens + call.outputTokens,
      estimated: row.estimated || call.estimated,
    });
  }
  return [...rows.values()];
}
