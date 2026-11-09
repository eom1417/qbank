import type { FastifyInstance } from 'fastify';
import { DEFAULT_POLICIES } from '../../src/contracts/sharing.js';
import type { Db } from '../../src/server/platform/db/index.js';
import { ownerWithBank, type createClient } from './client.js';
import type { useReviewSuite } from './questions.js';

type Browser = ReturnType<typeof createClient>;

type Policy = (typeof DEFAULT_POLICIES)['agent'];
type Kind = keyof typeof DEFAULT_POLICIES;

/** A policy section by section over the kind's default (DEC-39). */
export type PolicyChanges = { [K in keyof Policy]?: Partial<Policy[K]> };

/**
 * A policy for tests: the kind's default with the given changes. People's shares ask one
 * question unless a test says otherwise, so a small test bank can hold a whole attempt.
 */
export function policyOf(kind: Kind, changes: PolicyChanges = {}): Policy {
  const preset = DEFAULT_POLICIES[kind];
  const size = kind === 'agent' ? preset.content.size : 1;
  const base = { ...preset, content: { ...preset.content, size } };
  return {
    ...base,
    ...(changes.presenter !== undefined ? { presenter: changes.presenter as string } : {}),
    content: { ...base.content, ...changes.content },
    audience: { ...base.audience, ...changes.audience } as Policy['audience'],
    limits: { ...base.limits, ...changes.limits },
    reveal: { ...base.reveal, ...changes.reveal },
    records: { ...base.records, ...changes.records },
  };
}

/** A share the owner sets up on the bank; its secret is in the answer only (DEC-39). */
export async function newShare(
  owner: Browser,
  bankId: string,
  kind: Kind = 'agent',
  changes: PolicyChanges = {},
) {
  const response = await owner.post(`/api/banks/${bankId}/shares`, {
    kind,
    name: 'Daily three',
    policy: policyOf(kind, changes),
    rightsConfirmed: true,
  });
  const body = response.json();
  return { response, id: body.share?.id as string, key: body.secret as string, body };
}

/** An agent share in the old channel's terms (DEC-36): its key is in the answer only. */
export function newChannel(
  owner: Browser,
  bankId: string,
  settings: Partial<{ chapterIds: string[]; batchSize: number; whenDone: 'restart' | 'stop' }> = {},
) {
  const content = {
    ...(settings.chapterIds ? { chapterIds: settings.chapterIds } : {}),
    ...(settings.batchSize ? { size: settings.batchSize } : {}),
    ...(settings.whenDone ? { whenDone: settings.whenDone } : {}),
  };
  return newShare(owner, bankId, 'agent', { content });
}

/** An owner and a bank with `count` ready questions, in the suite's app. */
export async function bankWith({ app, seed }: ReturnType<typeof useReviewSuite>, count: number) {
  const { owner, bankId } = await ownerWithBank(app());
  const ids = await seed(
    owner,
    bankId,
    Array.from({ length: count }, (_, i) => ({ stem: `Question ${i + 1}?`, answers: ['B'] })),
  );
  return { owner, bankId, ids };
}

/** An outside agent holding a channel's key: no cookie, no Origin, just the key. */
export function agentOf(app: FastifyInstance, key: string) {
  const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${key}` },
      ...(payload ? { payload } : {}),
    });
  return {
    batch: (payload: object = {}) => call('POST', '/api/channel/v1/batches', payload),
    answers: (batchId: string) => call('GET', `/api/channel/v1/batches/${batchId}/answers`),
    answer: (payload: object) => call('POST', '/api/channel/v1/answers', payload),
    stats: () => call('GET', '/api/channel/v1/stats'),
    picture: (id: string) => call('GET', `/api/channel/v1/pictures/${id}`),
  };
}

export const questionIdsOf = (batch: { questions: { questionId: string }[] }) =>
  batch.questions.map((q) => q.questionId);

/**
 * The owner's own study as it stands (numbers, the session's answers, marks, the questions):
 * equal before and after a share is used proves the share never touches study (DEC-36, DEC-39).
 */
export async function studySnapshot(
  db: Db,
  owner: Browser,
  study: { bankId: string; sessionId: string; questionIds: string[] },
) {
  const ids = study.questionIds;
  return {
    summary: (await owner.get(`/api/analytics/summary?bankId=${study.bankId}`)).json(),
    items: await db
      .selectFrom('study_item')
      .selectAll()
      .where('session_id', '=', study.sessionId)
      .execute(),
    marks: await db
      .selectFrom('question_mark')
      .selectAll()
      .where('question_id', 'in', ids)
      .execute(),
    questions: await db
      .selectFrom('question')
      .select(['id', 'version', 'difficulty', 'difficulty_kind', 'status'])
      .where('id', 'in', ids)
      .orderBy('id')
      .execute(),
  };
}
