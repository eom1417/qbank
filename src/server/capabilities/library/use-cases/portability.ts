import type { LibraryDeps } from './banks.js';

/** A bank as an export carries it: its details, chapters with topics, and tag names. */
export interface RestoredLibrary {
  bank: { name: string; description: string | null; subject: string | null };
  chapters: { id: string; name: string; topics: { id: string; name: string }[] }[];
  tagNames: string[];
}

/** The new ids of what was restored, by the ids the export used. */
export interface RestoreMaps {
  bankId: string;
  chapters: Map<string, string>;
  topics: Map<string, string>;
  /** Tags by lower-case name: an account tag of the same name is reused, never duplicated. */
  tags: Map<string, string>;
}

async function restoreTags(deps: LibraryDeps, ownerId: string, names: readonly string[]) {
  const tags = new Map(
    (await deps.tags.list(ownerId)).map((t) => [t.name.toLocaleLowerCase(), t.id]),
  );
  for (const name of names) {
    const key = name.toLocaleLowerCase();
    if (tags.has(key)) continue;
    const id = deps.newId();
    await deps.tags.insert({ id, name, ownerId, createdAt: deps.clock.now() });
    tags.set(key, id);
  }
  return tags;
}

/**
 * Restores an exported bank as a new bank of the account (FR-18-005): its own new ids, the
 * same chapters and topics, and tags matched by name. Nothing existing is overwritten.
 */
export async function restoreLibrary(
  deps: LibraryDeps,
  ownerId: string,
  input: RestoredLibrary,
): Promise<RestoreMaps> {
  const now = deps.clock.now();
  const bankId = deps.newId();
  await deps.banks.insert({
    id: bankId,
    ownerId,
    ...input.bank,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  const chapters = new Map<string, string>();
  const topics = new Map<string, string>();
  for (const [position, chapter] of input.chapters.entries()) {
    const id = deps.newId();
    await deps.taxonomy.insertChapter({
      id,
      ownerId,
      bankId,
      name: chapter.name,
      position,
      createdAt: now,
    });
    chapters.set(chapter.id, id);
    for (const topic of chapter.topics) {
      const topicId = deps.newId();
      await deps.taxonomy.insertTopic({
        id: topicId,
        ownerId,
        chapterId: id,
        name: topic.name,
        createdAt: now,
      });
      topics.set(topic.id, topicId);
    }
  }
  return { bankId, chapters, topics, tags: await restoreTags(deps, ownerId, input.tagNames) };
}
