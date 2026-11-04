import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser, type createClient } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';
import { seedQuestions } from '../support/questions.js';

const { app, fixtures } = useImportSuite();
type Browser = ReturnType<typeof createClient>;

const counts = async (owner: Browser, bankId: string) =>
  (await owner.get(`/api/banks/${bankId}/sources`))
    .json()
    .sources.map((s: { questions: { total: number; eligible: number } }) => s.questions);

describe('the same file twice (FR-10-001, UAT-037)', () => {
  it('the second copy waits as duplicates, so nothing is studied twice', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await uploadFile(app(), owner.cookie(), bankId, fixtures().english);
    await runImports(app());
    await owner.post(`/api/banks/${bankId}/review/approve-safe`, {});
    const eligibleOnce = (await counts(owner, bankId))[0].eligible;
    await uploadFile(app(), owner.cookie(), bankId, fixtures().english);
    await runImports(app());
    const [second, first] = await counts(owner, bankId);
    expect([first.eligible, second.eligible]).toEqual([eligibleOnce, 0]);
    const { pairs } = (await owner.get(`/api/banks/${bankId}/duplicates`)).json();
    expect(pairs.length).toBe(first.total);
    expect(pairs.every((p: { kind: string }) => p.kind === 'exact')).toBe(true);
    const { items } = (await owner.get(`/api/banks/${bankId}/review`)).json();
    expect(
      items.filter((i: { reasons: string[] }) => i.reasons.includes('duplicate')),
    ).toHaveLength(first.total);
  });
});

describe("similar questions and the owner's decisions (FR-10-002…004, UAT-038, UAT-039)", () => {
  const stem = 'All of the following cause hyperkalemia in patients with renal failure';

  it('a question that adds "except" is similar, names the difference, and is never merged', async () => {
    const { owner, bankId } = await ownerWithBank(app(), 'A');
    const other = (await owner.post('/api/banks', { name: 'B' })).json().id as string;
    await seedQuestions(app.db(), owner, bankId, [{ stem }]);
    const [except] = await seedQuestions(app.db(), owner, other, [{ stem: `${stem} except` }]);
    const copied = (
      await owner.post('/api/questions/transfer', {
        questionIds: [except],
        targetBankId: bankId,
        mode: 'copy',
      })
    ).json();
    expect(copied).toEqual({ transferred: 1, duplicates: 1 });
    const [pair] = (await owner.get(`/api/banks/${bankId}/duplicates`)).json().pairs;
    expect(pair).toMatchObject({ kind: 'similar', differences: ['except'], decision: null });
    expect([pair.a.status, pair.b.status]).toEqual(['eligible', 'eligible']);
    expect(pair.a.fileName).toBe('seeded.pdf');
  });
});

describe('deciding a pair (FR-10-004, UAT-039)', () => {
  const stem = 'All of the following cause hyperkalemia in patients with renal failure';

  it('different approved answers are never settled silently; the reference hides the other', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const other = (await owner.post('/api/banks', { name: 'Second book' })).json().id as string;
    const [first] = await seedQuestions(app.db(), owner, bankId, [{ stem, answers: ['B'] }]);
    const [second] = await seedQuestions(app.db(), owner, other, [{ stem, answers: ['C'] }]);
    await owner.post('/api/questions/transfer', {
      questionIds: [second],
      targetBankId: bankId,
      mode: 'move',
    });
    const [pair] = (await owner.get(`/api/banks/${bankId}/duplicates`)).json().pairs;
    expect(pair).toMatchObject({ kind: 'exact', answersDiffer: true });
    const decide = (body: object) => owner.post(`/api/duplicates/${pair.id}/decision`, body);
    const silent = await decide({ decision: 'reference', questionId: first });
    expect([silent.statusCode, silent.json().error.code]).toEqual([409, 'answers_differ']);
    expect(
      (
        await decide({
          decision: 'reference',
          questionId: first,
          acknowledgeDifferentAnswers: true,
        })
      ).statusCode,
    ).toBe(204);
    expect((await owner.get(`/api/questions/${second}`)).json()).toMatchObject({
      status: 'excluded',
      number: 1,
    });
    expect((await owner.get(`/api/questions/${first}`)).json()).toMatchObject({
      status: 'eligible',
      reviewReasons: [],
    });
  });
});

describe('keeping both, and who may decide', () => {
  const stem = 'All of the following cause hyperkalemia in patients with renal failure';

  it('keeping both settles the duplicate; strangers cannot see or decide', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const other = (await owner.post('/api/banks', { name: 'Copy' })).json().id as string;
    const [one] = await seedQuestions(app.db(), owner, other, [{ stem }]);
    await seedQuestions(app.db(), owner, bankId, [{ stem }]);
    await owner.post('/api/questions/transfer', {
      questionIds: [one],
      targetBankId: bankId,
      mode: 'move',
    });
    expect((await owner.get(`/api/questions/${one}`)).json()).toMatchObject({
      status: 'needs_review',
      reviewReasons: ['duplicate'],
    });
    const [pair] = (await owner.get(`/api/banks/${bankId}/duplicates`)).json().pairs;
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.get(`/api/banks/${bankId}/duplicates`)).statusCode).toBe(404);
    expect(
      (await stranger.post(`/api/duplicates/${pair.id}/decision`, { decision: 'kept_both' }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await stranger.post('/api/questions/transfer', {
          questionIds: [one],
          targetBankId: other,
          mode: 'copy',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await owner.post(`/api/duplicates/${pair.id}/decision`, { decision: 'kept_both' }))
        .statusCode,
    ).toBe(204);
    expect((await owner.get(`/api/questions/${one}`)).json()).toMatchObject({
      status: 'eligible',
      bankId,
    });
  });
});
