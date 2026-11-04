import type { FastifyInstance } from 'fastify';
import { EditQuestionRequest, type QuestionResponse } from '../../../../contracts/questions.js';
import {
  DeleteQuestionRequest,
  RestoreVersionRequest,
  type DeletionImpactResponse,
  type HistoryResponse,
} from '../../../../contracts/review.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import {
  deleteQuestion,
  deletionImpact,
  editQuestion,
  history,
  restoreVersion,
} from '../use-cases/edit.js';
import type { ReviewDeps } from '../use-cases/question-actions.js';

type IdParams = { Params: { id: string } };

/** Editing a question, its history and restoring a version, and deleting it (M7.2, M7.6, M7.7). */
export function registerEditRoutes(
  app: FastifyInstance,
  deps: ReviewDeps,
  requireActor: RequireActor,
) {
  app.patch<IdParams>('/api/questions/:id', async (request): Promise<QuestionResponse> => {
    const actor = await requireActor(request);
    const edit = parseInput(EditQuestionRequest, request.body);
    return editQuestion(deps, actor, request.params.id, edit);
  });

  app.get<IdParams>('/api/questions/:id/history', async (request): Promise<HistoryResponse> =>
    history(deps, await requireActor(request), request.params.id),
  );

  app.post<IdParams>(
    '/api/questions/:id/restore-version',
    async (request): Promise<QuestionResponse> => {
      const actor = await requireActor(request);
      const { version } = parseInput(RestoreVersionRequest, request.body);
      return restoreVersion(deps, actor, request.params.id, version);
    },
  );

  app.get<IdParams>(
    '/api/questions/:id/deletion-impact',
    async (request): Promise<DeletionImpactResponse> =>
      deletionImpact(deps, await requireActor(request), request.params.id),
  );

  app.post<IdParams>('/api/questions/:id/delete', async (request, reply) => {
    const actor = await requireActor(request);
    parseInput(DeleteQuestionRequest, request.body);
    await deleteQuestion(deps, actor, request.params.id);
    return reply.status(204).send();
  });
}
