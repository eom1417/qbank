import { describe, expect, it } from 'vitest';
import type {
  PipelinePicture,
  PipelineQuestion,
} from '../../../src/server/capabilities/sources/domain/pipeline/question.js';
import {
  importedQuestions,
  readWithPipeline,
  type PipelineDeps,
} from '../../../src/server/capabilities/sources/use-cases/read-with-pipeline.js';
import {
  crop,
  LIGHT,
  lessonWorld,
  pipelineQuestion,
  recorded,
} from '../../support/lesson-world.js';

// M34 P5: the pipeline's reading on synthetic questions and RECORDED lesson replies: review
// reasons per status, placed pictures, cases and tags, and a pause that resumes from the cache.

const ask = (n: number, extra: Partial<PipelineQuestion> = {}) =>
  pipelineQuestion('ABCD', { key: `1-${n}-0`, number: n, ...extra });
const keyed = (n: number, letter: string, extra: Partial<PipelineQuestion> = {}) =>
  ask(n, { answers: [letter], evidence: ['printed_key'], ...extra });

const reasonsOf = (questions: readonly PipelineQuestion[]) =>
  importedQuestions(questions, new Map()).map((question) => question.reasons);

describe('review reasons by status (D7.1)', () => {
  it('passes a keyed question and leaves an unanswered one to the solvers', () => {
    const [ready, open] = importedQuestions([keyed(1, 'B'), ask(2)], new Map());
    expect(ready).toMatchObject({ answer: 'B', provenance: 'source', evidence: 'answer_key' });
    expect(ready?.reasons).toEqual([]);
    expect(open).toMatchObject({ answer: null, provenance: 'missing', reasons: ['no_answer'] });
  });

  it('holds a single option (Q32) and reads no options as an essay question', () => {
    const single = pipelineQuestion('A', {
      number: 1,
      answers: ['A'],
      evidence: ['single_option'],
    });
    const essay = pipelineQuestion('', { number: 2 });
    const [one, none] = importedQuestions([single, essay], new Map());
    expect(one?.reasons).toContain('single_option');
    expect(one?.evidence).toBe('single_option');
    expect(none).toMatchObject({ kind: 'essay', reasons: ['essay'] });
  });

  it('holds conflicts, a doubtful key, an unclear mark and «none of them» (Q31, Q54)', () => {
    const conflict = ask(1, { conflicts: ['printed_key=A disagrees with pen_mark=B'] });
    const doubt = ask(2, { reviewReasons: ['key_doubt', 'no_answer'] });
    const unclear = ask(3, { reviewReasons: ['mark_unclear', 'no_answer'] });
    const none = ask(4, { explanation: 'Correct answer: none of the above.' });
    const listed = ask(5, {
      options: [
        ...ask(5).options.slice(0, 3),
        { letter: 'D', label: 'D', text: 'None of these', spot: null },
      ],
      explanation: 'Answer: none of these',
      answers: ['A'],
      evidence: ['printed_key'],
    });
    const reasons = reasonsOf([conflict, doubt, unclear, none, listed]);
    expect(reasons[0]).toContain('answer_conflict');
    expect(importedQuestions([conflict], new Map())[0]?.provenance).toBe('conflict');
    expect(reasons[1]).toContain('key_doubt');
    expect(reasons[2]).toContain('mark_unclear');
    expect(reasons[3]).toContain('none_of_options');
    expect(reasons[4]).not.toContain('none_of_options');
  });
});

const picture = (
  id: string,
  placement: PipelinePicture['placement'],
  imageClass: PipelinePicture['imageClass'] = 'figure',
  optionLetter: string | null = null,
): PipelinePicture => ({
  unitId: id,
  spot: { page: 1, box: { x0: 10, y0: 130, x1: 200, y1: 180 } },
  placement,
  optionLetter,
  imageClass,
});

/** A world whose crops need no poppler: a grey picture per question, its key as fingerprint. */
function deps(world: ReturnType<typeof lessonWorld>, questions: PipelineQuestion[]): PipelineDeps {
  return {
    ...world.deps,
    readQuestions: () => Promise.resolve({ questions }),
    cropQuestions: (_file, asked) =>
      Promise.resolve(asked.map((q) => ({ key: q.key, image: crop(), fingerprint: q.key }))),
  };
}

const input = { file: 'synthetic.pdf', pages: { from: 1, to: 5 }, readings: new Map() };
const unmarked = (count: number) => ({
  items: Array.from({ length: count }, (_, i) => ({ n: i + 1, letter: null, eliminated: [] })),
});

