// M39 step 6: what of the model's answer for one region is accepted. Unknown ids or roles are
// ignored; text is accepted only on OCR and picture lines, and only as a spelling fix.
import type { LineAnswer, RolesOutput } from '../../domain/pipeline/lessons/roles.js';
import { isLineRole } from '../../domain/pipeline/lessons/roles.js';
import type { FileLines, LineRole } from '../contract.js';
import { isSpellingFix } from './closeness.js';

/** How sure a role the model gave is. */
const MODEL_CONFIDENCE = 0.9;

export interface Accepted {
  roles: LineRole[];
  corrections: Map<number, string>;
}

const lettersOf = (letter: string | null) => (letter ?? '').toUpperCase().match(/[A-Z]/g) ?? [];

function roleOf(answer: LineAnswer): LineRole | null {
  if (!isLineRole(answer.role)) return null;
  const role: LineRole = {
    line: answer.id,
    role: answer.role,
    confidence: MODEL_CONFIDENCE,
    byModel: true,
  };
  const letters = lettersOf(answer.letter);
  if (answer.role === 'label' && answer.number !== null) role.number = answer.number;
  if (answer.role === 'option' && letters.length === 1) role.letter = letters[0];
  if (answer.role === 'answer' && letters.length > 0) role.letters = letters;
  return role;
}

function correctionOf(file: FileLines, answer: LineAnswer): string | null {
  const line = file.lines[answer.id];
  if (!line || line.source === 'text' || answer.text === null) return null;
  const text = answer.text.trim();
  if (text === line.text.trim() || !isSpellingFix(line.text, text)) return null;
  return text;
}

/** The roles and spelling fixes accepted from one region's answer. */
export function acceptAnswer(
  file: FileLines,
  region: readonly number[],
  output: RolesOutput,
): Accepted {
  const accepted: Accepted = { roles: [], corrections: new Map() };
  for (const answer of output.lines) {
    if (!region.includes(answer.id)) continue;
    const role = roleOf(answer);
    if (role) accepted.roles.push(role);
    const text = correctionOf(file, answer);
    if (text !== null) accepted.corrections.set(answer.id, text);
  }
  return accepted;
}
