import { describe, expect, it } from 'vitest';
import { hidesQuestionText } from '../../../src/server/capabilities/sources/domain/pipeline/build-questions.js';
import { questionSeverity } from '../../../src/server/capabilities/questions/domain/review.js';

// M36 Q106: text no question read falls into the explanation before it. When that text has
// the shape of a question (a number, or two option letters), a question was missed: the one
// before it goes to review, so nothing is lost silently behind an explanation.
describe('question text hidden in an explanation (M36 Q106)', () => {
  it('flags a missed question number or two option lines', () => {
    expect(hidesQuestionText(['Question: 7', 'A girl of 3 years'])).toBe(true);
    expect(hidesQuestionText(['Of the following', 'A.free fatty acids', 'B.glucose'])).toBe(true);
  });

  it('leaves a plain explanation alone, one lettered line included', () => {
    expect(hidesQuestionText(['Insulin resistance is central.', 'A. is the answer here'])).toBe(
      false,
    );
    expect(hidesQuestionText([])).toBe(false);
  });

  it('ranks the reason high: a whole question may be missing', () => {
    expect(questionSeverity(['unread_question_text'])).toBe('high');
  });
});
