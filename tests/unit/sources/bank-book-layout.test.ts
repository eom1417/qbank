import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../../src/server/capabilities/sources/domain/lines.js';
import { parseQuestions } from '../../../src/server/capabilities/sources/domain/questions.js';
import { separateKeys } from '../../../src/server/capabilities/sources/domain/key-pass.js';
import { pageLines } from '../../../src/server/capabilities/sources/domain/lines.js';

// M36: a bank book (PREP) prints "Question: 1" alone, then a blank paragraph, then the stem
// and, after another blank paragraph, the options. Measured spacing: about 3 lines each.
function at(text: string, y: number): TextLine {
  const box = { x0: 36, y0: y, x1: 336, y1: y + 12 };
  const words = text.split(' ').map((word, i) => ({
    text: word,
    box: { ...box, x0: 36 + i * 30, x1: 36 + i * 30 + 25 },
    font: null,
  }));
  return { page: 1, text, box, words, rtl: false, start: 36 };
}

describe('a question number alone on its line (M36)', () => {
  it('takes the stem and options across the book paragraph spacing', () => {
    const questions = parseQuestions([
      at('Question: 1', 100),
      at('A 15-year-old girl is diagnosed with PCOS.', 148),
      at('Of the following, she is likely to show', 162),
      at('A.free fatty acid uptake', 210),
      at('B.glucose uptake', 224),
    ]);
    expect(questions.map((q) => [q.number, q.stem, q.options.length])).toEqual([
      [1, 'A 15-year-old girl is diagnosed with PCOS. Of the following, she is likely to show', 2],
    ]);
  });

  it('does not reach a line far below a numbered stem that already has text', () => {
    const questions = parseQuestions([
      at('Question: 2 Which drug?', 100),
      at('a note pasted lower on the page', 148),
    ]);
    expect(questions[0]?.stem).toBe('Which drug?');
  });
});

// M38: a bank book prints "Correct Answer: D" right after the options, then the explanation:
// the explanation is never more of option D (it showed the answer's reasoning in the option).
describe('the explanation after a printed answer (M38)', () => {
  it('ends the last option at the answer line and keeps what follows as explanation', () => {
    const separated = separateKeys(
      [
        at('Question: 1', 100),
        at('A girl has PCOS. Of the following, she shows', 148),
        at('A.free fatty acid uptake', 196),
        at('B.progesterone production', 210),
        at('Correct Answer: B', 224),
        at('Polycystic ovary syndrome is a symptom complex', 238),
        at('that involves metabolic dysfunction.', 252),
        at('Question: 2', 300),
        at('A boy has a cough.', 348),
      ],
      { explainAfterKey: true },
    );
    const questions = parseQuestions(separated.lines);
    expect(questions[0]?.options.map((option) => option.text)).toEqual([
      'free fatty acid uptake',
      'progesterone production',
    ]);
    expect(separated.inline.map((key) => key.letters)).toEqual([['B']]);
    expect(separated.explanations.map((note) => note.text)).toEqual([
      'Polycystic ovary syndrome is a symptom complex that involves metabolic dysfunction.',
    ]);
    expect(questions.map((question) => question.number)).toEqual([1, 2]);
  });
});

describe('an option set a little further in than the others (M38)', () => {
  it('takes it as the next option when it lines up with the option before', () => {
    const shifted = (text: string, y: number, x: number) => {
      const line = at(text, y);
      const dx = x - line.box.x0;
      const move = (box: TextLine['box']) => ({ ...box, x0: box.x0 + dx, x1: box.x1 + dx });
      return {
        ...line,
        box: move(line.box),
        start: x,
        words: line.words.map((w) => ({ ...w, box: move(w.box) })),
      };
    };
    const questions = parseQuestions([
      at('Question: 6', 100),
      at('Of the following, the next step is', 148),
      shifted('A.obtain a level', 196, 47),
      shifted('B.perform a survey', 210, 47),
      shifted('C.repeat the measurement', 224, 47),
      shifted('D.treat with calcium', 238, 73),
    ]);
    expect(questions[0]?.options.map((option) => option.text)).toEqual([
      'obtain a level',
      'perform a survey',
      'repeat the measurement',
      'treat with calcium',
    ]);
  });
});

describe('a numbered list inside an explanation (M38)', () => {
  it('stays explanation unless its number is the next question', () => {
    const separated = separateKeys(
      [
        at('Question: 5', 100),
        at('Which mutation is most likely?', 148),
        at('A.ABCG5 mutation', 196),
        at('B.PCSK9 mutation', 210),
        at('Correct Answer: A', 224),
        at('Sterols are absorbed in two steps:', 238),
        at('1. LDL receptor is not synthesized', 252),
        at('2. LDL receptor is not transported', 266),
        at('Question: 6', 300),
        at('A boy has a cough.', 348),
      ],
      { explainAfterKey: true },
    );
    expect(parseQuestions(separated.lines).map((question) => question.number)).toEqual([5, 6]);
    expect(separated.explanations.map((note) => note.text)).toEqual([
      'Sterols are absorbed in two steps: 1. LDL receptor is not synthesized 2. LDL receptor is not transported',
    ]);
  });
});

