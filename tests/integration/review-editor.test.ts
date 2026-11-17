import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import type { PageReadingResponse } from '../../src/contracts/review.js';
import { ownerWithBank } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { runImports, uploadFile } from '../support/imports.js';
import { usePipelineFile } from '../support/pipeline-import.js';
import { useTestApp } from '../support/test-app.js';

// M34 P6 (Q26): the review editor: a question's page as the import read it, roles changed by the
// owner, and the question re-assembled from its units as a new version. Owner only; the POST
// needs the app's Origin. Synthetic file, fake AI host.

const fake = useFakeAiHost();
const app = useTestApp({ aiHost: () => fake().settings });
const db = () => app.db();
const pipelineFile = usePipelineFile();

async function firstQuestion() {
  const { owner, bankId } = await ownerWithBank(app());
  await owner.post('/api/account/ai-consent', {});
  const started = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), {
    aiProviderId: FAKE_INSTANCES.lesson,
  });
  const job = started.json() as { id: string; sourceId: string };
  await runImports(app());
  const question = await db()
    .selectFrom('question')
    .select(['id', 'version'])
    .where('source_id', '=', job.sourceId)
    .where('source_seq', '=', 0)
    .executeTakeFirstOrThrow();
  const reading = (await owner.get(`/api/questions/${question.id}/page-reading`)).json();
  return { owner, job, question, reading: reading as PageReadingResponse };
}

const unitsOf = (reading: PageReadingResponse) => reading.pages.flatMap((page) => page.units);

const placementOf = (questionId: string) =>
  db()
    .selectFrom('media')
    .select(['placement', 'option_letter'])
    .where('question_id', '=', questionId)
    .execute();

describe('the page as read (Q26)', () => {
  it('shows the page picture and each unit with its role', async () => {
    const { owner, job, reading } = await firstQuestion();
    expect(reading.available).toBe(true);
    const [page] = reading.pages;
    expect(page?.imageUrl).toBe(`/api/sources/${job.sourceId}/pages/1`);
    const roles = unitsOf(reading).map((unit) => unit.role);
    expect(roles).toEqual(expect.arrayContaining(['stem', 'option:A', 'picture:explanation']));
    const others = unitsOf(reading).filter((unit) => !unit.editable);
    expect(others.length).toBeGreaterThan(0);
    const picture = await owner.get(page?.imageUrl ?? '');
    expect(picture.statusCode).toBe(200);
    expect(picture.headers['content-type']).toBe('image/png');
    expect(picture.rawPayload.subarray(1, 4).toString('latin1')).toBe('PNG');
  });

  it('gives neither the reading nor the page to another account', async () => {
    const { job, question } = await firstQuestion();
    const stranger = (await ownerWithBank(app())).owner;
    expect((await stranger.get(`/api/questions/${question.id}/page-reading`)).statusCode).toBe(404);
    expect((await stranger.get(`/api/sources/${job.sourceId}/pages/1`)).statusCode).toBe(404);
  });

  it('renders at most 60 pages a minute for one owner, and not for the next owner', async () => {
    const { owner, job } = await firstQuestion();
    for (let i = 0; i < 60; i++)
      expect((await owner.get(`/api/sources/${job.sourceId}/pages/999`)).statusCode).toBe(404);
    const limited = await owner.get(`/api/sources/${job.sourceId}/pages/1`);
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('too_many_attempts');
    const next = await firstQuestion();
    const page = await next.owner.get(`/api/sources/${next.job.sourceId}/pages/1`);
    expect(page.statusCode).toBe(200);
  }, 30_000);

  it('has no page picture once the original is deleted', async () => {
    const { owner, job, question } = await firstQuestion();
    await owner.delete(`/api/sources/${job.sourceId}/original`);
    expect((await owner.get(`/api/sources/${job.sourceId}/pages/1`)).statusCode).toBe(404);
    const reading = (await owner.get(`/api/questions/${question.id}/page-reading`)).json();
    expect(reading.available).toBe(false);
  });
});

