import { describe, expect, it } from 'vitest';
import { ownerWithBank, type createClient } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

const { app, fixtures } = useImportSuite();
type Browser = ReturnType<typeof createClient>;

const rows = (sourceId: string) =>
  app
    .db()
    .selectFrom('question')
    .selectAll()
    .where('source_id', '=', sourceId)
    .orderBy('source_seq')
    .execute();

async function imported(
  owner: Browser,
  bankId: string,
  file: string,
  fields: Record<string, string> = {},
) {
  const started = await uploadFile(app(), owner.cookie(), bankId, file, fields);
  await runImports(app());
  return { started, job: (await owner.get(`/api/imports/${started.json().id}`)).json() };
}

describe('answer keys in the source (M6.2, M6.4, M6.5, M6.7, M6.8, M6.11)', () => {
  it('beside the question, after each chapter, at the end; conflicts and gaps go to review', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const chapter = (
      await owner.post(`/api/banks/${bankId}/chapters`, { name: 'Cardiology' })
    ).json();
    const topic = (
      await owner.post(`/api/chapters/${chapter.id}/topics`, { name: 'Heart murmurs' })
    ).json();
    const { job } = await imported(owner, bankId, fixtures().keys);
    const saved = await rows(job.sourceId);
    expect(
      saved.map((q) => [q.source_number, q.answer_letters.join(), q.answer_provenance, q.status]),
    ).toEqual([
      [1, 'B', 'source', 'eligible'],
      [2, 'A', 'conflict', 'needs_review'],
      [3, '', 'missing', 'needs_review'],
      [4, 'A,C', 'source', 'eligible'],
      [5, 'A', 'source', 'eligible'],
      [1, 'C', 'source', 'eligible'],
      [2, 'B', 'source', 'eligible'],
    ]);
    expect(saved[1]).toMatchObject({
      review_reasons: ['explanation_conflict'],
      explanation: 'The correct answer is C because adrenaline reverses shock.',
    });
    expect(saved[3]?.multi_select).toBe(true);
    expect(saved[0]).toMatchObject({
      topic_id: topic.id,
      chapter_id: chapter.id,
      classification: 'suggested',
    });
    const { sources } = (await owner.get(`/api/banks/${bankId}/sources`)).json();
    expect(sources[0].questions).toEqual({ total: 7, needsReview: 2, eligible: 5 });
  });
});

describe("versions and the user's own answers (M6.1)", () => {
  it('keeps every change as a version, and a retry keeps the answer the user set', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const { job } = await imported(owner, bankId, fixtures().keys);
    const third = (await rows(job.sourceId))[2];
    await app
      .db()
      .updateTable('question')
      .set({ answer_letters: ['A'], answer_letter: 'A', answer_provenance: 'manual' })
      .where('id', '=', third?.id ?? '')
      .execute();
    await owner.post(`/api/imports/${job.id}/retry`, {});
    await runImports(app());
    const again = (await rows(job.sourceId))[2];
    expect([again?.answer_letters, again?.answer_provenance, again?.status]).toEqual([
      ['A'],
      'manual',
      'eligible',
    ]);
    const versions = await app
      .db()
      .selectFrom('question_version')
      .select('origin')
      .where('question_id', '=', third?.id ?? '')
      .execute();
    expect(versions.map((v) => v.origin)).toEqual(['import', 'import']);
  });
});

describe('a separate answer file (M6.3, JY-03, UAT-013)', () => {
  it('answers the chosen source by number; a letter it lacks is a conflict', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const { job: questions } = await imported(owner, bankId, fixtures().english);
    const { job } = await imported(owner, bankId, fixtures().answersOnly, {
      sourceType: 'answer_key',
      answersFor: questions.sourceId,
    });
    expect(job).toMatchObject({ stage: 'needs_review', questionsFound: 7, questionsReview: 1 });
    const saved = await rows(questions.sourceId);
    const q = (n: number) => saved.find((row) => row.source_number === n);
    expect([q(1)?.answer_letters, q(1)?.answer_evidence, q(1)?.status]).toEqual([
      ['A'],
      'answer_file',
      'eligible',
    ]);
    expect([q(5)?.kind, q(5)?.answer_letters]).toEqual(['essay', []]);
    expect([q(8)?.answer_provenance, q(8)?.review_reasons]).toEqual(['conflict', ['key_conflict']]);
  });

  it('must name a question source of the same bank', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const other = await ownerWithBank(app());
    const { job } = await imported(other.owner, other.bankId, fixtures().english);
    for (const answersFor of [undefined, job.sourceId]) {
      const fields = { sourceType: 'answer_key', ...(answersFor ? { answersFor } : {}) };
      const refused = await uploadFile(
        app(),
        owner.cookie(),
        bankId,
        fixtures().answersOnly,
        fields,
      );
      expect([refused.statusCode, refused.json().error.fields]).toEqual([
        400,
        { answersFor: 'invalid_value' },
      ]);
    }
  });
});

describe('the original file after import (M6.12, DEC-13, DEC-14)', () => {
  it('is erased on its own once its stated period ends; questions stay', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const { job } = await imported(owner, bankId, fixtures().arabic);
    const listed = async () => (await owner.get(`/api/banks/${bankId}/sources`)).json().sources[0];
    const expires = new Date((await listed()).originalExpiresAt).getTime();
    expect(Math.round((expires - Date.now()) / 86_400_000)).toBe(7);
    await app
      .db()
      .updateTable('source')
      .set({ original_expires_at: new Date(0) })
      .where('id', '=', job.sourceId)
      .execute();
    await runImports(app());
    expect(await listed()).toMatchObject({
      hasOriginal: false,
      originalExpiresAt: null,
      questions: { total: 3 },
    });
  });
});
