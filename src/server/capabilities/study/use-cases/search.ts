import type { SearchQuery, SearchResponse } from '../../../../contracts/analytics.js';
import { notFound } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import { stateOf, type QuestionState } from '../domain/mastery.js';
import type { StudyDeps } from './deps.js';

/** The review filters that depend on the owner's answers (FR-17-006). */
const BY_HISTORY: Record<string, (state: QuestionState) => boolean> = {
  wrong: (s) => s.lastCorrect === false,
  unanswered: (s) => s.attempts === 0,
  due: (s) => s.attempts > 0 && s.isDue,
};

/**
 * Searches the owner's questions (FR-03-005, FR-17-001, UI-22): words in the text, options,
 * notes, tags, file and bank names, narrowed by place, marks and review state; never another
 * account's. Opening a result is reading, not an attempt (FR-17-005).
 */
export async function search(
  deps: StudyDeps,
  actor: Actor,
  query: SearchQuery,
): Promise<SearchResponse> {
  if (query.bankId && !(await deps.ownsBank(actor.accountId, query.bankId))) throw notFound();
  const rows = await deps.questions.searchQuestions(actor.accountId, {
    text: query.q,
    bankId: query.bankId,
    chapterId: query.chapterId,
    sourceId: query.sourceId,
    tagId: query.tagId,
    status: query.status,
    flagged: query.flagged === 'true',
    favorite: query.favorite === 'true',
    deferred: query.review === 'deferred',
    noAnswer: query.review === 'no_answer',
  });
  const byHistory = query.review ? BY_HISTORY[query.review] : undefined;
  const history = byHistory ? await deps.sessions.attemptHistory(actor.accountId) : null;
  const now = deps.clock.now();
  const kept =
    byHistory && history
      ? rows.filter((r) => byHistory(stateOf(history.get(r.id) ?? [], now)))
      : rows;
  return {
    total: kept.length,
    results: kept.map((r) => ({
      id: r.id,
      bankId: r.bank_id,
      excerpt: r.stem.slice(0, 200),
      page: r.source_page,
      number: r.source_number,
      status: r.status,
    })),
  };
}
