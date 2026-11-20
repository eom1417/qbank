// M34 P6 (Q26): what each unit of a page became in the import, and a question rebuilt from its
// units after the owner corrected their roles. Every word stays the unit's own (Z2).
import { optionLabel, questionLabel } from '../labels.js';
import type { PipelineQuestion } from './question.js';
import type { Unit, UnitKind } from './units.js';

/** A unit's role: a part of a question, a picture with its place, filler, or nothing (dropped). */
export type BlockRole =
  | 'stem'
  | `option:${string}`
  | 'explanation'
  | 'case'
  | 'picture:question'
  | `picture:option:${string}`
  | 'picture:explanation'
  | 'filler'
  | 'dropped';

const LETTER = /^[A-J]$/;
const FIXED = new Set([
  'stem',
  'explanation',
  'case',
  'picture:question',
  'picture:explanation',
  'filler',
  'dropped',
]);

/** A role as stored or sent, or null when it is none of the known roles. */
export function parseRole(raw: string): BlockRole | null {
  if (FIXED.has(raw)) return raw as BlockRole;
  const letter = /^(?:picture:)?option:(.+)$/.exec(raw)?.[1];
  return letter && LETTER.test(letter) ? (raw as BlockRole) : null;
}

/** The roles a unit of this kind may take: text is read into parts, a picture is placed. */
export function rolesFor(kind: UnitKind, letters: readonly string[]): BlockRole[] {
  if (kind === 'text_line')
    return [
      'stem',
      ...letters.map((l) => `option:${l}` as const),
      'explanation',
      'case',
      'filler',
      'dropped',
    ];
  return [
    'picture:question',
    ...letters.map((l) => `picture:option:${l}` as const),
    'picture:explanation',
    'case',
    'filler',
    'dropped',
  ];
}

/** Roles that make a unit part of a question (filler and dropped units are of none). */
export const isQuestionRole = (role: BlockRole) => role !== 'filler' && role !== 'dropped';

export interface RoledUnit {
  unit: Unit;
  role: BlockRole;
  /** The question's index in the import's list (its `source_seq`); null for filler and dropped. */
  question: number | null;
}

const normal = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** The line without its printed question or option label. */
function bodyOf(line: string): string {
  const option = optionLabel(line);
  if (option) return normal(option.text);
  return normal(questionLabel(line)?.text ?? line);
}

const within = (part: string | null, body: string) =>
  part !== null && body !== '' && normal(part).includes(body);

/** A line printed with one of the question's option labels, whose words are that option's. */
function labelledOption(question: PipelineQuestion, line: string, body: string): BlockRole | null {
  const label = optionLabel(line)?.label.toUpperCase();
  const option = label ? question.options.find((o) => o.label.toUpperCase() === label) : undefined;
  return option && (body === '' || within(option.text, body)) ? `option:${option.letter}` : null;
}

/** A line printed with the question's own number (its words, if any, are the stem's). */
const numberedStem = (question: PipelineQuestion, line: string, body: string) =>
  questionLabel(line)?.number === question.number && body === '';

/** The part of `question` a text line is, or null when the line is none of it. */
function textPartOf(question: PipelineQuestion, line: string): BlockRole | null {
  const body = bodyOf(line);
  const option = labelledOption(question, line, body);
  if (option) return option;
  if (numberedStem(question, line, body) || within(question.stem, body)) return 'stem';
  if (within(question.explanation, body)) return 'explanation';
  if (within(question.caseText, body)) return 'case';
  const byText = question.options.find((o) => within(o.text, body));
  return byText ? `option:${byText.letter}` : null;
}

const placedRole = (picture: PipelineQuestion['pictures'][number]): BlockRole => {
  if (picture.placement === 'option' && picture.optionLetter)
    return `picture:option:${picture.optionLetter}`;
  if (picture.placement === 'explanation') return 'picture:explanation';
  return picture.placement === 'case' ? 'case' : 'picture:question';
};

/** Every kept picture's role and question, by its unit (a case's first question keeps it). */
function pictureRoles(questions: readonly PipelineQuestion[]) {
  const roles = new Map<string, { role: BlockRole; question: number }>();
  questions.forEach((question, index) => {
    for (const picture of question.pictures)
      if (!roles.has(picture.unitId))
        roles.set(picture.unitId, { role: placedRole(picture), question: index });
  });
  return roles;
}

const byReading = (a: Unit, b: Unit) => a.page - b.page || a.order - b.order;

