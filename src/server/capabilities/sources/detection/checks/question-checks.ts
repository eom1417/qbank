import type { Doubt, DraftQuestion } from '../contract.js';
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

export const stemCheck: QuestionCheck = (q, index, { file }) =>
  textOf(file, q.stem) === '' && q.pictures.length === 0
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
