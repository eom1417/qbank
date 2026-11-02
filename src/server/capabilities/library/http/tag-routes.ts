import type { FastifyInstance } from 'fastify';
import { NameRequest, type TagListResponse } from '../../../../contracts/library.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { LibraryDeps } from '../use-cases/banks.js';
import { createTag, deleteTag, listTags, renameTag } from '../use-cases/tags.js';

type IdParams = { Params: { id: string } };

/** Account-wide tags (FR-11-004). */
export function registerTagRoutes(
  app: FastifyInstance,
  deps: LibraryDeps,
  requireActor: RequireActor,
) {
  app.get('/api/tags', async (request): Promise<TagListResponse> => {
    const actor = await requireActor(request);
    return { tags: await listTags(deps, actor) };
  });

  app.post('/api/tags', async (request, reply) => {
    const actor = await requireActor(request);
    const { name } = parseInput(NameRequest, request.body);
    return reply.status(201).send(await createTag(deps, actor, name));
  });

  app.patch<IdParams>('/api/tags/:id', async (request, reply) => {
    const actor = await requireActor(request);
    const { name } = parseInput(NameRequest, request.body);
    await renameTag(deps, actor, request.params.id, name);
    return reply.status(204).send();
  });

  app.delete<IdParams>('/api/tags/:id', async (request, reply) => {
    const actor = await requireActor(request);
    await deleteTag(deps, actor, request.params.id);
    return reply.status(204).send();
  });
}
