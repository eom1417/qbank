import type { Actor } from '../../identity/index.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { TaxonomyKind } from '../adapters/taxonomy-repository.js';
import { nextPosition, type Chapter } from '../domain/taxonomy.js';
import { getBank, type LibraryDeps } from './banks.js';

/** Reference to an owner-scoped row; a malformed id behaves exactly like a missing one. */
export const ownedRef = (actor: Actor, id: string) => {
  if (!isId(id)) throw notFound();
  return { ownerId: actor.accountId, id };
};

export const orNotFound = (found: boolean) => {
  if (!found) throw notFound();
};

export async function getTaxonomy(deps: LibraryDeps, actor: Actor, bankId: string) {
  const bank = await getBank(deps, actor, bankId);
  return deps.taxonomy.listChapters(actor.accountId, bank.id);
}

export async function addChapter(deps: LibraryDeps, actor: Actor, bankId: string, name: string) {
  const chapters = await getTaxonomy(deps, actor, bankId);
  const chapter: Chapter = { id: deps.newId(), name, position: nextPosition(chapters), topics: [] };
  await deps.taxonomy.insertChapter({
    ...chapter,
    ownerId: actor.accountId,
    bankId,
    createdAt: deps.clock.now(),
  });
  return chapter;
}

export async function addTopic(deps: LibraryDeps, actor: Actor, chapterId: string, name: string) {
  const ref = ownedRef(actor, chapterId);
  orNotFound(await deps.taxonomy.chapterExists(ref.ownerId, ref.id));
  const topic = { id: deps.newId(), name };
  await deps.taxonomy.insertTopic({
    ...topic,
    ownerId: actor.accountId,
    chapterId,
    createdAt: deps.clock.now(),
  });
  return topic;
}

/** Renaming keeps the id, so every link to the chapter or topic survives (FR-11-003). */
export async function renameNode(
  deps: LibraryDeps,
  actor: Actor,
  node: { kind: TaxonomyKind; id: string; name: string },
) {
  orNotFound(await deps.taxonomy.rename(node.kind, ownedRef(actor, node.id), node.name));
}

/** Deleting a chapter deletes its topics; questions will become unclassified, never lost. */
export async function deleteNode(
  deps: LibraryDeps,
  actor: Actor,
  node: { kind: TaxonomyKind; id: string },
) {
  orNotFound(await deps.taxonomy.delete(node.kind, ownedRef(actor, node.id)));
}
