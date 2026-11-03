import type { FastifyInstance } from 'fastify';
import {
  StartAccountLoginRequest,
  SubmitLoginCodeRequest,
  type AccountLoginResponse,
} from '../../../../contracts/ai.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import {
  cancelAccountLogin,
  getAccountLogin,
  startAccountLogin,
  submitLoginCode,
} from '../use-cases/accounts.js';
import type { AiDeps } from '../use-cases/deps.js';

type IdParams = { Params: { id: string } };

/** Sign in with a Claude or ChatGPT (Codex) subscription through the official CLIs. */
export function registerAccountRoutes(
  app: FastifyInstance,
  deps: AiDeps,
  requireActor: RequireActor,
) {
  app.post('/api/ai/accounts/login', async (request, reply) => {
    const actor = await requireActor(request);
    const login: AccountLoginResponse = await startAccountLogin(
      deps,
      actor,
      parseInput(StartAccountLoginRequest, request.body),
    );
    return reply.status(201).send(login);
  });

  app.get<IdParams>('/api/ai/accounts/login/:id', async (request): Promise<AccountLoginResponse> =>
    getAccountLogin(deps, await requireActor(request), request.params.id),
  );

  app.post<IdParams>(
    '/api/ai/accounts/login/:id/code',
    async (request): Promise<AccountLoginResponse> => {
      const actor = await requireActor(request);
      const { code } = parseInput(SubmitLoginCodeRequest, request.body);
      return submitLoginCode(deps, actor, request.params.id, code);
    },
  );

  app.delete<IdParams>('/api/ai/accounts/login/:id', async (request, reply) => {
    cancelAccountLogin(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });
}
