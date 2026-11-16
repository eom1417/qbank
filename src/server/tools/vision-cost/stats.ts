/** Aggregation of bench calls into the format × size × model table. Pure. */

export type Format = 'FULL' | 'CROP' | 'SHEET';

export interface CallRecord {
  format: Format;
  /** Long edge of the image sent, px. */
  size: number;
  model: string;
  /** Questions the call answered. */
  questions: number;
  correct: number;
  /** All input: uncached + cache creation + cache read. */
  inputTokens: number;
  cacheCreation: number;
  cacheRead: number;
  outputTokens: number;
  seconds: number;
  /** Null when the call succeeded. */
  failure: string | null;
  /** True when tokens are estimated (no model call was made). */
  estimated: boolean;
}

export interface TableRow {
  format: Format;
  size: number;
  model: string;
  correct: number;
  total: number;
  accuracy: number;
  inputPerQuestion: number;
  /** Input per question after removing the per-call fixed overhead (text-only turn). */
  inputExclOverheadPerQuestion: number;
  cacheCreationPerCall: number;
  cacheReadPerCall: number;
  outputPerQuestion: number;
  secondsPerQuestion: number;
  calls: number;
  failures: number;
  estimated: boolean;
}

const round = (value: number, digits = 1): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

function toRow(records: readonly CallRecord[], overhead: number): TableRow {
  const first = records[0];
  if (!first) throw new RangeError('empty group');
  const sum = (pick: (r: CallRecord) => number): number => records.reduce((a, r) => a + pick(r), 0);
  const total = sum((r) => r.questions);
  const per = (v: number): number => (total === 0 ? 0 : round(v / total));
  return {
    format: first.format,
    size: first.size,
    model: first.model,
    correct: sum((r) => r.correct),
    total,
    accuracy: total === 0 ? 0 : round(sum((r) => r.correct) / total, 3),
    inputPerQuestion: per(sum((r) => r.inputTokens)),
    inputExclOverheadPerQuestion: per(sum((r) => r.inputTokens) - overhead * records.length),
    cacheCreationPerCall: round(sum((r) => r.cacheCreation) / records.length),
    cacheReadPerCall: round(sum((r) => r.cacheRead) / records.length),
    outputPerQuestion: per(sum((r) => r.outputTokens)),
    secondsPerQuestion: per(sum((r) => r.seconds)),
    calls: records.length,
    failures: records.filter((r) => r.failure !== null).length,
    estimated: records.some((r) => r.estimated),
  };
}

/**
 * One row per format × size × model, in first-seen order. `overhead` is each model's fixed input
 * per call (tokens of a text-only turn), subtracted for the "excl. overhead" column.
 */
export function summarize(
  records: readonly CallRecord[],
  overhead: Readonly<Record<string, number>> = {},
): TableRow[] {
  const groups = new Map<string, CallRecord[]>();
  for (const record of records) {
    const key = `${record.format}|${record.size}|${record.model}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return Array.from(groups.values(), (group) => toRow(group, overhead[group[0]?.model ?? ''] ?? 0));
}

/** Markdown table of the rows. */
export function renderTable(rows: readonly TableRow[]): string {
  const head =
    '| format | size | model | accuracy | in tok/q | in tok/q excl. overhead | cache create/read per call | out tok/q | s/q | calls | failed |\n' +
    '|---|---|---|---|---|---|---|---|---|---|---|';
  const lines = rows.map(
    (r) =>
      `| ${r.format} | ${r.size} | ${r.model} | ${r.estimated ? 'not run' : `${r.correct}/${r.total}`} | ` +
      `${r.inputPerQuestion}${r.estimated ? ' (est.)' : ''} | ${r.inputExclOverheadPerQuestion} | ` +
      `${r.cacheCreationPerCall}/${r.cacheReadPerCall} | ${r.outputPerQuestion} | ` +
      `${r.secondsPerQuestion} | ${r.calls} | ${r.failures} |`,
  );
  return [head, ...lines].join('\n');
}
