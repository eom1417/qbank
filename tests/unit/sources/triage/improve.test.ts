import { describe, expect, it } from 'vitest';
import { acceptedImprovement } from '../../../../src/server/capabilities/sources/domain/triage/improve.js';
import {
  reshape,
  withoutOption,
} from '../../../../src/server/capabilities/sources/domain/triage/reshape.js';

const recall = {
  id: 'q1',
  stem: 'A child with lethargy and retinal hemorrhage. What will you do next?',
  options: [{ letter: 'A', text: 'Skeletal survey' }],
};
const completed = {
  id: 'q1',
  stem: 'A child presents with lethargy and retinal hemorrhages. What is the next step?',
  options: [
    { from: 'A', text: 'Skeletal survey' },
    { from: null, text: 'Lumbar puncture' },
    { from: null, text: 'EEG' },
    { from: null, text: 'Reassure and discharge' },
  ],
  printedRight: null,
};
/** A scanned page read as one block: the options and the answer are inside the text. */
const scan = {
  id: 'q2',
  stem: '/61 A 13-year-old has recurrent infections. Which is most likely? a) Selective IgA deficiency b) Terminal complement deficiency c) Hyper-IgE syndrome 927. Answer (a) IgA',
  options: [],
};
const rebuilt = {
  id: 'q2',
  stem: 'A 13-year-old has recurrent infections. Which is most likely?',
  options: [
    { from: 'text', text: 'Selective IgA deficiency' },
    { from: 'text', text: 'Terminal complement deficiency' },
    { from: 'text', text: 'Hyper-IgE syndrome' },
  ],
  printedRight: 0,
};

describe('accepting an improvement', () => {
  it('accepts a cleaned stem and a recall question completed to four options', () => {
    expect(acceptedImprovement(recall, completed)?.options).toHaveLength(4);
  });

  it('refuses a reply that drops or duplicates an original option', () => {
    const dropped = { ...completed, options: completed.options.slice(1) };
    const twice = { ...completed, options: [...completed.options, { from: 'A', text: 'Again' }] };
    expect(acceptedImprovement(recall, dropped)).toBeNull();
    expect(acceptedImprovement(recall, twice)).toBeNull();
  });

  it('drops new options beyond four, and any new option when there were three', () => {
    const five = { ...completed, options: [...completed.options, { from: null, text: 'MRI' }] };
    expect(acceptedImprovement(recall, five)?.options.map((o) => o.text)).not.toContain('MRI');
    const three = {
      ...recall,
      options: ['A', 'B', 'C'].map((letter) => ({ letter, text: letter })),
    };
    const extra = {
      ...completed,
      options: [
        ...three.options.map((o) => ({ from: o.letter, text: o.text })),
        { from: null, text: 'D' },
      ],
    };
    expect(acceptedImprovement(three, extra)?.options).toHaveLength(3);
  });

  it('refuses padding: a stem much longer than it was', () => {
    const padded = { ...completed, stem: `${recall.stem} ${'Explained at length. '.repeat(10)}` };
    expect(acceptedImprovement(recall, padded)).toBeNull();
  });
});

describe('rebuilding a scanned question', () => {
  it('rebuilds a scanned question from options found in its own text, with the printed answer', () => {
    const accepted = acceptedImprovement(scan, rebuilt);
    expect(accepted?.options).toHaveLength(3);
    expect(accepted?.printedRight).toBe(0);
  });

  it('drops an option said to be found that is not in the text (nothing invented)', () => {
    const invented = {
      ...rebuilt,
      options: [...rebuilt.options, { from: 'text', text: 'Chronic granulomatous disease' }],
    };
    expect(acceptedImprovement(scan, invented)?.options.map((o) => o.text)).not.toContain(
      'Chronic granulomatous disease',
    );
  });

  it('never takes a new option as the printed answer', () => {
    const guessed = { ...completed, printedRight: 1 };
    expect(acceptedImprovement(recall, guessed)?.printedRight).toBeNull();
  });
});

describe('the improved question', () => {
  it('letters the options again, shuffled stably, and tracks the original answer', () => {
    const first = reshape(completed);
    expect(reshape(completed)).toEqual(first);
    expect(first.options).toHaveLength(4);
    const answer = first.moved.get('A') ?? '';
    expect(first.options.find((o) => o.letter === answer)?.text).toBe('Skeletal survey');
    expect(first.added.size).toBe(3);
    expect(first.added.has(answer)).toBe(false);
  });

  it('keeps the printed order of a rebuilt question and gives its printed answer a letter', () => {
    const shaped = reshape(rebuilt);
    expect(shaped.options.map((o) => o.text)).toEqual(rebuilt.options.map((o) => o.text));
    expect(shaped.printed).toBe('A');
  });

  it('drops an unfair distractor and letters the rest again', () => {
    const first = reshape(completed);
    const bad = [...first.added][0] ?? '';
    const fewer = withoutOption(first, bad);
    expect(fewer.options.map((o) => o.letter)).toEqual(['A', 'B', 'C']);
    const answer = fewer.moved.get('A') ?? '';
    expect(fewer.options.find((o) => o.letter === answer)?.text).toBe('Skeletal survey');
    expect(fewer.added.size).toBe(2);
  });
});
