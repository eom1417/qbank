import { describe, expect, it } from 'vitest';
import { ownerWithBank } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { runImports, uploadFile } from '../support/imports.js';
import { usePipelineFile } from '../support/pipeline-import.js';
import { useTestApp } from '../support/test-app.js';

// M34 P6: a pipeline import keeps every unit of its pages with what it became (import_block),
// for 7 days and never past its original (Q23); its report names the family, the pages of
// unknown shape and the review reasons (Q59). Synthetic file, fake AI host.

let now = new Date('2026-11-17T10:00:00Z');
const clock = { now: () => now };
const fake = useFakeAiHost();
const app = useTestApp({ aiHost: () => fake().settings, clock });
const db = () => app.db();
const pipelineFile = usePipelineFile();

async function imported() {
  now = new Date('2026-11-17T10:00:00Z');
  const { owner, bankId } = await ownerWithBank(app());
  await owner.post('/api/account/ai-consent', {});
  const started = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), {
    aiProviderId: FAKE_INSTANCES.lesson,
  });
  expect(started.statusCode).toBe(201);
  const job = started.json() as { id: string; sourceId: string };
  await runImports(app());
  return { owner, job };
}

const blocksOf = (jobId: string) =>
  db()
    .selectFrom('import_block')
    .select(['page', 'ordinal', 'kind', 'role', 'text', 'question_seq', 'expires_at'])
    .where('job_id', '=', jobId)
    .orderBy('page')
    .orderBy('ordinal')
    .execute();

describe('the units a pipeline import keeps (Q26)', () => {
  it('stores every unit with its role and its question, for 7 days', async () => {
    const { job } = await imported();
    const blocks = await blocksOf(job.id);
    expect(blocks.length).toBeGreaterThan(0);
    const roles = new Set(blocks.map((b) => b.role));
    expect(roles).toContain('stem');
    expect(roles).toContain('option:A');
    expect(roles).toContain('picture:explanation');
    for (const block of blocks) {
      const ofQuestion = !['filler', 'dropped'].includes(block.role ?? '');
      expect(block.question_seq !== null).toBe(ofQuestion);
      expect(block.expires_at.getTime()).toBe(now.getTime() + 7 * 24 * 60 * 60_000);
    }
    const seqs = new Set(blocks.flatMap((b) => (b.question_seq === null ? [] : [b.question_seq])));
    expect([...seqs].sort()).toEqual([0, 1, 2]);
  });

  it('reports the family, pages of unknown shape and the review reasons', async () => {
    const { owner, job } = await imported();
    const report = (await owner.get(`/api/imports/${job.id}`)).json();
    expect(report.ai.tier).toBe('light');
    const pipeline = report.ai.pipeline;
    expect(typeof pipeline.family).toBe('string');
    expect(pipeline.measured).toBe(pipeline.family === 'annotated_notes');
    expect(pipeline.unknownPages).toEqual([]);
    const total = pipeline.reviewReasons.reduce(
      (sum: number, r: { count: number }) => sum + r.count,
      0,
    );
    expect(total >= report.questionsReview).toBe(true);
    if (report.questionsReview > 0) expect(pipeline.reviewReasons.length).toBeGreaterThan(0);
  });
});

describe('the units kept for review go (Q23)', () => {
  it('forgets them with the original, when the owner deletes it', async () => {
    const { owner, job } = await imported();
    expect((await blocksOf(job.id)).length).toBeGreaterThan(0);
    const deleted = await owner.delete(`/api/sources/${job.sourceId}/original`);
    expect(deleted.statusCode).toBe(204);
    expect(await blocksOf(job.id)).toEqual([]);
  });

  it('forgets them after 7 days, and with the source itself', async () => {
    const { job } = await imported();
    now = new Date(now.getTime() + 8 * 24 * 60 * 60_000);
    await runImports(app());
    expect(await blocksOf(job.id)).toEqual([]);
    const other = await imported();
    const source = await db()
      .selectFrom('source')
      .select('bank_id')
      .where('id', '=', other.job.sourceId)
      .executeTakeFirstOrThrow();
    const erased = await other.owner.post(`/api/banks/${source.bank_id}/delete`, { confirm: true });
    expect(erased.statusCode).toBe(204);
    expect(await blocksOf(other.job.id)).toEqual([]);
  });

  it('does not let another account read the units of a question', async () => {
    const { job } = await imported();
    const [question] = await db()
      .selectFrom('question')
      .select('id')
      .where('source_id', '=', job.sourceId)
      .execute();
    const stranger = await ownerWithBank(app());
    const seen = await stranger.owner.get(`/api/questions/${question?.id}/page-reading`);
    expect(seen.statusCode).toBe(404);
  });
});
