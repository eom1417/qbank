import type { Readable } from 'node:stream';
import { enhancementsOf, type StartImportFields } from '../../../../contracts/sources.js';
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

/** The model chosen for each triage role (DEC-33), as the job keeps it. */
const roleModels = (fields: StartImportFields) => ({
  ...(fields.aiFirstModel ? { first: fields.aiFirstModel } : {}),
  ...(fields.aiSecondModel ? { second: fields.aiSecondModel } : {}),
  ...(fields.aiJudgeModel ? { judge: fields.aiJudgeModel } : {}),
  ...(fields.aiImproverModel ? { improver: fields.aiImproverModel } : {}),
});

/** How the AI helps: the pipeline on a server unless the upload chose (M34, Z4); else `verify`. */
const aiModeOf = (deps: Pick<SourcesDeps, 'mode'>, fields: StartImportFields) =>
  fields.aiMode ?? (deps.mode === 'accounts' ? 'pipeline' : 'verify');

/**
 * Where the server requires it (`imports.requiresAi`, Q7, Z4) an upload names the user's AI and
 * reads by the pipeline, or it is refused with a clear reason: never a silent rule-only import.
 * Checked once the file itself passed its checks, so a bad file still says what is wrong with it.
 */
function checkRequiredAi(deps: SourcesDeps, fields: StartImportFields) {
  if (!fields.aiProviderId || aiModeOf(deps, fields) !== 'pipeline')
    throw new AppError('ai_required');
}

/** The pages to read of a stored file, once the import may go on (range, then required AI). */
function pagesToRead(deps: SourcesDeps, fields: StartImportFields, pages: number, ai: boolean) {
  const range = rangeOf(fields, pages);
  if (!range) throw new AppError('validation_failed', { pageTo: 'too_big' });
  if (ai) checkRequiredAi(deps, fields);
  return range;
}

/**
 * The pipeline sends the file's text and page pictures to the user's own provider: only after
 * the account agreed to it once (Q8). Checked before the file is even stored.
 */
async function checkConsent(deps: SourcesDeps, actor: Actor, fields: StartImportFields) {
  if (!fields.aiProviderId || aiModeOf(deps, fields) !== 'pipeline') return;
  if (!(await deps.aiConsentOf(actor.accountId))) throw new AppError('ai_consent_required');
}

/** The job's AI: instance, models, mode and improvement, or none at all. */
const aiColumns = (deps: SourcesDeps, aiProviderId: string | null, fields: StartImportFields) => ({
  ai_provider_id: aiProviderId,
  ai_model: aiProviderId ? (fields.aiModel ?? null) : null,
  ai_mode: aiProviderId ? aiModeOf(deps, fields) : ('verify' as const),
  ai_enhance: aiProviderId ? JSON.stringify(enhancementsOf(fields.aiEnhance)) : null,
  ai_roles: aiProviderId ? JSON.stringify(roleModels(fields)) : null,
  // The pipeline's starting tier (Q14): light unless the owner chose strong.
  ai_tier:
    aiProviderId && aiModeOf(deps, fields) === 'pipeline' ? (fields.aiTier ?? 'light') : null,
});

/** Every role's model must be one the instance offers now (an unknown one fails early). */
async function checkRoleModels(deps: SourcesDeps, actor: Actor, fields: StartImportFields) {
  const roles = [
    ['aiFirstModel', fields.aiFirstModel],
    ['aiSecondModel', fields.aiSecondModel],
    ['aiJudgeModel', fields.aiJudgeModel],
    ['aiImproverModel', fields.aiImproverModel],
  ] as const;
  for (const [field, model] of roles) {
    if (!model || !fields.aiProviderId) continue;
    const target = { instanceId: fields.aiProviderId, model };
    if (!(await deps.ai.estimateFor(actor.accountId, target)))
      throw new AppError('validation_failed', { [field]: 'invalid_value' });
  }
}

/** With AI chosen, its estimate must be within the user's limits or approved (DEC-18, FR-22-008). */
async function checkAi(deps: SourcesDeps, actor: Actor, fields: StartImportFields) {
  if (!fields.aiProviderId) return null;
  if (!enhancementsOf(fields.aiEnhance))
    throw new AppError('validation_failed', { aiEnhance: 'invalid_value' });
  const target = {
    instanceId: fields.aiProviderId,
    ...(fields.aiModel ? { model: fields.aiModel } : {}),
  };
  const estimate = await deps.ai.estimateFor(actor.accountId, target);
  if (!estimate) throw new AppError('validation_failed', { aiProviderId: 'invalid_value' });
  await checkRoleModels(deps, actor, fields);
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

/**
 * Stores one file into a bank and queues its import (FR-04-001…008), as the upload or the sample
 * chose it. `requireAi`: the upload must name the user's AI, by the pipeline (Q7).
 */
export async function queueImport(
  deps: SourcesDeps,
  actor: Actor,
  bankId: string,
  fields: StartImportFields,
  upload: Upload,
  requireAi = false,
) {
  if (!isId(bankId)) throw notFound();
  const target = await answersFor(deps, actor, bankId, fields);
  await checkConsent(deps, actor, fields);
  const stored = await storeReadablePdf(deps, upload);
  try {
    const range = pagesToRead(deps, fields, stored.pages, requireAi);
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
      ...aiColumns(deps, aiProviderId, fields),
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

/** Uploads one file into a bank and queues its import (UI-07): with AI where required (Q7). */
export async function startImport(
  deps: SourcesDeps,
  actor: Actor,
  bankId: string,
  fields: StartImportFields,
  upload: Upload,
) {
  return queueImport(deps, actor, bankId, fields, upload, deps.requiresAi);
}
