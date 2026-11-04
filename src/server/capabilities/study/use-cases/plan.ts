import type { DueResponse, MasteryResponse, TopicsResponse } from '../../../../contracts/study.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { PoolQuestion } from '../../questions/index.js';
import { intervalDays, masteryScore, stateOf } from '../domain/mastery.js';
import { groupOf, mixGroups } from '../domain/selection.js';
import type { StudyDeps } from './deps.js';

/** Fewer answered questions than this and a topic's figures are only indicative. */
const SMALL_SAMPLE = 5;

async function banksPool(deps: StudyDeps, actor: Actor, bankIds: readonly string[]) {
  for (const bankId of bankIds)
    if (!isId(bankId) || !(await deps.ownsBank(actor.accountId, bankId))) throw notFound();
  const pool = await deps.questions.studyPool(actor.accountId, { bankIds });
  return {
    pool,
    history: await deps.sessions.attemptHistory(actor.accountId),
    now: deps.clock.now(),
  };
}

/**
 * Today's reviews in the chosen banks (FR-15-005, UI-20, JY-13), soonest due first, each with
 * the run of right answers behind its date. With none due, the new and weak to study instead.
 */
export async function dueToday(
  deps: StudyDeps,
  actor: Actor,
  bankIds: readonly string[],
): Promise<DueResponse> {
  const { pool, history, now } = await banksPool(deps, actor, bankIds);
  const due = pool
    .map((q) => ({ q, attempts: history.get(q.id) ?? [] }))
    .map(({ q, attempts }) => ({ q, state: stateOf(attempts, now) }))
    .filter(({ state }) => state.attempts > 0 && state.isDue)
    .sort((a, b) => (a.state.due?.getTime() ?? 0) - (b.state.due?.getTime() ?? 0));
  const groups = mixGroups(pool, history, now);
  return {
    count: due.length,
    items: due.slice(0, 200).map(({ q, state }) => ({
      questionId: q.id,
      excerpt: q.stem.slice(0, 160),
      chapterId: q.chapterId,
      streak: state.streak,
      intervalDays: intervalDays(state.streak),
      dueAt: (state.due ?? now).toISOString(),
    })),
    alternatives: { new: groups.new.length, weak: groups.weak.length },
  };
}

type Topic = TopicsResponse['topics'][number];

function addTo(
  topic: Topic,
  q: PoolQuestion,
  deps: { attempts: { correct: boolean; at: Date }[]; now: Date },
) {
  const state = stateOf(deps.attempts, deps.now);
  topic.questions += 1;
  if (state.attempts === 0) return;
  topic.mastery =
    (topic.mastery * topic.answered + masteryScore(deps.attempts)) / (topic.answered + 1);
  topic.answered += 1;
  if (groupOf(state) === 'weak') topic.weak += 1;
  if (state.isDue) topic.due += 1;
}

/** Chapters and topics by need (FR-15-006): weak and due first, small samples marked. */
export async function topicPriorities(
  deps: StudyDeps,
  actor: Actor,
  bankIds: readonly string[],
): Promise<TopicsResponse> {
  const { pool, history, now } = await banksPool(deps, actor, bankIds);
  const topics = new Map<string, Topic>();
  for (const q of pool) {
    const key = `${q.chapterId}:${q.topicId}`;
    const topic = topics.get(key) ?? {
      chapterId: q.chapterId,
      topicId: q.topicId,
      questions: 0,
      answered: 0,
      mastery: 0,
      weak: 0,
      due: 0,
      smallSample: true,
    };
    addTo(topic, q, { attempts: [...(history.get(q.id) ?? [])], now });
    topic.smallSample = topic.answered < SMALL_SAMPLE;
    topics.set(key, topic);
  }
  const need = (t: Topic) => t.weak + t.due;
  return {
    topics: [...topics.values()].sort((a, b) => need(b) - need(a) || a.mastery - b.mastery),
  };
}

/** One question's level and date, and what they rest on (FR-15-008). */
export async function questionMastery(
  deps: StudyDeps,
  actor: Actor,
  questionId: string,
): Promise<MasteryResponse> {
  if (!isId(questionId)) throw notFound();
  const attempts = (await deps.sessions.attemptHistory(actor.accountId)).get(questionId) ?? [];
  const state = stateOf(attempts, deps.clock.now());
  return {
    level: state.level,
    streak: state.streak,
    attempts: state.attempts,
    intervalDays: state.attempts > 0 ? intervalDays(state.streak) : null,
    dueAt: state.due?.toISOString() ?? null,
  };
}