describe('a labelled question runs to the next label (M38)', () => {
  it('keeps the text after a figure and the options far below in the question', () => {
    const lines = [
      at('Question: 2', 100),
      at('A boy has a DXA scan of his spine ( Figure).', 148),
      at('Lumbar Spine Analysis', 420),
      at('Of the following, the BEST next step is', 470),
      at('A.scan of the femur', 600),
      at('B.monitor bone health', 614),
      at('Question: 3', 700),
    ];
    const spanning = parseQuestions(lines, [], { spanToNextLabel: true });
    expect(spanning[0]?.stem).toBe(
      'A boy has a DXA scan of his spine ( Figure). Lumbar Spine Analysis Of the following, the BEST next step is',
    );
    expect(spanning[0]?.options.map((option) => option.text)).toEqual([
      'scan of the femur',
      'monitor bone health',
    ]);
    // Without the switch (annotated notes), distance still ends the question as measured.
    expect(parseQuestions(lines)[0]?.options).toEqual([]);
  });
});

describe('a full stop set at the start of a line (M38)', () => {
  it('goes back to the end of its sentence, as the right-to-left document wrote it', () => {
    const word = (text: string, x0: number) => ({
      text,
      box: { x0, y0: 0, x1: x0 + 8 * text.length, y1: 12 },
      font: 'Helvetica',
    });
    const page = {
      page: 1,
      width: 600,
      height: 800,
      words: [word('.', 36), word('A.Elevated', 42), word('thyrotropin', 130), word('levels', 230)],
    };
    expect(pageLines(page, null).map((line) => line.text)).toEqual([
      'A.Elevated thyrotropin levels.',
    ]);
  });
});

describe('options printed as table rows (M38)', () => {
  // A row: the letter, a wide cell gap, then the cells.
  const row = (letter: string, cells: string, y: number): TextLine => {
    const line = at(cells, y);
    const shift = (box: TextLine['box']) => ({ ...box, x0: box.x0 + 100, x1: box.x1 + 100 });
    const letterWord = { text: letter, box: { x0: 36, y0: y, x1: 44, y1: y + 12 }, font: null };
    return {
      ...line,
      text: `${letter} ${cells}`,
      box: { ...line.box, x0: 36 },
      words: [letterWord, ...line.words.map((w) => ({ ...w, box: shift(w.box) }))],
    };
  };
  it('reads each row that starts with the next letter as that option', () => {
    const questions = parseQuestions(
      [
        at('Question: 1', 100),
        at('Of the following, the MOST likely profile is', 148),
        at('Response Choice Glucose Cholesterol', 196),
        row('A', '95 (5.3) 200 (5.2)', 210),
        at('Response Choice Glucose Cholesterol', 240),
        row('B', '105 (5.8) 150 (3.9)', 254),
        at('C 3-year-old girl is not a row: no cell gap after the letter', 268),
        at('Question: 2', 300),
      ],
      [],
      { spanToNextLabel: true },
    );
    const options = questions[0]?.options ?? [];
    expect(options.map((option) => option.letter)).toEqual(['A', 'B']);
    expect(options[0]?.text).toBe('95 (5.3) 200 (5.2)');
    expect(options[1]?.text.startsWith('105 (5.8) 150 (3.9)')).toBe(true);
  });
});

describe('a question the book printed with no label (M38)', () => {
  it('starts it where its page starts, numbered after the question before', () => {
    const on = (page: number, text: string, y: number) => ({ ...at(text, y), page });
    const separated = separateKeys(
      [
        on(1, 'Question: 4', 100),
        on(1, 'Which finding is MOST likely?', 148),
        on(1, 'A.low calcium', 196),
        on(1, 'B.high thyrotropin', 210),
        on(1, 'Correct Answer: B', 224),
        on(1, 'Thyroid disease is the most common.', 238),
        on(2, 'A student presents a patient on the wards.', 40),
        on(2, 'Of the following, the BEST next step is to', 54),
        on(2, 'A.discuss concerns with the director', 68),
        on(2, 'B.model the presentation', 82),
        on(2, 'Correct Answer: B', 96),
        on(2, 'Feedback works best at once.', 110),
        on(2, 'Question: 6', 200),
      ],
      { explainAfterKey: true },
    );
    const questions = parseQuestions(separated.lines);
    expect(questions.map((question) => [question.number, question.stem])).toEqual([
      [4, 'Which finding is MOST likely?'],
      [5, 'A student presents a patient on the wards. Of the following, the BEST next step is to'],
      [6, ''],
    ]);
    expect(questions[1]?.options.map((option) => option.text)).toEqual([
      'discuss concerns with the director',
      'model the presentation',
    ]);
    expect(separated.explanations.map((note) => note.text)).toEqual([
      'Thyroid disease is the most common.',
      'Feedback works best at once.',
    ]);
  });
});
