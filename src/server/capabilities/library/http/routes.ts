import type { FastifyInstance } from 'fastify';
import { CreateBankRequest, type BankListResponse } from '../../../../contracts/library.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import { createBank, getBank, listBanks, type LibraryDeps } from '../use-cases/banks.js';
import { toBankResponse } from './presenters.js';

export function registerLibraryRoutes(
  app: FastifyInstance,
  deps: LibraryDeps,
  requireActor: RequireActor,
) {
  app.get('/api/banks', async (request): Promise<BankListResponse> => {
    const actor = await requireActor(request);
    const banks = await listBanks(deps, actor);
    return { banks: banks.map(toBankResponse) };
  });

  app.post('/api/banks', async (request, reply) => {
    const actor = await requireActor(request);
    const bank = await createBank(deps, actor, parseInput(CreateBankRequest, request.body));
    return reply.status(201).send(toBankResponse(bank));
  });

  app.get<{ Params: { bankId: string } }>('/api/banks/:bankId', async (request) => {
    const actor = await requireActor(request);
    return toBankResponse(await getBank(deps, actor, request.params.bankId));
  });
}
