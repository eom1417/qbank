import type { createClient } from './client.js';

type Browser = ReturnType<typeof createClient>;

/** Starts a Tutor session over one bank and returns its id. */
export async function startTutor(owner: Browser, bankId: string, size: number, kind = 'random') {
  const response = await owner.post('/api/study/sessions', {
    scope: { bankIds: [bankId] },
    kind,
    size,
    mode: 'tutor',
  });
  return response.json().id as string;
}

/** The session's question at a position. */
export const itemAt = (owner: Browser, sessionId: string, position: number) =>
  owner.get(`/api/study/sessions/${sessionId}/items/${position}`);

/** Answers with the letters given (the seeded key is B). */
export const answer = (owner: Browser, sessionId: string, position: number, chosen: string[]) =>
  owner.post(`/api/study/sessions/${sessionId}/items/${position}/answer`, { chosen, seconds: 7 });
