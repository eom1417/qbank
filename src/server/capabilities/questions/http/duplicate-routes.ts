import type { FastifyInstance } from 'fastify';
import {
  PairDecisionRequest,
  ReimportChoiceRequest,
  TransferRequest,
  type DuplicatePairsResponse,
  type TransferResponse,
} from '../../../../contracts/duplicates.js';
import type { QuestionResponse } from '../../../../contracts/questions.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import { decidePair, listPairs, type DuplicateDeps } from '../use-cases/duplicates.js';
import { getQuestion } from '../use-cases/question-actions.js';
import { chooseReimport, transferQuestions } from '../use-cases/transfer.js';

type IdParams = { Params: { id: string } };

/** Duplicates (M8.1–M8.4), re-import choices (M8.5) and moving questions between banks (M8.6). */
export function registerDuplicateRoutes(
  app: FastifyInstance,
  deps: DuplicateDeps,
  requireActor: RequireActor,
) {
  app.get<{ Params: { bankId: string } }>(
    '/api/banks/:bankId/duplicates',
    async (request): Promise<DuplicatePairsResponse> =>
      listPairs(deps, await requireActor(request), request.params.bankId),
  );
  app.post<IdParams>('/api/duplicates/:id/decision', async (request, reply) => {
    const actor = await requireActor(request);
    await decidePair(deps, actor, request.params.id, parseInput(PairDecisionRequest, request.body));
    return reply.status(204).send();
  });
  app.post('/api/questions/transfer', async (request): Promise<TransferResponse> => {
    const actor = await requireActor(request);
    return transferQuestions(deps, actor, parseInput(TransferRequest, request.body));
  });
  app.post<IdParams>(
    '/api/questions/:id/reimport-choice',
    async (request): Promise<QuestionResponse> => {
      const actor = await requireActor(request);
      const { use } = parseInput(ReimportChoiceRequest, request.body);
      await chooseReimport(deps, actor, request.params.id, use);
      return getQuestion(deps, actor, request.params.id);
    },
  );
}