describe('reading a file with the pipeline', () => {
  it('keeps placed pictures, filters the explanation, and gives cases and tags', async () => {
    const first = keyed(1, 'A', {
      caseText: 'A made-up case shared by two questions.',
      tags: { exam: 'Part II', year: '2019' },
      pictures: [
        picture('case-fig', 'case'),
        picture('stem-fig', 'question'),
        picture('opt-fig', 'option', 'figure', 'B'),
        picture('expl-fig', 'explanation', 'table'),
        picture('expl-unsure', 'explanation', 'unsure'),
      ],
    });
    const second = keyed(2, 'C', {
      caseText: 'A made-up case shared by two questions.',
      pictures: [picture('case-fig', 'case')],
    });
    const outside = keyed(9, 'A', { page: 7 });
    const world = lessonWorld({ [LIGHT]: [recorded(unmarked(1))] });
    const read = await readWithPipeline(deps(world, [first, second, outside]), input);
    expect(read.stopped).toBeNull();
    expect(read.questions.map((q) => q.number)).toEqual([1, 2]);
    expect(read.media.map((m) => [m.question, m.place, m.region.kind])).toEqual([
      [0, { placement: 'case', optionLetter: null }, 'figure'],
      [0, { placement: 'question', optionLetter: null }, 'figure'],
      [0, { placement: 'option', optionLetter: 'B' }, 'figure'],
      [0, { placement: 'explanation', optionLetter: null }, 'table'],
    ]);
    expect(read.extras).toEqual({
      cases: [{ text: 'A made-up case shared by two questions.', questions: [0, 1] }],
      tags: [{ question: 0, names: ['exam:Part II', 'year:2019'] }],
    });
    expect(read.usage).toHaveLength(1);
  });
});

describe('a stopped pipeline reading', () => {
  it('pauses on a full subscription and resumes without asking a finished sheet again', async () => {
    const questions = Array.from({ length: 12 }, (_, i) => ask(i + 1));
    const world = lessonWorld({
      [LIGHT]: [recorded(unmarked(10)), { ok: false, failure: 'no_quota' }],
    });
    const options = { concurrency: 1, auditEvery: 0 };
    const paused = await readWithPipeline(deps(world, questions), input, options);
    expect(paused.stopped?.failure).toBe('no_quota');
    expect(paused.stopped?.resumeAfter).toBeInstanceOf(Date);
    expect(paused.questions).toEqual([]);
    expect(world.calls).toHaveLength(2);

    const later = lessonWorld({ [LIGHT]: [recorded(unmarked(2))] });
    later.deps.cache = world.deps.cache;
    const resumed = await readWithPipeline(deps(later, questions), input, options);
    expect(resumed.stopped).toBeNull();
    expect(later.calls).toHaveLength(1);
    expect(resumed.questions).toHaveLength(12);
    expect(resumed.usage).toHaveLength(1);
  });

  it('stops on a refused key and returns no question', async () => {
    const world = lessonWorld({ [LIGHT]: [{ ok: false, failure: 'invalid_key' }] });
    const read = await readWithPipeline(deps(world, [ask(1)]), input);
    expect(read.stopped).toEqual({ failure: 'invalid_key', resumeAfter: null });
    expect(read.questions).toEqual([]);
  });
});

describe('the hand-mark audit by family (M34 P6)', () => {
  /** How many cells the first lesson sheet showed. */
  const cellsAsked = (world: ReturnType<typeof lessonWorld>) =>
    Number(/The image has (\d+) cells/.exec(JSON.stringify(world.calls[0]?.request))?.[1] ?? 0);
  const withFamily = (world: ReturnType<typeof lessonWorld>, family: string): PipelineDeps => ({
    ...deps(world, [keyed(1, 'A'), keyed(2, 'B'), keyed(3, 'C')]),
    readQuestions: () =>
      Promise.resolve({
        questions: [keyed(1, 'A'), keyed(2, 'B'), keyed(3, 'C')],
        units: { pages: [], family: { family, lessons: [], signals: {} } } as never,
      }),
  });

  it('audits every keyed question of hand-corrected notes', async () => {
    const world = lessonWorld({ [LIGHT]: [recorded(unmarked(3))] });
    await readWithPipeline(withFamily(world, 'annotated_notes'), input);
    expect(cellsAsked(world)).toBe(3);
  });

  it('keeps the 10% sample for any other family', async () => {
    const world = lessonWorld({ [LIGHT]: [recorded(unmarked(1))] });
    await readWithPipeline(withFamily(world, 'printed_key'), input);
    expect(cellsAsked(world)).toBe(1);
  });
});
