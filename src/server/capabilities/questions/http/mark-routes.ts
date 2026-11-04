import type { FastifyInstance } from 'fastify';
import { MarkRequest } from '../../../../contracts/study.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { createMarkRepository } from '../adapters/study-pool.js';
import { owned, type QuestionsDeps } from '../use-cases/question-actions.js';

type IdParams = { Params: { id: string } };

interface MarkDeps extends QuestionsDeps {
  marks: ReturnType<typeof createMarkRepository>;
}

/** The owner's flag and favourite on a question (FR-12-007, UAT-044). */
export function registerMarkRoutes(
  app: FastifyInstance,
  deps: MarkDeps,
  requireActor: RequireActor,
) {
  app.put<IdParams>('/api/questions/:id/mark', async (request) => {
    const actor = await requireActor(request);
    const mark = parseInput(MarkRequest, request.body);
    await owned(deps, actor, request.params.id);
    await deps.marks.setMark(actor.accountId, request.params.id, mark, deps.clock.now());
    const [saved] = await deps.marks.marksOf(actor.accountId, [request.params.id]);
    return { flagged: saved?.flagged ?? false, favorite: saved?.favorite ?? false };
  });
}
