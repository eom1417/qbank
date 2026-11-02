import type { FastifyInstance } from 'fastify';
import {
  BankListFilter,
  CreateBankRequest,
  UpdateBankRequest,
  type BankListResponse,
} from '../../../../contracts/library.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import {
  archiveBank,
  createBank,
  getBank,
  listBanks,
  restoreBank,
  updateBank,
  type LibraryDeps,
} from '../use-cases/banks.js';
import { toBankResponse } from './presenters.js';

type BankParams = { Params: { bankId: string } };

export function registerBankRoutes(
  app: FastifyInstance,
  deps: LibraryDeps,
  requireActor: RequireActor,
) {
  app.get('/api/banks', async (request): Promise<BankListResponse> => {
    const actor = await requireActor(request);
    const banks = await listBanks(deps, actor, parseInput(BankListFilter, request.query));
    return { banks: banks.map(toBankResponse) };
  });

  app.post('/api/banks', async (request, reply) => {
    const actor = await requireActor(request);
    const bank = await createBank(deps, actor, parseInput(CreateBankRequest, request.body));
    return reply.status(201).send(toBankResponse(bank));
  });

  app.get<BankParams>('/api/banks/:bankId', async (request) => {
    const actor = await requireActor(request);
    return toBankResponse(await getBank(deps, actor, request.params.bankId));
  });

  app.patch<BankParams>('/api/banks/:bankId', async (request) => {
    const actor = await requireActor(request);
    const changes = parseInput(UpdateBankRequest, request.body);
    return toBankResponse(await updateBank(deps, actor, request.params.bankId, changes));
  });

  app.post<BankParams>('/api/banks/:bankId/archive', async (request) => {
    const actor = await requireActor(request);
    return toBankResponse(await archiveBank(deps, actor, request.params.bankId));
  });

  app.post<BankParams>('/api/banks/:bankId/restore', async (request) => {
    const actor = await requireActor(request);
    return toBankResponse(await restoreBank(deps, actor, request.params.bankId));
  });
}
