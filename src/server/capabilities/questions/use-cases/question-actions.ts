import type { QuestionResponse } from '../../../../contracts/questions.js';
import type { Clock } from '../../../platform/clock.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { QuestionRepository, QuestionRow } from '../adapters/question-repository.js';
import { acceptAiAnswer } from '../domain/accept-ai.js';

export interface QuestionsDeps {
  questions: QuestionRepository;
  clock: Clock;
}

export function toQuestionResponse(row: QuestionRow): QuestionResponse {
  return {
    id: row.id,
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
    difficulty: { kind: row.difficulty_kind, value: row.difficulty },
    version: row.version,
  };
}

async function owned(deps: QuestionsDeps, actor: Actor, id: string) {
  const row = isId(id) ? await deps.questions.findQuestion(actor.accountId, id) : undefined;
  if (!row) throw notFound();
  return row;
}

export const getQuestion = async (deps: QuestionsDeps, actor: Actor, id: string) =>
  toQuestionResponse(await owned(deps, actor, id));

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
