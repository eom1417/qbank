import { z } from 'zod';
import {
  ImportResponse,
  MediaListResponse,
  SourceListResponse,
  type RetryImportRequest,
  type SourceLanguage,
  type SourceType,
} from '../../../contracts/sources.js';
import { apiRequest } from '../../platform/api/client.js';
import type { TriageRequest } from '../providers/use-triage-choice.js';

export interface UploadOptions {
  pageFrom: string;
  pageTo: string;
  language: SourceLanguage;
  sourceType: SourceType;
  /** The AI triage (DEC-33): instance, models per role, improvement; none without AI. */
  triage: TriageRequest | null;
  aiMode: 'verify' | 'read';
  aiApproved: boolean;
  answersFor: string;
}

const ROLE_FIELDS = {
  first: 'aiFirstModel',
  second: 'aiSecondModel',
  judge: 'aiJudgeModel',
  improver: 'aiImproverModel',
} as const;

/** The AI fields of an upload; pages are read (or marks checked) by the first solver's model. */
function appendTriage(form: FormData, triage: TriageRequest, mode: 'verify' | 'read') {
  form.append('aiProviderId', triage.instanceId);
  form.append('aiMode', mode);
  form.append('aiImprove', String(triage.improve));
  if (triage.models.first) form.append('aiModel', triage.models.first);
  for (const [role, field] of Object.entries(ROLE_FIELDS)) {
    const model = triage.models[role as keyof typeof ROLE_FIELDS];
    if (model) form.append(field, model);
  }
}

/** One file per request; the fields go first, as the server reads them before the file. */
export function uploadFile(bankId: string, file: File, options: UploadOptions) {
  const form = new FormData();
  form.append('rightsConfirmed', 'true');
  form.append('language', options.language);
  form.append('sourceType', options.sourceType);
  if (options.pageFrom) form.append('pageFrom', options.pageFrom);
  if (options.pageTo) form.append('pageTo', options.pageTo);
  if (options.triage) appendTriage(form, options.triage, options.aiMode);
  if (options.aiApproved) form.append('aiApproved', 'true');
  if (options.sourceType === 'answer_key') form.append('answersFor', options.answersFor);
  form.append('file', file);
  return apiRequest('POST', `/api/banks/${bankId}/imports`, ImportResponse, form);
}

export const fetchImport = (id: string) => apiRequest('GET', `/api/imports/${id}`, ImportResponse);

export const retryImport = (id: string, body: RetryImportRequest) =>
  apiRequest('POST', `/api/imports/${id}/retry`, ImportResponse, body);

export const cancelImport = (id: string) => apiRequest('DELETE', `/api/imports/${id}`, z.null());

/** The AI checks a source's saved questions again, as a background job (DEC-33). */
export const recheckSource = (sourceId: string, triage: TriageRequest) =>
  apiRequest('POST', `/api/sources/${sourceId}/recheck`, ImportResponse, {
    aiProviderId: triage.instanceId,
    ...(triage.models.first ? { aiModel: triage.models.first } : {}),
    improve: triage.improve,
    models: triage.models,
  });

/** Deletes a source's stored original; its questions stay (FR-19-001). */
export const deleteOriginal = (sourceId: string) =>
  apiRequest('DELETE', `/api/sources/${sourceId}/original`, z.null());

export const fetchSources = (bankId: string) =>
  apiRequest('GET', `/api/banks/${bankId}/sources`, SourceListResponse);

/** Stages after which an import no longer changes. */
export const FINISHED_STAGES = new Set([
  'completed',
  'needs_review',
  'partial_failure',
  'failed',
  'cancelled',
]);

export const fetchImportMedia = (id: string) =>
  apiRequest('GET', `/api/imports/${id}/media`, MediaListResponse);

/** The picture itself; the browser sends the session cookie, the server checks the owner. */
export const mediaSrc = (mediaId: string) => `/api/media/${mediaId}`;
