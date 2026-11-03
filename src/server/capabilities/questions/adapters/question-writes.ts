import type { Db } from '../../../platform/db/index.js';
import { suggestPlace, type ChapterNames } from '../domain/classify.js';
import { eligibilityOf, type ImportedQuestion } from '../domain/imported.js';

export interface Place {
  ownerId: string;
  bankId: string;
  sourceId: string;
}

type Existing = Awaited<ReturnType<typeof existingAt>>;

const existingAt = (db: Db, place: Place, question: ImportedQuestion, occurrence: number) =>
  db
    .selectFrom('question')
    .selectAll()
    .where('owner_id', '=', place.ownerId)
    .where('source_id', '=', place.sourceId)
    .where('source_page', '=', question.page)
    .where('source_number', '=', question.number)
    .where('source_occurrence', '=', occurrence)
    .executeTakeFirst();

/** The answer the user set by hand (M7) survives a re-import unchanged. */
const manualAnswer = (question: ImportedQuestion, existing: NonNullable<Existing>) => ({
  answer_letter: existing.answer_letter,
  answer_letters: existing.answer_letters,
  answer_provenance: existing.answer_provenance,
  answer_evidence: existing.answer_evidence,
  reasons: question.reasons.filter((r) => r !== 'no_answer' && r !== 'ai_suggested'),
  accepted: null,
});

/** When the AI answer the user accepted is suggested again, its acceptance stays (DEC-03). */
function stillAccepted(question: ImportedQuestion, existing: Existing): Date | null {
  const acceptedAt = existing?.ai_answer_accepted_at ?? null;
  if (question.provenance !== 'ai_suggested' || !existing || !acceptedAt) return null;
  return existing.answer_letters.join() === question.answers.join() ? acceptedAt : null;
}

/** The user's own answer and an accepted AI answer survive a re-import (M6.6, M7). */
function answerFields(question: ImportedQuestion, existing: Existing) {
  if (existing?.answer_provenance === 'manual') return manualAnswer(question, existing);
  const accepted = stillAccepted(question, existing);
  return {
    answer_letter: question.answers[0] ?? null,
    answer_letters: question.answers,
    answer_provenance: question.provenance,
    answer_evidence: question.evidence,
    reasons: accepted ? question.reasons.filter((r) => r !== 'ai_suggested') : question.reasons,
    accepted,
  };
}

/** Taxonomy the user chose stays; otherwise a fresh suggestion from the bank's names. */
function placeFields(
  question: ImportedQuestion,
  existing: Existing,
  chapters: readonly ChapterNames[],
) {
  if (existing?.classification === 'manual')
    return {
      chapter_id: existing.chapter_id,
      topic_id: existing.topic_id,
      classification: 'manual',
    };
  const text = `${question.stem} ${question.explanation ?? ''}`;
  const place = suggestPlace(text, chapters);
  return place
    ? { chapter_id: place.chapterId, topic_id: place.topicId, classification: 'suggested' }
    : { chapter_id: null, topic_id: null, classification: 'none' };
}

/** The values an import writes for one question, keeping what the user decided. */
export function importedValues(
  question: ImportedQuestion,
  existing: Existing,
  chapters: readonly ChapterNames[],
) {
  const { reasons, accepted, ...answer } = answerFields(question, existing);
  const status =
    existing?.status === 'excluded'
      ? 'excluded'
      : eligibilityOf({
          kind: question.kind,
          answers: answer.answer_letters,
          provenance: answer.answer_provenance,
          reasons,
          aiAccepted: accepted !== null,
        });
  return {
    kind: question.kind,
    stem: question.stem,
    options: JSON.stringify(question.options),
    multi_select: question.multiSelect,
    explanation: question.explanation,
    ...answer,
    ...placeFields(question, existing, chapters),
    ai_answer_accepted_at: accepted,
    review_reasons: reasons,
    status,
  };
}

/** Replaces the suggested tags of a question; tags the user set by hand stay (FR-11-004). */
export async function writeSuggestedTags(
  db: Db,
  ownerId: string,
  questionId: string,
  tagIds: readonly string[],
) {
  await db
    .deleteFrom('question_tag')
    .where('question_id', '=', questionId)
    .where('origin', '=', 'suggested')
    .execute();
  if (tagIds.length === 0) return;
  await db
    .insertInto('question_tag')
    .values(
      tagIds.map((tag_id) => ({
        question_id: questionId,
        tag_id,
        owner_id: ownerId,
        origin: 'suggested' as const,
      })),
    )
    .onConflict((conflict) => conflict.columns(['question_id', 'tag_id']).doNothing())
    .execute();
}

export { existingAt };
