import { describe, expect, it } from 'vitest';
import { decideAnswer } from '../../../src/server/capabilities/sources/domain/answer-decision.js';
import { matchKeys } from '../../../src/server/capabilities/sources/domain/answer-keys.js';
import { defectsOf } from '../../../src/server/capabilities/sources/domain/defects.js';

const entries = (pairs: [number, string][]) =>
  pairs.map(([number, l]) => ({ number, letters: [l] }));
const letters = ['A', 'B', 'C', 'D'];
const none = { answer: null, evidence: null };

describe('matching key sections by chapter and number (FR-07-001, UAT-012)', () => {
  it('keys after each chapter answer that chapter', () => {
    const keys = [
      {
        position: 1,
        entries: entries([
          [1, 'B'],
          [2, 'C'],
        ]),
      },
      {
        position: 3,
        entries: entries([
          [1, 'D'],
          [2, 'A'],
        ]),
      },
    ];
    expect(matchKeys([1, 2, 1, 2], keys)).toEqual([['B'], ['C'], ['D'], ['A']]);
  });

  it('one key at the end of the book, numbering restarting per chapter', () => {
    const key = {
      position: 3,
      entries: entries([
        [1, 'B'],
        [2, 'C'],
        [1, 'D'],
      ]),
    };
    expect(matchKeys([1, 2, 1, 2], [key])).toEqual([['B'], ['C'], ['D'], null]);
  });

  it('a key before any question, or numbers with no question, answers nothing', () => {
    expect(matchKeys([1, 2], [{ position: -1, entries: entries([[1, 'A']]) }])).toEqual([
      null,
      null,
    ]);
    expect(matchKeys([1], [{ position: 0, entries: entries([[7, 'A']]) }])).toEqual([null]);
  });
});

describe('deciding the answer (FR-07-003, FR-07-005)', () => {
  it('the key wins; a pen mark or an explanation that disagrees is a conflict', () => {
    const pen = { answer: 'A', evidence: 'pen_mark' as const };
    expect(decideAnswer({ letters, marked: pen, key: ['B'], explanation: null })).toEqual({
      answers: ['B'],
      evidence: 'answer_key',
      conflicts: ['key_conflict'],
    });
    const claim = 'The correct answer is C.';
    expect(
      decideAnswer({ letters, marked: none, key: ['B'], explanation: claim }).conflicts,
    ).toEqual(['explanation_conflict']);
  });

  it('a key letter the question lacks is a conflict; nothing at all stays unanswered', () => {
    expect(decideAnswer({ letters, marked: none, key: ['E'], explanation: null })).toEqual({
      answers: [],
      evidence: null,
      conflicts: ['key_conflict'],
    });
    expect(decideAnswer({ letters, marked: none, key: null, explanation: null }).answers).toEqual(
      [],
    );
    expect(
      decideAnswer({ letters, marked: none, key: null, explanation: 'Answer is (D)' }),
    ).toMatchObject({
      answers: ['D'],
      evidence: 'explanation',
    });
  });
});

describe('proven defects (FR-08-001, DEC-04)', () => {
  it('repeated options, too few options and garbled text', () => {
    const mcq = (stem: string, options: string[]) => ({
      kind: 'mcq' as const,
      stem,
      options: options.map((text) => ({ text })),
    });
    expect(defectsOf(mcq('Which is right?', ['Ibuprofen', 'ibuprofen ', 'Steroid']))).toEqual([
      'duplicate_options',
    ]);
    expect(defectsOf(mcq('Which is right?', ['Only one']))).toEqual(['too_few_options']);
    expect(defectsOf(mcq('ÿ¤¥¦§¨©ª«¬®¯°±²³', ['A', 'B']))).toEqual(['garbled_text']);
    expect(defectsOf(mcq('Normal stem with 5% and −4 mmol/L?', ['Yes', 'No']))).toEqual([]);
  });
});
