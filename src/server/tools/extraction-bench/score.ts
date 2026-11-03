import type { ExtractedQuestion } from '../../capabilities/sources/index.js';

/** One row of a reference answer key (written by hand from the page images). */
export interface ReferenceQuestion {
  number: number;
  page: number;
  options: string[];
  answer: string | null;
  evidence: string;
}

/** Marks a reader can see on the page; notes, ambiguous and unmarked items are not scored. */
const VISIBLE = new Set(['circle', 'tick', 'highlight', 'underline', 'single_option']);

export interface Score {
  questions: number;
  found: number;
  extra: number;
  pageCorrect: number;
  optionsCorrect: number;
  /** Reference answers marked visibly on the page. */
  decidable: number;
  answerCorrect: number;
  answerWrong: number;
  answerAbstained: number;
  /** Mean similarity (0–1) of question text to the text-layer reading; null without one. */
  stemSimilarity: number | null;
}

/** Normalised edit similarity of two texts (1 = identical), ignoring case and spacing. */
export function similarity(a: string, b: string): number {
  const x = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const y = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!x && !y) return 1;
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      next.push(Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + cost));
    }
    row = next;
  }
  return 1 - (row[y.length] ?? 0) / Math.max(x.length, y.length);
}

function answerOutcome(reference: ReferenceQuestion, got: ExtractedQuestion | undefined) {
  if (!VISIBLE.has(reference.evidence) || reference.answer === null) return 'skipped';
  if (!got || got.answer === null) return 'abstained';
  return got.answer === reference.answer ? 'correct' : 'wrong';
}

const meanOf = (values: readonly number[]) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

export function scoreExtraction(
  reference: readonly ReferenceQuestion[],
  extracted: readonly ExtractedQuestion[],
  textLayer: readonly ExtractedQuestion[] | null,
): Score {
  const byNumber = new Map(extracted.map((question) => [question.number, question]));
  const outcomes = reference.map((ref) => answerOutcome(ref, byNumber.get(ref.number)));
  const count = (outcome: string) => outcomes.filter((value) => value === outcome).length;
  const known = new Set(reference.map((ref) => ref.number));
  const stems = textLayer?.flatMap((truth) => {
    const got = byNumber.get(truth.number);
    return got ? [similarity(got.stem, truth.stem)] : [0];
  });
  return {
    questions: reference.length,
    found: reference.filter((ref) => byNumber.has(ref.number)).length,
    extra: extracted.filter((question) => !known.has(question.number)).length,
    pageCorrect: reference.filter((ref) => byNumber.get(ref.number)?.page === ref.page).length,
    optionsCorrect: reference.filter(
      (ref) =>
        byNumber
          .get(ref.number)
          ?.options.map((o) => o.letter)
          .join('') === ref.options.join(''),
    ).length,
    decidable: outcomes.filter((value) => value !== 'skipped').length,
    answerCorrect: count('correct'),
    answerWrong: count('wrong'),
    answerAbstained: count('abstained'),
    stemSimilarity: stems ? meanOf(stems) : null,
  };
}
