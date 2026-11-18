import { describe, expect, it } from 'vitest';
import type { Detection } from '../../../../src/server/capabilities/sources/detection/contract.js';
import { assemble } from '../../../../src/server/capabilities/sources/detection/link/assemble.js';
import { toDetectedQuestions } from '../../../../src/server/capabilities/sources/detection/link/to-detected.js';
import { detectionOf, fileOf, keys, label, option } from '../../../support/detection-links.js';

describe('M39 step 4: linking questions from line roles', () => {
  it('builds a question with an inline answer and its explanation', () => {
    const { file, roles } = fileOf([
      label(1, '1. Which drug', 1),
      [1, 'is first line?', 'stem'],
      option(1, 'A. Aspirin', 'A'),
      option(1, 'B. Heparin', 'B'),
      [1, 'Answer: B', 'answer', { letters: ['B'] }],
      [1, 'Because it acts fast.', 'explanation'],
    ]);
    const [question] = assemble(file, roles);
    expect(question).toMatchObject({ number: 1, numberInferred: false, labelLine: 0, stem: [1] });
    expect(question?.options.map((o) => [o.letter, o.label, o.lines])).toEqual([
      ['A', 'A', [2]],
      ['B', 'B', [3]],
    ]);
    expect(question?.answer).toEqual({ letters: ['B'], lines: [4], from: 'inline' });
    expect(question?.explanation).toEqual([5]);
  });
});

describe('M39 step 4: answer keys printed later in the file', () => {
  it('matches a key at each chapter end, numbering restarting per chapter', () => {
    const { file, roles } = fileOf([
      label(1, '1. One', 1),
      option(1, 'A. x', 'A'),
      label(1, '2. Two', 2),
      option(1, 'A. x', 'A'),
      [2, 'Answers', 'key_table'],
      keys('1-C', [[1, 'C']]),
      keys('2-D', [[2, 'D']]),
      [3, 'Chapter 2', 'heading'],
      label(3, '1. Three', 1),
      option(3, 'A. x', 'A'),
      keys('1-B', [[1, 'B']]),
    ]);
    const answers = assemble(file, roles).map((q) => q.answer);
    expect(answers).toEqual([
      { letters: ['C'], lines: [5], from: 'key_table' },
      { letters: ['D'], lines: [6], from: 'key_table' },
      { letters: ['B'], lines: [10], from: 'key_table' },
    ]);
  });

  it('answers from one key at the end of the book, after every chapter', () => {
    const { file, roles } = fileOf([
      label(1, '1. One', 1),
      label(2, '1. Two', 1),
      label(3, '2. Three', 2),
      [3, 'Answer key', 'key_table'],
      keys('1-A', [[1, 'A']]),
      keys('1-B 2-C', [
        [1, 'B'],
        [2, 'C'],
      ]),
    ]);
    const letters = assemble(file, roles).map((q) => q.answer?.letters);
    expect(letters).toEqual([['A'], ['B'], ['C']]);
  });
});

describe('M39 step 4: inline answers against keys', () => {
  it('keeps an inline answer over a later key, and leaves unmatched numbers unanswered', () => {
    const { file, roles } = fileOf([
      label(1, '1. One', 1),
      [1, 'Ans: A', 'answer', { letters: ['A'] }],
      label(1, '2. Two', 2),
      keys('1-D 7-B', [
        [1, 'D'],
        [7, 'B'],
      ]),
    ]);
    const [first, second] = assemble(file, roles);
    expect(first?.answer?.from).toBe('inline');
    expect(second?.answer).toBeNull();
  });
});

describe('M39 step 4: questions across pages and without numbers', () => {
  it('follows a question across a page break and option continuation lines', () => {
    const { file, roles } = fileOf([
      label(1, '4. A long', 4),
      [1, 'Page 1 of 9', 'filler'],
      [2, 'stem goes on', 'stem'],
      option(2, 'A. first', 'A'),
      [2, 'still first', 'unknown'],
      option(2, 'B. second', 'B'),
      [2, 'second goes on', 'stem'],
    ]);
    const [question] = assemble(file, roles);
    expect(question?.stem).toEqual([2]);
    expect(question?.options.map((o) => o.lines)).toEqual([
      [3, 4],
      [5, 6],
    ]);
    const [detected] = toDetectedQuestions(detectionOf(file, roles));
    expect(detected).toMatchObject({ key: '1-4-0', page: 1, pages: [1, 2] });
    expect(detected?.stem).toBe('A long stem goes on');
    expect(detected?.options.map((o) => o.text)).toEqual([
      'first still first',
      'second second goes on',
    ]);
    expect(detected?.area.map((spot) => spot.page)).toEqual([1, 2]);
  });

  it('infers the number of an unnumbered question from the one before', () => {
    const { file, roles } = fileOf([
      label(1, '5. Five', 5),
      option(1, 'A. x', 'A'),
      [1, 'Answer: A', 'answer', { letters: ['A'] }],
      [1, 'An unnumbered question', 'stem'],
      option(1, 'A. y', 'A'),
    ]);
    const questions = assemble(file, roles);
    expect(questions.map((q) => [q.number, q.numberInferred])).toEqual([
      [5, false],
      [6, true],
    ]);
  });
});

