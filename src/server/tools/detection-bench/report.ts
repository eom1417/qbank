import { matchQuestions, type PipelineScore } from '../extraction-bench/pipeline-score.js';
import type { PipelineQuestion } from '../../capabilities/sources/domain/pipeline/question.js';
import type { TruthFile } from '../extraction-bench/truth.js';

// M39 bench: the table, with the column the detection is judged by: "silent" is a question
// that is wrong (answer or options) and carries no review reason, so nobody would look at it.

export interface Row {
  group: string;
  name: string;
  seconds: number;
  score: PipelineScore;
  silent: number;
}

const letters = (list: readonly { letter: string }[]) => list.map((o) => o.letter).join('');

/** Wrong answer or wrong options, with no review reason and no conflict to flag it. */
export function silentCount(truth: TruthFile, read: readonly PipelineQuestion[]): number {
  return matchQuestions(truth.questions, read).filter(([t, q]) => {
    const decided = t.status === 'valid' || t.status === 'single_option';
    const wrongAnswer = decided && q.answers.length > 0 && q.answers.join() !== t.answer.join();
    const wrongOptions = letters(t.options) !== letters(q.options);
    return (
      (wrongAnswer || wrongOptions) && q.reviewReasons.length === 0 && q.conflicts.length === 0
    );
  }).length;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '-';

const COLUMNS: [string, (r: Row) => string][] = [
  ['file', (r) => `${r.group}/${r.name}`],
  [
    'found',
    (r) => `${r.score.found}/${r.score.expected} (${pct(r.score.found, r.score.expected)})`,
  ],
  ['extra', (r) => String(r.score.extra)],
  ['stem sim', (r) => r.score.stemSimilarity.toFixed(3)],
  ['options exact', (r) => pct(r.score.optionsExact, r.score.found)],
  ['leaks', (r) => String(r.score.leaks)],
  [
    'answers ok/wrong/undecided',
    (r) =>
      `${r.score.answersCorrect}/${r.score.answersWrong}/${r.score.answersUndecided} of ${r.score.answersDecidable}`,
  ],
  ['unfounded', (r) => String(r.score.answersUnfounded)],
  ['leftovers', (r) => String(r.score.leftovers)],
  ['silent', (r) => String(r.silent)],
  ['s', (r) => r.seconds.toFixed(1)],
];

export const header = () => COLUMNS.map(([title]) => title).join(' | ');
export const line = (row: Row) => COLUMNS.map(([, cell]) => cell(row)).join(' | ');
