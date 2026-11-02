import type { Db } from '../../../platform/db/index.js';
import { deleteOwned, renameOwned } from './owned-rows.js';
import type { Chapter } from '../domain/taxonomy.js';

interface NewChapter {
  id: string;
  ownerId: string;
  bankId: string;
  name: string;
  position: number;
  createdAt: Date;
}

interface NewTopic {
  id: string;
  ownerId: string;
  chapterId: string;
  name: string;
  createdAt: Date;
}

/** Chapters and topics, always filtered by owner (composite keys forbid cross-owner links). */
export interface TaxonomyRepository {
  listChapters(ownerId: string, bankId: string): Promise<Chapter[]>;
  insertChapter(chapter: NewChapter): Promise<void>;
  chapterExists(ownerId: string, chapterId: string): Promise<boolean>;
  insertTopic(topic: NewTopic): Promise<void>;
  /** Rename/delete a chapter or topic the owner holds; false when it is not theirs. */
  rename(kind: TaxonomyKind, ref: OwnedRef, name: string): Promise<boolean>;
  delete(kind: TaxonomyKind, ref: OwnedRef): Promise<boolean>;
}

export type TaxonomyKind = 'chapter' | 'topic';
export interface OwnedRef {
  ownerId: string;
  id: string;
}

async function topicsByChapter(db: Db, ownerId: string, chapterIds: string[]) {
  if (chapterIds.length === 0) return new Map<string, Chapter['topics']>();
  const rows = await db
    .selectFrom('topic')
    .select(['id', 'name', 'chapter_id'])
    .where('owner_id', '=', ownerId)
    .where('chapter_id', 'in', chapterIds)
    .orderBy('created_at')
    .execute();
  const grouped = new Map<string, Chapter['topics']>();
  for (const row of rows) {
    grouped.set(row.chapter_id, [
      ...(grouped.get(row.chapter_id) ?? []),
      { id: row.id, name: row.name },
    ]);
  }
  return grouped;
}

async function listChapters(db: Db, ownerId: string, bankId: string): Promise<Chapter[]> {
  const rows = await db
    .selectFrom('chapter')
    .select(['id', 'name', 'position'])
    .where('owner_id', '=', ownerId)
    .where('bank_id', '=', bankId)
    .orderBy('position')
    .execute();
  const topics = await topicsByChapter(
    db,
    ownerId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({ ...row, topics: topics.get(row.id) ?? [] }));
}

export function createTaxonomyRepository(db: Db): TaxonomyRepository {
  return {
    listChapters: (ownerId, bankId) => listChapters(db, ownerId, bankId),
    async insertChapter(c) {
      await db
        .insertInto('chapter')
        .values({
          id: c.id,
          owner_id: c.ownerId,
          bank_id: c.bankId,
          name: c.name,
          position: c.position,
          created_at: c.createdAt,
        })
        .execute();
    },
    async chapterExists(ownerId, chapterId) {
      const row = await db
        .selectFrom('chapter')
        .select('id')
        .where('owner_id', '=', ownerId)
        .where('id', '=', chapterId)
        .executeTakeFirst();
      return row !== undefined;
    },
    async insertTopic(t) {
      await db
        .insertInto('topic')
        .values({
          id: t.id,
          owner_id: t.ownerId,
          chapter_id: t.chapterId,
          name: t.name,
          created_at: t.createdAt,
        })
        .execute();
    },
    rename: (kind, ref, name) => renameOwned(db, kind, ref, name),
    delete: (kind, ref) => deleteOwned(db, kind, ref),
  };
}
