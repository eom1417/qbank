import { beforeAll, describe, expect, it } from 'vitest';
import { ownerWithBank, type createClient } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';

// A bank of 10,000 questions with real study history: every screen a learner opens daily must
// answer within its budget (M17.5). Times are medians of several runs, in milliseconds.
const QUESTIONS = 10_000;
const RUNS = 5;
const { app, seed } = useReviewSuite();
let owner: ReturnType<typeof createClient>;
let bankId = '';

const TOPICS = ['cardiology', 'renal', 'endocrine', 'neurology', 'infection'];
/** One in five waits for review, as after a real import of scanned pages. */
const stems = Array.from({ length: QUESTIONS }, (_, i) => ({
  stem: `Case ${i + 1}: a patient with ${TOPICS[i % TOPICS.length]} findings, item ${i * 7919}. What next?`,
  ...(i % 5 === 0 ? { status: 'needs_review' as const, reasons: ['ocr_page'] } : {}),
}));

async function median(run: () => Promise<{ statusCode: number }>) {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    const response = await run();
    times.push(performance.now() - start);
    expect(response.statusCode).toBeLessThan(300);
  }
  return times.sort((a, b) => a - b)[Math.floor(RUNS / 2)] ?? 0;
}

/** Ten answered Tutor sessions of 100, so mastery, due reviews and analytics have history. */
async function studyHistory() {
  for (let s = 0; s < 10; s++) {
    const started = await owner.post('/api/study/sessions', {
      scope: { bankIds: [bankId] },
      kind: 'random',
      size: 100,
      mode: 'tutor',
    });
    const id = started.json().id as string;
    for (let p = 0; p < 100; p++)
      await owner.post(`/api/study/sessions/${id}/items/${p}/answer`, {
        chosen: [p % 3 === 0 ? 'A' : 'B'],
        seconds: 20,
      });
  }
}

beforeAll(async () => {
  ({ owner, bankId } = await ownerWithBank(app(), 'Scale bank'));
  const started = performance.now();
  await seed(owner, bankId, stems);
  console.log(`seeded ${QUESTIONS} questions in ${Math.round(performance.now() - started)} ms`);
  await studyHistory();
});

const session = (kind: string) => () =>
  owner.post('/api/study/sessions', {
    scope: { bankIds: [bankId] },
    kind,
    size: 40,
    mode: 'tutor',
  });

describe(`a bank of ${QUESTIONS} questions`, () => {
  it.each([
    ['library', 300, () => owner.get('/api/banks')],
    ['search in stems and options', 300, () => owner.get('/api/search?q=endocrine')],
    ['review queue', 500, () => owner.get(`/api/banks/${bankId}/review`)],
    ['start a random session', 500, session('random')],
    ['start a Smart Mix session', 500, session('smart_mix')],
    ['due reviews', 500, () => owner.get(`/api/study/due?bankIds=${bankId}`)],
    ['analytics summary', 500, () => owner.get(`/api/analytics/summary?bankId=${bankId}`)],
    ['session history', 500, () => owner.get('/api/analytics/sessions')],
  ] as const)('%s answers within %i ms', async (name, budget, run) => {
    const ms = await median(run);
    console.log(`${name}: ${ms.toFixed(0)} ms (budget ${budget})`);
    expect(ms).toBeLessThan(budget);
  });
});
