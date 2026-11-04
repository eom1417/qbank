import { zipSync, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser, type createClient } from '../support/client.js';
import { restoreZip, runImports, uploadFile, useImportSuite } from '../support/imports.js';
import { seedQuestions } from '../support/questions.js';
import { answer, startTutor } from '../support/study.js';

const { app, fixtures } = useImportSuite();
type Browser = ReturnType<typeof createClient>;

async function exportZip(owner: Browser, bankId: string, chapters = '') {
  const response = await app().inject({
    url: `/api/banks/${bankId}/export${chapters}`,
    headers: { cookie: owner.cookie() },
  });
  return { response, files: unzipSync(new Uint8Array(response.rawPayload)) };
}

const restore = (owner: Browser, bytes: Uint8Array) => restoreZip(app(), owner.cookie(), bytes);

describe('exporting a bank (FR-18-001…006, UAT-069…071)', () => {
  it('holds the questions, options and pictures, no secrets, and only the chosen chapters', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await uploadFile(app(), owner.cookie(), bankId, fixtures().arabic);
    await runImports(app());
    const preview = (await owner.get(`/api/banks/${bankId}/export/preview`)).json();
    expect(preview).toMatchObject({
      questions: 3,
      sources: 1,
      notIncluded: expect.arrayContaining(['ai_sign_ins_and_keys', 'original_files']),
    });
    const { response, files } = await exportZip(owner, bankId);
    expect(response.headers['content-type']).toBe('application/zip');
    const json = new TextDecoder().decode(files['qbank-export.json']);
    const file = JSON.parse(json);
    expect(file.questions).toHaveLength(3);
    expect(file.questions[0].options.length).toBeGreaterThan(0);
    for (const picture of file.questions.flatMap(
      (q: { pictures: { file: string }[] }) => q.pictures,
    ))
      expect(files[picture.file]).toBeDefined();
    expect(json).not.toMatch(/token|password|apiKey|secret/i);
    const chapter = (
      await owner.post(`/api/banks/${bankId}/chapters`, { name: 'Empty chapter' })
    ).json();
    expect(
      (await owner.get(`/api/banks/${bankId}/export/preview?chapterIds=${chapter.id}`)).json()
        .questions,
    ).toBe(0);
    const { browser: stranger } = await registeredBrowser(app());
    expect(
      (
        await app().inject({
          url: `/api/banks/${bankId}/export`,
          headers: { cookie: stranger.cookie() },
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe('restoring an export (FR-18-005)', () => {
  it('brings the bank back as a new one with its questions, and refuses broken or foreign files', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await uploadFile(app(), owner.cookie(), bankId, fixtures().arabic);
    await runImports(app());
    const { response } = await exportZip(owner, bankId);
    const restored = await restore(owner, new Uint8Array(response.rawPayload));
    expect(restored.statusCode).toBe(201);
    expect(restored.json()).toMatchObject({ questions: 3, skipped: 0, missingPictures: 0 });
    const newBank = restored.json().bankId;
    expect(newBank).not.toBe(bankId);
    expect(
      (await owner.get(`/api/analytics/summary?bankId=${newBank}`)).json().questions.total,
    ).toBe(3);
    const bad = await restore(
      owner,
      zipSync({ 'qbank-export.json': new TextEncoder().encode('{"format":"other"}') }),
    );
    expect([bad.statusCode, bad.json().error.code]).toEqual([415, 'file_unsupported']);
    const notZip = await restore(owner, new TextEncoder().encode('not a zip at all'));
    expect(notZip.json().error.code).toBe('file_corrupt');
  });
});

describe('deleting a bank, then the account (FR-19-005…007, UAT-074, UAT-075, JY-16)', () => {
  it("shows the impact, deletes only that bank, and leaves bank B's results whole", async () => {
    const { owner, bankId: a } = await ownerWithBank(app(), 'A');
    const b = (await owner.post('/api/banks', { name: 'B' })).json().id as string;
    await seedQuestions(app.db(), owner, a, [{ stem: 'In A?' }]);
    await seedQuestions(app.db(), owner, b, [{ stem: 'In B?' }]);
    for (const bank of [a, b]) {
      const id = await startTutor(owner, bank, 1);
      await answer(owner, id, 0, ['B']);
    }
    const impact = (await owner.get(`/api/banks/${a}/deletion-impact`)).json();
    expect(impact).toEqual({
      questions: 1,
      pictures: 0,
      sources: 1,
      notes: 0,
      sessions: 1,
      activeSessions: 1,
    });
    expect((await owner.post(`/api/banks/${a}/delete`, {})).statusCode).toBe(400);
    expect((await owner.post(`/api/banks/${a}/delete`, { confirm: true })).statusCode).toBe(204);
    expect((await owner.get(`/api/banks/${a}`)).statusCode).toBe(404);
    const summaryB = (await owner.get(`/api/analytics/summary?bankId=${b}`)).json();
    expect(summaryB).toMatchObject({ questions: { total: 1 }, accuracy: { part: 1, whole: 1 } });
    expect((await owner.get('/api/analytics/sessions')).json().sessions).toHaveLength(1);
    const done = (await owner.post('/api/account/delete', { confirm: true })).json();
    expect(done).toEqual({
      complete: true,
      steps: [
        { step: 'banks', done: true },
        { step: 'files', done: true },
        { step: 'account', done: true },
      ],
    });
    expect((await owner.get('/api/auth/me')).statusCode).toBe(401);
  });
});
