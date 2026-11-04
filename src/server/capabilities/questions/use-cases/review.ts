import type { BulkApproveResponse, ReviewItem } from '../../../../contracts/review.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { ReviewItemRow } from '../adapters/review-repository.js';
import {
  approvalOf,
  isSafeToApproveInBulk,
  questionSeverity,
  severityRank,
} from '../domain/review.js';
import { eligibilityOf } from '../domain/imported.js';
import { getQuestion, owned, type ReviewDeps } from './question-actions.js';

const EXCERPT = 160;

/** Another account's bank, or no bank at all, is the neutral not-found. */
async function ownedBank(deps: ReviewDeps, actor: Actor, bankId: string) {
  if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
}

function toItem(row: ReviewItemRow): ReviewItem {
  const openReports = Number(row.open_reports);
  const reasons = openReports > 0 ? [...row.review_reasons, 'reported'] : row.review_reasons;
  return {
    id: row.id,
    sourceId: row.source_id,
    page: row.source_page,
    number: row.source_number,
    kind: row.kind,
    excerpt: row.stem.slice(0, EXCERPT),
    status: row.status,
    reasons,
    severity: questionSeverity(reasons),
    provenance: row.answer_provenance,
    deferred: row.deferred_at !== null,
    openReports,
  };
}

/** The bank's review queue (FR-09-001, UI-10): worst first, the book's order, deferred last. */
export async function reviewQueue(deps: ReviewDeps, actor: Actor, bankId: string) {
  await ownedBank(deps, actor, bankId);
  const rows = await deps.review.reviewItems(actor.accountId, bankId);
  const order = (row: ReviewItemRow) => row.source_seq;
  const items = rows
    .sort((a, b) => a.source_id.localeCompare(b.source_id) || order(a) - order(b))
    .map(toItem)
    .sort(
      (a, b) =>
        Number(a.deferred) - Number(b.deferred) ||
        severityRank(b.severity) - severityRank(a.severity),
    );
  return { items };
}

/** The owner approves one question (FR-09-004); one that cannot be studied yet is refused. */
export async function approve(deps: ReviewDeps, actor: Actor, id: string) {
  const row = await owned(deps, actor, id);
  const changes = approvalOf(
    { ...row, options: row.options as { letter: string; text: string }[] },
    deps.clock.now(),
  );
  if (!changes) throw new AppError('not_approvable');
  await deps.questions.updateQuestion(actor.accountId, id, changes, 'approve', deps.clock.now());
  return getQuestion(deps, actor, id);
}

/** Leaves the question in review for later; it moves to the end of the queue. */
export async function defer(deps: ReviewDeps, actor: Actor, id: string) {
  await owned(deps, actor, id);
  const now = deps.clock.now();
  await deps.questions.updateQuestion(actor.accountId, id, { deferred_at: now }, 'defer', now);
  return getQuestion(deps, actor, id);
}

/** Hides the question from study (FR-09-007): nothing is deleted, and it can come back. */
export async function exclude(deps: ReviewDeps, actor: Actor, id: string) {
  await owned(deps, actor, id);
  const now = deps.clock.now();
  await deps.questions.updateQuestion(actor.accountId, id, { status: 'excluded' }, 'exclude', now);
  return getQuestion(deps, actor, id);
}

/**
 * Brings an excluded question back to review (UAT-035): it is studied again only after the
 * owner approves it again.
 */
export async function restore(deps: ReviewDeps, actor: Actor, id: string) {
  const row = await owned(deps, actor, id);
  if (row.status !== 'excluded') throw new AppError('not_retryable');
  const status = eligibilityOf({
    kind: row.kind,
    answers: row.answer_letters,
    provenance: row.answer_provenance,
    reasons: ['restored'],
    aiAccepted: row.ai_answer_accepted_at !== null,
  });
  const changes = { status, review_reasons: [...row.review_reasons, 'restored'] };
  await deps.questions.updateQuestion(actor.accountId, id, changes, 'restore', deps.clock.now());
  return getQuestion(deps, actor, id);
}

/**
 * Safe bulk approval (FR-09-006, FR-08-007): approves only complete questions with a trusted
 * answer and harmless notes; conflicts and missing parts stay for the owner (UAT-034).
 */
export async function approveSafe(
  deps: ReviewDeps,
  actor: Actor,
  bankId: string,
  questionIds: readonly string[] | undefined,
): Promise<BulkApproveResponse> {
  await ownedBank(deps, actor, bankId);
  const wanted = questionIds ? new Set(questionIds) : null;
  const rows = (await deps.review.reviewQuestionsOfBank(actor.accountId, bankId)).filter(
    (row) => !wanted || wanted.has(row.id),
  );
  const now = deps.clock.now();
  let approved = 0;
  for (const row of rows) {
    const question = { ...row, options: row.options as { letter: string; text: string }[] };
    const changes = isSafeToApproveInBulk(question) ? approvalOf(question, now) : null;
    if (!changes) continue;
    await deps.questions.updateQuestion(actor.accountId, row.id, changes, 'bulk_approve', now);
    approved += 1;
  }
  return { approved, keptForReview: rows.length - approved };
}
