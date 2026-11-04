import {
  AccountDeletionResponse,
  BankDeletionImpact,
  ExportPreviewResponse,
  RestoreResponse,
} from '../../../contracts/portability.js';
import { z } from 'zod';
import { apiRequest } from '../../platform/api/client.js';

const chapterQuery = (chapterIds: readonly string[]) =>
  chapterIds.length > 0 ? `?chapterIds=${chapterIds.join(',')}` : '';

export const fetchExportPreview = (bankId: string, chapterIds: readonly string[]) =>
  apiRequest(
    'GET',
    `/api/banks/${bankId}/export/preview${chapterQuery(chapterIds)}`,
    ExportPreviewResponse,
  );

/** A plain download link: the browser saves the ZIP itself. */
export const exportUrl = (bankId: string, chapterIds: readonly string[]) =>
  `/api/banks/${bankId}/export${chapterQuery(chapterIds)}`;

export function restoreBank(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('POST', '/api/restore', RestoreResponse, form);
}

export const fetchDeletionImpact = (bankId: string) =>
  apiRequest('GET', `/api/banks/${bankId}/deletion-impact`, BankDeletionImpact);

export const deleteBank = (bankId: string) =>
  apiRequest('POST', `/api/banks/${bankId}/delete`, z.null(), { confirm: true });

export const deleteAccount = () =>
  apiRequest('POST', '/api/account/delete', AccountDeletionResponse, { confirm: true });

export const reportUrl = (from: string, to: string, locale: string) =>
  `/api/analytics/report?from=${from}&to=${to}&locale=${locale}`;
