// M34 P4, D6.3 in code: a case text read before two or more questions that refer to it is
// shared by each of them, with its pictures (placement `case`). No AI.
import type { QuestionFrame } from './placement.js';
import { isTagLine } from './tags.js';
import type { VirtualText } from './virtual-text.js';

export interface CaseGroup {
  /** Indexes of the questions (frames) that share the case. */
  questions: number[];
  text: string;
  /** The case's place in reading order: from its first line up to the first question's anchor. */
  from: number;
  to: number;
}

/** A block introduces questions: "the following", "case", "questions 3–5", "(735-738)". */
const CASE_CUE =
  /\b(?:the\s+following|case|scenario|vignette)\b|\bquestions?\s*\d+\s*(?:-|–|to|and)\s*\d+|\(\s*\d+\s*[-–]\s*\d+\s*\)/i;
/** "questions 3–5" or "(735-738)": the numbers a case covers. */
const RANGE =
  /questions?\s*(\d{1,4})\s*(?:-|–|to|and)\s*(\d{1,4})|\(\s*(\d{1,4})\s*[-–]\s*(\d{1,4})\s*\)/i;
/** A stem that leans on text before it ("this patient", "the same child"). */
const BACK_REFERENCE =
  /\b(?:this|the\s+same|the\s+above|the\s+previous|the\s+aforementioned)\s+(?:patient|child|infant|baby|boy|girl|woman|man|case|scenario|newborn|neonate)\b/i;

/** The free lines (read by no question, key or explanation) right before `frame`'s anchor. */
function blockBefore(
  frame: QuestionFrame,
  text: VirtualText,
  free: ReadonlySet<number>,
  floor: number,
): number[] {
  const block: number[] = [];
  const anchor = text.lines[frame.stemAt];
  // A picture's edge ends the block: a case is read on the page, or inside the same picture.
  const sameSource = (at: number) => {
    const line = text.lines[at];
    if (!line || !anchor || line.fromPicture !== anchor.fromPicture) return false;
    return !line.fromPicture || line.unitId === anchor.unitId;
  };
  for (let at = frame.stemAt - 1; at > floor && free.has(at) && sameSource(at); at--) {
    if (isTagLine(text.lines[at]?.line.text ?? '')) break;
    block.unshift(at);
  }
  return block;
}

/**
 * The questions a case before `start` covers: those in its number range, or else the run of
 * questions whose stems all lean on it (a stem with its own scenario does not share one).
 */
function covered(frames: readonly QuestionFrame[], start: number, caseText: string): number[] {
  const range = RANGE.exec(caseText);
  const [low, high] = range
    ? [Number(range[1] ?? range[3]), Number(range[2] ?? range[4])]
    : [NaN, NaN];
  const members: number[] = [];
  for (let index = start; index < frames.length; index++) {
    const frame = frames[index] as QuestionFrame;
    const inside = range ? frame.number >= low && frame.number <= high && low < high : null;
    const leans = BACK_REFERENCE.test(frame.stem);
    if (!(inside ?? leans)) break;
    members.push(index);
  }
  return members;
}

/**
 * Case texts (D6.3): free lines right before a question that introduce what follows, shared by
 * the two or more questions they cover. `free` holds the orders of the virtual lines no
 * question, key or explanation read.
 */
export function caseGroups(
  frames: readonly QuestionFrame[],
  text: VirtualText,
  free: ReadonlySet<number>,
): CaseGroup[] {
  const groups: CaseGroup[] = [];
  let next = 0;
  frames.forEach((frame, index) => {
    if (index < next) return;
    const floor = frames[index - 1]?.endAt ?? -1;
    const block = blockBefore(frame, text, free, floor);
    const caseText = block.map((at) => text.lines[at]?.line.text ?? '').join(' ');
    if (!caseText || !CASE_CUE.test(caseText)) return;
    const questions = covered(frames, index, caseText);
    if (questions.length < 2) return;
    groups.push({ questions, text: caseText, from: block[0] ?? frame.stemAt, to: frame.stemAt });
    next = index + questions.length;
  });
  return groups;
}

/**
 * The question of a group whose options the others share (a matching set prints its options
 * once, after the last item): the only member with options, when every other has none.
 */
export function optionDonor(group: CaseGroup, optionCounts: readonly number[]): number | null {
  const withOptions = group.questions.filter((index) => (optionCounts[index] ?? 0) > 0);
  const donor = withOptions[0];
  return withOptions.length === 1 && donor !== undefined && (optionCounts[donor] ?? 0) >= 2
    ? donor
    : null;
}