describe('M39 step 4: questions as the answers layer takes them', () => {
  const { file, roles } = fileOf([
    label(1, '1. Wht is it?', 1),
    option(1, 'A. one', 'A'),
    option(1, 'B. two', 'B'),
    [1, 'Correct Answer: B', 'answer', { letters: ['B'] }],
    [1, 'Two is right.', 'explanation'],
    label(1, '1. Again', 1),
  ]);

  it('joins corrected text, answers with their evidence, spots and keys', () => {
    const detection = detectionOf(file, roles, { corrections: new Map([[0, '1. What is it?']]) });
    const [first, second] = toDetectedQuestions(detection);
    expect(first).toMatchObject({
      key: '1-1-0',
      stem: 'What is it?',
      explanation: 'Two is right.',
      answers: ['B'],
      evidence: ['printed_key'],
      fromPicture: false,
      caseText: null,
      reviewReasons: [],
    });
    expect(first?.options[1]?.spot).toEqual({ page: 1, box: file.lines[2]?.words[0]?.box });
    expect(second?.key).toBe('1-1-1');
  });

  it('sends doubts, missing options and missing answers to review', () => {
    const doubt = { check: 'stem' as const, question: 1, lines: [5], detail: 'short' };
    const [first, second] = toDetectedQuestions(detectionOf(file, roles, { doubts: [doubt] }));
    expect(first?.reviewReasons).toEqual([]);
    expect(second?.reviewReasons).toEqual(['detection_doubt', 'incomplete_options', 'no_answer']);
    expect(second?.evidence).toEqual(['none']);
  });

  it('reads a question from a picture and a pen-mark answer', () => {
    const picture = fileOf([label(1, '3. Pictured', 3), option(1, 'A. x', 'A')]);
    const lines = picture.file.lines.map((line) => ({ ...line, source: 'picture' as const }));
    const detection = detectionOf({ ...picture.file, lines }, picture.roles);
    const draft = detection.questions[0];
    if (draft) draft.answer = { letters: ['A'], lines: [], from: 'pen_mark' };
    const [question] = toDetectedQuestions(detection);
    expect(question).toMatchObject({ fromPicture: true, answers: ['A'], evidence: ['pen_mark'] });
  });
});

// The roles step marks an option's wrapped line as that option again (same letter): one option.
describe('M39 step 4: an option over several lines', () => {
  it('keeps the wrapped lines in their option, not as new options', () => {
    const { file, roles } = fileOf([
      label(1, 'Q1) Which test compares two means?', 1),
      option(1, 'A. t-test', 'A'),
      option(1, 'B. Chi-square for two', 'B'),
      option(1, 'categories of one variable', 'B'),
      option(1, 'C. ANOVA', 'C'),
    ]);
    const [question] = assemble(file, roles);
    expect(question?.options.map((o) => [o.letter, o.lines.length])).toEqual([
      ['A', 1],
      ['B', 2],
      ['C', 1],
    ]);
  });
});

// A question printed with one option and no answer is answered by it (the old single-option rule).
describe('M39 step 4: a question with one option', () => {
  it('takes the lone option of a text page as its answer, with its evidence', () => {
    const { file, roles } = fileOf([label(1, '1. Only one', 1), option(1, 'A. x', 'A')]);
    const detection = detectionOf(file, roles);
    expect(detection.questions[0]?.answer).toEqual({
      letters: ['A'],
      lines: [],
      from: 'single_option',
    });
    const [question] = toDetectedQuestions(detection);
    expect(question).toMatchObject({ answers: ['A'], evidence: ['single_option'] });
  });

  it('leaves a lone option read by OCR, or one with a printed answer, as it is', () => {
    const ocr = fileOf([label(1, '1. Only one', 1), option(1, 'A. x', 'A')]);
    const lines = ocr.file.lines.map((line) => ({ ...line, source: 'ocr' as const }));
    expect(assemble({ ...ocr.file, lines }, ocr.roles)[0]?.answer).toBeNull();
    const printed = fileOf([
      label(1, '1. Only one', 1),
      option(1, 'A. x', 'A'),
      [1, 'Answer: B', 'answer', { letters: ['B'] }],
    ]);
    expect(assemble(printed.file, printed.roles)[0]?.answer?.from).toBe('inline');
  });
});

// The roles step decides an option is the next one of the question being read: linking keeps it.
describe('M39 step 4: an option after text that interrupts the options', () => {
  it('adds the next option to its question, past a pasted explanation', () => {
    const { file, roles } = fileOf([
      label(1, '8. What should he do?', 8),
      option(1, 'A. Refuse', 'A'),
      option(1, 'B. Accept', 'B'),
      [1, 'Article 12: a pasted rule', 'explanation'],
      option(1, 'C. Disclose', 'C'),
    ]);
    const questions = assemble(file, roles);
    expect(questions.map((q) => q.options.map((o) => o.letter).join(''))).toEqual(['ABC']);
  });
});

