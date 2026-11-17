import { describe, expect, it } from 'vitest';
import {
  markedLetters,
  markLesson,
  optionNamed,
  type MarkInput,
} from '../../../src/server/capabilities/sources/domain/pipeline/lessons/mark.js';
import { buildPrompt } from '../../../src/server/capabilities/sources/domain/pipeline/prompt-standard.js';
import { runLesson } from '../../../src/server/capabilities/sources/use-cases/run-lesson.js';
import { crop, LIGHT, lessonWorld, recorded, STRONG, textOf } from '../../support/lesson-world.js';

// M34 P4b: lesson D4.mark on synthetic options and RECORDED replies only.

const latin: MarkInput = {
  options: ['A', 'B', 'C', 'D'].map((letter) => ({ letter, label: letter })),
};
const lower: MarkInput = {
  options: ['a', 'b', 'c'].map((label, i) => ({ letter: 'ABC'[i] ?? '', label })),
};
const arabic: MarkInput = {
  options: [
    { letter: 'A', label: 'أ' },
    { letter: 'B', label: 'ب' },
  ],
};
const check = (input: MarkInput, letter: string | null, eliminated: string[] = []) =>
  markLesson.check(input, { letter, eliminated });

describe('lesson D4.mark: the card (M34 P4b)', () => {
  it('accepts a marked option, no mark, and struck-out options', () => {
    expect(check(latin, 'B')).toBeNull();
    expect(check(latin, null)).toBeNull();
    expect(check(latin, 'C', ['A', 'B'])).toBeNull();
  });

  it('rejects a letter the question does not have, naming the real options', () => {
    expect(check(latin, 'E')).toBe('E is not an option of this cell (its options: A, B, C, D)');
    expect(check(latin, 'A', ['F'])).toContain('F is not an option');
  });

  it('rejects an option both marked and struck out', () => {
    expect(check(latin, 'B', ['B'])).toBe('B cannot be both the marked answer and struck out');
    expect(check(lower, 'b', ['B'])).toContain('cannot be both');
  });

  it('reads printed labels in any case or script as positional letters', () => {
    expect(optionNamed(lower, 'b')?.letter).toBe('B');
    expect(optionNamed(lower, '(C)')?.letter).toBe('C');
    expect(optionNamed(arabic, 'ب')?.letter).toBe('B');
    expect(optionNamed(arabic, 'B')?.letter).toBe('B');
    expect(markedLetters(lower, { letter: 'c', eliminated: ['a'] })).toEqual({
      letter: 'C',
      eliminated: ['A'],
    });
    expect(markedLetters(latin, { letter: null, eliminated: [] }).letter).toBeNull();
  });

  it('accepts only the reply shape: a letter or null, and a list', () => {
    expect(markLesson.schema.safeParse({ letter: null, eliminated: [] }).success).toBe(true);
    expect(markLesson.schema.safeParse({ letter: 'A' }).success).toBe(false);
    expect(markLesson.schema.safeParse({ letter: 3, eliminated: [] }).success).toBe(false);
  });

  it('asks one closed question with the elimination trap and the JSON fields', () => {
    const prompt = buildPrompt(markLesson, { count: 2, texts: null });
    expect(prompt.text).toContain('NOT the answer');
    expect(prompt.text).toContain('"letter":…,"eliminated":…');
    expect(prompt.system).toContain('lesson D4.mark');
  });
});

const items = [latin, arabic].map((input, i) => ({
  input,
  fingerprint: `q-${i}`,
  image: crop(),
  text: null,
}));

describe('lesson D4.mark: running it (M34 P4b)', () => {
  it('answers a sheet of crops in one light call', async () => {
    const reply = {
      items: [
        { n: 1, letter: 'C', eliminated: ['A'] },
        { n: 2, letter: null, eliminated: [] },
      ],
    };
    const world = lessonWorld({ [LIGHT]: [recorded(reply)] });
    const run = await runLesson(world.deps, markLesson, items);
    expect(run.results).toEqual([
      { status: 'answered', output: { letter: 'C', eliminated: ['A'] }, model: LIGHT },
      { status: 'answered', output: { letter: null, eliminated: [] }, model: LIGHT },
    ]);
    expect(world.calls).toHaveLength(1);
  });
});

describe('lesson D4.mark: failed checks (M34 P4b)', () => {
  it('retries a failed check, escalates, then sends it to review', async () => {
    const wrong = recorded({ items: [{ n: 1, letter: 'E', eliminated: [] }] });
    const first = {
      items: [
        { n: 1, letter: 'B', eliminated: [] },
        { n: 2, letter: 'E', eliminated: [] },
      ],
    };
    const world = lessonWorld({ [LIGHT]: [recorded(first), wrong], [STRONG]: [wrong] });
    const run = await runLesson(world.deps, markLesson, items);
    expect(world.calls.map((call) => call.model)).toEqual([LIGHT, LIGHT, STRONG]);
    expect(run.results[0]).toMatchObject({ status: 'answered', output: { letter: 'B' } });
    expect(run.results[1]).toEqual({ status: 'review', reason: 'mark_unclear' });
  });

  it('tells the retry which option the cell really has', async () => {
    const world = lessonWorld({
      [LIGHT]: [
        recorded({ items: [{ n: 1, letter: 'Z', eliminated: [] }] }),
        recorded({ items: [{ n: 1, letter: 'ب', eliminated: [] }] }),
      ],
    });
    const run = await runLesson(world.deps, markLesson, items.slice(1));
    expect(textOf(world.calls, 1)).toContain(
      'Cell 1: Z is not an option of this cell (its options: أ, ب)',
    );
    expect(run.results[0]).toMatchObject({ status: 'answered', output: { letter: 'ب' } });
  });
});
