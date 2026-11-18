import { questionLabel } from '../../domain/labels.js';
import type { Doubt, DraftQuestion, FileLines } from '../contract.js';
import { partsInOrder, textOf, type CheckContext } from './question-lines.js';

type QuestionCheck = (q: DraftQuestion, index: number, ctx: CheckContext) => Doubt[];

const one = (check: Doubt['check'], question: number, lines: number[], detail: string): Doubt[] => [
  { check, question, lines, detail },
];

export const numberCheck: QuestionCheck = (q, index) =>
  q.numberInferred
    ? one(
        'number',
        index,
        q.labelLine === null ? q.stem.slice(0, 1) : [q.labelLine],
        'The file printed no number; it was inferred.',
      )
    : [];

/** The words after the printed label on the label line, then the stem lines. */
const stemText = (q: DraftQuestion, file: FileLines): string => {
  const head = q.labelLine === null ? '' : textOf(file, [q.labelLine]);
  return `${questionLabel(head)?.text ?? ''} ${textOf(file, q.stem)}`.trim();
};

export const stemCheck: QuestionCheck = (q, index, { file }) =>
  stemText(q, file) === '' && q.pictures.length === 0
    ? one(
        'stem',
        index,
        q.labelLine === null ? [] : [q.labelLine],
        'The question has no stem text.',
      )
    : [];

export const partsInOrderCheck: QuestionCheck = (q, index) => {
  const parts = partsInOrder(q);
  const broken = parts.findIndex((id, at) => at > 0 && id <= (parts[at - 1] ?? -1));
  return broken === -1
    ? []
    : one('parts_in_order', index, parts, 'The question’s lines jump back in reading order.');
};

export const caseLinkCheck: QuestionCheck = (q, index, { file }) =>
  q.caseLines.length > 0 && textOf(file, q.caseLines) === ''
    ? one('case_link', index, q.caseLines, 'The shared case linked to this question has no text.')
    : [];

export const keyUseQuestion: QuestionCheck = (q, index) =>
  q.conflicts.length > 0
    ? one(
        'key_use',
        index,
        q.answer?.lines ?? [],
        `Two answers disagree: ${q.conflicts.join('; ')}`,
      )
    : [];
