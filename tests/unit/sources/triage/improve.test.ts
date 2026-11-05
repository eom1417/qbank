import { describe, expect, it } from 'vitest';
import {
  acceptedImprovement,
  improvePrompt,
  type ImproveRules,
} from '../../../../src/server/capabilities/sources/domain/triage/improve.js';
import {
  reshape,
  withoutOption,
} from '../../../../src/server/capabilities/sources/domain/triage/reshape.js';

const stem = 'A child with lethargy and retinal hemorrhage. What will you do next?';
const recall = {
  question: { id: 'q1', stem, options: [{ letter: 'A', text: 'Skeletal survey' }] },
  right: 'A',
  mayAdd: true,
};
const kept = { from: 'A', printed: 'Skeletal survey', text: 'Skeletal survey' };
const added = (text: string) => ({ from: null, printed: null, text });
const reply = {
  id: 'q1',
  organizedStem: stem,
  stem: 'A child presents with lethargy and retinal hemorrhages. What is the next step?',
  options: [kept, added('Lumbar puncture'), added('EEG'), added('Reassure and discharge')],
  printedRight: null,
};
const ALL: ImproveRules = { polish: true, most: 4 };

describe('organizing and improving a question (DEC-34)', () => {
  it('asks only for what the owner chose', () => {
    expect(improvePrompt({ polish: false, most: 0 })).not.toMatch(/written clearly|new options/);
    expect(improvePrompt(ALL)).toMatch(/written clearly/);
    expect(improvePrompt({ polish: false, most: 5 })).toMatch(/fewer than 5 options/);
  });

  it('uses the polished text and the new options when chosen', () => {
    const accepted = acceptedImprovement(recall, reply, ALL);
    expect(accepted?.stem).toBe(reply.stem);
    expect(accepted?.options).toHaveLength(4);
  });

  it('keeps the printed words only, with no new option, when nothing else was chosen', () => {
    const accepted = acceptedImprovement(recall, reply, { polish: false, most: 0 });
    expect(accepted?.stem).toBe(stem);
    expect(accepted?.options).toEqual([{ from: 'A', text: 'Skeletal survey' }]);
  });

  it('adds options only up to the chosen number, and never where not allowed', () => {
    expect(acceptedImprovement(recall, reply, { polish: true, most: 3 })?.options).toHaveLength(3);
    expect(acceptedImprovement({ ...recall, mayAdd: false }, reply, ALL)?.options).toHaveLength(1);
  });
});

describe('the guards of organizing and polishing', () => {
  it('refuses organizing that drops an original option or writes its own words', () => {
    expect(
      acceptedImprovement(recall, { ...reply, options: reply.options.slice(1) }, ALL),
    ).toBeNull();
    const rewritten = {
      ...reply,
      organizedStem: 'A toddler has bleeding in the eyes; choose management.',
    };
    expect(acceptedImprovement(recall, rewritten, ALL)).toBeNull();
  });

  it('falls back to the organized text when polishing drops a number or a negation', () => {
    const negated = {
      question: { id: 'q2', stem: 'Which is NOT a cause of miosis at 2 mg?', options: [] },
      right: null,
      mayAdd: false,
    };
    const lost = {
      id: 'q2',
      organizedStem: negated.question.stem,
      stem: 'Which causes miosis?',
      options: [],
      printedRight: null,
    };
    expect(acceptedImprovement(negated, lost, ALL)?.stem).toBe(negated.question.stem);
  });
});

describe('rebuilding a scanned question', () => {
  const scanned = {
    question: {
      id: 'q3',
      stem: '/61 A 13-year-old has recurrent infections. Which is most likely? a) Selective IgA deficiency b) Terminal complement deficiency c) Hyper-IgE syndrome 927. Answer (a) IgA',
      options: [],
    },
    right: null,
    mayAdd: false,
  };
  const found = (text: string) => ({ from: 'text', printed: text, text });
  const rebuilt = {
    id: 'q3',
    organizedStem: 'A 13-year-old has recurrent infections. Which is most likely?',
    stem: 'A 13-year-old has recurrent infections. Which is most likely?',
    options: [
      'Selective IgA deficiency',
      'Terminal complement deficiency',
      'Hyper-IgE syndrome',
    ].map(found),
    printedRight: 0,
  };

  it('takes the printed options and the printed answer found in its own text', () => {
    const accepted = acceptedImprovement(scanned, rebuilt, { polish: false, most: 0 });
    expect(accepted?.options).toHaveLength(3);
    expect(accepted?.printedRight).toBe(0);
    expect(reshape(accepted ?? rebuilt).printed).toBe('A');
  });

  it('refuses an option said to be printed that is not in the text', () => {
    const invented = {
      ...rebuilt,
      options: [...rebuilt.options, found('Chronic granulomatous disease')],
    };
    expect(acceptedImprovement(scanned, invented, { polish: false, most: 0 })).toBeNull();
  });
});

describe('the improved question', () => {
  const improved = {
    id: 'q1',
    stem,
    options: reply.options.map(({ from, text }) => ({ from, text })),
    printedRight: null,
  };

  it('letters the options again, shuffled stably, and tracks the original answer', () => {
    const first = reshape(improved);
    expect(reshape(improved)).toEqual(first);
    const answer = first.moved.get('A') ?? '';
    expect(first.options.find((o) => o.letter === answer)?.text).toBe('Skeletal survey');
    expect(first.added.size).toBe(3);
  });

  it('drops an unfair distractor and letters the rest again', () => {
    const first = reshape(improved);
    const fewer = withoutOption(first, [...first.added][0] ?? '');
    expect(fewer.options.map((o) => o.letter)).toEqual(['A', 'B', 'C']);
    const answer = fewer.moved.get('A') ?? '';
    expect(fewer.options.find((o) => o.letter === answer)?.text).toBe('Skeletal survey');
  });
});
