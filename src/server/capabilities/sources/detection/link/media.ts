import { mergeRegions, newRegions } from './media-regions.js';
import { rasterCache } from '../../use-cases/extract-questions.js';
import { ownerAt, placePictures, type QuestionFrame } from '../../domain/pipeline/placement.js';
import type { CaseGroup } from '../../domain/pipeline/case.js';
import { combineTags, takeTags, type QuestionTags } from '../../domain/pipeline/tags.js';
import { readsAsText, type VirtualText } from '../../domain/pipeline/virtual-text.js';
import type { DraftQuestion, FileLines, LineRole, Role } from '../contract.js';
import { attachCases } from './media-cases.js';
import {
  defaultRender,
  notePictures,
  orNothing,
  penMark,
  printedBoxes,
  withMark,
  type MediaRender,
} from './media-ink.js';
import { frameOfDraft, heldLines, viewOf } from './media-view.js';

// M39 step 4 (media): each draft question's pictures (question, option, case, or after the
// reveal), its shared case, its exam tags and pen-marked answer, by the M34 rules reused.

export type { MediaRender } from './media-ink.js';

/** Roles that leave a picture's words unread: the picture itself is then the content. */
const UNREAD = new Set<Role>(['unknown', 'filler', 'note']);

/**
 * Pictures read as text: one whose words were read into a question or a key. A figure is
 * never one, even with a few words on it (a label, a scale).
 */
export function consumedPictures(
  file: FileLines,
  roles: readonly LineRole[],
  questions: DraftQuestion[],
) {
  const held = new Set(questions.flatMap(heldLines));
  const role = new Map(roles.map((r) => [r.line, r.role]));
  const read = new Set<string>();
  for (const line of file.lines) {
    const used = held.has(line.id) || !UNREAD.has(role.get(line.id) ?? 'unknown');
    if (line.source === 'picture' && used) read.add(line.unitId);
  }
  const units = file.units.pages.flatMap((page) => page.units);
  return new Set(units.filter((u) => read.has(u.id) && readsAsText(u)).map((u) => u.id));
}

/** Exam tags: tag lines from the question's anchor to the next one's, and tags in its lines. */
function tagsOf(file: FileLines, tagLines: readonly number[], frames: readonly QuestionFrame[]) {
  const found: QuestionTags[][] = frames.map(() => []);
  for (const id of tagLines)
    found[ownerAt(frames, id)]?.push(takeTags(file.lines[id]?.text ?? '').tags);
  return found;
}

const ownTags = (file: FileLines, q: DraftQuestion) =>
  [...q.stem, ...q.options.flatMap((o) => o.lines), ...q.explanation].map(
    (id) => takeTags(file.lines[id]?.text ?? '').tags,
  );

interface Context {
  fileName: string;
  file: FileLines;
  roles: readonly LineRole[];
  view: VirtualText;
  frames: QuestionFrame[];
  render: MediaRender;
}

/** Pictures placed by the D3.1/D3.2/D6.3 rules, with handwritten notes after the reveal. */
async function picturesOf(context: Context, questions: DraftQuestion[], cases: CaseGroup[]) {
  const consumed = consumedPictures(context.file, context.roles, questions);
  const owned = placePictures({
    frames: context.frames,
    text: context.view,
    consumed,
    cases,
    namedOwner: () => null,
  });
  const notes = await notePictures({
    ...context,
    questions,
    printed: printedBoxes(context.file, context.view),
  });
  const pictures = owned.map((slot, index) => [...slot.pictures, ...(notes[index] ?? [])]);
  const readRegions = context.render.regions;
  const regions = readRegions
    ? await orNothing(readRegions(context.fileName, context.file.pages))
    : null;
  if (!regions) return pictures;
  const read = context.file.units.pages
    .flatMap((page) => page.units)
    .filter((unit) => consumed.has(unit.id));
  return mergeRegions(context.file, questions, pictures, newRegions(regions, read));
}

/** Pen marks, except on questions read from a picture or sharing a matching set's options. */
async function marked(context: Context, questions: DraftQuestion[], skip: ReadonlySet<number>) {
  const grey = rasterCache(context.fileName, context.render.grey);
  const input = {
    file: context.file,
    printed: printedBoxes(context.file, context.view),
    raster: (page: number) => orNothing(grey(page)),
  };
  const result: DraftQuestion[] = [];
  for (const [index, q] of questions.entries())
    result.push(skip.has(index) ? q : withMark(q, await penMark(input, q)));
  return result;
}

const copyOf = (q: DraftQuestion): DraftQuestion => ({
  ...q,
  options: q.options.map((option) => ({ ...option, lines: [...option.lines] })),
  caseLines: [...q.caseLines],
  conflicts: [...q.conflicts],
});

/**
 * Fills each draft question's pictures, case lines, tags and pen-marked answer. `render` draws
 * the pages (pen marks and handwritten notes); a page it cannot draw shows no ink.
 */
export async function attachMedia(
  fileName: string,
  file: FileLines,
  roles: LineRole[],
  questions: DraftQuestion[],
  render: MediaRender = defaultRender,
): Promise<DraftQuestion[]> {
  const drafts = questions.map(copyOf);
  const view = viewOf(file);
  const frames = drafts.map((q) => frameOfDraft(file, q));
  const context: Context = { fileName, file, roles, view, frames, render };
  const cases = attachCases(drafts, roles, frames, view);
  const pictures = await picturesOf(context, drafts, cases.groups);
  const tagLines = roles.filter((r) => r.role === 'tag').map((r) => r.line);
  const lineTags = tagsOf(file, tagLines, frames);
  const fromPicture = drafts.flatMap((q, i) =>
    file.lines[frames[i]?.stemAt ?? -1]?.source === 'picture' ? [i] : [],
  );
  const filled = drafts.map((q, index) => ({
    ...q,
    pictures: pictures[index] ?? [],
    tags: combineTags([q.tags, ...ownTags(file, q), ...(lineTags[index] ?? [])]),
  }));
  return marked(context, filled, new Set([...cases.shared, ...fromPicture]));
}
