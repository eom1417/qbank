import { createReadStream } from 'node:fs';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  RetryImportRequest,
  StartImportFields,
  type ImportResponse,
  type MediaListResponse,
  type SourceListResponse,
} from '../../../../contracts/sources.js';
import { AppError } from '../../../platform/errors/index.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import type { SourcesDeps } from '../use-cases/deps.js';
import {
  cancelImport,
  deleteOriginal,
  getImport,
  listImportMedia,
  listSources,
  mediaFile,
  recentImports,
  retryImport,
} from '../use-cases/manage-imports.js';
import { startImport } from '../use-cases/start-import.js';
import { suggestFix } from '../use-cases/fix-suggestion.js';
import { FixSuggestionRequest, type FixSuggestionResponse } from '../../../../contracts/review.js';

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

/** Upload, progress, report, cancel and retry of imports (UI-07…09). */
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

  app.get('/api/imports/recent', async (request) =>
    recentImports(deps, await requireActor(request)),
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

/** A bank's sources, deleting an original, and the pictures kept from them (UI-23, M5). */
export function registerSourceRoutes(
  app: FastifyInstance,
  deps: SourcesDeps,
  requireActor: RequireActor,
) {
  app.get<BankParams>('/api/banks/:bankId/sources', async (request): Promise<SourceListResponse> =>
    listSources(deps, await requireActor(request), request.params.bankId),
  );

  app.get<IdParams>('/api/imports/:id/media', async (request): Promise<MediaListResponse> =>
    listImportMedia(deps, await requireActor(request), request.params.id),
  );

  app.get<IdParams>('/api/media/:id', async (request, reply) => {
    const path = await mediaFile(deps, await requireActor(request), request.params.id);
    return reply
      .type('image/png')
      .header('cache-control', 'private, max-age=3600')
      .header('x-content-type-options', 'nosniff')
      .send(createReadStream(path));
  });

  app.post<IdParams>(
    '/api/questions/:id/fix-suggestion',
    async (request): Promise<FixSuggestionResponse> => {
      const actor = await requireActor(request);
      const { instanceId } = parseInput(FixSuggestionRequest, request.body);
      return suggestFix(deps, actor, request.params.id, instanceId);
    },
  );

  app.delete<IdParams>('/api/sources/:id/original', async (request, reply) => {
    await deleteOriginal(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });
}
