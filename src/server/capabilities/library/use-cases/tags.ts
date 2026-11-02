import { AppError } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import type { Tag } from '../domain/taxonomy.js';
import type { LibraryDeps } from './banks.js';
import { orNotFound, ownedRef } from './taxonomy.js';

const nameTaken = () => new AppError('name_taken', { name: 'taken' });

export const listTags = (deps: LibraryDeps, actor: Actor) => deps.tags.list(actor.accountId);

export async function createTag(deps: LibraryDeps, actor: Actor, name: string): Promise<Tag> {
  const tag = { id: deps.newId(), name };
  const outcome = await deps.tags.insert({
    ...tag,
    ownerId: actor.accountId,
    createdAt: deps.clock.now(),
  });
  if (outcome === 'name_taken') throw nameTaken();
  return tag;
}

export async function renameTag(deps: LibraryDeps, actor: Actor, id: string, name: string) {
  const outcome = await deps.tags.rename(ownedRef(actor, id), name);
  if (outcome === 'name_taken') throw nameTaken();
  orNotFound(outcome === 'renamed');
}

export async function deleteTag(deps: LibraryDeps, actor: Actor, id: string) {
  orNotFound(await deps.tags.delete(ownedRef(actor, id)));
}
