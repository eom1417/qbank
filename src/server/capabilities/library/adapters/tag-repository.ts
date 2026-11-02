import { isUniqueViolation } from '../../../platform/db/errors.js';
import type { Db } from '../../../platform/db/index.js';
import type { Tag } from '../domain/taxonomy.js';
import { deleteOwned, renameOwned } from './owned-rows.js';
import type { OwnedRef } from './taxonomy-repository.js';

/** Account-wide tags; names are unique per account, case-insensitively. */
export interface TagRepository {
  list(ownerId: string): Promise<Tag[]>;
  insert(tag: Tag & { ownerId: string; createdAt: Date }): Promise<'created' | 'name_taken'>;
  rename(ref: OwnedRef, name: string): Promise<'renamed' | 'missing' | 'name_taken'>;
  delete(ref: OwnedRef): Promise<boolean>;
}

export function createTagRepository(db: Db): TagRepository {
  return {
    async list(ownerId) {
      return db
        .selectFrom('tag')
        .select(['id', 'name'])
        .where('owner_id', '=', ownerId)
        .orderBy('name')
        .execute();
    },
    async insert(tag) {
      try {
        await db
          .insertInto('tag')
          .values({ id: tag.id, owner_id: tag.ownerId, name: tag.name, created_at: tag.createdAt })
          .execute();
        return 'created';
      } catch (error) {
        if (isUniqueViolation(error)) return 'name_taken';
        throw error;
      }
    },
    async rename(ref, name) {
      try {
        return (await renameOwned(db, 'tag', ref, name)) ? 'renamed' : 'missing';
      } catch (error) {
        if (isUniqueViolation(error)) return 'name_taken';
        throw error;
      }
    },
    delete: (ref) => deleteOwned(db, 'tag', ref),
  };
}
