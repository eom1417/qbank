import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  judgeSheet,
  replySchema,
  UNREADABLE_REPLY,
  type LessonCard,
} from '../../../src/server/capabilities/sources/domain/pipeline/lesson.js';

// M34 P3: a sheet's reply is judged per cell; the numbering rule is the engine's, not the model's.

const card: LessonCard<{ letters: string[] }, { option: string }> = {
  id: 'T.letter',
  level: 4,
  needs: 'vision',
  version: 1,
  question: 'Which letter is circled?',
  yesCues: [],
  noCues: [],
  schema: z.object({ option: z.string() }),
  check: (input, output) => (input.letters.includes(output.option) ? null : 'not an option'),
  reviewReason: 'mark_unclear',
};
const inputs = [{ letters: ['A', 'B'] }, { letters: ['C', 'D'] }, { letters: ['E'] }];

describe('lesson replies (M34 P3)', () => {
  it('reads a whole reply and drops nothing but the cell number', () => {
    const reply = replySchema(card).parse({ items: [{ n: 1, option: 'A' }] });
    expect(reply.items).toEqual([{ n: 1, option: 'A' }]);
    expect(replySchema(card).safeParse({ items: [{ n: 'one', option: 'A' }] }).success).toBe(false);
  });

  it('answers each cell in order and runs the card check', () => {
    const reply = {
      items: [
        { n: 2, option: 'C' },
        { n: 1, option: 'B' },
        { n: 3, option: 'Z' },
      ],
    };
    expect(judgeSheet(card, inputs, reply)).toEqual([
      { ok: true, output: { option: 'B' } },
      { ok: true, output: { option: 'C' } },
      { ok: false, error: 'not an option' },
    ]);
  });

  it('catches a missing, a repeated and an out-of-range number', () => {
    const reply = {
      items: [
        { n: 1, option: 'A' },
        { n: 1, option: 'B' },
        { n: 3, option: 'E' },
        { n: 9, option: 'E' },
      ],
    };
    const [first, second, third] = judgeSheet(card, inputs, reply);
    expect(first).toEqual({ ok: false, error: expect.stringContaining('answered 2 times') });
    expect(second).toEqual({ ok: false, error: expect.stringContaining('no answer') });
    expect(third).toEqual({ ok: true, output: { option: 'E' } });
  });

  it('fails every cell when the reply could not be read', () => {
    expect(judgeSheet(card, inputs, null)).toEqual(
      inputs.map(() => ({ ok: false, error: UNREADABLE_REPLY })),
    );
  });
});
