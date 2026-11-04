import { describe, expect, it } from 'vitest';
import { createClient, ownerWithBank, registeredBrowser } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { answer, startTutor } from '../support/study.js';

// Acceptance gaps found in M18: classifying a question (FR-03-003, FR-11-003, FR-11-004) and
// carrying on from another device in another language (JY-17).
const { app, seed } = useReviewSuite();

describe('classifying a question by hand', () => {
  it('puts it in a chapter and topic; a rename keeps it there, a delete leaves it unclassified', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{ stem: 'Where does it go?' }]);
    const chapter = (await owner.post(`/api/banks/${bankId}/chapters`, { name: 'Renal' })).json();
    const topic = (await owner.post(`/api/chapters/${chapter.id}/topics`, { name: 'AKI' })).json();
    const version = (await owner.get(`/api/questions/${id}`)).json().version;
    const placed = await owner.patch(`/api/questions/${id}`, {
      expectedVersion: version,
      chapterId: chapter.id,
      topicId: topic.id,
    });
    expect(placed.json()).toMatchObject({
      chapterId: chapter.id,
      topicId: topic.id,
      classification: 'manual',
    });
    await owner.patch(`/api/chapters/${chapter.id}`, { name: 'Nephrology' });
    expect((await owner.get(`/api/questions/${id}`)).json().chapterId).toBe(chapter.id);
    await owner.delete(`/api/chapters/${chapter.id}`);
    expect((await owner.get(`/api/questions/${id}`)).json()).toMatchObject({
      chapterId: null,
      topicId: null,
    });
  });

  it('takes several of the owner’s tags, and refuses a tag of another account', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [id] = await seed(owner, bankId, [{ stem: 'Tagged?' }]);
    const tags = [];
    for (const name of ['high-yield', 'repeat'])
      tags.push((await owner.post('/api/tags', { name })).json().id);
    const version = (await owner.get(`/api/questions/${id}`)).json().version;
    const tagged = await owner.patch(`/api/questions/${id}`, {
      expectedVersion: version,
      tagIds: tags,
    });
    expect(tagged.json().tags).toEqual(tags.map((tag) => ({ id: tag, origin: 'manual' })));
    const { browser: stranger } = await registeredBrowser(app());
    const foreign = (await stranger.post('/api/tags', { name: 'mine' })).json().id;
    const refused = await owner.patch(`/api/questions/${id}`, {
      expectedVersion: tagged.json().version,
      tagIds: [foreign],
    });
    expect([refused.statusCode, refused.json().error.fields]).toEqual([
      400,
      { tagIds: 'invalid_value' },
    ]);
  });
});

describe('another device, another language (JY-17)', () => {
  it('follows the account: the language changes there, and the session goes on where it stopped', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [{ stem: 'First?' }, { stem: 'Second?' }]);
    const session = await startTutor(owner, bankId, 2);
    await answer(owner, session, 0, ['B']);
    await owner.post(`/api/study/sessions/${session}/position`, { position: 1 });
    await owner.patch('/api/account', { locale: 'en' });
    const email = (await owner.get('/api/auth/me')).json().email;
    const phone = createClient(app());
    expect(
      (await phone.post('/api/auth/sign-in', { email, password: 'correct horse battery' }))
        .statusCode,
    ).toBe(200);
    expect((await phone.get('/api/auth/me')).json().preferences.locale).toBe('en');
    const resumed = (await phone.get('/api/study/sessions'))
      .json()
      .sessions.find((s: { id: string }) => s.id === session);
    expect(resumed).toMatchObject({ position: 1, answered: 1 });
  });
});
