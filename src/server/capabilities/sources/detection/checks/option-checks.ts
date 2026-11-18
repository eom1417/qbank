import { explanationStart, inlineAnswer, isKeyHeading } from '../../domain/key-lines.js';
import { optionLabel, questionLabel } from '../../domain/labels.js';
import type { Doubt, DraftQuestion, FileLines } from '../contract.js';
import { textOf, type CheckContext } from './question-lines.js';

type QuestionCheck = (q: DraftQuestion, index: number, ctx: CheckContext) => Doubt[];

const bare = (text: string) => optionLabel(text)?.text ?? text;

/** An option's text without its printed label. */
export const optionText = (file: FileLines, lines: number[]): string => bare(textOf(file, lines));

const holdsWords = (text: string) =>
  inlineAnswer(text) !== null || explanationStart(text) !== null || isKeyHeading(text);

export const optionSequence: QuestionCheck = (q, index, { file }) => {
  const indexes = q.options.map(
    (o) => optionLabel(textOf(file, o.lines.slice(0, 1)))?.index ?? o.letter.charCodeAt(0) - 65,
  );
  if (indexes.every((value, at) => value === at)) return [];
  const lines = q.options.flatMap((o) => o.lines.slice(0, 1));
  return [
    { check: 'option_sequence', question: index, lines, detail: 'Option labels skip or repeat.' },
  ];
};

export const optionHoldsOther: QuestionCheck = (q, index, { file, medianOption }) =>
  q.options.flatMap((option): Doubt[] => {
    const words = option.lines.some((id) => holdsWords(bare(textOf(file, [id]))));
    const long = medianOption > 0 && optionText(file, option.lines).length > 3 * medianOption;
    if (!words && !long) return [];
    const detail = words
      ? 'An option holds answer or explanation words.'
      : 'An option is far longer than the file’s options.';
    return [{ check: 'option_holds_other', question: index, lines: option.lines, detail }];
  });

export const answerInOptions: QuestionCheck = (q, index) => {
  if (!q.answer || q.options.length === 0) return [];
  const letters = new Set(q.options.map((o) => o.letter));
  if (q.answer.letters.every((letter) => letters.has(letter))) return [];
  return [
    {
      check: 'answer_in_options',
      question: index,
      lines: q.answer.lines,
      detail: 'The answer names a letter the question has no option for.',
    },
  ];
};

export const explanationHoldsQuestion: QuestionCheck = (q, index, { file }) => {
  const labels = q.explanation.map((id) => {
    const text = file.lines[id]?.text ?? '';
    return { id, question: questionLabel(text) !== null, option: optionLabel(text) };
  });
  const lines = labels.flatMap((item, at) => {
    const prev = labels[at - 1]?.option;
    const run = item.option && prev && item.option.index === prev.index + 1;
    return item.question || run ? [item.id] : [];
  });
  if (lines.length === 0) return [];
  return [
    {
      check: 'explanation_holds_question',
      question: index,
      lines,
      detail: 'The explanation holds a question label or consecutive option labels.',
    },
  ];
};
