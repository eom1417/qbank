import { describe, expect, it } from 'vitest';
import { ownerWithBank, type createClient } from '../support/client.js';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { runImports } from '../support/imports.js';
import { useReviewSuite, type SeedQuestion } from '../support/questions.js';

const fakeHost = useFakeAiHost();
const { app, seed } = useReviewSuite({ aiHost: () => fakeHost().settings });
type Browser = ReturnType<typeof createClient>;

const options = (...texts: string[]) =>
  texts.map((text, index) => {
    const letter = String.fromCharCode(65 + index);
    return { letter, label: `${letter}.`, text };
  });

/** Five questions, one per outcome; the fake models pick the longest option (fake-triage.ts). */
const SEEDS: SeedQuestion[] = [
  { stem: 'Confirmed?', options: options('The right answer', 'No'), answers: ['A'] },
  {
    stem: 'No key?',
    options: options('No', 'The answer here'),
    answers: [],
    provenance: 'missing',
    status: 'needs_review',
    reasons: ['no_answer', 'ocr_page'],
  },
  { stem: 'Wrong key?', options: options('The real answer', 'Key'), answers: ['B'] },
  { stem: 'A tie?', options: options('Same', 'Also'), answers: [], provenance: 'missing' },
  { stem: 'Recall: teh next step?', options: options('Skeletal survey'), answers: ['A'] },
];

const rowOf = (id: string) =>
  app.db().selectFrom('question').selectAll().where('id', '=', id).executeTakeFirstOrThrow();

/** Seeds questions into a new source of the owner's bank; returns their ids and the source. */
async function seeded(owner: Browser, bankId: string, questions: SeedQuestion[]) {
  const ids = await seed(owner, bankId, questions);
  return { ids, sourceId: (await rowOf(ids[0] ?? '')).source_id };
}

/** Starts a re-check, runs it, and returns its import report. */
async function recheckNow(owner: Browser, sourceId: string, body: object) {
  const started = await owner.post(`/api/sources/${sourceId}/recheck`, body);
  await runImports(app());
  return { started, job: (await owner.get(`/api/imports/${started.json().id}`)).json() };
}

async function recheckSeeds(improve: boolean) {
  const { owner, bankId } = await ownerWithBank(app());
  const { ids, sourceId } = await seeded(owner, bankId, SEEDS);
  const body = { aiProviderId: FAKE_INSTANCES.vision, improve, models: { judge: 'fake-large' } };
  const { started, job } = await recheckNow(owner, sourceId, body);
  expect(started.statusCode).toBe(200);
  return { job, rows: await Promise.all(ids.map(rowOf)) };
}

describe('the AI triage settles answers (DEC-33)', () => {
  it('confirms, answers, corrects, and leaves only a real tie to a person', async () => {
    const { job, rows } = await recheckSeeds(false);
    const [confirmed, answered, corrected, tie, recall] = rows;
    expect(confirmed).toMatchObject({ answer_letter: 'A', answer_provenance: 'source' });
    expect(answered).toMatchObject({
      answer_letter: 'B',
      answer_provenance: 'ai_verified',
      answer_evidence: 'ai_consensus',
      status: 'eligible',
      review_reasons: ['ocr_page'],
    });
    expect(corrected).toMatchObject({
      answer_letter: 'A',
      file_answer: 'B',
      answer_evidence: 'ai_corrected',
      ai_note: 'the longest option',
      status: 'eligible',
    });
    expect(tie).toMatchObject({ answer_letter: null, status: 'needs_review' });
    expect(tie?.review_reasons).toContain('no_answer');
    // One option and no improvement: nothing for the solvers to choose between.
    expect(recall).toMatchObject({ stem: 'Recall: teh next step?', version: 1 });
    expect(job).toMatchObject({ stage: 'needs_review', aiOutcome: 'done', questionsReview: 1 });
  });

  it('improves text and completes a recall question, keeping the original as version 1', async () => {
    const { rows } = await recheckSeeds(true);
    const recall = rows[4];
    expect(recall).toMatchObject({
      stem: 'Recall: the next step?',
      status: 'eligible',
      version: 2,
    });
    const choices = recall?.options as { letter: string; text: string }[];
    expect(choices).toHaveLength(4);
    const answer = choices.find((choice) => choice.letter === recall?.answer_letter);
    expect(answer?.text).toBe('Skeletal survey');
    const versions = await app
      .db()
      .selectFrom('question_version')
      .selectAll()
      .where('question_id', '=', recall?.id ?? '')
      .orderBy('version')
      .execute();
    expect(versions.map((v) => v.origin)).toEqual(['import', 'ai_triage']);
    expect((versions[0]?.snapshot as { stem: string }).stem).toBe('Recall: teh next step?');
  });
});

