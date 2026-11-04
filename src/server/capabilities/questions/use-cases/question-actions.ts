import type { QuestionResponse } from '../../../../contracts/questions.js';
import type { Clock } from '../../../platform/clock.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { MediaRepository } from '../adapters/media-repository.js';
import type { QuestionRepository, QuestionRow } from '../adapters/question-repository.js';
import { acceptAiAnswer } from '../domain/accept-ai.js';
import type { ChapterNames } from '../domain/classify.js';
import type { NoteRepository } from '../adapters/note-repository.js';
import type { ReportRepository } from '../adapters/report-repository.js';
import type { ReviewRepository } from '../adapters/review-repository.js';

export interface QuestionsDeps {
  questions: QuestionRepository;
  media: Pick<MediaRepository, 'mediaOfQuestion'>;
  clock: Clock;
}

/** What review and editing use besides the questions themselves (M7). */
export interface ReviewDeps extends QuestionsDeps {
  review: ReviewRepository;
  notes: NoteRepository;
  reports: ReportRepository;
  newId: () => string;
  /** Removes a deleted question's stored pictures. */
  deleteBlob(key: string): Promise<void>;
  ownsBank(ownerId: string, bankId: string): Promise<boolean>;
  /** The bank's chapters and the account's tags, from the library, to check an edit. */
  chaptersOf(ownerId: string, bankId: string): Promise<readonly ChapterNames[]>;
  tagsOf(ownerId: string): Promise<readonly { id: string; name: string }[]>;
}

function toQuestionResponse(
  row: QuestionRow,
  tags: QuestionResponse['tags'],
  pictures: QuestionResponse['pictures'],
): QuestionResponse {
  return {
    id: row.id,
    bankId: row.bank_id,
    sourceId: row.source_id,
    number: row.source_number,
    page: row.source_page,
    kind: row.kind,
    stem: row.stem,
    options: row.options as QuestionResponse['options'],
    multiSelect: row.multi_select,
    answers: row.answer_letters,
    provenance: row.answer_provenance,
    evidence: row.answer_evidence,
    aiAccepted: row.ai_answer_accepted_at !== null,
    explanation: row.explanation,
    status: row.status,
    reviewReasons: row.review_reasons,
    chapterId: row.chapter_id,
    topicId: row.topic_id,
    classification: row.classification,
    tags,
    difficulty: { kind: row.difficulty_kind, value: row.difficulty },
    updateNote: row.update_note,
    deferred: row.deferred_at !== null,
    pictures,
    version: row.version,
  };
}

/** The actor's own question, or the neutral not-found (anyone else's is invisible). */
export async function owned(deps: QuestionsDeps, actor: Actor, id: string) {
  const row = isId(id) ? await deps.questions.findQuestion(actor.accountId, id) : undefined;
  if (!row) throw notFound();
  return row;
}

export async function getQuestion(deps: QuestionsDeps, actor: Actor, id: string) {
  const row = await owned(deps, actor, id);
  const tags = await deps.questions.tagsOfQuestion(actor.accountId, id);
  const media = await deps.media.mediaOfQuestion(actor.accountId, id);
  return toQuestionResponse(
    row,
    tags.map((tag) => ({ id: tag.tag_id, origin: tag.origin })),
    media.map((m) => ({
      id: m.id,
      kind: m.kind,
      certain: m.link === 'certain',
      lowQuality: m.low_quality,
      width: m.width,
      height: m.height,
    })),
  );
}

/** Accepts the AI's suggested answer for the actor's own question (M6.6). */
export async function acceptSuggestedAnswer(deps: QuestionsDeps, actor: Actor, id: string) {
  const row = await owned(deps, actor, id);
  const changes = acceptAiAnswer(row, deps.clock.now());
  if (!changes) throw new AppError('not_retryable');
  await deps.questions.updateQuestion(
    actor.accountId,
    id,
    changes,
    'ai_accepted',
    deps.clock.now(),
  );
  return getQuestion(deps, actor, id);
}
