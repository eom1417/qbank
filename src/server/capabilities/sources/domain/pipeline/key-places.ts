// M34 P4a, D4.1 in code: a printed key line ("Answer: C") answers the question it is printed
// with. Inside a screenshot it answers the question read from that same picture; elsewhere
// the nearest question before it in reading order (D3.1). Read by the existing key owner.
import type { QuestionKeys } from '../answer-keys.js';
import { inlineAnswer } from '../key-lines.js';
import type { SeparatedLines } from '../key-pass.js';
import type { Box } from '../page.js';
import type { ParsedQuestion } from '../questions.js';
import type { VirtualText } from './virtual-text.js';

/** Where each question's stem starts in the reading order, and the picture it was read in. */
function anchors(questions: readonly ParsedQuestion[], text: VirtualText) {
  const at = new Map<Box, number>(text.lines.map(({ line }, index) => [line.box, index]));
  return questions.map((question) => {
    const stemAt = at.get(question.spans[0]?.box as Box) ?? -1;
    return { stemAt, unitId: text.lines[stemAt]?.unitId ?? null };
  });
}

const rowsShared = (a: Box, b: Box) => Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);

/** A question read from a picture that sits beside the key's picture (side-by-side panels). */
function besidePanel(starts: ReturnType<typeof anchors>, text: VirtualText, unitId: string) {
  const key = text.units.get(unitId);
  if (!key || key.kind !== 'image') return -1;
  let best = -1;
  let shared = 0;
  starts.forEach((start, index) => {
    const stem = start.unitId === unitId ? undefined : text.units.get(start.unitId ?? '');
    const rows =
      stem?.kind === 'image' && stem.page === key.page ? rowsShared(stem.box, key.box) : 0;
    if (rows > shared) [best, shared] = [index, rows];
  });
  return best;
}

/**
 * The question a key line at `at` (in unit `unitId`) belongs to: the one read from the same
 * picture, else from the picture beside it, else the nearest before it; -1 when none.
 */
function ownerOf(
  starts: ReturnType<typeof anchors>,
  text: VirtualText,
  at: number,
  unitId: string,
) {
  const same = starts.findLastIndex((start) => start.unitId === unitId && start.stemAt <= at);
  if (same >= 0) return same;
  const beside = besidePanel(starts, text, unitId);
  if (beside >= 0) return beside;
  return starts.findLastIndex((start) => start.stemAt >= 0 && start.stemAt <= at);
}

const unitAt = (text: VirtualText, index: number) => text.lines[index]?.unitId ?? '';

/** The first key line at or after `from`: the line the key pass read the key from. */
const keyLineAfter = (text: VirtualText, from: number) =>
  text.lines.findIndex(
    (virtual, index) => index >= from && inlineAnswer(virtual.line.text) !== null,
  );

/**
 * Keys the key pass took out but could not tie to a question (the line before them was no
 * question line: a tag, a picture's caption, another panel) go to their owner by place. A
 * question that already has a key keeps it.
 */
export function keysByPlace(
  questions: readonly ParsedQuestion[],
  keys: readonly QuestionKeys[],
  text: VirtualText,
  inline: SeparatedLines['inline'],
): QuestionKeys[] {
  const placed = keys.map((key) => ({ ...key }));
  const starts = anchors(questions, text);
  const spans = new Set(questions.flatMap((question) => question.spans.map((span) => span.box)));
  const at = new Map(text.lines.map((virtual, index) => [virtual.line, index]));
  for (const { after, letters } of inline) {
    if ((after && spans.has(after.box)) || letters.length === 0) continue;
    const index = keyLineAfter(text, after ? (at.get(after) ?? -1) + 1 : 0);
    const slot = placed[ownerOf(starts, text, index, unitAt(text, index))];
    if (slot && !slot.key) Object.assign(slot, { key: letters, keyFrom: 'inline' });
  }
  return placed;
}
