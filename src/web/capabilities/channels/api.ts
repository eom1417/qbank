import { z } from 'zod';
import {
  ExposureResponse,
  ShareEventsResponse,
  ShareListResponse,
  ShareResultsResponse,
  ShareSecretResponse,
  ShareStatsResponse,
  ShareView,
  type CreateShareRequest,
} from '../../../contracts/sharing.js';
import { apiRequest } from '../../platform/api/client.js';

/** The owner's shares (DEC-39): one bank's, or every bank's when `bankId` is left out. */
export const fetchShares = (bankId?: string) =>
  apiRequest(
    'GET',
    bankId ? `/api/shares?bankId=${encodeURIComponent(bankId)}` : '/api/shares',
    ShareListResponse,
  );

/** A new share; its key or link is in this answer only. */
export const createShare = (bankId: string, request: CreateShareRequest) =>
  apiRequest('POST', `/api/banks/${bankId}/shares`, ShareSecretResponse, request);

export type ShareAction = 'pause' | 'resume' | 'end' | 'archive';

/** Question 6, control: one lifecycle step. */
export const changeShare = (id: string, action: ShareAction) =>
  apiRequest('POST', `/api/shares/${id}/${action}`, ShareView, {});

/** A new key or link; the old one stops at once. */
export const renewSecret = (id: string) =>
  apiRequest('POST', `/api/shares/${id}/secret`, ShareSecretResponse, {});

export const deleteShare = (id: string) => apiRequest('DELETE', `/api/shares/${id}`, z.null());

export const fetchShareEvents = (id: string) =>
  apiRequest('GET', `/api/shares/${id}/events`, ShareEventsResponse);

export const fetchShareStats = (id: string) =>
  apiRequest('GET', `/api/shares/${id}/stats`, ShareStatsResponse);

export const fetchShareResults = (id: string) =>
  apiRequest('GET', `/api/shares/${id}/results`, ShareResultsResponse);

/** Before publishing: how much of this choice is already out, or reserved by an exam. */
export const fetchExposure = (bankId: string, chapterIds: string[], fixedQuestionIds: string[]) =>
  apiRequest('POST', `/api/banks/${bankId}/shares/exposure`, ExposureResponse, {
    chapterIds,
    fixedQuestionIds,
  });
