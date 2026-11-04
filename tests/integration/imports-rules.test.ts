import { describe, expect, it } from 'vitest';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { ownerWithBank, registeredBrowser, type createClient } from '../support/client.js';
import { blobCount, runImports, uploadFile, useImportSuite } from '../support/imports.js';

const fakeHost = useFakeAiHost();
const { app, fixtures } = useImportSuite({ aiHost: () => fakeHost().settings });
type Browser = ReturnType<typeof createClient>;

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
    expect((await stranger.get(`/api/banks/${bankId}/sources`)).statusCode).toBe(404);
    expect((await stranger.get('/api/imports/recent')).json().imports).toEqual([]);
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

describe('deleting the original file (FR-19-001)', () => {
  it('erases the stored file on request and keeps the questions; only the owner can', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const queued = (await uploadFile(app(), owner.cookie(), bankId, fixtures().arabic)).json();
    const remove = (browser: Browser) => browser.delete(`/api/sources/${queued.sourceId}/original`);
    expect((await remove(owner)).statusCode).toBe(409);
    await runImports(app());
    const { browser: stranger } = await registeredBrowser(app());
    expect((await remove(stranger)).statusCode).toBe(404);
    const before = blobCount();
    expect((await remove(owner)).statusCode).toBe(204);
    expect(blobCount()).toBe(before - 1);
    const { sources } = (await owner.get(`/api/banks/${bankId}/sources`)).json();
    expect(sources).toMatchObject([{ hasOriginal: false, questions: { total: 3 } }]);
    const retry = await owner.post(`/api/imports/${queued.id}/retry`, {});
    expect([retry.statusCode, retry.json().error.code]).toEqual([409, 'original_deleted']);
  });
});

const ownerWithAi = () => ownerWithBank(app());

/** Imports the Arabic fixture with the given AI connection and runs it. */
async function importWithAi(owner: Browser, bankId: string, providerId: string) {
  const started = await uploadFile(app(), owner.cookie(), bankId, fixtures().arabic, {
    aiProviderId: providerId,
  });
  await runImports(app());
  return started.json() as { id: string; sourceId: string };
}

describe("the user's AI on top of the rules (cascade, DEC-30)", () => {
  it('suggests answers for undecided questions only, with their own provenance', async () => {
    const { owner, bankId } = await ownerWithAi();
    const job = await importWithAi(owner, bankId, FAKE_INSTANCES.vision);
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
    expect(fakeHost().asks.at(-1)?.ownerSession).toMatch(/^account:/);
  });

  it('a signed-out provider keeps the rules result and says why (JY-14, UAT-084)', async () => {
    const { owner, bankId } = await ownerWithAi();
    const job = await importWithAi(owner, bankId, FAKE_INSTANCES.refusing);
    expect((await owner.get(`/api/imports/${job.id}`)).json()).toMatchObject({
      stage: 'needs_review',
      aiOutcome: 'invalid_key',
      questionsFound: 3,
    });
    fakeHost().refusing.delete(FAKE_INSTANCES.refusing);
    await owner.post(`/api/imports/${job.id}/retry`, {});
    await runImports(app());
    expect((await owner.get(`/api/imports/${job.id}`)).json()).toMatchObject({
      aiOutcome: 'done',
      questionsFound: 3,
    });
    fakeHost().refusing.add(FAKE_INSTANCES.refusing);
  });
});

describe('choosing the AI for an import', () => {
  it('refuses an instance the kit has turned off or does not know', async () => {
    const { owner, bankId } = await ownerWithAi();
    for (const instance of [FAKE_INSTANCES.disabled, 'no-such-instance']) {
      const refused = await uploadFile(app(), owner.cookie(), bankId, fixtures().arabic, {
        aiProviderId: instance,
      });
      expect([refused.statusCode, refused.json().error.fields]).toEqual([
        400,
        { aiProviderId: 'invalid_value' },
      ]);
    }
  });
});

describe('choosing the model for an import', () => {
  it('reads with the model chosen, keeps it for a retry, and refuses one not offered', async () => {
    const { owner, bankId } = await ownerWithAi();
    const upload = (aiModel: string) =>
      uploadFile(app(), owner.cookie(), bankId, fixtures().arabic, {
        aiProviderId: FAKE_INSTANCES.vision,
        aiModel,
      });
    const refused = await upload('not-offered');
    expect([refused.statusCode, refused.json().error.fields]).toEqual([
      400,
      { aiProviderId: 'invalid_value' },
    ]);
    const job = (await upload('fake-small')).json() as { id: string };
    await runImports(app());
    expect(fakeHost().asks.at(-1)?.body.model).toBe('fake-small');
    const asked = fakeHost().asks.length;
    await owner.post(`/api/imports/${job.id}/retry`, {});
    await runImports(app());
    const retried = fakeHost().asks.slice(asked);
    expect(retried.length).toBeGreaterThan(0);
    expect(retried.every((ask) => ask.body.model === 'fake-small')).toBe(true);
  });
});

describe("accepting the AI's suggested answer (M6.6, DEC-03)", () => {
  it('makes the question eligible, keeps the AI badge, and only for its owner', async () => {
    const { owner, bankId } = await ownerWithAi();
    const job = await importWithAi(owner, bankId, FAKE_INSTANCES.vision);
    const [first, , essay] = await app
      .db()
      .selectFrom('question')
      .select('id')
      .where('source_id', '=', job.sourceId)
      .orderBy('source_seq')
      .execute();
    const accept = (browser: Browser) =>
      browser.post(`/api/questions/${first?.id}/accept-ai-answer`, {});
    const { browser: stranger } = await registeredBrowser(app());
    expect((await accept(stranger)).statusCode).toBe(404);
    expect((await accept(owner)).json()).toMatchObject({
      provenance: 'ai_suggested',
      aiAccepted: true,
      status: 'eligible',
      reviewReasons: [],
      version: 2,
    });
    const refused = await owner.post(`/api/questions/${essay?.id}/accept-ai-answer`, {});
    expect(refused.statusCode).toBe(409);
  });
});

describe('notices of ended imports (FR-22-003)', () => {
  it('lists the owner’s ended imports with their honest stage, not a queued one', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const job = (await uploadFile(app(), owner.cookie(), bankId, fixtures().english)).json();
    expect((await owner.get('/api/imports/recent')).json().imports).toEqual([]);
    await runImports(app());
    const { imports } = (await owner.get('/api/imports/recent')).json();
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({ id: job.id, fileName: expect.any(String) });
    expect(imports[0].stage).not.toBe('queued');
  });
});
