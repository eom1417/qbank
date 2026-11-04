import type { Readable } from 'node:stream';
import type { StartImportFields } from '../../../../contracts/sources.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import { openBlob, type StoredBlob } from '../../../platform/storage/blob-store.js';
import type { Actor } from '../../identity/index.js';
import { inspectPdf } from '../adapters/pdf-inspect.js';
import type { SourcesDeps } from './deps.js';

export interface Upload {
  fileName: string;
  data: Readable;
}

const PDF_MAGIC = '%PDF-';

async function startsAsPdf(deps: SourcesDeps, blob: StoredBlob): Promise<boolean> {
  for await (const chunk of openBlob(deps.blobs, blob.key)) {
    return (
      Buffer.from(chunk as Buffer)
        .subarray(0, 5)
        .toString('latin1') === PDF_MAGIC
    );
  }
  return false;
}

/** Stores the upload, then refuses what cannot be read, with a clear reason (FR-23-001, UAT-019). */
async function storeReadablePdf(deps: SourcesDeps, upload: Upload) {
  const blob = await deps.blobs.put(upload.data, deps.maxUploadBytes);
  if (blob === 'too_large') throw new AppError('payload_too_large');
  const refuse = async (
    code:
      'file_unsupported' | 'file_corrupt' | 'file_protected' | 'too_many_pages' | 'page_too_large',
  ) => {
    await deps.blobs.remove(blob.key);
    return new AppError(code);
  };
  if (!(await startsAsPdf(deps, blob))) throw await refuse('file_unsupported');
  const inspection = await inspectPdf(deps.blobs.pathOf(blob.key));
  if (!inspection.ok) throw await refuse(inspection.reason);
  if (inspection.pages > deps.maxPages) throw await refuse('too_many_pages');
  return { blob, pages: inspection.pages, discard: () => deps.blobs.remove(blob.key) };
}

/** The page range to read (FR-04-004): the whole file unless the user chose part of it. */
function rangeOf(fields: StartImportFields, pages: number) {
  const from = fields.pageFrom ?? 1;
  const to = fields.pageTo ?? pages;
  if (to > pages) return null;
  return { from, to };
}

/** The job's AI: instance, model and mode, or none at all. */
const aiColumns = (aiProviderId: string | null, fields: StartImportFields) => ({
  ai_provider_id: aiProviderId,
  ai_model: aiProviderId ? (fields.aiModel ?? null) : null,
  ai_mode: aiProviderId ? fields.aiMode : ('verify' as const),
});

/** With AI chosen, its estimate must be within the user's limits or approved (DEC-18, FR-22-008). */
async function checkAi(deps: SourcesDeps, actor: Actor, fields: StartImportFields) {
  if (!fields.aiProviderId) return null;
  const target = {
    instanceId: fields.aiProviderId,
    ...(fields.aiModel ? { model: fields.aiModel } : {}),
  };
  const estimate = await deps.ai.estimateFor(actor.accountId, target);
  if (!estimate) throw new AppError('validation_failed', { aiProviderId: 'invalid_value' });
  if (estimate.needsApproval && fields.aiApproved !== 'true') {
    throw new AppError(
      'approval_required',
      Object.fromEntries(estimate.reasons.map((r) => [r, 'required'])),
    );
  }
  return fields.aiProviderId;
}

/**
 * An answer-key file names a question source of the same bank (M6.3, JY-03); anything else
 * (another bank, another owner, an answer file itself) is refused as not found.
 */
async function answersFor(
  deps: SourcesDeps,
  actor: Actor,
  bankId: string,
  fields: StartImportFields,
) {
  if (fields.sourceType !== 'answer_key') return null;
  const target = fields.answersFor
    ? await deps.imports.findSource(actor.accountId, fields.answersFor)
    : undefined;
  if (!target || target.bank_id !== bankId || target.source_type === 'answer_key')
    throw new AppError('validation_failed', { answersFor: 'invalid_value' });
  return target.id;
}

/** Uploads one file into a bank and queues its import (UI-07, FR-04-001…008). */
export async function startImport(
  deps: SourcesDeps,
  actor: Actor,
  bankId: string,
  fields: StartImportFields,
  upload: Upload,
) {
  if (!isId(bankId)) throw notFound();
  const target = await answersFor(deps, actor, bankId, fields);
  const stored = await storeReadablePdf(deps, upload);
  try {
    const range = rangeOf(fields, stored.pages);
    if (!range) throw new AppError('validation_failed', { pageTo: 'too_big' });
    const aiProviderId = await checkAi(deps, actor, fields);
    const now = deps.clock.now();
    const source = {
      id: deps.newId(),
      owner_id: actor.accountId,
      bank_id: bankId,
      file_name: upload.fileName.slice(0, 255),
      byte_size: stored.blob.size,
      sha256: stored.blob.sha256,
      blob_key: stored.blob.key,
      page_count: stored.pages,
      page_from: range.from,
      page_to: range.to,
      language: fields.language,
      source_type: fields.sourceType,
      answers_for_source_id: target,
      original_expires_at: null,
      created_at: now,
    };
    const job = {
      id: deps.newId(),
      owner_id: actor.accountId,
      source_id: source.id,
      stage: 'queued' as const,
      pages_total: range.to - range.from + 1,
      ...aiColumns(aiProviderId, fields),
      created_at: now,
      updated_at: now,
    };
    if ((await deps.imports.create(source, job)) === 'bank_missing') throw notFound();
    return job.id;
  } catch (error) {
    await stored.discard();
    throw error;
  }
}
