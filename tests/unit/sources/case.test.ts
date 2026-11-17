import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../../src/server/capabilities/sources/domain/lines.js';
import {
  caseGroups,
  optionDonor,
} from '../../../src/server/capabilities/sources/domain/pipeline/case.js';
import type { QuestionFrame } from '../../../src/server/capabilities/sources/domain/pipeline/placement.js';
import type { VirtualText } from '../../../src/server/capabilities/sources/domain/pipeline/virtual-text.js';

// D6.3 with synthetic texts: a case shared by the questions that refer to it.
const BOX = { x0: 40, y0: 0, x1: 300, y1: 10 };

/** A virtual text of page lines (no pictures). */
const textOf = (texts: string[]): VirtualText => ({
  lines: texts.map((text) => ({
    line: { page: 1, text, box: BOX, words: [], rtl: false, start: 40 } as TextLine,
    unitId: text,
    fromPicture: false,
  })),
  order: new Map(),
  units: new Map(),
  covers: new Set(),
});

const frame = (number: number, stemAt: number, stem: string): QuestionFrame => ({
  number,
  stem,
  stemAt,
  endAt: stemAt + 2,
  options: [],
  spans: [],
});

describe('shared case texts', () => {
  it('shares a case naming its question range with the questions in it', () => {
    const text = textOf([
      'Questions 3-4 refer to the following case.',
      'A boy aged six.',
      'Q3',
      'a',
      'b',
      'Q4',
      'a',
      'b',
      'Q5',
    ]);
    const frames = [frame(3, 2, 'Diagnosis?'), frame(4, 5, 'Treatment?'), frame(5, 8, 'Other?')];
    const groups = caseGroups(frames, text, new Set([0, 1]));
    expect(groups).toEqual([
      {
        questions: [0, 1],
        text: 'Questions 3-4 refer to the following case. A boy aged six.',
        from: 0,
        to: 2,
      },
    ]);
  });

  it('shares a case without a range only with stems that lean on it', () => {
    const text = textOf(['Read the following case: a girl with a rash.', 'Q1', 'a', 'b', 'Q2']);
    const leaning = [
      frame(1, 1, 'What does this patient have?'),
      frame(2, 4, 'What should this patient take?'),
    ];
    expect(caseGroups(leaning, text, new Set([0]))[0]?.questions).toEqual([0, 1]);
    const standalone = [
      frame(1, 1, 'What does this patient have?'),
      frame(2, 4, 'A man has a cough. Why?'),
    ];
    expect(caseGroups(standalone, text, new Set([0]))).toEqual([]);
  });
});

describe('no shared case', () => {
  it('reads no case from text another question already used, or without a cue', () => {
    const text = textOf(['the following case', 'Q1', 'Q2']);
    const frames = [frame(1, 1, 'this patient?'), frame(2, 2, 'this patient?')];
    expect(caseGroups(frames, text, new Set())).toEqual([]);
    expect(caseGroups(frames, textOf(['A plain line', 'Q1', 'Q2']), new Set([0]))).toEqual([]);
  });

  it('lets a matching set share the options printed once for it', () => {
    const group = { questions: [0, 1, 2], text: '', from: 0, to: 1 };
    expect(optionDonor(group, [0, 0, 4])).toBe(2);
    expect(optionDonor(group, [4, 0, 4])).toBeNull();
    expect(optionDonor(group, [0, 0, 1])).toBeNull();
  });
});