/** The text line's part in the current question or the next one (the cursor moves on). */
function lineRole(questions: readonly PipelineQuestion[], cursor: { at: number }, unit: Unit) {
  for (const index of [cursor.at, cursor.at + 1]) {
    const question = questions[index];
    if (!question || !question.pages.includes(unit.page)) continue;
    const role = textPartOf(question, unit.text ?? '');
    if (role === null) continue;
    cursor.at = index;
    return { unit, role, question: index };
  }
  return { unit, role: 'dropped' as const, question: null };
}

/**
 * Each unit's role from the import's final questions: pictures by their placement, text lines
 * matched to the question parts in reading order, filler as filler, anything else dropped.
 */
export function assignRoles(
  units: readonly Unit[],
  questions: readonly PipelineQuestion[],
): RoledUnit[] {
  const pictures = pictureRoles(questions);
  const cursor = { at: 0 };
  return [...units].sort(byReading).map((unit): RoledUnit => {
    const picture = pictures.get(unit.id);
    if (picture) return { unit, ...picture };
    if (unit.kind === 'filler') return { unit, role: 'filler', question: null };
    if (unit.kind !== 'text_line') return { unit, role: 'dropped', question: null };
    return lineRole(questions, cursor, unit);
  });
}

/** A stored unit as the editor and the re-assembly see it. */
export interface RoleBlock {
  unitId: string;
  page: number;
  order: number;
  kind: UnitKind;
  text: string | null;
  role: BlockRole;
}

interface PicturePlace {
  unitId: string;
  placement: 'question' | 'option' | 'explanation' | 'case';
  optionLetter: string | null;
}

export interface Assembled {
  stem: string;
  options: { letter: string; text: string }[];
  explanation: string | null;
  pictures: PicturePlace[];
}

const join = (blocks: readonly RoleBlock[], separator: string) =>
  blocks
    .map((block) => (block.text ?? '').trim())
    .filter((text) => text !== '')
    .join(separator);

/** The stem's lines verbatim, its first without the printed number. */
function stemOf(blocks: readonly RoleBlock[]): string {
  const [first, ...rest] = blocks;
  if (!first) return '';
  const head = questionLabel(first.text ?? '')?.text ?? first.text ?? '';
  return join([{ ...first, text: head }, ...rest], ' ');
}

/** Each option's lines verbatim, the first without its printed letter, in letter order. */
function optionsOf(blocks: readonly RoleBlock[]) {
  const byLetter = new Map<string, RoleBlock[]>();
  for (const block of blocks) {
    const letter = /^option:(.)$/.exec(block.role)?.[1];
    if (letter) byLetter.set(letter, [...(byLetter.get(letter) ?? []), block]);
  }
  return [...byLetter.keys()].sort().map((letter) => {
    const [first, ...rest] = byLetter.get(letter) ?? [];
    const head = first ? (optionLabel(first.text ?? '')?.text ?? first.text) : null;
    return { letter, text: join(first ? [{ ...first, text: head }, ...rest] : rest, ' ') };
  });
}

function placeOf(block: RoleBlock): PicturePlace | null {
  if (block.kind === 'text_line') return null;
  const { unitId, role } = block;
  const letter = /^picture:option:(.)$/.exec(role)?.[1];
  if (letter) return { unitId, placement: 'option', optionLetter: letter };
  if (role === 'picture:question') return { unitId, placement: 'question', optionLetter: null };
  if (role === 'picture:explanation')
    return { unitId, placement: 'explanation', optionLetter: null };
  return role === 'case' ? { unitId, placement: 'case', optionLetter: null } : null;
}

/** A question rebuilt from its units: text verbatim from the units, pictures with their place. */
export function assemble(blocks: readonly RoleBlock[]): Assembled {
  const ordered = [...blocks].sort((a, b) => a.page - b.page || a.order - b.order);
  const text = ordered.filter((block) => block.kind === 'text_line');
  const explanation = join(
    text.filter((block) => block.role === 'explanation'),
    '\n',
  );
  return {
    stem: stemOf(text.filter((block) => block.role === 'stem')),
    options: optionsOf(text),
    explanation: explanation === '' ? null : explanation,
    pictures: ordered.flatMap((block) => placeOf(block) ?? []),
  };
}

/**
 * Pages of unknown shape: content units but none of them became part of a question (the
 * pipeline could not read the page; Q44 counts them).
 */
export function unknownShapePages(
  blocks: readonly Pick<RoleBlock, 'page' | 'kind' | 'role'>[],
): number[] {
  const content = new Set<number>();
  const read = new Set<number>();
  for (const block of blocks) {
    if (block.kind === 'filler') continue;
    content.add(block.page);
    if (isQuestionRole(block.role)) read.add(block.page);
  }
  return [...content].filter((page) => !read.has(page)).sort((a, b) => a - b);
}
