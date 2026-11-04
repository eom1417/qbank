import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { seedQuestions } from '../support/questions.js';
import { useTestApp } from '../support/test-app.js';

const fakeHost = useFakeAiHost();
const app = useTestApp({ aiHost: () => fakeHost().settings });

const PAGE_WORDS = 'Serum potassium is 7.2 mmol/L. Which ECG change is typical?'.split(' ');

/** The page as an import read it: one line of words, for the seeded question's source. */
async function readPage(questionId: string) {
  const db = app.db();
  const q = await db
    .selectFrom('question')
    .selectAll()
    .where('id', '=', questionId)
    .executeTakeFirstOrThrow();
  const jobId = randomUUID();
  const now = new Date();
  await db
    .insertInto('import_job')
    .values({
      id: jobId,
      owner_id: q.owner_id,
      source_id: q.source_id,
      stage: 'needs_review',
      pages_total: 1,
      created_at: now,
      updated_at: now,
      ai_provider_id: null,
      ai_outcome: null,
      error_code: null,
      locked_until: null,
      finished_at: now,
    })
    .execute();
  const words = PAGE_WORDS.map((text, i) => ({
    text,
    font: null,
    box: { x0: 10 + i * 60, y0: 100, x1: 60 + i * 60, y1: 112 },
  }));
  await db
    .insertInto('import_page')
    .values({
      job_id: jobId,
      page_no: q.source_page,
      status: 'done',
      reading: 'ocr',
      warning: null,
      content: JSON.stringify({ page: q.source_page, width: 800, height: 1000, words }),
    })
    .execute();
}

describe("the AI's fix suggestion, compared before it is applied (FR-09-005, M7.4)", () => {
  it('suggests the misread unit with evidence from the page; applying it is an `ai_fix` edit', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seedQuestions(app.db(), owner, bankId, [
      { stem: 'Serum potassium is 7.2 rnmol/L. Which ECG change is typical?' },
    ]);
    await readPage(id ?? '');
    const suggestion = (
      await owner.post(`/api/questions/${id}/fix-suggestion`, { instanceId: FAKE_INSTANCES.fixer })
    ).json();
    expect(suggestion).toMatchObject({
      outcome: 'suggested',
      stem: expect.stringContaining('mmol/L'),
    });
    const question = (await owner.get(`/api/questions/${id}`)).json();
    expect(question.stem).toContain('rnmol');
    const edit = {
      expectedVersion: question.version,
      stem: suggestion.stem,
      fromAiSuggestion: true,
    };
    expect((await owner.patch(`/api/questions/${id}`, edit)).json().stem).toContain('mmol/L');
    const { versions } = (await owner.get(`/api/questions/${id}/history`)).json();
    expect(versions[0].origin).toBe('ai_fix');
  });

  it('refuses without the page text, with an unusable AI, and for strangers', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seedQuestions(app.db(), owner, bankId, [{}]);
    const ask = (instanceId: string) =>
      owner.post(`/api/questions/${id}/fix-suggestion`, { instanceId });
    expect((await ask(FAKE_INSTANCES.fixer)).json()).toEqual({
      outcome: 'refused',
      why: 'no_page_text',
    });
    expect((await ask(FAKE_INSTANCES.disabled)).statusCode).toBe(400);
    await readPage(id ?? '');
    expect((await ask(FAKE_INSTANCES.refusing)).json()).toEqual({
      outcome: 'failed',
      failure: 'invalid_key',
    });
    const { browser: stranger } = await registeredBrowser(app());
    const denied = await stranger.post(`/api/questions/${id}/fix-suggestion`, {
      instanceId: FAKE_INSTANCES.fixer,
    });
    expect(denied.statusCode).toBe(404);
  });
});
