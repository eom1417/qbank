import type { DuplicatePair, PairDecisionRequest } from '../../../../contracts/duplicates.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { PairRepository, PairRow } from '../adapters/pair-repository.js';
import type { QuestionRepository } from '../adapters/question-repository.js';
import { findPairs } from '../domain/duplicates.js';
import { eligibilityOf } from '../domain/imported.js';
import type { ReviewDeps } from './question-actions.js';

export interface DuplicateDeps extends ReviewDeps {
  pairs: PairRepository;
}

type Options = { letter: string; text: string }[];

/** Settles or raises the `duplicate` reason, keeping eligibility honest (FR-10-001). */
async function setDuplicateReason(
  questions: QuestionRepository,
  ownerId: string,
  id: string,
  present: boolean,
  now: Date,
) {
  const row = await questions.findQuestion(ownerId, id);
  if (!row) return;
  const others = row.review_reasons.filter((r) => r !== 'duplicate');
  const reasons = present ? [...others, 'duplicate'] : others;
  const status =
    row.status === 'excluded'
      ? 'excluded'
      : eligibilityOf({
          kind: row.kind,
          answers: row.answer_letters,
          provenance: row.answer_provenance,
          reasons,
          aiAccepted: row.ai_answer_accepted_at !== null,
        });
  await questions.updateQuestion(
    ownerId,
    id,
    { review_reasons: reasons, status },
    'duplicate',
    now,
  );
}

/**
 * After new questions arrive in a bank (an import, a move, a copy): records the pairs it has
 * with earlier ones. An exact copy waits for the owner, so the same book twice never doubles
 * what is studied (FR-10-001, UAT-037); a similar one is listed, never merged (FR-10-002).
 */
export async function detectDuplicates(
  deps: Pick<DuplicateDeps, 'pairs' | 'questions'>,
  place: { ownerId: string; bankId: string },
  addedIds: readonly string[],
  now: Date,
) {
  if (addedIds.length === 0) return;
  const added = new Set(addedIds);
  const texts = (await deps.pairs.bankTexts(place.ownerId, place.bankId)).map((row) => ({
    ...row,
    options: row.options as Options,
  }));
  const pairs = findPairs(
    texts.filter((q) => !added.has(q.id)),
    texts.filter((q) => added.has(q.id)),
  );
  await deps.pairs.savePairs(place.ownerId, place.bankId, pairs, now);
  for (const pair of pairs.filter((p) => p.kind === 'exact'))
    await setDuplicateReason(deps.questions, place.ownerId, pair.b, true, now);
}

function side(row: PairRow, prefix: 'qa' | 'qb') {
  const value = <K extends string>(key: K) =>
    (row as unknown as Record<string, unknown>)[`${prefix}_${key}`];
  return {
    id: value('id') as string,
    stem: value('stem') as string,
    options: (value('options') as Options).map((o) => ({ letter: o.letter, text: o.text })),
    answers: value('answers') as string[],
    provenance: value('provenance') as string,
    status: value('status') as string,
    page: value('page') as number,
    number: value('number') as number,
    fileName: value('file') as string,
  };
}

/** The bank's duplicate pairs for the comparison screen (UI-12, FR-10-003). */
export async function listPairs(deps: DuplicateDeps, actor: Actor, bankId: string) {
  if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
  const rows = await deps.pairs.pairsOfBank(actor.accountId, bankId);
  const pairs: DuplicatePair[] = rows.map((row) => {
    const a = side(row, 'qa');
    const b = side(row, 'qb');
    return {
      id: row.id,
      kind: row.kind,
      similarity: row.similarity,
      differences: row.differences,
      decision: row.decision,
      answersDiffer: a.answers.join() !== b.answers.join(),
      a,
      b,
    };
  });
  return { pairs };
}

/**
 * The owner's decision on a pair (FR-10-004): keep both, make one the reference (the other is
 * hidden from study and remembers which one it repeats), or hide one. Different approved
 * answers are never settled silently (UAT-039).
 */
export async function decidePair(
  deps: DuplicateDeps,
  actor: Actor,
  pairId: string,
  input: PairDecisionRequest,
) {
  const pair = isId(pairId) ? await deps.pairs.findPair(actor.accountId, pairId) : undefined;
  if (!pair) throw notFound();
  const ids = [pair.question_a, pair.question_b];
  const now = deps.clock.now();
  const owner = actor.accountId;
  if (input.decision !== 'kept_both' && !ids.includes(input.questionId))
    throw new AppError('validation_failed', { questionId: 'invalid_value' });
  if (input.decision === 'reference') await makeReference(deps, owner, ids, input, now);
  if (input.decision === 'excluded')
    await deps.questions.updateQuestion(
      owner,
      input.questionId,
      { status: 'excluded' },
      'duplicate',
      now,
    );
  for (const id of ids) await setDuplicateReason(deps.questions, owner, id, false, now);
  await deps.pairs.recordDecision(pair.id, input.decision, now);
}

async function makeReference(
  deps: DuplicateDeps,
  ownerId: string,
  ids: string[],
  input: Extract<PairDecisionRequest, { decision: 'reference' }>,
  now: Date,
) {
  const rows = await Promise.all(ids.map((id) => deps.questions.findQuestion(ownerId, id)));
  const [a, b] = rows;
  if (!a || !b) throw notFound();
  if (a.answer_letters.join() !== b.answer_letters.join() && !input.acknowledgeDifferentAnswers)
    throw new AppError('answers_differ');
  const other = input.questionId === a.id ? b : a;
  await deps.questions.updateQuestion(
    ownerId,
    other.id,
    { status: 'excluded', duplicate_of: input.questionId },
    'duplicate',
    now,
  );
}
