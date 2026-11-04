import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';

const { app, seed } = useReviewSuite();

const OPTIONS = [
  { letter: 'A', text: 'Hypokalemia' },
  { letter: 'B', text: 'Hyperkalemia' },
  { letter: 'C', text: 'Hypocalcemia' },
];

describe('editing a question (FR-09-002, FR-09-003, UI-11, UAT-033)', () => {
  it("fixes a missing option from one card; the book's answer stays the book's", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [
      {
        status: 'needs_review',
        reasons: ['too_few_options'],
        options: [{ letter: 'A', label: 'A.', text: 'Only one' }],
      },
    ]);
    const before = (await owner.get(`/api/questions/${id}`)).json();
    const edit = { expectedVersion: before.version, options: OPTIONS, answers: ['B'] };
    const saved = (await owner.patch(`/api/questions/${id}`, edit)).json();
    expect(saved).toMatchObject({
      answers: ['B'],
      provenance: 'source',
      options: [{ letter: 'A', label: 'A.' }, { letter: 'B', label: 'B' }, { letter: 'C' }],
    });
    expect(saved.version).toBeGreaterThan(before.version);
    expect((await owner.post(`/api/questions/${id}/approve`, {})).json().status).toBe('eligible');
  });

  it('refuses an edit over a newer version, answers outside the options, and strangers', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{}]);
    const { version } = (await owner.get(`/api/questions/${id}`)).json();
    await owner.patch(`/api/questions/${id}`, { expectedVersion: version, stem: 'First change?' });
    const stale = await owner.patch(`/api/questions/${id}`, {
      expectedVersion: version,
      stem: 'Second?',
    });
    expect([stale.statusCode, stale.json().error.code]).toEqual([409, 'version_conflict']);
    const current = (await owner.get(`/api/questions/${id}`)).json();
    const outside = await owner.patch(`/api/questions/${id}`, {
      expectedVersion: current.version,
      answers: ['J'],
    });
    expect(outside.json()).toMatchObject({ status: 'needs_review', reviewReasons: ['no_answer'] });
    const { browser: stranger } = await registeredBrowser(app());
    const denied = await stranger.patch(`/api/questions/${id}`, { expectedVersion: 1, stem: 'x' });
    expect(denied.statusCode).toBe(404);
  });
});

describe('newer information (FR-24-002, DEC-16)', () => {
  it('keeps a modern-information note apart from the book answer (FR-24-002)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{}]);
    const { version } = (await owner.get(`/api/questions/${id}`)).json();
    const note = 'Newer guidelines prefer drug X.';
    const saved = (
      await owner.patch(`/api/questions/${id}`, { expectedVersion: version, updateNote: note })
    ).json();
    expect(saved).toMatchObject({
      updateNote: note,
      answers: ['B'],
      provenance: 'source',
      status: 'eligible',
    });
  });
});

describe('history and undo (FR-09-008, FR-08-008)', () => {
  it('changes an answer twice, then brings the first back, with each origin listed', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{}]);
    let question = (await owner.get(`/api/questions/${id}`)).json();
    for (const answers of [['A'], ['C']]) {
      question = (
        await owner.patch(`/api/questions/${id}`, { expectedVersion: question.version, answers })
      ).json();
    }
    const { versions } = (await owner.get(`/api/questions/${id}/history`)).json();
    const recent = versions.slice(0, 2);
    expect(
      recent.map((v: { answers: string[]; origin: string }) => [v.origin, v.answers.join()]),
    ).toEqual([
      ['edit', 'C'],
      ['edit', 'A'],
    ]);
    const first = versions[1].version;
    const restored = (
      await owner.post(`/api/questions/${id}/restore-version`, { version: first })
    ).json();
    expect(restored).toMatchObject({
      answers: ['A'],
      sourceId: question.sourceId,
      page: question.page,
    });
    const latest = (await owner.get(`/api/questions/${id}/history`)).json().versions[0];
    expect(latest.origin).toBe(`restore:${first}`);
  });
});

describe('hiding versus deleting (FR-09-007, FR-01-008)', () => {
  it('shows what a deletion removes, needs an explicit confirmation, then deletes', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{}]);
    await owner.post(`/api/questions/${id}/notes`, { body: 'check' });
    const impact = (await owner.get(`/api/questions/${id}/deletion-impact`)).json();
    expect(impact).toMatchObject({ notes: 1, pictures: 0, reports: 0 });
    expect((await owner.post(`/api/questions/${id}/delete`, {})).statusCode).toBe(400);
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.post(`/api/questions/${id}/delete`, { confirm: true })).statusCode).toBe(
      404,
    );
    expect((await owner.post(`/api/questions/${id}/delete`, { confirm: true })).statusCode).toBe(
      204,
    );
    expect((await owner.get(`/api/questions/${id}`)).statusCode).toBe(404);
  });
});

describe('review notes and study reports (FR-09-009, FR-09-010, UAT-036)', () => {
  it("finds «راجع المصدر» in the owner's notes only", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{}]);
    await owner.post(`/api/questions/${id}/notes`, {
      body: 'راجع المصدر في الصفحة 12',
      labels: ['Source'],
    });
    const found = (
      await owner.get(`/api/review-notes?q=${encodeURIComponent('راجع المصدر')}`)
    ).json();
    expect(found.notes).toHaveLength(1);
    expect((await owner.get('/api/review-notes?q=source')).json().notes[0].labels).toEqual([
      'source',
    ]);
    const { browser: stranger } = await registeredBrowser(app());
    expect(
      (await stranger.get(`/api/review-notes?q=${encodeURIComponent('راجع')}`)).json().notes,
    ).toEqual([]);
  });

  it('a report reaches review and changes neither the answer nor the status', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{}]);
    const reported = await owner.post(`/api/questions/${id}/reports`, {
      kind: 'wrong_key',
      comment: 'I think C',
    });
    expect(reported.statusCode).toBe(201);
    expect((await owner.get(`/api/questions/${id}`)).json()).toMatchObject({
      answers: ['B'],
      status: 'eligible',
    });
    const { items } = (await owner.get(`/api/banks/${bankId}/review`)).json();
    expect(items).toMatchObject([{ id, openReports: 1, reasons: ['reported'], severity: 'high' }]);
    const reportId = reported.json().reports[0].id;
    expect((await owner.post(`/api/reports/${reportId}/resolve`, {})).statusCode).toBe(204);
    expect((await owner.get(`/api/banks/${bankId}/review`)).json().items).toEqual([]);
  });
});
