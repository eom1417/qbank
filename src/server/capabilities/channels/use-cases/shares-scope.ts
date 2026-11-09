import type { ChannelsDeps } from './deps.js';
import { shareOf } from './governance.js';

/** A part of a bank: its chapters (none: the whole bank) and questions named one by one. */
export interface Scope {
  chapterIds: readonly string[];
  fixedQuestionIds: readonly string[];
}

type Placed = { id: string; chapterId: string | null };

/** Whether a question falls inside a scope. */
export const inScope = (scope: Scope, question: Placed) =>
  scope.chapterIds.length === 0 ||
  (question.chapterId !== null && scope.chapterIds.includes(question.chapterId)) ||
  scope.fixedQuestionIds.includes(question.id);

/**
 * The scopes the bank's exam shares reserve (DEC-39): an exam with `reserve` that is not
 * archived keeps its chapters and fixed questions out of every agent share of the bank.
 */
export async function reservedScopes(
  deps: Pick<ChannelsDeps, 'shares'>,
  ownerId: string,
  bankId: string,
): Promise<Scope[]> {
  const exams = await deps.shares.examsOfBank(ownerId, bankId);
  return exams
    .map((row) => shareOf(row).policy.content)
    .filter((content) => content.reserve)
    .map(({ chapterIds, fixedQuestionIds }) => ({ chapterIds, fixedQuestionIds }));
}

/** Whether any of the scopes holds the question. */
export const isReserved = (scopes: readonly Scope[], question: Placed) =>
  scopes.some((scope) => inScope(scope, question));
