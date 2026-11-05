import type { FastifyInstance } from 'fastify';
import type { QuestionResponse, TopicCardsResponse } from '../../../../contracts/questions.js';
import { topicCards } from '../use-cases/topic-cards.js';
import type { RequireActor } from '../../identity/index.js';
import {
  acceptSuggestedAnswer,
  getQuestion,
  type QuestionsDeps,
} from '../use-cases/question-actions.js';

type IdParams = { Params: { id: string } };

/** One question, accepting the answer the user's AI suggested (M6), and topic cards (DEC-34). */
export function registerQuestionRoutes(
  app: FastifyInstance,
  deps: QuestionsDeps & { ownsBank(ownerId: string, bankId: string): Promise<boolean> },
  requireActor: RequireActor,
) {
  app.get<IdParams>('/api/questions/:id', async (request): Promise<QuestionResponse> =>
    getQuestion(deps, await requireActor(request), request.params.id),
  );

  app.get<{ Params: { bankId: string } }>(
    '/api/banks/:bankId/topic-cards',
    async (request): Promise<TopicCardsResponse> =>
      topicCards(deps, await requireActor(request), request.params.bankId),
  );

  app.post<IdParams>(
    '/api/questions/:id/accept-ai-answer',
    async (request): Promise<QuestionResponse> =>
      acceptSuggestedAnswer(deps, await requireActor(request), request.params.id),
  );
}
