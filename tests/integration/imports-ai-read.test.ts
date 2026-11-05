import { describe, expect, it } from 'vitest';
import { FAKE_INSTANCES, useFakeAiHost } from '../support/fake-ai-host.js';
import { ownerWithBank } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

const fakeHost = useFakeAiHost();
const { app, fixtures } = useImportSuite({ aiHost: () => fakeHost().settings });

/** Imports a file with the AI reading whole pages, and returns the job and its questions. */
async function readByAi(instance: string, file: string) {
  const { owner, bankId } = await ownerWithBank(app());
  const started = await uploadFile(app(), owner.cookie(), bankId, file, {
    aiProviderId: instance,
    aiMode: 'read',
  });
  expect(started.statusCode).toBe(201);
  await runImports(app());
  const job = (await owner.get(`/api/imports/${started.json().id}`)).json();
  const questions = await app
    .db()
    .selectFrom('question')
    .selectAll()
    .where('source_id', '=', job.sourceId)
    .orderBy('source_page')
    .orderBy('source_number')
    .execute();
  return { owner, job, questions };
}

describe("reading whole pages with the user's AI (scans and hard layouts)", () => {
  it('takes questions, options, the printed key and explanation, and crops the picture', async () => {
    const { job, questions } = await readByAi(FAKE_INSTANCES.reader, fixtures().scanned);
    expect(job).toMatchObject({ stage: 'needs_review', aiOutcome: 'done' });
    const first = questions[0];
    expect(first).toMatchObject({
      stem: 'Which ECG finding is typical of hyperkalaemia?',
      answer_letter: 'A',
      // The printed key, read from the page by the AI: the file's answer (DEC-34).
      answer_provenance: 'source',
      answer_evidence: 'ai_read',
      explanation: 'Potassium excess peaks the T waves first.',
      status: 'eligible',
    });
    expect(first?.review_reasons).toEqual(['media_uncertain']);
    const media = await app.db().selectFrom('media').selectAll().execute();
    expect(media.filter((m) => m.question_id === first?.id)).toHaveLength(1);
  });

  it('never invents: an answer naming no option stays open, a speck is not a picture', async () => {
    const { questions } = await readByAi(FAKE_INSTANCES.reader, fixtures().scanned);
    const second = questions.find((q) => q.stem.startsWith('First-line'));
    expect(second).toMatchObject({ answer_letter: null, answer_provenance: 'missing' });
    expect(second?.review_reasons).toEqual(expect.arrayContaining(['no_answer']));
    const media = await app.db().selectFrom('media').selectAll().execute();
    expect(media.some((m) => m.question_id === second?.id)).toBe(false);
  });

  it('falls back to the rules, and says why, when the AI is signed out', async () => {
    const { job, questions } = await readByAi(FAKE_INSTANCES.refusing, fixtures().english);
    expect(job).toMatchObject({ aiOutcome: 'invalid_key', questionsFound: 8 });
    expect(questions.every((q) => !q.review_reasons.includes('ai_read'))).toBe(true);
  });
});
