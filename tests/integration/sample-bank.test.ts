import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { runImports, useImportSuite } from '../support/imports.js';

const { app } = useImportSuite();

describe('the sample bank (M28.1)', () => {
  it('imports ten questions ready to study, each with its answer and explanation', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const started = await owner.post(`/api/banks/${bankId}/imports/sample`, {});
    expect(started.statusCode).toBe(201);
    await runImports(app());
    const job = (await owner.get(`/api/imports/${started.json().id}`)).json();
    expect([job.questionsFound, job.errorCode, job.aiOutcome]).toEqual([10, null, 'not_used']);
    const rows = await app
      .db()
      .selectFrom('question')
      .select(['status', 'answer_letters', 'explanation'])
      .where('source_id', '=', job.sourceId)
      .execute();
    expect(rows.filter((q) => q.status === 'eligible')).toHaveLength(10);
    expect(rows.every((q) => q.answer_letters.length === 1 && q.explanation)).toBe(true);
    const session = await owner.post('/api/study/sessions', {
      scope: { bankIds: [bankId] },
      kind: 'random',
      size: 10,
      mode: 'tutor',
    });
    expect(session.statusCode).toBe(201);
  });

  it("refuses another account's bank", async () => {
    const { bankId } = await ownerWithBank(app());
    const { browser: stranger } = await registeredBrowser(app());
    const refused = await stranger.post(`/api/banks/${bankId}/imports/sample`, {});
    expect(refused.statusCode).toBe(404);
  });
});
