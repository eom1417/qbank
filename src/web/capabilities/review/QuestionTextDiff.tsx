import { DiffText } from '../../design-system/index.js';
import { wordDiff } from '../../platform/text/word-diff.js';

interface QuestionText {
  stem: string;
  options: readonly { letter: string; text: string }[];
}

const textOf = (question: QuestionText) =>
  [question.stem, ...question.options.map((o) => `${o.letter}. ${o.text}`)].join('\n');

/** Two versions of a question's text (stem and options) as one word diff. */
export function QuestionTextDiff({ before, after }: { before: QuestionText; after: QuestionText }) {
  return <DiffText segments={wordDiff(textOf(before), textOf(after))} />;
}