describe('what a re-check may touch', () => {
  it("never changes the owner's own answers, and refuses another owner's source", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const mine = { options: options('Long answer text', 'B'), provenance: 'manual' as const };
    const { ids, sourceId } = await seeded(owner, bankId, [mine]);
    const stranger = await ownerWithBank(app(), 'Other');
    const body = { aiProviderId: FAKE_INSTANCES.vision };
    const refused = await stranger.owner.post(`/api/sources/${sourceId}/recheck`, body);
    expect(refused.statusCode).toBe(404);
    await recheckNow(owner, sourceId, body);
    const after = await rowOf(ids[0] ?? '');
    expect(after).toMatchObject({ answer_letter: 'B', answer_provenance: 'manual', version: 1 });
  });

  it("brings a question held under the old rule to today's rule (DEC-33)", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const old = {
      provenance: 'manual' as const,
      status: 'needs_review' as const,
      reasons: ['ocr_page'],
    };
    const { ids, sourceId } = await seeded(owner, bankId, [old]);
    await recheckNow(owner, sourceId, { aiProviderId: FAKE_INSTANCES.vision });
    expect(await rowOf(ids[0] ?? '')).toMatchObject({
      status: 'eligible',
      answer_provenance: 'manual',
    });
  });
});

describe('a re-check of answers it settled before', () => {
  it('keeps an answer the AI verified before when a re-check splits (no lost answers)', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    // A tie: the solvers split and the judge is unsure; the earlier verified answer stands.
    const verified = {
      options: options('Same', 'Also'),
      answers: ['A'],
      provenance: 'ai_verified' as const,
    };
    const { ids, sourceId } = await seeded(owner, bankId, [{ ...verified, provenance: 'source' }]);
    await app
      .db()
      .updateTable('question')
      .set({ answer_provenance: 'ai_verified', answer_evidence: 'ai_consensus' })
      .where('id', '=', ids[0] ?? '')
      .execute();
    await recheckNow(owner, sourceId, { aiProviderId: FAKE_INSTANCES.vision });
    expect(await rowOf(ids[0] ?? '')).toMatchObject({
      answer_letter: 'A',
      answer_provenance: 'ai_verified',
      status: 'eligible',
    });
  });

  it("treats a disputed answer as the file's: overturned only by the stricter rule, and kept shown", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const disputed = {
      options: options('The real answer', 'Key'),
      answers: ['B'],
      provenance: 'conflict' as const,
    };
    const { ids, sourceId } = await seeded(owner, bankId, [disputed]);
    await recheckNow(owner, sourceId, { aiProviderId: FAKE_INSTANCES.vision });
    expect(await rowOf(ids[0] ?? '')).toMatchObject({
      answer_letter: 'A',
      file_answer: 'B',
      answer_evidence: 'ai_corrected',
    });
  });
});

describe('a re-check that cannot run', () => {
  it('refuses a model the instance does not offer, and keeps work when the AI is signed out', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const { ids, sourceId } = await seeded(owner, bankId, [SEEDS[1] ?? {}]);
    const unknown = await owner.post(`/api/sources/${sourceId}/recheck`, {
      aiProviderId: FAKE_INSTANCES.vision,
      models: { judge: 'no-such-model' },
    });
    expect(unknown.statusCode).toBe(400);
    const { job } = await recheckNow(owner, sourceId, { aiProviderId: FAKE_INSTANCES.refusing });
    expect(job).toMatchObject({ stage: 'needs_review', aiOutcome: 'invalid_key' });
    expect(await rowOf(ids[0] ?? '')).toMatchObject({ answer_provenance: 'missing', version: 1 });
  });
});
