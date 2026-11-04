import { Readable } from 'node:stream';
import { unzipSync, type Unzipped } from 'fflate';
import type { RestoreResponse } from '../../../../contracts/portability.js';
import { AppError } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import type { RestoredQuestion } from '../../questions/index.js';
import { EXPORT_JSON, ExportFile, type ExportQuestion } from '../domain/export-format.js';
import type { PortabilityDeps } from './deps.js';

const MAX_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const ALLOWED = /^(qbank-export\.json|media\/[A-Za-z0-9-]{1,64}\.png)$/;

/** Unpacks only the expected entries, refusing a file that would expand beyond the limits. */
function unpack(bytes: Uint8Array): Unzipped {
  let total = 0;
  try {
    return unzipSync(bytes, {
      filter: (entry) => {
        if (!ALLOWED.test(entry.name)) return false;
        total += entry.originalSize;
        if (entry.originalSize > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES)
          throw new AppError('payload_too_large');
        return true;
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('file_corrupt');
  }
}

/** The export inside the file, checked against the format: untrusted until it passes (FR-18-005). */
function exportOf(files: Unzipped): ExportFile {
  const json = files[EXPORT_JSON];
  if (!json) throw new AppError('file_unsupported');
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(json));
  } catch {
    throw new AppError('file_corrupt');
  }
  const parsed = ExportFile.safeParse(data);
  if (!parsed.success) throw new AppError('file_unsupported');
  return parsed.data;
}

/** Stores each picture the file holds; a picture it only names is counted as missing. */
async function storePictures(
  deps: PortabilityDeps,
  files: Unzipped,
  questions: readonly ExportQuestion[],
) {
  const keys = new Map<string, string>();
  let missing = 0;
  for (const picture of questions.flatMap((q) => q.pictures)) {
    const bytes = files[picture.file];
    if (!bytes) {
      missing += 1;
      continue;
    }
    const stored = await deps.blobs.put(Readable.from(Buffer.from(bytes)), MAX_ENTRY_BYTES);
    if (stored !== 'too_large') keys.set(picture.file, stored.key);
  }
  return { keys, missing };
}

interface Maps {
  sources: Map<string, string>;
  chapters: Map<string, string>;
  topics: Map<string, string>;
  tags: Map<string, string>;
  pictures: Map<string, string>;
}

/** One exported question with the new ids of everything it points to; null without its source. */
function restored(q: ExportQuestion, maps: Maps): RestoredQuestion | null {
  const sourceId = maps.sources.get(q.sourceId);
  if (!sourceId) return null;
  return {
    ...q,
    sourceId,
    chapterId: q.chapterId ? (maps.chapters.get(q.chapterId) ?? null) : null,
    topicId: q.topicId ? (maps.topics.get(q.topicId) ?? null) : null,
    reasons: q.reasons,
    tagIds: q.tagIds.flatMap((id) => maps.tags.get(id) ?? []),
    pictures: q.pictures.flatMap((p) => {
      const blobKey = maps.pictures.get(p.file);
      return blobKey
        ? [
            {
              blobKey,
              page: p.page,
              position: p.position,
              kind: p.kind,
              width: p.width,
              height: p.height,
            },
          ]
        : [];
    }),
  };
}

/**
 * Restores an exported bank as a new bank of the account (FR-18-005, DEC-15 assumed: questions,
 * not attempt history). Nothing existing is overwritten; duplicates inside it are found as after
 * any import; what was missing is said.
 */
export async function restoreBank(
  deps: PortabilityDeps,
  actor: Actor,
  bytes: Uint8Array,
): Promise<RestoreResponse> {
  if (bytes.length > deps.maxUploadBytes) throw new AppError('payload_too_large');
  const files = unpack(bytes);
  const file = exportOf(files);
  const owner = actor.accountId;
  const tagNames = new Map(file.tags.map((t) => [t.id, t.name.toLocaleLowerCase()]));
  const library = await deps.library.restoreLibrary(owner, {
    bank: file.bank,
    chapters: file.chapters,
    tagNames: file.tags.map((t) => t.name),
  });
  const sources = await deps.sources.restoreSources(owner, library.bankId, file.sources);
  const pictures = await storePictures(deps, files, file.questions);
  const tags = new Map(
    [...tagNames].flatMap(([id, name]) =>
      library.tags.has(name) ? [[id, library.tags.get(name) as string]] : [],
    ),
  );
  const maps = {
    sources,
    chapters: library.chapters,
    topics: library.topics,
    tags,
    pictures: pictures.keys,
  };
  const questions = file.questions.flatMap((q) => restored(q, maps) ?? []);
  const count = await deps.questions.restoreQuestions(
    { ownerId: owner, bankId: library.bankId, now: deps.clock.now() },
    questions,
  );
  return {
    bankId: library.bankId,
    questions: count,
    pictures: pictures.keys.size,
    skipped: file.questions.length - questions.length,
    missingPictures: pictures.missing,
  };
}
