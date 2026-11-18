import { matchKeys, type PlacedKey } from '../../domain/answer-keys.js';
import type { KeyEntry } from '../../domain/key-lines.js';
import type { DraftQuestion, LineRole } from '../contract.js';

// M39 step 4: answer-key sections (end of a chapter, end of the book, answer pages) as the line
// roles show them, matched to the questions by number and section order (domain/answer-keys).

/** One key section: its consecutive key lines, after the question at `position` (-1: none). */
export interface KeySection {
  position: number;
  lines: number[];
  entries: (KeyEntry & { line: number })[];
}

/** Adds a key line to the open section, or opens one after the last question so far. */
export function addKeyLine(
  sections: KeySection[],
  open: boolean,
  role: LineRole,
  position: number,
): void {
  const last = sections.at(-1);
  const section = open && last ? last : { position, lines: [], entries: [] };
  if (section !== last) sections.push(section);
  section.lines.push(role.line);
  for (const entry of role.entries ?? []) section.entries.push({ ...entry, line: role.line });
}

/**
 * Gives every question with no inline answer the letters its key section prints. Numbering
 * restarting per chapter is matched by order (matchKeys); unmatched numbers stay unanswered.
 */
export function applyKeys(questions: DraftQuestion[], sections: readonly KeySection[]): void {
  const lineOf = new Map<readonly string[], number>();
  const placed: PlacedKey[] = sections.map((section) => ({
    position: section.position,
    entries: section.entries.map((entry) => {
      lineOf.set(entry.letters, entry.line);
      return { number: entry.number, letters: entry.letters };
    }),
  }));
  matchKeys(
    questions.map((question) => question.number),
    placed,
  ).forEach((letters, index) => {
    const question = questions[index];
    if (!letters || !question || question.answer) return;
    const line = lineOf.get(letters);
    const lines = line === undefined ? [] : [line];
    question.answer = { letters: [...letters], lines, from: 'key_table' };
  });
}
