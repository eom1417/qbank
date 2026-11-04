import type { FastifyInstance } from 'fastify';
import type { Clock } from '../../platform/clock.js';
import type { Db } from '../../platform/db/index.js';
import { newId } from '../../platform/ids.js';
import type { RequireActor } from '../identity/index.js';
import { createBankRepository } from './adapters/bank-repository.js';
import { createTagRepository } from './adapters/tag-repository.js';
import { createTaxonomyRepository } from './adapters/taxonomy-repository.js';
import { registerBankRoutes } from './http/routes.js';
import { registerTagRoutes } from './http/tag-routes.js';
import { registerTaxonomyRoutes } from './http/taxonomy-routes.js';
import { restoreLibrary, type RestoredLibrary } from './use-cases/portability.js';

export { toBankResponse } from './http/presenters.js';

interface LibrarySettings {
  db: Db;
  clock: Clock;
  requireActor: RequireActor;
}

export function createLibrary(settings: LibrarySettings) {
  const { db, requireActor } = settings;
  const deps = {
    banks: createBankRepository(db),
    taxonomy: createTaxonomyRepository(db),
    tags: createTagRepository(db),
    clock: settings.clock,
    newId,
  };
  return {
    /** A bank's chapters with their topics, for other capabilities (questions' suggestions). */
    chaptersOf: (ownerId: string, bankId: string) => deps.taxonomy.listChapters(ownerId, bankId),
    /** The account's bank ids, archived ones included (analytics over the whole library). */
    bankIdsOf: async (ownerId: string) =>
      (await deps.banks.listOwned(ownerId, { archived: 'include' })).map((bank) => bank.id),
    /** Whether the bank is the account's (questions' review lists are per bank). */
    ownsBank: async (ownerId: string, bankId: string) =>
      (await deps.banks.findOwned(ownerId, bankId)) !== undefined,
    /** One of the account's banks, for an export (M13). */
    findBank: (ownerId: string, bankId: string) => deps.banks.findOwned(ownerId, bankId),
    /** Restores an exported bank as a new one, with its chapters, topics and tags (FR-18-005). */
    restoreLibrary: (ownerId: string, input: RestoredLibrary) =>
      restoreLibrary(deps, ownerId, input),
    /** Deletes one bank with everything in it; other banks are untouched (FR-19-005). */
    deleteBank: (ownerId: string, bankId: string) => deps.banks.delete(ownerId, bankId),
    /** The account's tags, for questions' tag suggestions (FR-11-004). */
    tagsOf: (ownerId: string) => deps.tags.list(ownerId),
    register: (app: FastifyInstance) => {
      registerBankRoutes(app, deps, requireActor);
      registerTaxonomyRoutes(app, deps, requireActor);
      registerTagRoutes(app, deps, requireActor);
    },
  };
}