it('removes a bare table-cell label from the option words', () => {
  const { file, roles } = fileOf([
    label(1, '1. Which nutrient?', 1),
    option(1, 'A Vitamin C', 'A'),
    option(1, 'B Vitamin D', 'B'),
  ]);
  const detection: Detection = {
    file,
    roles,
    questions: assemble(file, roles),
    doubts: [],
    corrections: new Map(),
  };
  expect(toDetectedQuestions(detection)[0]?.options.map((o) => o.text)).toEqual([
    'Vitamin C',
    'Vitamin D',
  ]);
});

describe('M39 step 4: an explanation that opens with its question number and answer', () => {
  it('goes to that numbered question and gives its printed answer', () => {
    const { file, roles } = fileOf([
      label(2, '545. Which statement', 545),
      option(2, 'a) Skin testing first', 'A'),
      option(2, 'b) No testing', 'B'),
      label(2, 'Q82) The most common eye reaction', 82),
      option(2, 'a) Contact allergy', 'A'),
      option(2, 'd) Allergic conjunctivitis', 'D'),
      [2, '545. a) _ Patients with late rashes need no testing', 'explanation'],
      [2, 'before penicillin therapy.', 'explanation'],
      [2, '82. d)__ Allergic conjunctivitis', 'explanation'],
    ]);
    const [first, second] = assemble(file, roles);
    expect(first?.explanation).toEqual([6, 7]);
    expect(first?.answer).toEqual({ letters: ['A'], lines: [6], from: 'key_table' });
    expect(second?.explanation).toEqual([8]);
    expect(second?.answer?.letters).toEqual(['D']);
  });

  it('stays with the question before when the number names no question', () => {
    const { file, roles } = fileOf([
      label(1, '1. Which drug', 1),
      option(1, 'A. Aspirin', 'A'),
      option(1, 'B. Heparin', 'B'),
      [1, '12. a) dose is weight based', 'explanation'],
    ]);
    const [question] = assemble(file, roles);
    expect(question?.explanation).toEqual([3]);
    expect(question?.answer).toBeNull();
  });
});

describe('M39 step 4: a second printed answer after the explanation', () => {
  it('is not merged into the question that already has its answer', () => {
    const { file, roles } = fileOf([
      label(54, 'Q39) Which finding', 39),
      option(54, 'A. Fever', 'A'),
      option(54, 'E. Intussusception', 'E'),
      [54, 'Answer: E', 'answer', { letters: ['E'] }],
      [54, 'A history of intussusception is a contraindication.', 'explanation'],
      [55, 'Correct Answer: B', 'answer', { letters: ['B'] }],
      [55, 'Marked neutrophilia is expected here.', 'explanation'],
    ]);
    const [question] = assemble(file, roles);
    expect(question?.answer?.letters).toEqual(['E']);
    expect(question?.explanation).toEqual([4]);
  });
});

describe('M39 step 4: a question with no options and its answer after the question mark', () => {
  it('ends the question at the mark; the statement after it is the explanation', () => {
    const { file, roles } = fileOf([
      label(53, '69. Should we feed infants allergenic foods early?', 69),
      [53, 'Two landmark trials changed the advice.', 'stem'],
    ]);
    const [question] = toDetectedQuestions(detectionOf(file, roles));
    expect(question?.stem).toBe('Should we feed infants allergenic foods early?');
    expect(question?.explanation).toBe('Two landmark trials changed the advice.');
  });

  it('keeps a stem of two questions whole', () => {
    const { file, roles } = fileOf([
      label(1, '2. A boy has a rash. What is it?', 2),
      [1, 'How would you treat it?', 'stem'],
    ]);
    const [question] = toDetectedQuestions(detectionOf(file, roles));
    expect(question?.stem).toBe('A boy has a rash. What is it? How would you treat it?');
  });
});

describe('M39 step 4: one option circled by hand', () => {
  it('is the pen-marked answer, its text without the circle', () => {
    const { file, roles } = fileOf([
      label(5, '6. What is the most likely cause?', 6),
      [5, '@)Tricuspid atresia', 'option', { letter: 'A', circled: true }],
      option(5, 'B. Truncus arteriosus', 'B'),
    ]);
    const [question] = toDetectedQuestions(detectionOf(file, roles));
    expect(question?.answers).toEqual(['A']);
    expect(question?.evidence).toEqual(['pen_mark']);
    expect(question?.options[0]?.text).toBe('Tricuspid atresia');
  });
});

describe('M39 step 4: a label with nothing of a question after it', () => {
  it('is no question: no stem, no options, no picture', () => {
    const { file, roles } = fileOf([
      label(8, 'Q. 12', 12),
      label(8, 'Q13) Which drug is first?', 13),
      option(8, 'A. Aspirin', 'A'),
      option(8, 'B. Heparin', 'B'),
    ]);
    const questions = toDetectedQuestions(detectionOf(file, roles));
    expect(questions.map((question) => question.number)).toEqual([13]);
  });
});
