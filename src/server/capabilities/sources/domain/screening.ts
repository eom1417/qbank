import type { ImportedQuestion, ReviewReason } from '../../questions/index.js';
import type { ExtractedQuestion } from '../use-cases/extract-questions.js';
import { defectsOf } from './defects.js';

export interface PageReading {
  reading: 'text' | 'ocr';
  unreadable: boolean;
}

function answerReasons(question: ExtractedQuestion): ReviewReason[] {
  if (question.kind === 'essay') return ['essay'];
  if (question.answer === null) return ['no_answer'];
  return question.evidence === 'ai_suggested' ? ['ai_suggested'] : [];
}

function placeReasons(
  question: ExtractedQuestion,
  page: PageReading | undefined,
  previous: number | null,
) {
  const reasons: ReviewReason[] = [];
  if (page?.reading === 'ocr') reasons.push('ocr_page');
  if (page?.unreadable) reasons.push('unreadable_page');
  // Numbering starting again at 1 is a new chapter, not a gap.
  const continues = question.number === (previous ?? 0) + 1 || question.number === 1;
  if (previous !== null && !continues) reasons.push('numbering_gap');
  if (question.stem.trim().length < 3) reasons.push('empty_stem');
  return reasons;
}

const reasonsOf = (
  question: ExtractedQuestion,
  page: PageReading | undefined,
  previous: number | null,
) => [
  ...answerReasons(question),
  ...question.conflicts,
  ...placeReasons(question, page, previous),
  ...defectsOf(question),
];

const provenanceOf = (question: ExtractedQuestion): ImportedQuestion['provenance'] => {
  if (question.conflicts.length > 0) return 'conflict';
  if (question.answer === null) return 'missing';
  return question.evidence === 'ai_suggested' ? 'ai_suggested' : 'source';
};

/**
 * The free check of every extracted question (step 2 of the import): anything uncertain gets a
 * reason and goes to review instead of being trusted silently, its pictures included (M5).
 */
export function screenQuestions(
  questions: readonly ExtractedQuestion[],
  pages: ReadonlyMap<number, PageReading>,
  mediaReasons: ReadonlyMap<number, readonly ReviewReason[]> = new Map(),
): ImportedQuestion[] {
  return questions.map((question, index) => ({
    number: question.number,
    page: question.page,
    kind: question.kind,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    answers: question.answers,
    multiSelect: question.multiSelect,
    provenance: provenanceOf(question),
    evidence: question.evidence,
    explanation: question.explanation,
    reasons: [
      ...reasonsOf(
        question,
        pages.get(question.page),
        index === 0 ? null : (questions[index - 1]?.number ?? null),
      ),
      ...(mediaReasons.get(index) ?? []),
    ],
  }));
}

/** Share of rule-decided answers the user's AI double-checks (and at least this many). */
const AUDIT_SHARE = 0.05;
const AUDIT_MIN = 10;

/**
 * Which rule-decided questions the AI audits: a fixed, spread-out sample, so free tools that
 * fail silently are caught (step 4). The same file always gets the same sample.
 */
export function auditSample(questions: readonly ImportedQuestion[]): Set<number> {
  const decided = questions.filter(
    (q) => q.kind === 'mcq' && !q.multiSelect && q.answer !== null && q.provenance === 'source',
  );
  const size = Math.min(
    decided.length,
    Math.max(AUDIT_MIN, Math.ceil(decided.length * AUDIT_SHARE)),
  );
  const step = decided.length / Math.max(size, 1);
  return new Set(
    Array.from({ length: size }, (_, i) => decided[Math.floor(i * step)]?.number ?? -1),
  );
}
