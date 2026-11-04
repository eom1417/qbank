import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, startTutor } from '../support/study.js';

// One suite for the whole audit: every account below shares its database.
const suite = useReviewSuite();
const { app, seed } = suite;

describe('a denied link reveals nothing (FR-20-001, FR-20-008, FR-02-004, UAT-076)', () => {
  it("answers every route to another account's things with the same neutral not-found", async () => {
    const { owner, bankId } = await ownerWithBank(app(), 'Secret Cardiology Notes');
    const [questionId] = await seed(owner, bankId, [
      { stem: 'Confidential stem about patient X?' },
    ]);
    await owner.post(`/api/questions/${questionId}/notes`, { body: 'private note' });
    const sessionId = await startTutor(owner, bankId, 1);
    await answer(owner, sessionId, 0, ['B']);
    const { browser: stranger } = await registeredBrowser(app());
    const paths = [
      `/api/banks/${bankId}`,
      `/api/banks/${bankId}/sources`,
      `/api/banks/${bankId}/review`,
      `/api/banks/${bankId}/duplicates`,
      `/api/banks/${bankId}/export/preview`,
      `/api/banks/${bankId}/deletion-impact`,
      `/api/analytics/summary?bankId=${bankId}`,
      `/api/questions/${questionId}`,
      `/api/questions/${questionId}/history`,
      `/api/questions/${questionId}/notes`,
      `/api/questions/${questionId}/reports`,
      `/api/study/sessions/${sessionId}`,
      `/api/study/sessions/${sessionId}/items/0`,
      `/api/study/sessions/${sessionId}/summary`,
    ];
    for (const path of paths) {
      const response = await stranger.get(path);
      expect([path, response.statusCode]).toEqual([path, 404]);
      expect(response.json()).toEqual({ error: { code: 'not_found' } });
    }
    const leaks = await Promise.all([
      stranger.get('/api/search?q=Confidential'),
      stranger.get('/api/review-notes?q=private'),
    ]);
    for (const response of leaks)
      expect(response.body).not.toMatch(/Confidential|private note|Secret Cardiology/);
  });
});

describe('reminders and support (FR-22-004, FR-22-007)', () => {
  it('keeps reminders off until the owner turns them on', async () => {
    const { owner } = await ownerWithBank(app());
    const saved = async () => (await owner.get('/api/auth/me')).json().preferences.reviewReminders;
    expect(await saved()).toBe('off');
    expect((await owner.patch('/api/account', { reviewReminders: 'weekly' })).statusCode).toBe(200);
    expect(await saved()).toBe('weekly');
    expect((await owner.patch('/api/account', { reviewReminders: 'hourly' })).statusCode).toBe(400);
  });

  it('builds a support report with counts only, never content', async () => {
    const { owner, bankId } = await ownerWithBank(app(), 'Secret Cardiology Notes');
    await seed(owner, bankId, [{ stem: 'Confidential stem about patient X?' }]);
    const report = await owner.get('/api/support/report');
    expect(report.statusCode).toBe(200);
    expect(report.json()).toMatchObject({ banks: 1, questions: expect.any(Object) });
    expect(report.body).not.toMatch(/Confidential|Secret Cardiology|@/);
  });
});
