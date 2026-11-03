import type { FastifyInstance } from 'fastify';
import type { QuestionResponse } from '../../../../contracts/questions.js';
import type { RequireActor } from '../../identity/index.js';
import {
  acceptSuggestedAnswer,
  getQuestion,
  type QuestionsDeps,
} from '../use-cases/question-actions.js';

type IdParams = { Params: { id: string } };

/** One question, and accepting the answer the user's AI suggested (M6). */
export function registerQuestionRoutes(
  app: FastifyInstance,
  deps: QuestionsDeps,
  requireActor: RequireActor,
) {
  app.get<IdParams>('/api/questions/:id', async (request): Promise<QuestionResponse> =>
    getQuestion(deps, await requireActor(request), request.params.id),
  );

  app.post<IdParams>(
    '/api/questions/:id/accept-ai-answer',
    async (request): Promise<QuestionResponse> =>
      acceptSuggestedAnswer(deps, await requireActor(request), request.params.id),
  );
}
