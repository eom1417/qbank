import type { EditQuestionRequest } from '../../../../contracts/questions.js';
import type { QuestionVersion } from '../../../../contracts/review.js';
import { AppError } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import { editChanges } from '../domain/edit.js';
import { eligibilityOf, type AnswerProvenance } from '../domain/imported.js';
import { getQuestion, owned, type ReviewDeps } from './question-actions.js';

type Row = Awaited<ReturnType<typeof owned>>;

type Chapter = Awaited<ReturnType<ReviewDeps['chaptersOf']>>[number];

/** The chapter the edit leaves the question in; it must be one of the bank's. */
async function chosenChapter(deps: ReviewDeps, actor: Actor, row: Row, edit: EditQuestionRequest) {
  const chapterId = edit.chapterId === undefined ? row.chapter_id : edit.chapterId;
  if (chapterId === null) return { chapterId, chapter: undefined };
  const chapters = await deps.chaptersOf(actor.accountId, row.bank_id);
  const chapter = chapters.find((c) => c.id === chapterId);
  if (!chapter) throw new AppError('validation_failed', { chapterId: 'invalid_value' });
  return { chapterId, chapter };
}

/** A topic named by the edit must be in that chapter; moving chapters drops one it lacks. */
function chosenTopic(chapter: Chapter | undefined, row: Row, edit: EditQuestionRequest) {
  const topicId = edit.topicId === undefined ? row.topic_id : edit.topicId;
  const inChapter = topicId !== null && chapter?.topics.some((t) => t.id === topicId) === true;
  if (edit.topicId !== undefined && topicId !== null && !inChapter)
    throw new AppError('validation_failed', { topicId: 'invalid_value' });
  return inChapter ? topicId : null;
}

async function placeChanges(deps: ReviewDeps, actor: Actor, row: Row, edit: EditQuestionRequest) {
  if (edit.chapterId === undefined && edit.topicId === undefined) return {};
  const { chapterId, chapter } = await chosenChapter(deps, actor, row, edit);
  return {
    chapter_id: chapterId,
    topic_id: chosenTopic(chapter, row, edit),
    classification: 'manual',
  };
}

/** Only the account's own tags can be put on its question. */
async function checkTags(deps: ReviewDeps, actor: Actor, tagIds: readonly string[]) {
  const owned = new Set((await deps.tagsOf(actor.accountId)).map((tag) => tag.id));
  if (!tagIds.every((id) => owned.has(id)))
    throw new AppError('validation_failed', { tagIds: 'invalid_value' });
}

/**
 * The owner's edit (FR-09-003, UI-11), as one new version with origin `edit`. Refused when the
 * question changed since the editor loaded it (another tab), so nothing is overwritten.
 */
export async function editQuestion(
  deps: ReviewDeps,
  actor: Actor,
  id: string,
  edit: EditQuestionRequest,
) {
  const row = await owned(deps, actor, id);
  if (row.version !== edit.expectedVersion) throw new AppError('version_conflict');
  const options = row.options as { letter: string; label: string; text: string }[];
  const content = editChanges({ ...row, options }, edit);
  const place = await placeChanges(deps, actor, row, edit);
  if (edit.tagIds) {
    await checkTags(deps, actor, edit.tagIds);
    await deps.review.setTags(actor.accountId, id, edit.tagIds);
  }
  await deps.questions.updateQuestion(
    actor.accountId,
    id,
    { ...content, ...place },
    edit.fromAiSuggestion ? 'ai_fix' : 'edit',
    deps.clock.now(),
  );
  return getQuestion(deps, actor, id);
}

interface Snapshot {
  stem: string;
  options: { letter: string; label?: string; text: string }[];
  answer_letters: string[];
  answer_provenance: AnswerProvenance;
  answer_evidence: string | null;
  explanation: string | null;
  update_note?: string | null;
  multi_select: boolean;
  chapter_id: string | null;
  topic_id: string | null;
  status: string;
  review_reasons: string[];
}

/** The question's saved versions, newest first, each with what made it (FR-09-008). */
export async function history(deps: ReviewDeps, actor: Actor, id: string) {
  await owned(deps, actor, id);
  const rows = await deps.review.versionsOf(actor.accountId, id);
  const versions: QuestionVersion[] = rows.map((row) => {
    const snapshot = row.snapshot as Snapshot;
    return {
      version: row.version,
      origin: row.origin,
      createdAt: row.created_at.toISOString(),
      stem: snapshot.stem,
      options: snapshot.options.map((o) => ({ letter: o.letter, text: o.text })),
      answers: snapshot.answer_letters,
      provenance: snapshot.answer_provenance,
      explanation: snapshot.explanation,
      updateNote: snapshot.update_note ?? null,
      status: snapshot.status,
    };
  });
  return { versions };
}

/**
 * Brings back an earlier version's content as a new version (`restore`): nothing is lost, the
 * source attribution is untouched, and an excluded question stays excluded.
 */
export async function restoreVersion(deps: ReviewDeps, actor: Actor, id: string, version: number) {
  const row = await owned(deps, actor, id);
  const found = (await deps.review.versionsOf(actor.accountId, id)).find(
    (v) => v.version === version,
  );
  if (!found) throw new AppError('not_found');
  const s = found.snapshot as Snapshot;
  const aiAccepted = s.answer_provenance === 'ai_suggested' && row.ai_answer_accepted_at !== null;
  const status =
    row.status === 'excluded'
      ? 'excluded'
      : eligibilityOf({
          kind: row.kind,
          answers: s.answer_letters,
          provenance: s.answer_provenance,
          reasons: s.review_reasons,
          aiAccepted,
        });
  const changes = {
    stem: s.stem,
    options: JSON.stringify(s.options),
    answer_letters: s.answer_letters,
    answer_letter: s.answer_letters[0] ?? null,
    answer_provenance: s.answer_provenance,
    answer_evidence: s.answer_evidence,
    explanation: s.explanation,
    update_note: s.update_note ?? null,
    multi_select: s.multi_select,
    chapter_id: s.chapter_id,
    topic_id: s.topic_id,
    review_reasons: s.review_reasons,
    status,
  };
  await deps.questions.updateQuestion(
    actor.accountId,
    id,
    changes,
    `restore:${version}`,
    deps.clock.now(),
  );
  return getQuestion(deps, actor, id);
}

/** What a permanent deletion would remove, for the confirmation (FR-09-007). */
export async function deletionImpact(deps: ReviewDeps, actor: Actor, id: string) {
  await owned(deps, actor, id);
  return deps.review.deletionImpact(actor.accountId, id);
}

/** Deletes the question for good, with its pictures' stored files. */
export async function deleteQuestion(deps: ReviewDeps, actor: Actor, id: string) {
  await owned(deps, actor, id);
  const blobs = await deps.review.deleteQuestion(actor.accountId, id);
  for (const key of blobs) await deps.deleteBlob(key);
}
