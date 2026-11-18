import { questionLabel } from '../../domain/labels.js';
import { caseGroups } from '../../domain/pipeline/case.js';
import type { QuestionFrame } from '../../domain/pipeline/placement.js';
import type { VirtualText } from '../../domain/pipeline/virtual-text.js';
import type { FileLines, LineRole } from '../contract.js';
import { sameParagraph, toTextLine, type Measure } from './geometry.js';

// M39 step 3: a block before two or more questions that refer to it is their case, by the one
// case rule (its cue, then the questions in its range or whose stems lean on it).

const QUESTION_PART = new Set(['stem', 'option', 'answer']);

/** Each labelled question as the case rule reads it: its stem text and where it ends. */
function framesOf(file: FileLines, roles: readonly LineRole[]): QuestionFrame[] {
  const labels = roles.filter((role) => role.role === 'label');
  return labels.map((label, index) => {
    const end = labels[index + 1]?.line ?? roles.length;
    const own = roles.slice(label.line + 1, end).filter((role) => QUESTION_PART.has(role.role));
    const text = (id: number) => file.lines[id]?.text ?? '';
    const head = text(label.line);
    const stem = own.filter((role) => role.role === 'stem').map((role) => text(role.line));
    const stemText = [questionLabel(head)?.text ?? head, ...stem].join(' ');
    const endAt = own.at(-1)?.line ?? label.line;
    return {
      number: label.number ?? 0,
      stem: stemText,
      stemAt: label.line,
      endAt,
      options: [],
      spans: [],
    };
  });
}

/** Lines no question part claims for sure: unplaced text, and the paragraph before a label. */
function freeLines(file: FileLines, roles: readonly LineRole[], measure: Measure): Set<number> {
  const free = new Set<number>();
  roles.forEach((role) => {
    const weak =
      role.confidence <= 0.5 && ['unknown', 'heading', 'explanation'].includes(role.role);
    if (weak) free.add(role.line);
    if (role.role !== 'label') return;
    for (let id = role.line - 1; roles[id]?.role === 'explanation'; id--) {
      free.add(id);
      const line = file.lines[id];
      if (!line || !sameParagraph(measure, file.lines[id - 1], line)) break;
    }
  });
  return free;
}

/** Re-reads the free blocks the case rule finds before the questions they cover as `case`. */
export function markCases(file: FileLines, roles: LineRole[], measure: Measure): void {
  const text: VirtualText = {
    lines: file.lines.map((line) => ({
      line: toTextLine(line),
      unitId: line.unitId,
      fromPicture: line.source === 'picture',
    })),
    order: new Map(),
    units: new Map(),
    covers: new Set(),
  };
  const free = freeLines(file, roles, measure);
  for (const group of caseGroups(framesOf(file, roles), text, free)) {
    for (let id = group.from; id < group.to; id++)
      if (free.has(id)) roles[id] = { line: id, role: 'case', confidence: 0.7 };
  }
}
