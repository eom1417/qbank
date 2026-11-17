import { describe, expect, it } from 'vitest';
import { questionLabel } from '../../../src/server/capabilities/sources/domain/labels.js';

// M36 Q107: question-bank books number their questions with a separator between the word and
// the number ("Question: 1", PREP); every such form is a question, any other line is not.
describe('prefixed question numbers (M36 Q107)', () => {
  it.each([
    ['Question: 1', 1, ''],
    ['Question:12 A boy of 3', 12, 'A boy of 3'],
    ['Question #7', 7, ''],
    ['Question no. 4', 4, ''],
    ['Q.5) A girl', 5, 'A girl'],
    ['Question-9', 9, ''],
    ['MCQ 3: Which', 3, 'Which'],
    ['سؤال: 8', 8, ''],
    ['Question 1', 1, ''],
  ])('reads %j as question %i', (line, number, text) => {
    expect(questionLabel(line)).toEqual({ number, text, prefixed: true });
  });

  it.each(['Questions: 1-10', 'Question bank 2022', 'Quality: 3', 'Q fever'])(
    'does not read %j as a question',
    (line) => {
      expect(questionLabel(line)?.prefixed ?? false).toBe(false);
    },
  );
});
