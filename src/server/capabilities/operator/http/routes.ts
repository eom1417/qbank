import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  FeedbackRequest,
  type FeedbackListResponse,
  type QueueResponse,
  type ResetLinkResponse,
  type ResetRequestListResponse,
  type ServerStatusResponse,
} from '../../../../contracts/operator.js';
import { notFound } from '../../../platform/errors/index.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { OperatorDeps } from '../use-cases/deps.js';
import { closeFeedback, listFeedback, sendFeedback } from '../use-cases/feedback.js';

type IdParams = { Params: { id: string } };

/** A path id that is not a UUID names nothing: the same answer as an unknown one. */
function idOf(raw: string): string {
  const parsed = z.uuid().safeParse(raw);
  if (!parsed.success) throw notFound();
  return parsed.data;
}

/** Any signed-in account sends feedback to the operator (M31, B1). */
export function registerFeedbackRoute(
  app: FastifyInstance,
  deps: OperatorDeps,
  requireActor: RequireActor,
) {
  app.post('/api/feedback', async (request, reply) => {
    const actor = await requireActor(request);
    await sendFeedback(deps, actor, parseInput(FeedbackRequest, request.body));
    return reply.status(204).send();
  });
}

/** Password resets waiting for the operator (M31, B4). */
function registerResetRoutes(app: FastifyInstance, deps: OperatorDeps, gate: RequireActor) {
  app.get('/api/operator/resets', async (request): Promise<ResetRequestListResponse> => {
    await gate(request);
    const items = (await deps.resetRequests()).map((item) => ({
      ...item,
      requestedAt: item.requestedAt.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
    }));
    return { items };
  });
  app.post<{ Params: { accountId: string } }>(
    '/api/operator/resets/:accountId/link',
    async (request): Promise<ResetLinkResponse> => {
      const actor = await gate(request);
      const accountId = idOf(request.params.accountId);
      const handed = await deps.resetLink(accountId);
      // Who took a link for whom, never the link: it is a password for an hour.
      request.log.info({ operator: actor.accountId, accountId, fresh: handed.fresh }, 'reset link');
      return { ...handed, expiresAt: handed.expiresAt.toISOString() };
    },
  );
}

/**
 * The operator's console (DEC-40): feedback, resets, the queue and the server's status (M32);
 * never a bank or a question.
 */
export function registerOperatorRoutes(
  app: FastifyInstance,
  deps: OperatorDeps,
  requireOperator: RequireActor,
) {
  app.get('/api/operator/feedback', async (request): Promise<FeedbackListResponse> => {
    await requireOperator(request);
    return { items: await listFeedback(deps) };
  });
  app.post<IdParams>('/api/operator/feedback/:id/close', async (request, reply) => {
    await requireOperator(request);
    await closeFeedback(deps, idOf(request.params.id));
    return reply.status(204).send();
  });
  app.get('/api/operator/queue', async (request): Promise<QueueResponse> => {
    await requireOperator(request);
    return { workers: deps.workers, items: await deps.listQueue() };
  });
  app.get('/api/operator/status', async (request): Promise<ServerStatusResponse> => {
    await requireOperator(request);
    return { backup: await deps.backupStatus() };
  });
  registerResetRoutes(app, deps, requireOperator);
}
