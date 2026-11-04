import type { FastifyInstance } from 'fastify';
import { ConfirmRequest } from '../../../../contracts/portability.js';
import { AppError } from '../../../platform/errors/index.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import { bankDeletionImpact, deleteAccount, deleteBank } from '../use-cases/deletion.js';
import type { PortabilityDeps } from '../use-cases/deps.js';
import { buildExport, previewExport } from '../use-cases/export.js';
import { restoreBank } from '../use-cases/restore.js';
import { supportReport } from '../use-cases/support.js';

type BankParams = { Params: { bankId: string }; Querystring: { chapterIds?: string } };

const chaptersOf = (raw: string | undefined) =>
  String(raw ?? '')
    .split(',')
    .filter(Boolean)
    .slice(0, 500);

/** Export and its preview (M13.1), and restore (M13.3). */
function registerExportRoutes(
  app: FastifyInstance,
  deps: PortabilityDeps,
  requireActor: RequireActor,
) {
  app.get<BankParams>('/api/banks/:bankId/export/preview', async (request) =>
    previewExport(
      deps,
      await requireActor(request),
      request.params.bankId,
      chaptersOf(request.query.chapterIds),
    ),
  );
  app.get<BankParams>('/api/banks/:bankId/export', async (request, reply) => {
    const actor = await requireActor(request);
    const file = await buildExport(
      deps,
      actor,
      request.params.bankId,
      chaptersOf(request.query.chapterIds),
    );
    return reply
      .header('content-type', 'application/zip')
      .header(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      )
      .send(Buffer.from(file.bytes));
  });
  app.post('/api/restore', async (request, reply) => {
    const actor = await requireActor(request);
    const part = await request.file({ limits: { fileSize: deps.maxUploadBytes, files: 1 } });
    if (!part) throw new AppError('validation_failed', { file: 'required' });
    const bytes = await part.toBuffer();
    return reply.status(201).send(await restoreBank(deps, actor, bytes));
  });
}

/** Deleting a bank or the whole account, each after its impact is known (M13.5–6). */
function registerDeletionRoutes(
  app: FastifyInstance,
  deps: PortabilityDeps,
  requireActor: RequireActor,
) {
  app.get<BankParams>('/api/banks/:bankId/deletion-impact', async (request) =>
    bankDeletionImpact(deps, await requireActor(request), request.params.bankId),
  );
  app.post<BankParams>('/api/banks/:bankId/delete', async (request, reply) => {
    const actor = await requireActor(request);
    parseInput(ConfirmRequest, request.body);
    await deleteBank(deps, actor, request.params.bankId);
    return reply.status(204).send();
  });
  app.get('/api/support/report', async (request) =>
    supportReport(deps, await requireActor(request)),
  );
  app.post('/api/account/delete', async (request, reply) => {
    const actor = await requireActor(request);
    parseInput(ConfirmRequest, request.body);
    const result = await deleteAccount(deps, actor);
    if (result.complete) void reply.clearCookie('qb_session', { path: '/' });
    return reply.send(result);
  });
}

export function registerPortabilityRoutes(
  app: FastifyInstance,
  deps: PortabilityDeps,
  requireActor: RequireActor,
) {
  registerExportRoutes(app, deps, requireActor);
  registerDeletionRoutes(app, deps, requireActor);
}
