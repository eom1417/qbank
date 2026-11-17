import { describe, expect, it } from 'vitest';
import type { PipelinePicture } from '../../../src/server/capabilities/sources/domain/pipeline/question.js';
import {
  EXPLANATION_WORDS,
  filterValue,
  trimExplanation,
} from '../../../src/server/capabilities/sources/domain/pipeline/value-filter.js';
import { pipelineQuestion } from '../../support/lesson-world.js';

// M34 P5: the value filter (curriculum level 5) keeps the explanation's useful parts verbatim
// and drops marks, filler and anything unsure; the question's own pictures always stay.

const words = (count: number, word = 'word') => Array.from({ length: count }, () => word).join(' ');

/** A picture `y` points below the question's area (which ends at y 120 on page 1). */
function picture(
  id: string,
  imageClass: PipelinePicture['imageClass'],
  placement: PipelinePicture['placement'] = 'explanation',
  at: { page?: number; y?: number } = {},
): PipelinePicture {
  const y0 = 120 + (at.y ?? 10);
  return {
    unitId: id,
    spot: { page: at.page ?? 1, box: { x0: 10, y0, x1: 200, y1: y0 + 50 } },
    placement,
    optionLetter: placement === 'option' ? 'B' : null,
    imageClass,
  };
}

const ids = (pictures: readonly PipelinePicture[]) => pictures.map((p) => p.unitId);

describe('the explanation text', () => {
  it('keeps a short explanation exactly as printed', () => {
    const text = 'Line one.\n  Line two keeps   its spacing.';
    expect(trimExplanation(text)).toBe(text);
    expect(trimExplanation(null)).toBeNull();
    expect(trimExplanation('   ')).toBeNull();
  });

  it('cuts a long explanation at the last sentence end within the limit', () => {
    const first = `${words(250)}.`;
    const second = `${words(100, 'more')}.`;
    const third = `${words(100, 'tail')}.`;
    const kept = trimExplanation(`${first} ${second} ${third}`);
    expect(kept).toBe(`${first} ${second}`);
  });

  it('cuts at a word boundary, never mid-word, when no sentence ends in time', () => {
    const kept = trimExplanation(words(EXPLANATION_WORDS + 50, 'lengthy')) ?? '';
    expect(kept.split(' ')).toHaveLength(EXPLANATION_WORDS);
    expect(kept.endsWith('lengthy')).toBe(true);
  });
});

describe('explanation pictures by class', () => {
  it('keeps figures, tables and handwriting, and drops text pictures and unsure ones', () => {
    const question = pipelineQuestion('ABC', {
      pictures: [
        picture('fig', 'figure'),
        picture('tab', 'table', 'explanation', { y: 60 }),
        picture('hand', 'handwriting', 'explanation', { y: 120 }),
        picture('ink', 'handwriting_ink', 'explanation', { y: 180 }),
        picture('unsure', 'unsure'),
        picture('words', 'text_picture'),
      ],
    });
    expect(ids(filterValue(question).pictures)).toEqual(['fig', 'tab', 'hand', 'ink']);
  });

  it('keeps at most three images and two tables, the nearest first', () => {
    const question = pipelineQuestion('ABC', {
      pictures: [
        picture('far-fig', 'figure', 'explanation', { page: 2, y: 0 }),
        picture('fig-3', 'figure', 'explanation', { y: 300 }),
        picture('fig-1', 'figure', 'explanation', { y: 10 }),
        picture('fig-2', 'handwriting_ink', 'explanation', { y: 100 }),
        picture('tab-far', 'table', 'explanation', { y: 500 }),
        picture('tab-1', 'table', 'explanation', { y: 50 }),
        picture('tab-2', 'table', 'explanation', { y: 200 }),
      ],
    });
    const kept = ids(filterValue(question).pictures);
    expect(kept.sort()).toEqual(['fig-1', 'fig-2', 'fig-3', 'tab-1', 'tab-2'].sort());
  });

  it('never drops the question’s, an option’s or the case’s pictures', () => {
    const question = pipelineQuestion('ABC', {
      pictures: [
        picture('stem', 'unsure', 'question'),
        picture('opt', 'text_picture', 'option'),
        picture('case', 'figure', 'case'),
        ...['a', 'b', 'c', 'd'].map((id) => picture(id, 'figure', 'question')),
      ],
    });
    expect(filterValue(question).pictures).toEqual(question.pictures);
  });

  it('changes nothing else of the question', () => {
    const question = pipelineQuestion('AB', { explanation: 'Short.', answers: ['A'] });
    expect(filterValue(question)).toEqual(question);
  });
});