describe('re-assembly (Q26)', () => {
  it('rebuilds the question from its units as a new version and moves its picture', async () => {
    const { owner, question, reading } = await firstQuestion();
    const units = unitsOf(reading);
    const explanation = units.find((unit) => unit.role === 'explanation' && unit.editable);
    const picture = units.find((unit) => unit.role === 'picture:explanation');
    if (!explanation || !picture) throw new Error('the fixture lost its explanation');
    const saved = await owner.post(`/api/questions/${question.id}/reassemble`, {
      expectedVersion: reading.version,
      roles: [
        { unitId: explanation.unitId, role: 'stem' },
        { unitId: picture.unitId, role: 'picture:option:B' },
      ],
    });
    expect(saved.statusCode).toBe(200);
    const body = saved.json();
    expect(body.version).toBe(reading.version + 1);
    expect(body.stem).toContain('Which test comes first for this boy?');
    expect(body.stem).toContain(explanation.text);
    expect(body.options.map((o: { text: string }) => o.text)).toEqual([
      'Chest film',
      'Blood count',
      'Throat swab',
    ]);
    expect(await placementOf(question.id)).toEqual([{ placement: 'option', option_letter: 'B' }]);
    const history = (await owner.get(`/api/questions/${question.id}/history`)).json();
    expect(history.versions[0].origin).toBe('edit');
    const after = (await owner.get(`/api/questions/${question.id}/page-reading`)).json();
    const moved = unitsOf(after).find((unit) => unit.unitId === explanation.unitId);
    expect(moved?.role).toBe('stem');
  });
});

describe('re-assembly refused (Q26)', () => {
  it('refuses a role a unit cannot take, another question’s unit and a stale version', async () => {
    const { owner, question, reading } = await firstQuestion();
    const units = unitsOf(reading);
    const picture = units.find((unit) => unit.kind === 'image' && unit.editable);
    const foreign = units.find((unit) => !unit.editable);
    const url = `/api/questions/${question.id}/reassemble`;
    const send = (unitId: string, role: string, expectedVersion = reading.version) =>
      owner.post(url, { expectedVersion, roles: [{ unitId, role }] });
    expect((await send(picture?.unitId ?? '', 'stem')).statusCode).toBe(400);
    expect((await send(foreign?.unitId ?? '', 'explanation')).statusCode).toBe(400);
    expect((await send('p1-u9999', 'explanation')).statusCode).toBe(400);
    expect((await send(picture?.unitId ?? '', 'owner')).statusCode).toBe(400);
    const stale = await send(picture?.unitId ?? '', 'picture:question', reading.version + 5);
    expect(stale.statusCode).toBe(409);
  });

  it('needs the app’s Origin and the owner', async () => {
    const { owner, question, reading } = await firstQuestion();
    const [unit] = unitsOf(reading).filter((u) => u.editable);
    const payload = {
      expectedVersion: reading.version,
      roles: [{ unitId: unit?.unitId ?? '', role: unit?.role ?? 'stem' }],
    };
    const url = `/api/questions/${question.id}/reassemble`;
    const forged = await owner.post(url, payload, 'https://evil.example');
    expect(forged.statusCode).toBe(403);
    const stranger = (await ownerWithBank(app())).owner;
    expect((await stranger.post(url, payload)).statusCode).toBe(404);
  });
});

describe('re-assembly is one change (Q26)', () => {
  /** Makes moving any picture fail, as a lost connection in the last step would. */
  async function withFailingPictures(run: () => Promise<void>) {
    await sql`create or replace function qb_test_fail_media() returns trigger as $$
      begin raise exception 'picture move failed'; end $$ language plpgsql`.execute(db());
    await sql`create trigger qb_test_fail_media before update on media
      for each row execute function qb_test_fail_media()`.execute(db());
    try {
      await run();
    } finally {
      await sql`drop trigger if exists qb_test_fail_media on media`.execute(db());
      await sql`drop function if exists qb_test_fail_media()`.execute(db());
    }
  }

  it('leaves the question, the roles and the pictures as they were when a step fails', async () => {
    const { owner, question, reading } = await firstQuestion();
    const units = unitsOf(reading);
    const explanation = units.find((unit) => unit.role === 'explanation' && unit.editable);
    const picture = units.find((unit) => unit.role === 'picture:explanation');
    if (!explanation || !picture) throw new Error('the fixture lost its explanation');
    const placed = await placementOf(question.id);
    await withFailingPictures(async () => {
      const failed = await owner.post(`/api/questions/${question.id}/reassemble`, {
        expectedVersion: reading.version,
        roles: [
          { unitId: explanation.unitId, role: 'stem' },
          { unitId: picture.unitId, role: 'picture:option:B' },
        ],
      });
      expect(failed.statusCode).toBe(500);
    });
    const now = (await owner.get(`/api/questions/${question.id}`)).json();
    expect(now.version).toBe(reading.version);
    expect(await placementOf(question.id)).toEqual(placed);
    const after = (await owner.get(`/api/questions/${question.id}/page-reading`)).json();
    expect(unitsOf(after).map((unit) => unit.role)).toEqual(units.map((unit) => unit.role));
  });
});
