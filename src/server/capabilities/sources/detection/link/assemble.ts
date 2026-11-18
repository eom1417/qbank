import { answerOpening } from '../../domain/key-lines.js';
import { answerLetter, optionLabel } from '../../domain/labels.js';
import type { DraftQuestion, FileLines, Line, LineRole, Role } from '../contract.js';
import { addKeyLine, applyKeys, type KeySection } from './answer-keys.js';

// M39 step 4 (plan §3): questions put together from the line roles, in reading order and across
// pages: label → stem → options (with their continuation lines) → answer → explanation. Answer
// keys printed anywhere later are matched by number and section order. Pictures, cases, tags and
// pen marks are the media step's (./media.ts).

type Part = 'stem' | 'option' | 'answer' | 'explanation';

interface State {
  questions: DraftQuestion[];
  current: DraftQuestion | null;
  part: Part;
  keys: KeySection[];
  /** The last line read was a key line: the next one belongs to the same section. */
  keyOpen: boolean;
}

/** Opens a question; with no printed number it follows on from the one before. */
function open(state: State, number: number | undefined, labelLine: number | null): DraftQuestion {
  const inferred = number === undefined;
  const question: DraftQuestion = {
    number: number ?? (state.questions.at(-1)?.number ?? 0) + 1,
    numberInferred: inferred,
    labelLine,
    stem: [],
    options: [],
    answer: null,
    conflicts: [],
    explanation: [],
    caseLines: [],
    pictures: [],
    tags: { exam: null, year: null },
  };
  state.questions.push(question);
  state.current = question;
  state.part = 'stem';
  return question;
}

/** The question a new stem or option line belongs to: a finished one gives way to a new one. */
const ongoing = (state: State): DraftQuestion =>
  state.current && (state.part === 'stem' || state.part === 'option')
    ? state.current
    : open(state, undefined, null);

/** A line that carries on the part being read (a stem, an option or an explanation goes on). */
function carryOn(state: State, line: Line): void {
  const question = state.current;
  if (!question) return;
  if (state.part === 'stem') question.stem.push(line.id);
  if (state.part === 'option') question.options.at(-1)?.lines.push(line.id);
  if (state.part === 'explanation') question.explanation.push(line.id);
}

/**
 * The question whose next option the roles step read past other text (a pasted explanation
 * between its options); null when the letter does not follow on or the question is answered.
 */
function interrupted(state: State, role: LineRole): DraftQuestion | null {
  const question = state.current;
  if (!question || question.answer || question.options.length === 0) return null;
  return role.letter === answerLetter(question.options.length) ? question : null;
}

function addOption(state: State, line: Line, role: LineRole): void {
  const question = interrupted(state, role) ?? ongoing(state);
  const last = question.options.at(-1);
  // The roles step marks a wrapped line with its option's letter: more of the same option.
  if (last && state.part === 'option' && role.letter === last.letter && !optionLabel(line.text)) {
    last.lines.push(line.id);
    return;
  }
  const letter = role.letter ?? answerLetter(question.options.length);
  const label = optionLabel(line.text)?.label ?? letter;
  question.options.push({ letter, label, lines: [line.id] });
  state.part = 'option';
}

function addAnswer(state: State, line: Line, role: LineRole): void {
  const question = state.current;
  if (!question) return;
  const letters = role.letters ?? (role.letter ? [role.letter] : []);
  const before = question.answer?.from === 'inline' ? question.answer : null;
  question.answer = {
    letters: [...new Set([...(before?.letters ?? []), ...letters])],
    lines: [...(before?.lines ?? []), line.id],
    from: 'inline',
  };
  state.part = 'answer';
}

/**
 * A question read earlier whose number this explanation opens with ("82. d) …"): the
 * explanation is that question's, and the letter its printed answer.
 */
function numberedOwner(state: State, line: Line): DraftQuestion | null {
  const opening = answerOpening(line.text);
  const owner = opening && state.questions.findLast((q) => q.number === opening.number);
  if (!opening || !owner) return null;
  owner.answer ??= { letters: opening.letters, lines: [line.id], from: 'key_table' };
  return owner;
}

function addExplanation(state: State, line: Line): void {
  state.current = numberedOwner(state, line) ?? state.current;
  if (!state.current) return;
  state.current.explanation.push(line.id);
  state.part = 'explanation';
}

/** A heading, a case text or a key line ends the question before it. */
function close(state: State): void {
  state.current = null;
}

const ignore = (): void => undefined;

const READ: Record<Role, (state: State, line: Line, role: LineRole) => void> = {
  label: (state, line, role) => void open(state, role.number, line.id),
  stem: (state, line) => {
    const question = ongoing(state);
    if (state.part === 'stem') question.stem.push(line.id);
    else carryOn(state, line);
  },
  option: addOption,
  answer: addAnswer,
  explanation: addExplanation,
  key_table: (state, _line, role) => {
    addKeyLine(state.keys, state.keyOpen, role, state.questions.length - 1);
    close(state);
  },
  case: close,
  heading: close,
  unknown: carryOn,
  tag: ignore,
  filler: ignore,
  note: ignore,
};

/** Roles that leave an open key section open (page furniture between two key lines). */
const KEEPS_KEY: ReadonlySet<Role> = new Set(['key_table', 'filler', 'note', 'tag']);

/**
 * A question printed with one option and no answer is answered by it, as the file's own text
 * shows it (an OCR read may have lost the others): evidence `single_option`, kept for review.
 */
function answerLoneOptions(file: FileLines, questions: DraftQuestion[]): void {
  for (const question of questions) {
    const [only] = question.options;
    if (question.answer || question.options.length !== 1 || !only) continue;
    if (file.lines[only.lines[0] ?? -1]?.source !== 'text') continue;
    question.answer = { letters: [only.letter], lines: [], from: 'single_option' };
  }
}

/** Every question of the file as line ids, answers from inline lines and key sections. */
export function assemble(file: FileLines, roles: readonly LineRole[]): DraftQuestion[] {
  const state: State = { questions: [], current: null, part: 'stem', keys: [], keyOpen: false };
  const byLine = new Map(roles.map((role) => [role.line, role]));
  for (const line of file.lines) {
    const role = byLine.get(line.id);
    if (!role || line.deviceNote) continue;
    READ[role.role](state, line, role);
    state.keyOpen = KEEPS_KEY.has(role.role) && (state.keyOpen || role.role === 'key_table');
  }
  applyKeys(state.questions, state.keys);
  answerLoneOptions(file, state.questions);
  return state.questions;
}
