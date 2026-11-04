import type { TransferRequest, TransferResponse } from '../../../../contracts/duplicates.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import { detectDuplicates, type DuplicateDeps } from './duplicates.js';
import { owned } from './question-actions.js';

/** The chapters and topics are the old bank's: in the new bank the question starts unplaced. */
const UNPLACED = { chapter_id: null, topic_id: null, classification: 'none' } as const;

/**
 * Moves or copies the owner's questions to another of their banks (FR-03-009), then looks for
 * duplicates there, so the owner is told before anything is studied twice.
 */
export async function transferQuestions(
  deps: DuplicateDeps,
  actor: Actor,
  request: TransferRequest,
): Promise<TransferResponse> {
  const owner = actor.accountId;
  if (!(await deps.ownsBank(owner, request.targetBankId))) throw notFound();
  const rows = await Promise.all(request.questionIds.map((id) => owned(deps, actor, id)));
  if (rows.some((row) => row.bank_id === request.targetBankId))
    throw new AppError('validation_failed', { targetBankId: 'invalid_value' });
  const now = deps.clock.now();
  const ids: string[] = [];
  for (const row of rows) {
    if (request.mode === 'move') {
      await deps.questions.updateQuestion(
        owner,
        row.id,
        { bank_id: request.targetBankId, ...UNPLACED },
        'move',
        now,
      );
      ids.push(row.id);
    } else
      ids.push(
        await deps.questions.copyQuestion(owner, row.id, request.targetBankId, deps.newId(), now),
      );
  }
  if (request.mode === 'move') await deps.pairs.forgetPairsOf(owner, ids);
  const before = (await deps.pairs.pairsOfBank(owner, request.targetBankId)).length;
  await detectDuplicates(deps, { ownerId: owner, bankId: request.targetBankId }, ids, now);
  const after = (await deps.pairs.pairsOfBank(owner, request.targetBankId)).length;
  return { transferred: ids.length, duplicates: after - before };
}

/**
 * The owner's choice after a re-import read an edited question differently (FR-10-006): keep
 * their text, or take the new reading. Either way the comparison is settled.
 */
export async function chooseReimport(
  deps: DuplicateDeps,
  actor: Actor,
  id: string,
  use: 'new' | 'mine',
) {
  const row = await owned(deps, actor, id);
  const fresh = row.reimport_text as {
    stem: string;
    options: unknown[];
    explanation: string | null;
  } | null;
  if (!fresh) throw new AppError('not_retryable');
  const reasons = row.review_reasons.filter((r) => r !== 'reimport_differs');
  const text =
    use === 'new'
      ? { stem: fresh.stem, options: JSON.stringify(fresh.options), explanation: fresh.explanation }
      : {};
  const changes = { ...text, reimport_text: null, review_reasons: reasons };
  await deps.questions.updateQuestion(
    actor.accountId,
    id,
    changes,
    use === 'new' ? 'reimport' : 'edit',
    deps.clock.now(),
  );
}
