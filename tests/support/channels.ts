import type { FastifyInstance } from 'fastify';
import type { createClient } from './client.js';

type Browser = ReturnType<typeof createClient>;

/** A channel the owner sets up on the bank; its key is in the answer only (DEC-36). */
export async function newChannel(
  owner: Browser,
  bankId: string,
  settings: Partial<{ chapterIds: string[]; batchSize: number; whenDone: string }> = {},
) {
  const response = await owner.post(`/api/banks/${bankId}/channels`, {
    name: 'Daily three',
    chapterIds: [],
    batchSize: 3,
    whenDone: 'restart',
    ...settings,
  });
  const body = response.json();
  return { response, id: body.channel.id as string, key: body.key as string, body };
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
