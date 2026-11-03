import { describe, expect, it } from 'vitest';
import * as k from '../../../src/server/capabilities/sources/domain/key-lines.js';
describe('answer keys as printed (FR-07-001, FR-07-005, FR-07-008)', () => {
  it('reads inline answers, key lines, headings, explanations and multiple-select stems', () => {
    expect(k.inlineAnswer('Answer: B')).toEqual(['B']);
    expect(k.inlineAnswer('Correct answer: D')).toEqual(['D']);
    expect(k.inlineAnswer('The correct answer is (C).')).toEqual(['C']);
    expect(k.inlineAnswer('Key: B, D')).toEqual(['B', 'D']);
    expect(k.inlineAnswer('الإجابة: ب')).toEqual(['B']);
    expect(k.inlineAnswer('الجواب الصحيح: ج')).toEqual(['C']);
    expect(k.inlineAnswer('Answer the following question')).toBeNull();
    expect(k.keyEntries('1. A  2. C  3) B')).toEqual([
      { number: 1, letters: ['A'] },
      { number: 2, letters: ['C'] },
      { number: 3, letters: ['B'] },
    ]);
    expect(k.keyEntries('12: B, D')).toEqual([{ number: 12, letters: ['B', 'D'] }]);
    expect(k.keyEntries('١- ب   ٢- د')).toEqual([
      { number: 1, letters: ['B'] },
      { number: 2, letters: ['D'] },
    ]);
    expect(k.keyEntries('1. A child with fever')).toBeNull();
    expect(k.keyEntries('3. Asthma')).toBeNull();
    expect(k.isKeyHeading('Answer key')).toBe(true);
    expect(k.isKeyHeading('مفتاح الإجابات')).toBe(true);
    expect(k.isKeyHeading('Answers to the questions are below')).toBe(false);
    expect(k.explanationStart('Explanation: Measles causes')).toBe('Measles causes');
    expect(k.explanationStart('explanation for her irregular menstrual cycles?')).toBeNull();
    expect(k.explanationStart('Rationale')).toBe('');
    expect(k.explanationClaim('The correct answer is C because')).toBe('C');
    expect(k.explanationClaim('Option B is correct as the rash')).toBe('B');
    expect(k.explanationClaim('A child is correct')).toBeNull();
    expect(k.asksForSeveral('Select two correct statements')).toBe(true);
  });
});
