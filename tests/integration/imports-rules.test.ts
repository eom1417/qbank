import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FAKE_KEYS, FAKE_MODELS, startFakeAiServer } from '../support/fake-ai-server.js';
import { ownerWithBank, registeredBrowser, type createClient } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

const { app, fixtures } = useImportSuite();
type Browser = ReturnType<typeof createClient>;
let fake: Awaited<ReturnType<typeof startFakeAiServer>>;
beforeAll(async () => {
  fake = await startFakeAiServer();
});
afterAll(() => fake.close());

const blobCount = () => {
  try {
    return readdirSync(`.data/test-app/${process.pid}/blobs`, { recursive: true }).filter(
      (name) => String(name).length > 30,
    ).length;
  } catch {
    return 0;
  }
};

describe('files that cannot be imported are refused clearly (FR-23-001, UAT-019)', () => {
  it.each([
    ['text', 415, 'file_unsupported'],
    ['damaged', 422, 'file_corrupt'],
    ['protectedPdf', 422, 'file_protected'],
  ] as const)('%s → %i %s, nothing kept', async (name, status, code) => {
    const { owner, bankId } = await ownerWithBank(app());
    const before = blobCount();
    const refused = await uploadFile(app(), owner.cookie(), bankId, fixtures()[name]);
    expect([refused.statusCode, refused.json().error.code]).toEqual([status, code]);
    expect(blobCount()).toBe(before);
    expect((await owner.get(`/api/banks/${bankId}/sources`)).json().sources).toEqual([]);
  });

  it('needs the usage-rights confirmation and a page range inside the file', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    expect(
      (
        await uploadFile(app(), owner.cookie(), bankId, fixtures().english, {
          rightsConfirmed: 'false',
        })
      ).statusCode,
    ).toBe(400);
    const range = await uploadFile(app(), owner.cookie(), bankId, fixtures().english, {
      pageFrom: '2',
      pageTo: '9',
    });
    expect([range.statusCode, range.json().error.fields]).toEqual([400, { pageTo: 'too_big' }]);
  });
});

describe('ownership and lifecycle', () => {
  it("cannot upload into, read, retry or cancel another account's imports", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const job = (await uploadFile(app(), owner.cookie(), bankId, fixtures().english)).json();
    const { browser: stranger } = await registeredBrowser(app());
    expect(
      (await uploadFile(app(), stranger.cookie(), bankId, fixtures().english)).statusCode,
    ).toBe(404);
    expect((await stranger.get(`/api/imports/${job.id}`)).statusCode).toBe(404);
    expect((await stranger.post(`/api/imports/${job.id}/retry`, {})).statusCode).toBe(404);
    expect((await stranger.delete(`/api/imports/${job.id}`)).statusCode).toBe(404);
    expect((await stranger.get(`/api/banks/${bankId}/sources`)).json().sources).toEqual([]);
  });

  it('a file can be removed before its import starts, not after (FR-04-008)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const before = blobCount();
    const queued = (await uploadFile(app(), owner.cookie(), bankId, fixtures().english)).json();
    expect((await owner.delete(`/api/imports/${queued.id}`)).statusCode).toBe(204);
    expect((await owner.get(`/api/imports/${queued.id}`)).statusCode).toBe(404);
    expect(blobCount()).toBe(before);
    const done = (await uploadFile(app(), owner.cookie(), bankId, fixtures().arabic)).json();
    await runImports(app());
    expect((await owner.delete(`/api/imports/${done.id}`)).statusCode).toBe(409);
  });
});

async function withProvider(apiKey: string) {
  const { owner, bankId } = await ownerWithBank(app());
  const body = {
    kind: 'openai_compatible',
    label: 'Vision',
    model: FAKE_MODELS.vision,
    baseUrl: fake.url,
    apiKey,
    acknowledgeDisclosure: true,
  };
  const provider = (await owner.post('/api/ai/providers', body)).json();
  return { owner, bankId, providerId: provider.id as string };
}

/** Imports the Arabic fixture with the given AI connection and runs it. */
async function importWithAi(owner: Browser, bankId: string, providerId: string) {
  const started = await uploadFile(app(), owner.cookie(), bankId, fixtures().arabic, {
    aiProviderId: providerId,
  });
  await runImports(app());
  return started.json() as { id: string; sourceId: string };
}

describe("the user's AI on top of the rules (cascade)", () => {
  it('suggests answers for undecided questions only, with their own provenance', async () => {
    const { owner, bankId, providerId } = await withProvider(FAKE_KEYS.valid);
    const job = await importWithAi(owner, bankId, providerId);
    expect((await owner.get(`/api/imports/${job.id}`)).json()).toMatchObject({
      stage: 'needs_review',
      aiOutcome: 'done',
    });
    const rows = await app
      .db()
      .selectFrom('question')
      .selectAll()
      .where('source_id', '=', job.sourceId)
      .orderBy('source_number')
      .execute();
    expect(rows.map((q) => [q.answer_letter, q.answer_provenance, q.review_reasons])).toEqual([
      ['A', 'ai_suggested', ['ai_suggested']],
      ['A', 'ai_suggested', ['ai_suggested']],
      [null, 'missing', ['essay']],
    ]);
  });

  it('a key that stops working keeps the rules result and says why (JY-14, UAT-084)', async () => {
    const { owner, bankId, providerId } = await withProvider('sk-expired-key-000');
    const job = await importWithAi(owner, bankId, providerId);
    const report = (await owner.get(`/api/imports/${job.id}`)).json();
    expect(report).toMatchObject({
      stage: 'needs_review',
      aiOutcome: 'invalid_key',
      questionsFound: 3,
    });
    await owner.patch(`/api/ai/providers/${providerId}`, { apiKey: FAKE_KEYS.valid });
    await owner.post(`/api/imports/${job.id}/retry`, {});
    await runImports(app());
    expect((await owner.get(`/api/imports/${job.id}`)).json()).toMatchObject({
      aiOutcome: 'done',
      questionsFound: 3,
    });
  });
});

describe('AI cost approval', () => {
  it('asks for approval above the user limits before using AI (DEC-18, FR-22-008)', async () => {
    const { owner, bankId, providerId } = await withProvider(FAKE_KEYS.valid);
    await owner.patch('/api/ai/settings', { approvalPages: 1 });
    const refused = await uploadFile(app(), owner.cookie(), bankId, fixtures().english, {
      aiProviderId: providerId,
    });
    expect([refused.statusCode, refused.json().error]).toEqual([
      409,
      { code: 'approval_required', fields: { over_page_limit: 'required' } },
    ]);
    const approved = await uploadFile(app(), owner.cookie(), bankId, fixtures().english, {
      aiProviderId: providerId,
      aiApproved: 'true',
    });
    expect(approved.statusCode).toBe(201);
  });
});
