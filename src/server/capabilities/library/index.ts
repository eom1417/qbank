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
    /** The account's tags, for questions' tag suggestions (FR-11-004). */
    tagsOf: (ownerId: string) => deps.tags.list(ownerId),
    register: (app: FastifyInstance) => {
      registerBankRoutes(app, deps, requireActor);
      registerTaxonomyRoutes(app, deps, requireActor);
      registerTagRoutes(app, deps, requireActor);
    },
  };
}
