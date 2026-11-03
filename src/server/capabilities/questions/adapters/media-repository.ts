import type { Db } from '../../../platform/db/index.js';
import type { ImportedMedia } from '../domain/imported.js';

interface SourcePlace {
  ownerId: string;
  sourceId: string;
}

/**
 * Replaces a source's pictures with a new import's (a retry never duplicates them) and returns
 * the blob keys that are no longer used, for the caller to delete.
 */
async function replaceMedia(
  db: Db,
  newId: () => string,
  place: SourcePlace,
  items: readonly ImportedMedia[],
  now: Date,
): Promise<string[]> {
  const old = await db
    .deleteFrom('media')
    .where('owner_id', '=', place.ownerId)
    .where('source_id', '=', place.sourceId)
    .returning('blob_key')
    .execute();
  for (const item of items) {
    const question = await db
      .selectFrom('question')
      .select('id')
      .where('owner_id', '=', place.ownerId)
      .where('source_id', '=', place.sourceId)
      .where('source_page', '=', item.questionPage)
      .where('source_number', '=', item.questionNumber)
      .executeTakeFirst();
    if (!question) continue;
    await db
      .insertInto('media')
      .values({
        id: newId(),
        owner_id: place.ownerId,
        source_id: place.sourceId,
        question_id: question.id,
        position: item.position,
        page: item.page,
        box: JSON.stringify(item.box),
        kind: item.kind,
        modality: item.modality,
        link: item.certain ? 'certain' : 'uncertain',
        blob_key: item.blobKey,
        width: item.width,
        height: item.height,
        quality: JSON.stringify(item.quality),
        low_quality: item.quality.low,
        created_at: now,
      })
      .execute();
  }
  return old.map((row) => row.blob_key);
}

/** A source's pictures with their question's number, in reading order. */
const mediaOfSource = (db: Db, ownerId: string, sourceId: string) =>
  db
    .selectFrom('media')
    .innerJoin('question', 'question.id', 'media.question_id')
    .select([
      'media.id',
      'media.page',
      'media.position',
      'media.kind',
      'media.modality',
      'media.link',
      'media.width',
      'media.height',
      'media.low_quality',
      'question.source_number as question_number',
    ])
    .where('media.owner_id', '=', ownerId)
    .where('media.source_id', '=', sourceId)
    .orderBy('question.source_page')
    .orderBy('question.source_number')
    .orderBy('media.position')
    .execute();

/** Owner-scoped store of the pictures kept for questions. */
export function createMediaRepository(db: Db, newId: () => string) {
  return {
    replaceMedia: (place: SourcePlace, items: readonly ImportedMedia[], now: Date) =>
      replaceMedia(db, newId, place, items, now),
    mediaOfSource: (ownerId: string, sourceId: string) => mediaOfSource(db, ownerId, sourceId),
    /** One picture's stored file, only for its owner. */
    findMedia: (ownerId: string, mediaId: string) =>
      db
        .selectFrom('media')
        .select(['blob_key', 'source_id'])
        .where('owner_id', '=', ownerId)
        .where('id', '=', mediaId)
        .executeTakeFirst(),
  };
}

export type MediaRow = Awaited<ReturnType<typeof mediaOfSource>>[number];
