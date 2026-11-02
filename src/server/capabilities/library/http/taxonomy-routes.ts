import type { FastifyInstance } from 'fastify';
import { NameRequest, type TaxonomyResponse } from '../../../../contracts/library.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { TaxonomyKind } from '../adapters/taxonomy-repository.js';
import type { LibraryDeps } from '../use-cases/banks.js';
import {
  addChapter,
  addTopic,
  deleteNode,
  getTaxonomy,
  renameNode,
} from '../use-cases/taxonomy.js';
import { toChapterResponse } from './presenters.js';

type IdParams = { Params: { id: string } };
const KINDS: Record<string, TaxonomyKind> = { chapters: 'chapter', topics: 'topic' };

/** Chapters and topics of a bank (FR-03-003, FR-11-003). */
export function registerTaxonomyRoutes(
  app: FastifyInstance,
  deps: LibraryDeps,
  requireActor: RequireActor,
) {
  app.get<IdParams>('/api/banks/:id/taxonomy', async (request): Promise<TaxonomyResponse> => {
    const actor = await requireActor(request);
    const chapters = await getTaxonomy(deps, actor, request.params.id);
    return { chapters: chapters.map(toChapterResponse) };
  });

  app.post<IdParams>('/api/banks/:id/chapters', async (request, reply) => {
    const actor = await requireActor(request);
    const { name } = parseInput(NameRequest, request.body);
    const chapter = await addChapter(deps, actor, request.params.id, name);
    return reply.status(201).send(toChapterResponse(chapter));
  });

  app.post<IdParams>('/api/chapters/:id/topics', async (request, reply) => {
    const actor = await requireActor(request);
    const { name } = parseInput(NameRequest, request.body);
    return reply.status(201).send(await addTopic(deps, actor, request.params.id, name));
  });

  for (const [segment, kind] of Object.entries(KINDS)) {
    app.patch<IdParams>(`/api/${segment}/:id`, async (request, reply) => {
      const actor = await requireActor(request);
      const { name } = parseInput(NameRequest, request.body);
      await renameNode(deps, actor, { kind, id: request.params.id, name });
      return reply.status(204).send();
    });
    app.delete<IdParams>(`/api/${segment}/:id`, async (request, reply) => {
      const actor = await requireActor(request);
      await deleteNode(deps, actor, { kind, id: request.params.id });
      return reply.status(204).send();
    });
  }
}
