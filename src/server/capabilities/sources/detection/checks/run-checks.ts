import type { Doubt, DraftQuestion, FileLines, LineRole } from '../contract.js';
import { coverageCheck, keyUseFile, numberingCheck } from './file-checks.js';
import {
  answerInOptions,
  explanationHoldsQuestion,
  optionHoldsOther,
  optionSequence,
  optionText,
} from './option-checks.js';
import { pictureCheck } from './picture-check.js';
import {
  caseLinkCheck,
  keyUseQuestion,
  numberCheck,
  partsInOrderCheck,
  stemCheck,
} from './question-checks.js';
import { median, type CheckContext } from './question-lines.js';

const QUESTION_CHECKS = [
  numberCheck,
  stemCheck,
  optionSequence,
  optionHoldsOther,
  answerInOptions,
  explanationHoldsQuestion,
  partsInOrderCheck,
  caseLinkCheck,
  keyUseQuestion,
];

/** M39 step 5: the twelve generic checks (plan §4), none of them tied to a kind of file. */
export function runChecks(file: FileLines, roles: LineRole[], questions: DraftQuestion[]): Doubt[] {
  const lengths = questions.flatMap((q) => q.options.map((o) => optionText(file, o.lines).length));
  const byLine = new Map(roles.map((role) => [role.line, role]));
  const ctx: CheckContext = { file, medianOption: median(lengths), roles: byLine };
  const perQuestion = questions.flatMap((q, index) => [
    ...QUESTION_CHECKS.flatMap((check) => check(q, index, ctx)),
    ...pictureCheck(q, index, ctx, questions),
  ]);
  return [
    ...perQuestion,
    ...coverageCheck(roles, questions),
    ...numberingCheck(questions),
    ...keyUseFile(roles),
  ];
}
