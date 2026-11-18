// M39 step 6: lesson D3.roles — the role of each line in a region the rules doubted. The model
// only POINTS: line ids, roles, a number or a letter (principle 5: it never writes words of its
// own). The one exception is an OCR line's spelling, which the code accepts only when close.
import { z } from 'zod';
import type { Role } from '../../../detection/contract.js';
import type { LessonCard } from '../lesson.js';

const LINE_ROLES = [
  'label',
  'stem',
  'option',
  'answer',
  'key_table',
  'explanation',
  'case',
  'tag',
  'heading',
  'filler',
  'note',
  'unknown',
] as const satisfies readonly Role[];

export const isLineRole = (role: string): role is Role =>
  (LINE_ROLES as readonly string[]).includes(role);

export interface RolesInput {
  /** The region's line ids, as shown to the model. */
  lines: number[];
}

export interface LineAnswer {
  id: number;
  role: string;
  number: number | null;
  letter: string | null;
  /** OCR lines only: the line with its spelling corrected; null to keep it as read. */
  text: string | null;
}

export interface RolesOutput {
  lines: LineAnswer[];
}

const schema = z.object({
  lines: z.array(
    z.object({
      id: z.number().int(),
      role: z.string(),
      number: z.number().int().nullable(),
      letter: z.string().nullable(),
      text: z.string().nullable(),
    }),
  ),
});

/** A reply must name at least one of the region's lines; unknown ids or roles are ignored later. */
function check(input: RolesInput, output: RolesOutput): string | null {
  const known = output.lines.some((line) => input.lines.includes(line.id));
  return known ? null : `give a role for the lines shown (ids ${input.lines.join(', ')})`;
}

/** One region's lines as the model reads them; OCR lines are marked, the only ones it may fix. */
export function regionText(lines: readonly { id: number; text: string; ocr: boolean }[]): string {
  return lines.map((line) => `${line.id}${line.ocr ? ' [ocr]' : ''}: ${line.text}`).join('\n');
}

export const rolesLesson: LessonCard<RolesInput, RolesOutput> = {
  id: 'D3.roles',
  level: 3,
  needs: 'text',
  version: 2,
  question:
    'Each item is the lines of one part of an exam file, each starting with its line id. An optional image shows the same region for checking OCR; its cell number matches the text item. For every ' +
    `line give "id" and its "role", one of: ${LINE_ROLES.join(', ')}. "number" = the printed ` +
    'question number of a label line, else null. "letter" = the letter of an option line or the ' +
    'letters an answer line names, else null. "text" = null, except on a line marked [ocr] whose ' +
    'words were misread: then the same line with only its spelling fixed. Never add, drop or ' +
    'reword anything; give ids and roles, not text of your own.',
  yesCues: [
    'a line "12." or "Question 3" that starts a question: label, with its number',
    'lines "A. first choice", "B) second choice": option, with letters A and B',
    'a line "Answer: C" under a question: answer, letter C; "1-A 2-C 3-B" in a key: key_table',
    'a running header, footer or page number: filler; a device note typed over the page: note',
  ],
  noCues: [
    'never return a line id that is not in the item',
    'never put text on a line that is not marked [ocr], and never rewrite a whole line',
  ],
  schema,
  check,
  reviewReason: 'roles_unclear',
};
