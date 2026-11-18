import type {
  Detection,
  FileLines,
  Line,
  LineRole,
  Role,
} from '../../src/server/capabilities/sources/detection/contract.js';
import { assemble } from '../../src/server/capabilities/sources/detection/link/assemble.js';

// M39 step 4 fixtures: synthetic lines with their roles, one per row, stacked down each page.

export type Row = [page: number, text: string, role: Role, extra?: Partial<LineRole>];

/** A synthetic file: one line per row, stacked down each page, with its role. */
export function fileOf(rows: Row[]): { file: FileLines; roles: LineRole[] } {
  const lines: Line[] = rows.map(([page, text], id) => {
    const box = { x0: 10, y0: id * 20, x1: 300, y1: id * 20 + 12 };
    const words = text.split(' ').map((word, at) => ({
      text: word,
      box: { x0: 10 + at * 30, y0: box.y0, x1: 35 + at * 30, y1: box.y1 },
      font: 'Body',
    }));
    const base = { id, page, box, text, words, unitId: `u${id}`, rtl: false };
    return { ...base, source: 'text', confidence: null, deviceNote: false };
  });
  const roles = rows.map(([, , role, extra], line) => ({ line, role, confidence: 1, ...extra }));
  const layout = { lineHeight: 12, lineGap: 8, paragraphGap: 16, margins: new Map() };
  return { file: { lines, units: new Map() as never, pages: [], layout }, roles };
}

export const label = (page: number, text: string, number: number): Row => [
  page,
  text,
  'label',
  { number },
];
export const option = (page: number, text: string, letter: string): Row => [
  page,
  text,
  'option',
  { letter },
];
export const keys = (text: string, entries: [number, string][]): Row => [
  9,
  text,
  'key_table',
  { entries: entries.map(([number, letter]) => ({ number, letters: [letter] })) },
];

export function detectionOf(
  file: FileLines,
  roles: LineRole[],
  extra: Partial<Detection> = {},
): Detection {
  const questions = assemble(file, roles);
  return { file, roles, questions, doubts: [], corrections: new Map(), ...extra };
}
