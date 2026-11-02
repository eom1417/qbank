import type { Db } from '../../../platform/db/index.js';

/** Library tables whose rows are plain owner-scoped names (one rename/delete path for all). */
type NamedTable = 'chapter' | 'topic' | 'tag';

/** Renames a row the owner holds; false when it does not exist or belongs to someone else. */
export async function renameOwned(
  db: Db,
  table: NamedTable,
  ref: { ownerId: string; id: string },
  name: string,
): Promise<boolean> {
  const result = await db
    .updateTable(table)
    .set({ name })
    .where('owner_id', '=', ref.ownerId)
    .where('id', '=', ref.id)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

/** Deletes a row the owner holds (children cascade); false when nothing was deleted. */
export async function deleteOwned(
  db: Db,
  table: NamedTable,
  ref: { ownerId: string; id: string },
): Promise<boolean> {
  const result = await db
    .deleteFrom(table)
    .where('owner_id', '=', ref.ownerId)
    .where('id', '=', ref.id)
    .executeTakeFirst();
  return result.numDeletedRows > 0n;
}
