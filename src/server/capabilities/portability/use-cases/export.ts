import { readFile } from 'node:fs/promises';
import { zipSync } from 'fflate';
import type { ExportPreviewResponse } from '../../../../contracts/portability.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import {
  EXPORT_JSON,
  NOT_INCLUDED,
  type ExportFile,
  type ExportQuestion,
} from '../domain/export-format.js';
import type { PortabilityDeps } from './deps.js';

type Rows = Awaited<ReturnType<PortabilityDeps['questions']['questionsOfBank']>>;
type Extras = Awaited<ReturnType<PortabilityDeps['questions']['extrasOf']>>;

async function ownedBank(deps: PortabilityDeps, actor: Actor, bankId: string) {
  const bank = isId(bankId) ? await deps.library.findBank(actor.accountId, bankId) : undefined;
  if (!bank) throw notFound();
  return bank;
}

/** The chapters the owner chose, or every one (FR-18-003, UAT-071). */
const chosen = (chapterIds: readonly string[]) => (chapterIds.length > 0 ? chapterIds : null);

/** A set difficulty, by the owner or inferred; none when unset (FR-11-005). */
function difficultyOf(row: Rows[number]): ExportQuestion['difficulty'] {
  if (row.difficulty_kind === 'unset' || row.difficulty === null) return null;
  return { kind: row.difficulty_kind, value: row.difficulty };
}

function toExportQuestion(row: Rows[number], extras: Extras): ExportQuestion {
  return {
    id: row.id,
    sourceId: row.source_id,
    page: row.source_page,
    number: row.source_number,
    occurrence: row.source_occurrence,
    seq: row.source_seq,
    kind: row.kind,
    stem: row.stem,
    options: row.options as ExportQuestion['options'],
    answers: row.answer_letters,
    provenance: row.answer_provenance,
    evidence: row.answer_evidence,
    explanation: row.explanation,
    updateNote: row.update_note,
    multiSelect: row.multi_select,
    studyNote: row.study_note as ExportQuestion['studyNote'],
    aiChanges: row.ai_changes,
    fileAnswer: row.file_answer,
    aiNote: row.ai_note,
    difficulty: difficultyOf(row),
    chapterId: row.chapter_id,
    topicId: row.topic_id,
    status: row.status === 'archived' ? 'excluded' : row.status,
    reasons: row.review_reasons,
    tagIds: (extras.tags.get(row.id) ?? []).map((t) => t.tag_id),
    notes: (extras.notes.get(row.id) ?? []).map((n) => ({ body: n.body, labels: n.labels })),
    pictures: (extras.media.get(row.id) ?? []).map((m) => ({
      file: `media/${m.id}.png`,
      kind: m.kind,
      page: m.page,
      position: m.position,
      width: m.width,
      height: m.height,
    })),
  };
}

/** Everything one export will hold, read once for the preview and the file alike. */
async function gather(
  deps: PortabilityDeps,
  actor: Actor,
  bankId: string,
  chapterIds: readonly string[],
) {
  const bank = await ownedBank(deps, actor, bankId);
  const rows = await deps.questions.questionsOfBank(actor.accountId, bank.id, chosen(chapterIds));
  const extras = await deps.questions.extrasOf(
    actor.accountId,
    rows.map((r) => r.id),
  );
  const chapters = (await deps.library.chaptersOf(actor.accountId, bank.id)).filter(
    (c) => chapterIds.length === 0 || chapterIds.includes(c.id),
  );
  const sources = await deps.sources.sourcesOfBank(actor.accountId, bank.id);
  return { bank, rows, extras, chapters, sources };
}

/** What the export of this choice holds and leaves out, before creating it (UI-26). */
export async function previewExport(
  deps: PortabilityDeps,
  actor: Actor,
  bankId: string,
  chapterIds: readonly string[],
): Promise<ExportPreviewResponse> {
  const { rows, extras, chapters, sources } = await gather(deps, actor, bankId, chapterIds);
  const count = (map: Map<string, unknown[]>) =>
    [...map.values()].reduce((sum, list) => sum + list.length, 0);
  return {
    questions: rows.length,
    pictures: count(extras.media),
    notes: count(extras.notes),
    chapters: chapters.length,
    sources: sources.length,
    notIncluded: NOT_INCLUDED,
  };
}

/**
 * The bank as one ZIP file (FR-18-001, UAT-069, UAT-070): the export JSON and the pictures it
 * names. No key, sign-in or original PDF is ever put in it (FR-18-004).
 */
export async function buildExport(
  deps: PortabilityDeps,
  actor: Actor,
  bankId: string,
  chapterIds: readonly string[],
) {
  const { bank, rows, extras, chapters, sources } = await gather(deps, actor, bankId, chapterIds);
  const tagIds = new Set(rows.flatMap((r) => (extras.tags.get(r.id) ?? []).map((t) => t.tag_id)));
  const file: ExportFile = {
    format: 'qbank-export',
    version: 1,
    exportedAt: deps.clock.now().toISOString(),
    bank: { name: bank.name, description: bank.description, subject: bank.subject },
    chapters: chapters.map((c) => ({
      id: c.id,
      name: c.name,
      topics: c.topics.map((t) => ({ id: t.id, name: t.name })),
    })),
    tags: (await deps.library.tagsOf(actor.accountId))
      .filter((t) => tagIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name })),
    sources,
    questions: rows.map((row) => toExportQuestion(row, extras)),
    notIncluded: NOT_INCLUDED,
  };
  const entries: Record<string, Uint8Array> = {
    [EXPORT_JSON]: new TextEncoder().encode(JSON.stringify(file)),
  };
  for (const media of [...extras.media.values()].flat())
    entries[`media/${media.id}.png`] = await readFile(deps.blobs.pathOf(media.blob_key));
  return {
    bytes: zipSync(entries),
    name: `qbank-${bank.name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.zip`,
  };
}
