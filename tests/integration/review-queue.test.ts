import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';

const { app, seed } = useReviewSuite();

describe('the review queue (FR-09-001, UI-10, UAT-032)', () => {
  it('lists questions in review, the scientific risks first, deferred ones last', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [scan, conflict, deferred, missing] = await seed(owner, bankId, [
      { status: 'needs_review', reasons: ['ocr_page'] },
      { status: 'needs_review', reasons: ['key_conflict'], provenance: 'conflict' },
      { status: 'needs_review', reasons: ['no_answer'], answers: [], provenance: 'missing' },
      { status: 'needs_review', reasons: ['media_not_kept'] },
      { status: 'eligible' },
    ]);
    await owner.post(`/api/questions/${deferred}/defer`, {});
    const { items } = (await owner.get(`/api/banks/${bankId}/review`)).json();
    expect(items.map((i: { id: string }) => i.id)).toEqual([conflict, missing, scan, deferred]);
    expect(items[0]).toMatchObject({ severity: 'high', reasons: ['key_conflict'] });
    expect(items[3]).toMatchObject({ deferred: true, severity: 'high' });
  });

  it("is another account's bank: not found", async () => {
    const { bankId } = await ownerWithBank(app());
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.get(`/api/banks/${bankId}/review`)).statusCode).toBe(404);
    const bulk = await stranger.post(`/api/banks/${bankId}/review/approve-safe`, {});
    expect(bulk.statusCode).toBe(404);
  });
});

describe('approving, excluding and restoring (FR-09-004, UAT-035)', () => {
  it('approves a complete question, refuses one without an answer', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [ok, noAnswer] = await seed(owner, bankId, [
      { status: 'needs_review', reasons: ['ocr_page'] },
      { status: 'needs_review', reasons: ['no_answer'], answers: [], provenance: 'missing' },
    ]);
    const approved = (await owner.post(`/api/questions/${ok}/approve`, {})).json();
    expect(approved).toMatchObject({ status: 'eligible', reviewReasons: [] });
    const refused = await owner.post(`/api/questions/${noAnswer}/approve`, {});
    expect([refused.statusCode, refused.json().error.code]).toEqual([409, 'not_approvable']);
  });

  it('an excluded question comes back to review, and is studied only once approved again', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{ status: 'eligible' }]);
    expect((await owner.post(`/api/questions/${id}/exclude`, {})).json().status).toBe('excluded');
    const back = (await owner.post(`/api/questions/${id}/restore`, {})).json();
    expect(back).toMatchObject({ status: 'needs_review', reviewReasons: ['restored'] });
    expect((await owner.post(`/api/questions/${id}/approve`, {})).json().status).toBe('eligible');
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.post(`/api/questions/${id}/exclude`, {})).statusCode).toBe(404);
  });
});

describe('safe bulk approval (FR-09-006, FR-08-007, UAT-034)', () => {
  it('a batch of 40 with 4 problems leaves 36 eligible and the 4 in review', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const safe = Array.from({ length: 36 }, () => ({
      status: 'needs_review' as const,
      reasons: ['ocr_page'],
    }));
    const problems = [
      {
        status: 'needs_review' as const,
        reasons: ['key_conflict'],
        provenance: 'conflict' as const,
      },
      {
        status: 'needs_review' as const,
        reasons: ['no_answer'],
        answers: [],
        provenance: 'missing' as const,
      },
      {
        status: 'needs_review' as const,
        reasons: ['ai_suggested'],
        provenance: 'ai_suggested' as const,
      },
      { status: 'needs_review' as const, reasons: ['media_not_kept'] },
    ];
    await seed(owner, bankId, [...safe, ...problems]);
    const result = (await owner.post(`/api/banks/${bankId}/review/approve-safe`, {})).json();
    expect(result).toEqual({ approved: 36, keptForReview: 4 });
    const { items } = (await owner.get(`/api/banks/${bankId}/review`)).json();
    expect(items).toHaveLength(4);
  });
});
