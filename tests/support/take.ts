import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ShareKind } from '../../src/contracts/sharing.js';
import type { Db } from '../../src/server/platform/db/index.js';
import { policyOf, type PolicyChanges } from './channels.js';
import type { createClient } from './client.js';
import { ORIGIN } from './test-app.js';

type Browser = ReturnType<typeof createClient>;
type Kind = ShareKind;

export type { PolicyChanges } from './channels.js';

/** The owner shares the bank (an exam or practice link, or an agent's key), shown once. */
export async function newShare(
  owner: Browser,
  bankId: string,
  kind: Kind,
  changes: PolicyChanges = {},
) {
  const response = await owner.post(`/api/banks/${bankId}/shares`, {
    kind,
    name: `A ${kind} share`,
    policy: policyOf(kind, { presenter: 'Internal Medicine Program', ...changes }),
    rightsConfirmed: true,
  });
  if (response.statusCode !== 201) throw new Error(`share not created: ${response.body}`);
  const body = response.json();
  return { id: body.share.id as string, token: body.secret as string };
}

/** A clock the test moves: the app sees `now()`. */
export function movableClock(start = new Date('2026-12-01T09:00:00Z')) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => void (now = new Date(now.getTime() + ms)),
  };
}

type Method = 'GET' | 'POST' | 'PUT';

/**
 * A person with no account on the take page: the link token for the landing and the start, then
 * the attempt token (kept as a "reloaded" page would) for everything else.
 */
export function takerOf(app: FastifyInstance, linkToken: string) {
  let attemptToken = '';
  const call = (method: Method, url: string, payload?: object) =>
    app.inject({
      method,
      url: `/api/take/v1${url}`,
      headers: attemptToken ? { authorization: `Bearer ${attemptToken}` } : { origin: ORIGIN },
      ...(payload ? { payload } : {}),
    });
  return {
    landing: () => call('GET', `/links/${linkToken}`),
    start: async (person: object) => {
      const response = await call('POST', `/links/${linkToken}/attempts`, person);
      if (response.statusCode === 201) attemptToken = response.json().token;
      return response;
    },
    token: () => attemptToken,
    useToken: (token: string) => void (attemptToken = token),
    state: () => call('GET', '/attempt'),
    item: (position: number | string) => call('GET', `/attempt/items/${position}`),
    choose: (position: number, chosen: string[]) =>
      call('PUT', `/attempt/items/${position}`, { chosen }),
    flag: (position: number, flagged: boolean) =>
      call('POST', `/attempt/items/${position}/flag`, { flagged }),
    submit: () => call('POST', '/attempt/submit', {}),
    result: () => call('GET', '/attempt/result'),
    picture: (id: string) => call('GET', `/attempt/pictures/${id}`),
  };
}

export type Taker = ReturnType<typeof takerOf>;

/** Answers every question of the attempt with the same letters. */
export async function answerAll(taker: Taker, total: number, chosen: string[]) {
  for (let position = 0; position < total; position++) {
    await taker.item(position);
    await taker.choose(position, chosen);
  }
}

/** A figure stored for the question in the test app's data folder, as an import leaves one. */
export async function storeFigure(db: Db, questionId: string) {
  const { owner_id, source_id } = await db
    .selectFrom('question')
    .select(['owner_id', 'source_id'])
    .where('id', '=', questionId)
    .executeTakeFirstOrThrow();
  const [id, blobKey] = [randomUUID(), randomUUID()];
  const dir = resolve(`.data/test-app/${process.pid}`, 'blobs', blobKey.slice(0, 2));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, blobKey), Buffer.from('89504e470d0a1a0a', 'hex'));
  const box = JSON.stringify({ x0: 0, y0: 0, x1: 1, y1: 1 });
  const shape = { position: 0, page: 1, width: 10, height: 10, low_quality: false };
  const figure = { kind: 'figure', modality: null, link: 'certain', quality: '{}' } as const;
  await db
    .insertInto('media')
    .values({
      id,
      owner_id,
      source_id,
      question_id: questionId,
      blob_key: blobKey,
      box,
      ...shape,
      ...figure,
      created_at: new Date(),
    })
    .execute();
  return id;
}
