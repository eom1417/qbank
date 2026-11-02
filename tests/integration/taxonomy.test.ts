import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

const app = useTestApp();

describe('chapters and topics (FR-03-003, FR-11-003)', () => {
  it('adds chapters in order with their topics', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const endocrine = (
      await owner.post(`/api/banks/${bankId}/chapters`, { name: 'Endocrine' })
    ).json();
    await owner.post(`/api/banks/${bankId}/chapters`, { name: 'Cardiology' });
    const topic = await owner.post(`/api/chapters/${endocrine.id}/topics`, { name: 'Thyroid' });
    expect(topic.statusCode).toBe(201);

    const { chapters } = (await owner.get(`/api/banks/${bankId}/taxonomy`)).json();
    expect(chapters.map((c: { name: string }) => c.name)).toEqual(['Endocrine', 'Cardiology']);
    expect(chapters[0].topics).toEqual([{ id: topic.json().id, name: 'Thyroid' }]);
  });

  it('renames without changing ids, and deleting a chapter removes its topics', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const chapter = (await owner.post(`/api/banks/${bankId}/chapters`, { name: 'Old' })).json();
    const topic = (await owner.post(`/api/chapters/${chapter.id}/topics`, { name: 'T' })).json();
    expect((await owner.patch(`/api/chapters/${chapter.id}`, { name: 'New' })).statusCode).toBe(
      204,
    );
    expect((await owner.patch(`/api/topics/${topic.id}`, { name: 'T2' })).statusCode).toBe(204);
    const renamed = (await owner.get(`/api/banks/${bankId}/taxonomy`)).json().chapters[0];
    expect(renamed).toEqual({
      id: chapter.id,
      name: 'New',
      topics: [{ id: topic.id, name: 'T2' }],
    });

    expect((await owner.delete(`/api/chapters/${chapter.id}`)).statusCode).toBe(204);
    expect((await owner.get(`/api/banks/${bankId}/taxonomy`)).json()).toEqual({ chapters: [] });
    expect((await owner.patch(`/api/topics/${topic.id}`, { name: 'gone' })).statusCode).toBe(404);
  });
});

describe('taxonomy isolation', () => {
  it("never reads or changes another account's taxonomy", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const chapter = (await owner.post(`/api/banks/${bankId}/chapters`, { name: 'Private' })).json();
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.get(`/api/banks/${bankId}/taxonomy`)).statusCode).toBe(404);
    expect((await stranger.post(`/api/banks/${bankId}/chapters`, { name: 'x' })).statusCode).toBe(
      404,
    );
    expect(
      (await stranger.post(`/api/chapters/${chapter.id}/topics`, { name: 'x' })).statusCode,
    ).toBe(404);
    expect((await stranger.patch(`/api/chapters/${chapter.id}`, { name: 'x' })).statusCode).toBe(
      404,
    );
    expect((await stranger.delete(`/api/chapters/${chapter.id}`)).statusCode).toBe(404);
    expect((await owner.get(`/api/banks/${bankId}/taxonomy`)).json().chapters).toHaveLength(1);
  });
});

describe('tags (FR-11-004)', () => {
  it('keeps tag names unique per account, ignoring case', async () => {
    const { browser: owner } = await registeredBrowser(app());
    const thyroid = (await owner.post('/api/tags', { name: 'Thyroid' })).json();
    const pharma = (await owner.post('/api/tags', { name: 'Pharmacology' })).json();
    expect((await owner.post('/api/tags', { name: 'thyroid' })).statusCode).toBe(409);
    expect((await owner.patch(`/api/tags/${pharma.id}`, { name: 'THYROID' })).statusCode).toBe(409);
    expect((await owner.get('/api/tags')).json().tags).toEqual([pharma, thyroid]);

    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.post('/api/tags', { name: 'Thyroid' })).statusCode).toBe(201);
    expect((await stranger.delete(`/api/tags/${thyroid.id}`)).statusCode).toBe(404);
    expect((await owner.delete(`/api/tags/${thyroid.id}`)).statusCode).toBe(204);
  });
});
