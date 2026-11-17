// M34 P4b: lesson D6.1 (curriculum level 6) — is a leftover picture a whole question? The model
// only POINTS to numbered OCR lines (principle 2: it never copies text); the code builds the stem,
// options and explanation verbatim from those lines. Cues are synthetic, never from a file.
import { z } from 'zod';
import { answerLetter, optionLabel, questionLabel } from '../../labels.js';
import type { LeftoverLine } from '../leftover.js';
import type { LessonCard } from '../lesson.js';

export interface StructureInput {
  lineCount: number;
}

export interface StructureOutput {
  question: boolean;
  stem: number[];
  /** The line each option starts on, in order; an option runs to the next start. */
  options: number[];
  explanation: number[];
}

const schema = z.object({
  question: z.boolean(),
  stem: z.array(z.number().int()),
  options: z.array(z.number().int()),
  explanation: z.array(z.number().int()),
});

const ascending = (numbers: readonly number[]) =>
  numbers.every((n, i) => i === 0 || n > (numbers[i - 1] ?? 0));

function outOfRange(input: StructureInput, output: StructureOutput): number | undefined {
  const all = [...output.stem, ...output.options, ...output.explanation];
  return all.find((n) => n < 1 || n > input.lineCount);
}

function shapeError(output: StructureOutput): string | null {
  if (!output.question) {
    const empty = output.stem.length + output.options.length + output.explanation.length === 0;
    return empty ? null : 'when it is not a question, stem, options and explanation must be empty';
  }
  if (output.stem.length === 0) return 'a question needs at least one stem line';
  if (output.options.length < 2) return 'a question needs at least two option starts';
  if (!ascending(output.options)) return 'option starts must be in increasing order';
  const firstOption = output.options[0] ?? 0;
  if (output.stem.some((n) => n >= firstOption))
    return 'stem lines must come before the first option';
  return null;
}

function check(input: StructureInput, output: StructureOutput): string | null {
  const wrong = outOfRange(input, output);
  if (wrong !== undefined) return `line ${wrong} does not exist (lines are 1…${input.lineCount})`;
  const shape = shapeError(output);
  if (shape) return shape;
  const used = [...output.stem, ...output.options, ...output.explanation];
  const repeated = used.find((n, i) => used.indexOf(n) !== i);
  return repeated === undefined ? null : `line ${repeated} is given twice; each line has one role`;
}

/** The numbered lines as the model reads them. */
export const numberedLines = (lines: readonly LeftoverLine[]) =>
  lines.map((line) => `${line.n}: ${line.text}`).join('\n');

export interface BuiltQuestion {
  number: number | null;
  stem: string;
  options: { letter: string; label: string; text: string }[];
  explanation: string | null;
  /** The explanation's lines, for reading a printed key among them. */
  explanationLines: string[];
}

const textOf = (lines: readonly LeftoverLine[], numbers: readonly number[]) =>
  numbers.flatMap((n) => lines.find((line) => line.n === n)?.text.trim() ?? []);

/** The lines of option `index`: from its start to the next start, skipping explanation lines. */
function optionLines(lines: readonly LeftoverLine[], output: StructureOutput, index: number) {
  const start = output.options[index] ?? 0;
  const end = output.options[index + 1] ?? Infinity;
  const firstNote = Math.min(Infinity, ...output.explanation.filter((n) => n > start));
  return lines
    .filter((line) => line.n >= start && line.n < Math.min(end, firstNote))
    .filter((line) => !output.explanation.includes(line.n))
    .map((line) => line.text.trim());
}

/**
 * Printed labels are kept only when they run in sequence (A, B, C…): OCR often reads a tick box
 * as a letter ("C)Text"), and a stray label would name the wrong option. Otherwise the options
 * take positional letters and keep their whole line, verbatim.
 */
function optionsOf(texts: readonly string[]) {
  const labels = texts.map((text) => optionLabel(text));
  const system = labels[0]?.system;
  const sequential = labels.every((label, i) => label?.index === i && label.system === system);
  return texts.map((text, i) => {
    const letter = answerLetter(i);
    const label = sequential ? labels[i] : null;
    return label
      ? { letter, label: label.label, text: label.text }
      : { letter, label: letter, text };
  });
}

/** The question built verbatim from the lines a passing reply pointed at; null for "no". */
export function buildStructure(
  lines: readonly LeftoverLine[],
  output: StructureOutput,
): BuiltQuestion | null {
  if (!output.question) return null;
  const stemText = textOf(lines, output.stem).join(' ');
  const label = questionLabel(stemText);
  const options = optionsOf(
    output.options.map((_, index) => optionLines(lines, output, index).join(' ')),
  );
  const explanationLines = textOf(lines, output.explanation);
  return {
    number: label?.number ?? null,
    stem: label?.text ?? stemText,
    options,
    explanation: explanationLines.length > 0 ? explanationLines.join(' ') : null,
    explanationLines,
  };
}

export const structureLesson: LessonCard<StructureInput, StructureOutput> = {
  id: 'D6.1',
  level: 6,
  needs: 'text',
  version: 1,
  question:
    'Each item is the numbered text lines of one picture. Is it a multiple-choice question? ' +
    'If yes: "question": true, "stem" = the line numbers of the question text, "options" = the line ' +
    'number where each answer option starts, in order, and "explanation" = the line numbers of any ' +
    'answer, explanation or notes. If not: "question": false and three empty lists. Give line numbers only, never text.',
  yesCues: [
    'a line like "7) Which drug is first-line for condition X?" then lines "A. drug one", "B. drug two"',
    'options shown with boxes or circles instead of letters, one per line, after the question',
    'lines after the options such as "Answer: B" or a paragraph explaining why: explanation',
  ],
  noCues: [
    'a paragraph of notes, a table or a list with no question and no options: question false',
    'a numbered list of facts without options: question false',
    'a heading, a source tag ("Exam 2019") or a page header above the question: leave it out of every list',
  ],
  schema,
  check,
  reviewReason: 'structure_unclear',
};
