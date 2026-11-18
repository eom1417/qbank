import type { TextLine } from '../../domain/lines.js';
import type { Box } from '../../domain/page.js';
import type { QuestionFrame } from '../../domain/pipeline/placement.js';
import { pageFlow, virtualText, type VirtualText } from '../../domain/pipeline/virtual-text.js';
import type { DraftQuestion, FileLines, Line } from '../contract.js';

// M39 step 4 (media): the file's lines and draft questions seen as the M34 placement rules read
// them (a virtual text and question frames), so those rules are reused as they are.

const textLine = (line: Line): TextLine => ({
  page: line.page,
  text: line.text,
  box: line.box,
  words: line.words,
  rtl: line.rtl,
  start: line.rtl ? line.box.x1 : line.box.x0,
});

/** Each unit's first and last line ids. */
function unitSpans(lines: readonly Line[]) {
  const spans = new Map<string, { first: number; last: number }>();
  for (const line of lines) {
    const span = spans.get(line.unitId);
    if (span) span.last = line.id;
    else spans.set(line.unitId, { first: line.id, last: line.id });
  }
  return spans;
}

/**
 * Each unit's place in the reading order: its first line, or (a unit with no line, such as a
 * figure) halfway between the line before it and the next one, as the virtual text places it.
 */
function unitOrder(file: FileLines): Map<string, number> {
  const spans = unitSpans(file.lines);
  const order = new Map<string, number>();
  let cursor = 0;
  for (const page of file.units.pages)
    for (const unit of pageFlow(page.units)) {
      const span = spans.get(unit.id);
      order.set(unit.id, span ? span.first : cursor - 0.5);
      if (span) cursor = Math.max(cursor, span.last + 1);
    }
  return order;
}

/** The file as one virtual text: its lines by id, its units, and the pictures over print. */
export function viewOf(file: FileLines): VirtualText {
  const { units, covers } = virtualText(file.units.pages, [], []);
  const lines = file.lines.map((line) => ({
    line: textLine(line),
    unitId: line.unitId,
    fromPicture: line.source === 'picture',
  }));
  return { lines, order: unitOrder(file), units, covers };
}

/** Where an option's printed letter is: its first word, else its first line. */
export function letterBox(file: FileLines, lines: readonly number[]): Box | null {
  const line = file.lines[lines[0] ?? -1];
  return line ? (line.words[0]?.box ?? line.box) : null;
}

/** The question's label and stem lines (its anchor), in order. */
export const anchorLines = (q: DraftQuestion): number[] =>
  [...(q.labelLine === null ? [] : [q.labelLine]), ...q.stem].sort((a, b) => a - b);

/** Every line a question already holds. */
export const heldLines = (q: DraftQuestion): number[] => [
  ...anchorLines(q),
  ...q.options.flatMap((option) => option.lines),
  ...(q.answer?.lines ?? []),
  ...q.explanation,
  ...q.caseLines,
];

/** A draft question as a placement frame: its anchor, options and own lines' spots. */
export function frameOfDraft(file: FileLines, q: DraftQuestion): QuestionFrame {
  const options = q.options.flatMap((option) => {
    const line = file.lines[option.lines[0] ?? -1];
    return line ? [{ letter: option.letter, at: line.id, page: line.page, box: line.box }] : [];
  });
  const own = [...anchorLines(q), ...q.options.flatMap((option) => option.lines)];
  const lines = own.flatMap((id) => (file.lines[id] ? [file.lines[id]] : []));
  return {
    number: q.number,
    stem: q.stem.map((id) => file.lines[id]?.text ?? '').join(' '),
    stemAt: own.length > 0 ? Math.min(...own) : -1,
    endAt: Math.max(...own, -1),
    options,
    spans: lines.map((line) => ({ page: line.page, box: line.box })),
  };
}
