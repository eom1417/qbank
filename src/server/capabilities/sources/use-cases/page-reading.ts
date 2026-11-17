// M34 P6 (Q26): a question's pages as the pipeline read them, and the question re-assembled after
// the owner corrected its units' roles: text verbatim from the units, pictures moved to their new
// place, saved through the question's edit owner as a new version.
import type { QuestionResponse } from '../../../../contracts/questions.js';
import type { PageReadingResponse, ReassembleRequest } from '../../../../contracts/review.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { StoredBlock } from '../adapters/import-blocks.js';
import { renderPng } from '../adapters/raster.js';
import type { PageText } from '../domain/page.js';
import {
  assemble,
  isQuestionRole,
  parseRole,
  rolesFor,
  type Assembled,
} from '../domain/pipeline/roles.js';
import type { SourcesDeps } from './deps.js';

type QuestionRow = NonNullable<Awaited<ReturnType<SourcesDeps['questions']['findQuestion']>>>;

const ALL_LETTERS = 'ABCDEFGHIJ'.split('');

async function ownedQuestion(deps: SourcesDeps, actor: Actor, id: string) {
  const question = isId(id) ? await deps.questions.findQuestion(actor.accountId, id) : undefined;
  if (!question) throw notFound();
  return question;
}

/** The question's units' job and pages: its own page and every page holding one of its units. */
async function readingOf(deps: SourcesDeps, question: QuestionRow) {
  const now = deps.clock.now();
  const jobId = await deps.blocks.latestJob(question.owner_id, question.source_id, now);
  if (!jobId) return null;
  const seq = question.source_seq;
  const near = [question.source_page - 1, question.source_page, question.source_page + 1];
  const around = await deps.blocks.onPages({ ownerId: question.owner_id, jobId }, near, now);
  const pages = new Set([question.source_page]);
  for (const block of around) if (block.question === seq) pages.add(block.page);
  const blocks = around.filter((block) => pages.has(block.page));
  return { jobId, seq, blocks, pages: [...pages].sort((a, b) => a - b) };
}

/** Letters the pickers offer: the question's options and the next letter. */
function lettersOf(question: QuestionRow): string[] {
  const count = (question.options as unknown[]).length;
  return ALL_LETTERS.slice(0, Math.min(ALL_LETTERS.length, Math.max(2, count + 1)));
}

/** Units of this question and dropped ones; filler and other questions' units stay as they are. */
const editable = (block: StoredBlock, seq: number) =>
  block.kind !== 'filler' && (block.question === seq || block.question === null);

/** The page's size from its reading; the units' extent when the page was not kept. */
async function pageSize(
  deps: SourcesDeps,
  question: QuestionRow,
  page: number,
  units: StoredBlock[],
) {
  const row = await deps.imports.pageOfSource(question.owner_id, question.source_id, page);
  const text = row?.content as PageText | undefined;
  if (text && text.width > 0) return { width: text.width, height: text.height };
  return {
    width: Math.max(1, ...units.map((u) => u.box.x1)),
    height: Math.max(1, ...units.map((u) => u.box.y1)),
  };
}

export async function getPageReading(
  deps: SourcesDeps,
  actor: Actor,
  id: string,
): Promise<PageReadingResponse> {
  const question = await ownedQuestion(deps, actor, id);
  const letters = lettersOf(question);
  const choices = { text: rolesFor('text_line', letters), picture: rolesFor('image', letters) };
  const base = { questionId: question.id, version: question.version, choices };
  const reading = await readingOf(deps, question);
  if (!reading) return { ...base, available: false, pages: [] };
  const source = await deps.imports.findSource(actor.accountId, question.source_id);
  const pages = await Promise.all(
    reading.pages.map(async (page) => {
      const units = reading.blocks.filter((block) => block.page === page);
      return {
        page,
        ...(await pageSize(deps, question, page, units)),
        imageUrl: source?.blob_key ? `/api/sources/${source.id}/pages/${page}` : null,
        units: units.map((u) => ({
          unitId: u.unitId,
          kind: u.kind,
          box: u.box,
          text: u.text,
          imageClass: u.imageClass,
          role: u.role,
          editable: editable(u, reading.seq),
        })),
      };
    }),
  );
  return { ...base, available: true, pages };
}

/** The units with the owner's roles; refused when a unit is unknown, another's or wrongly roled. */
function withRoles(blocks: readonly StoredBlock[], seq: number, input: ReassembleRequest) {
  const byId = new Map(blocks.map((block) => [block.unitId, block]));
  const changed = input.roles.map(({ unitId, role }) => {
    const block = byId.get(unitId);
    const parsed = parseRole(role);
    if (
      !block ||
      !parsed ||
      !editable(block, seq) ||
      !rolesFor(block.kind, ALL_LETTERS).includes(parsed)
    )
      throw new AppError('validation_failed', { roles: 'invalid_value' });
    return { ...block, role: parsed, question: isQuestionRole(parsed) ? seq : null };
  });
  for (const block of changed) byId.set(block.unitId, block);
  return { changed, all: [...byId.values()] };
}

/** The edit the re-assembled question makes: a stem always, options when it has some. */
function editOf(question: QuestionRow, rebuilt: Assembled, expectedVersion: number) {
  if (rebuilt.stem === '') throw new AppError('validation_failed', { roles: 'no_stem' });
  const options = rebuilt.options.filter((option) => option.text !== '');
  if (options.length === 1 || (options.length === 0 && question.kind === 'mcq'))
    throw new AppError('validation_failed', { roles: 'too_few_options' });
  return {
    expectedVersion,
    stem: rebuilt.stem,
    ...(options.length >= 2 ? { options } : {}),
    explanation: rebuilt.explanation,
  };
}

/**
 * Saves the new roles, rebuilds the question from its units and moves its pictures (Q26): one
 * transaction, so a failed step leaves the question, its units and its pictures as they were.
 */
export async function reassemble(
  deps: SourcesDeps,
  actor: Actor,
  id: string,
  input: ReassembleRequest,
): Promise<QuestionResponse> {
  const question = await ownedQuestion(deps, actor, id);
  const reading = await readingOf(deps, question);
  if (!reading) throw notFound();
  const { changed, all } = withRoles(reading.blocks, reading.seq, input);
  const rebuilt = assemble(all.filter((block) => block.question === reading.seq));
  const edit = editOf(question, rebuilt, input.expectedVersion);
  const boxes = new Map(all.map((block) => [block.unitId, block]));
  const places = rebuilt.pictures.flatMap((picture) => {
    const block = boxes.get(picture.unitId);
    return block ? [{ ...picture, page: block.page, box: block.box }] : [];
  });
  const target = { ownerId: actor.accountId, jobId: reading.jobId };
  return deps.questions.reassembleQuestion({
    actor,
    id: question.id,
    edit,
    places,
    alongside: (within) => deps.blocks.setRoles(target, changed, within),
  });
}

/** One page of the owner's kept original as PNG; not found once the original is erased. */
export async function sourcePage(deps: SourcesDeps, actor: Actor, sourceId: string, page: number) {
  const source = isId(sourceId)
    ? await deps.imports.findSource(actor.accountId, sourceId)
    : undefined;
  if (!source?.blob_key || !Number.isInteger(page) || page < 1 || page > source.page_count)
    throw notFound();
  return Buffer.from(await renderPng(deps.blobs.pathOf(source.blob_key), page), 'base64');
}
