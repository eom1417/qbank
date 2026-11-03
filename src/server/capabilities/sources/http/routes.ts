import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  RetryImportRequest,
  StartImportFields,
  type ImportResponse,
  type SourceListResponse,
} from '../../../../contracts/sources.js';
import { AppError } from '../../../platform/errors/index.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { SourcesDeps } from '../use-cases/deps.js';
import { cancelImport, getImport, listSources, retryImport } from '../use-cases/manage-imports.js';
import { startImport } from '../use-cases/start-import.js';

type BankParams = { Params: { bankId: string } };
type IdParams = { Params: { id: string } };

/** The form fields sent before the file part, as plain strings. */
function fieldsOf(fields: Record<string, unknown>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, field] of Object.entries(fields)) {
    const value = (field as { type?: string; value?: unknown } | undefined)?.value;
    if ((field as { type?: string }).type === 'field' && typeof value === 'string')
      values[name] = value;
  }
  return values;
}

async function uploadOf(request: FastifyRequest, deps: SourcesDeps) {
  const part = await request.file({
    limits: { fileSize: deps.maxUploadBytes, files: 1, fields: 12 },
  });
  if (!part) throw new AppError('validation_failed', { file: 'required' });
  const fields = parseInput(StartImportFields, fieldsOf(part.fields));
  return { fields, upload: { fileName: part.filename || 'file.pdf', data: part.file } };
}

/** Upload, progress, report, cancel and retry of imports; a bank's sources (UI-07…09, UI-23). */
export function registerImportRoutes(
  app: FastifyInstance,
  deps: SourcesDeps,
  requireActor: RequireActor,
) {
  app.post<BankParams>('/api/banks/:bankId/imports', async (request, reply) => {
    const actor = await requireActor(request);
    const { fields, upload } = await uploadOf(request, deps);
    const jobId = await startImport(deps, actor, request.params.bankId, fields, upload);
    return reply.status(201).send(await getImport(deps, actor, jobId));
  });

  app.get<BankParams>('/api/banks/:bankId/sources', async (request): Promise<SourceListResponse> =>
    listSources(deps, await requireActor(request), request.params.bankId),
  );

  app.get<IdParams>('/api/imports/:id', async (request): Promise<ImportResponse> =>
    getImport(deps, await requireActor(request), request.params.id),
  );

  app.delete<IdParams>('/api/imports/:id', async (request, reply) => {
    await cancelImport(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });

  app.post<IdParams>('/api/imports/:id/retry', async (request): Promise<ImportResponse> => {
    const actor = await requireActor(request);
    await retryImport(
      deps,
      actor,
      request.params.id,
      parseInput(RetryImportRequest, request.body ?? {}),
    );
    return getImport(deps, actor, request.params.id);
  });
}
