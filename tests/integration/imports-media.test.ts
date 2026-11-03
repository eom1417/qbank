import { describe, expect, it } from 'vitest';
import { ownerWithBank, registeredBrowser } from '../support/client.js';
import { blobCount, runImports, uploadFile, useImportSuite } from '../support/imports.js';

const { app, fixtures } = useImportSuite();

async function importMedia(file: string) {
  const { owner, bankId } = await ownerWithBank(app());
  const job = (await uploadFile(app(), owner.cookie(), bankId, file)).json();
  await runImports(app());
  const media = (await owner.get(`/api/imports/${job.id}/media`)).json().media;
  return { owner, job, media };
}

const questionRows = (sourceId: string) =>
  app
    .db()
    .selectFrom('question')
    .select(['source_number', 'stem', 'review_reasons'])
    .where('source_id', '=', sourceId)
    .orderBy('source_number')
    .execute();

describe('figures and tables from a text PDF (M5.1–M5.6)', () => {
  it('keeps each picture with its question, in order, with what it is and how sure', async () => {
    const { job, media } = await importMedia(fixtures().media);
    const summary = media.map((m: Record<string, unknown>) => [
      m['questionNumber'],
      m['position'],
      m['kind'],
      m['modality'],
      m['link'],
      m['lowQuality'],
    ]);
    expect(summary).toEqual([
      [1, 1, 'figure', 'ecg', 'certain', false],
      [2, 1, 'figure', null, 'certain', false],
      [2, 2, 'figure', null, 'certain', false],
      [3, 1, 'figure', 'photo', 'uncertain', false],
      [4, 1, 'figure', 'xray', 'certain', true],
      [5, 1, 'table', 'table', 'certain', false],
      [6, 1, 'figure', 'ultrasound', 'certain', false],
    ]);
    const rows = await questionRows(job.sourceId);
    expect(rows[2]?.review_reasons).toContain('media_uncertain');
    expect(rows[3]?.review_reasons).toContain('media_low_quality');
    expect(rows[4]?.stem).toBe('A child has these laboratory results. What is the diagnosis?');
  });

  it('serves a picture only to its owner, and a retry replaces instead of adding', async () => {
    const { owner, job, media } = await importMedia(fixtures().media);
    const file = await owner.get(`/api/media/${media[0].id}`);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.rawPayload.subarray(1, 4).toString()).toBe('PNG');
    const { browser: stranger } = await registeredBrowser(app());
    expect((await stranger.get(`/api/media/${media[0].id}`)).statusCode).toBe(404);
    expect((await stranger.get(`/api/imports/${job.id}/media`)).statusCode).toBe(404);
    const before = blobCount();
    await owner.post(`/api/imports/${job.id}/retry`, {});
    await runImports(app());
    const again = (await owner.get(`/api/imports/${job.id}/media`)).json().media;
    expect([again.length, blobCount()]).toEqual([7, before]);
  });
});

describe('pictures on a scanned page (FR-06-001)', () => {
  it('finds them in the ink and keeps OCR noise out of the question text', async () => {
    const { job, media } = await importMedia(fixtures().mediaScanned);
    const kinds = media.map((m: Record<string, unknown>) => `${m['questionNumber']}:${m['kind']}`);
    expect(kinds).toEqual(expect.arrayContaining(['1:figure', '2:figure', '4:figure', '5:table']));
    const rows = await questionRows(job.sourceId);
    expect(rows[1]?.stem).toBe('Which side is abnormal when comparing these two views?');
  });
});
