import type { FastifyInstance } from 'fastify';
import type { QuestionResponse } from '../../../../contracts/questions.js';
import {
  BulkApproveRequest,
  type BulkApproveResponse,
  type ReviewQueueResponse,
} from '../../../../contracts/review.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { ReviewDeps } from '../use-cases/question-actions.js';
import { approve, approveSafe, defer, exclude, restore, reviewQueue } from '../use-cases/review.js';

type IdParams = { Params: { id: string } };
type BankParams = { Params: { bankId: string } };

const DECISIONS = { approve, defer, exclude, restore } as const;

/** The bank's review queue and the owner's decisions on each question (M7.1, M7.3, M7.5). */
export function registerReviewRoutes(
  app: FastifyInstance,
  deps: ReviewDeps,
  requireActor: RequireActor,
) {
  app.get<BankParams>('/api/banks/:bankId/review', async (request): Promise<ReviewQueueResponse> =>
    reviewQueue(deps, await requireActor(request), request.params.bankId),
  );

  app.post<BankParams>(
    '/api/banks/:bankId/review/approve-safe',
    async (request): Promise<BulkApproveResponse> => {
      const actor = await requireActor(request);
      const { questionIds } = parseInput(BulkApproveRequest, request.body ?? {});
      return approveSafe(deps, actor, request.params.bankId, questionIds);
    },
  );

  for (const [name, decide] of Object.entries(DECISIONS)) {
    app.post<IdParams>(`/api/questions/:id/${name}`, async (request): Promise<QuestionResponse> =>
      decide(deps, await requireActor(request), request.params.id),
    );
  }
}
