import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { StructuredResult } from '../../../../src/server/capabilities/providers/domain/ai-provider.js';
import type { AiProvider } from '../../../../src/server/capabilities/providers/index.js';
import { linkKeys } from '../../../../src/server/capabilities/sources/use-cases/link-keys.js';
import type { ExtractedQuestion } from '../../../../src/server/capabilities/sources/use-cases/extract-questions.js';
import type { PageText } from '../../../../src/server/capabilities/sources/domain/page.js';

const question = (number: number, page: number): ExtractedQuestion => ({
  number,
  page,
  stem: `Question ${number}?`,
  kind: 'mcq',
  options: ['أ', 'ب', 'ج'].map((label, i) => ({
    letter: 'ABC'[i] ?? 'A',
    label,
    text: `Option ${i}`,
  })),
  answer: null,
  answers: [],
  evidence: null,
  conflicts: [],
  multiSelect: false,
  explanation: null,
  spans: [],
});
const page = (no: number, text: string): PageText => ({
  page: no,
  width: 600,
  height: 800,
  words: text
    .split(' ')
    .map((word) => ({ text: word, box: { x0: 0, y0: 0, x1: 1, y1: 1 } })) as never,
});

/** A model that links every listed question to the reply it is given. */
function linking(links: object[]) {
  const asked: string[] = [];
  const provider: AiProvider = {
    generate: <T>(request: {
      parts: readonly { type: string; text?: string }[];
      schema: z.ZodType<T>;
    }) => {
      asked.push(request.parts[0]?.text ?? '');
      return Promise.resolve({
        ok: true,
        value: request.schema.parse({ links }),
        usage: null,
      } as StructuredResult<T>);
    },
  } as AiProvider;
  return { provider, asked };
}

const KEY =
  'Answers key for chapter one follows here with each number and its printed answer: 1. ب because the second option is the cause 2. ج';

describe('linking answer pages at the end of a file (DEC-34)', () => {
  it('takes a printed answer by its printed label, and its explanation copied from the page', async () => {
    const ai = linking([
      { id: 'q1', answer: 'ب', explanation: 'because the second option is the cause' },
    ]);
    const linked = await linkKeys(
      ai.provider,
      [question(1, 1), question(2, 1)],
      [page(1, 'q'), page(9, KEY)],
    );
    expect(linked[0]).toMatchObject({
      answer: 'B',
      evidence: 'answer_key',
      explanation: 'because the second option is the cause',
    });
    expect(linked[1]?.answer).toBeNull();
    expect(ai.asked[0]).toContain('--- page 9');
    expect(ai.asked[0]).not.toContain('--- page 1\n');
  });

  it('refuses a link to no real option, to a number the pages never print, or an invented explanation', async () => {
    const ai = linking([
      { id: 'q1', answer: 'د', explanation: null },
      { id: 'q2', answer: 'ج', explanation: 'an explanation written by the model itself' },
      { id: 'q3', answer: 'A', explanation: null },
    ]);
    const linked = await linkKeys(
      ai.provider,
      [question(1, 1), question(2, 1), question(7, 1)],
      [page(9, KEY)],
    );
    expect(linked.map((q) => q.answer)).toEqual([null, 'C', null]);
    expect(linked[1]?.explanation).toBeNull();
  });

  it('asks nothing when every question has its answer or no page could hold a key', async () => {
    const ai = linking([]);
    await linkKeys(ai.provider, [{ ...question(1, 1), answer: 'A' }], [page(9, KEY)]);
    await linkKeys(ai.provider, [question(1, 1)], [page(1, KEY)]);
    expect(ai.asked).toHaveLength(0);
  });
});
