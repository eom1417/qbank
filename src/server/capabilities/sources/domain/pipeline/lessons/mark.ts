// M34 P4b: lesson D4.mark (curriculum level 4) — which option the annotator marked as the answer,
// read from the crop of one question (stem and options). Cues are synthetic, never from a file.
import { z } from 'zod';
import type { LessonCard } from '../lesson.js';

/** One option as the crop shows it: its positional letter and the label the page printed. */
export interface MarkOption {
  letter: string;
  label: string;
}

export interface MarkInput {
  options: readonly MarkOption[];
}

/** The reply for one cell: the marked option (as printed), and the options struck out. */
export interface MarkOutput {
  letter: string | null;
  eliminated: string[];
}

const schema = z.object({
  letter: z.string().nullable(),
  eliminated: z.array(z.string()),
});

/** The option a reply names, by its printed label or its positional letter (any case). */
export function optionNamed(input: MarkInput, named: string): MarkOption | null {
  const wanted = named.trim().replace(/[().]/g, '').toUpperCase();
  return (
    input.options.find(
      (option) => option.label.toUpperCase() === wanted || option.letter === wanted,
    ) ?? null
  );
}

function check(input: MarkInput, output: MarkOutput): string | null {
  const labels = input.options.map((option) => option.label).join(', ');
  const unknown = [output.letter, ...output.eliminated].find(
    (named) => named !== null && optionNamed(input, named) === null,
  );
  if (unknown !== undefined)
    return `${unknown} is not an option of this cell (its options: ${labels})`;
  const marked = output.letter === null ? null : optionNamed(input, output.letter);
  const crossed = output.eliminated.map((named) => optionNamed(input, named));
  if (marked && crossed.includes(marked))
    return `${output.letter} cannot be both the marked answer and struck out`;
  return null;
}

/** The reply in positional letters (A, B, C…), once it passed `check`. */
export function markedLetters(input: MarkInput, output: MarkOutput) {
  const letterOf = (named: string) => optionNamed(input, named)?.letter ?? null;
  return {
    letter: output.letter === null ? null : letterOf(output.letter),
    eliminated: output.eliminated.flatMap((named) => letterOf(named) ?? []),
  };
}

export const markLesson: LessonCard<MarkInput, MarkOutput> = {
  id: 'D4.mark',
  level: 4,
  needs: 'vision',
  version: 2,
  question:
    'Which option letter does the annotator mark as the answer (a circle, a tick, a filled box ■, or a highlight over the option text)? ' +
    'An ✗ or a strike-through means NOT the answer: list those letters in "eliminated". ' +
    'Reply the letter as printed in "letter", or null if no option is marked.',
  yesCues: [
    'a hand-drawn circle or ring around an option letter',
    'a tick ✓ beside an option, also one drawn after the end of its text',
    'a filled box ■ beside an option while the others are empty □',
    'a colored highlight over the text of one option',
  ],
  noCues: [
    'an ✗ or a line through an option: that option goes in "eliminated", it is not the answer',
    'a circle, underline or highlight inside the question text, not on an option: confirmation only',
    'arrows leading to handwritten comments beside options: not a mark, whatever the comment says',
    'two or more options marked, or a mark with a question mark beside it: letter is null',
    'no mark on any option: letter is null',
  ],
  schema,
  check,
  reviewReason: 'mark_unclear',
};
