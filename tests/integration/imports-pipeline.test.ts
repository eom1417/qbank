import { describe, expect, it } from 'vitest';
import { ownerWithBank } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { runImports, uploadFile } from '../support/imports.js';
import { usePipelineFile } from '../support/pipeline-import.js';
import { answer, itemAt, startTutor } from '../support/study.js';
import { useTestApp } from '../support/test-app.js';

// M34 P5 end to end on a synthetic PDF and the fake AI host: the pipeline saves questions with
// their pictures' places, the case and the tags; explanation pictures wait for the reveal; no
// AI means no import (Z4); a full subscription pauses and resumes from the step cache (Q16).

let now = new Date('2026-11-17T10:00:00Z');
const clock = { now: () => now };
const fake = useFakeAiHost();
const app = useTestApp({ aiHost: () => fake().settings, clock });
const db = () => app.db();
const pipelineFile = usePipelineFile();

/** The lesson sheets the fake host was asked (D4.mark), whatever their answer. */
const lessonAsks = () =>
  fake().asks.filter((ask) => /The image has \d+ cells/.test(ask.body.prompt ?? '')).length;

async function startPipeline(instance: string = FAKE_INSTANCES.lesson) {
  const { owner, bankId } = await ownerWithBank(app());
  await owner.post('/api/account/ai-consent', {});
  const started = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), {
    aiProviderId: instance,
  });
  expect(started.statusCode).toBe(201);
  const job = started.json() as { id: string; sourceId: string };
  const report = async () => (await owner.get(`/api/imports/${job.id}`)).json();
  return { owner, bankId, job, report };
}

const questionsOf = (sourceId: string) =>
  db()
    .selectFrom('question')
    .select(['id', 'source_number', 'case_id', 'status'])
    .where('source_id', '=', sourceId)
    .orderBy('source_seq')
    .execute();

const placementsOf = (sourceId: string) =>
  db()
    .selectFrom('media')
    .innerJoin('question', 'question.id', 'media.question_id')
    .select(['media.id', 'media.placement', 'question.source_number as number'])
    .where('media.source_id', '=', sourceId)
    .orderBy('question.source_seq')
    .execute();

describe('a pipeline import (M34 P5)', () => {
  it('saves the questions with their pictures placed, the shared case and the tags', async () => {
    const { job, report } = await startPipeline();
    await runImports(app());
    const done = await report();
    expect(done.stage).toBe('needs_review');
    expect(done.errorCode).toBeNull();
    expect(done.questionsFound).toBe(3);
    const questions = await questionsOf(job.sourceId);
    expect(questions.map((q) => q.source_number)).toEqual([1, 2, 3]);
    const places = await placementsOf(job.sourceId);
    expect(places.map((p) => [p.number, p.placement])).toEqual([
      [1, 'explanation'],
      [2, 'question'],
    ]);
    const [first, second, third] = questions;
    expect(first?.case_id).toBeTruthy();
    expect(second?.case_id).toBe(first?.case_id);
    expect(third?.case_id).toBeNull();
    const tags = await db()
      .selectFrom('question_tag')
      .innerJoin('tag', 'tag.id', 'question_tag.tag_id')
      .select(['tag.name', 'question_tag.origin', 'question_tag.question_id'])
      .where('question_tag.question_id', '=', first?.id ?? '')
      .execute();
    expect(tags.map((t) => [t.name, t.origin]).sort()).toEqual([
      ['exam:Part II', 'import'],
      ['year:2019', 'import'],
    ]);
  });

  it('reports the lesson tokens, estimated when the provider gives none, and the review', async () => {
    const { report } = await startPipeline();
    await runImports(app());
    const { ai, questionsReview } = await report();
    expect(ai.mode).toBe('pipeline');
    expect(ai.usage).toEqual([
      expect.objectContaining({ lesson: 'D4.mark', model: 'claude-haiku-5-5', estimated: true }),
    ]);
    expect(ai.usage[0].calls).toBe(1);
    expect(ai.usage[0].inputTokens).toBeGreaterThan(0);
    expect(questionsReview).toBeGreaterThanOrEqual(0);
  });
});

describe('a pipeline import in study', () => {
  it('shows an explanation picture only with the solution (Z1)', async () => {
    const { owner, bankId, job } = await startPipeline();
    await runImports(app());
    const questions = await questionsOf(job.sourceId);
    expect(questions[0]?.status).toBe('eligible');
    const eligible = questions.filter((q) => q.status === 'eligible').length;
    const [explanation] = (await placementsOf(job.sourceId)).filter(
      (p) => p.placement === 'explanation',
    );
    const session = await startTutor(owner, bankId, eligible);
    for (let position = 0; position < eligible; position++) {
      const before = await itemAt(owner, session, position);
      if (before.statusCode !== 200) throw new Error(before.body);
      if (!String(before.json().stem).includes('Which test comes first')) continue;
      expect(JSON.stringify(before.json())).not.toContain(explanation?.id);
      const after = (await answer(owner, session, position, ['B'])).json();
      expect(after.solution.pictureIds).toEqual([explanation?.id]);
      return;
    }
    throw new Error('the keyed question was not in the session');
  });
});

describe('no silent fallback (Z4)', () => {
  it('fails a job whose provider is gone, with no question read by the rules', async () => {
    const { job, report } = await startPipeline();
    await db()
      .updateTable('import_job')
      .set({ ai_provider_id: 'fake-gone' })
      .where('id', '=', job.id)
      .execute();
    await runImports(app());
    expect(await report()).toMatchObject({ stage: 'failed', errorCode: 'ai_not_ready' });
    expect(await questionsOf(job.sourceId)).toEqual([]);
  });

  it('fails a job whose provider refuses, with no question read by the rules', async () => {
    const { job, report } = await startPipeline();
    fake().refusing.add(FAKE_INSTANCES.lesson);
    try {
      await runImports(app());
    } finally {
      fake().refusing.delete(FAKE_INSTANCES.lesson);
    }
    const failed = await report();
    expect(failed).toMatchObject({ stage: 'failed', errorCode: 'ai_failed' });
    expect(failed.aiOutcome).toBe('invalid_key');
    expect(await questionsOf(job.sourceId)).toEqual([]);
  });
});

describe('a full subscription (Q16)', () => {
  it('pauses the job, resumes it later, and never pays for a finished lesson twice', async () => {
    const { owner, job, report } = await startPipeline();
    fake().exhausted.add(FAKE_INSTANCES.lesson);
    const asked = lessonAsks();
    await runImports(app());
    fake().exhausted.delete(FAKE_INSTANCES.lesson);
    const paused = await report();
    expect(paused.stage).toBe('extracting');
    expect(paused.aiOutcome).toBe('no_quota');
    expect(Date.parse(paused.ai.resumesAt)).toBe(now.getTime() + 60 * 60_000);
    expect(await questionsOf(job.sourceId)).toEqual([]);
    expect(lessonAsks() - asked).toBe(1);

    await runImports(app());
    expect((await report()).stage).toBe('extracting');
    now = new Date(now.getTime() + 61 * 60_000);
    await runImports(app());
    const resumed = await report();
    expect(resumed.stage).toBe('needs_review');
    expect(resumed.ai.resumesAt).toBeNull();
    expect(lessonAsks() - asked).toBe(2);

    await owner.post(`/api/imports/${job.id}/retry`, {});
    await runImports(app());
    expect((await report()).stage).toBe('needs_review');
    expect(lessonAsks() - asked).toBe(2);
  });
});
