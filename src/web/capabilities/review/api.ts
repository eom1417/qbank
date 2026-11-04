import { z } from 'zod';
import { QuestionResponse, type EditQuestionRequest } from '../../../contracts/questions.js';
import {
  BulkApproveResponse,
  DeletionImpactResponse,
  FixSuggestionResponse,
  HistoryResponse,
  NotesResponse,
  ReportsResponse,
  ReviewQueueResponse,
} from '../../../contracts/review.js';
import { apiRequest } from '../../platform/api/client.js';

export type Decision = 'approve' | 'defer' | 'exclude' | 'restore';

export const fetchQueue = (bankId: string) =>
  apiRequest('GET', `/api/banks/${bankId}/review`, ReviewQueueResponse);

export const approveSafe = (bankId: string) =>
  apiRequest('POST', `/api/banks/${bankId}/review/approve-safe`, BulkApproveResponse, {});

export const decide = (id: string, decision: Decision) =>
  apiRequest('POST', `/api/questions/${id}/${decision}`, QuestionResponse, {});

export const fetchQuestion = (id: string) =>
  apiRequest('GET', `/api/questions/${id}`, QuestionResponse);

export const editQuestion = (id: string, edit: EditQuestionRequest) =>
  apiRequest('PATCH', `/api/questions/${id}`, QuestionResponse, edit);

export const fetchHistory = (id: string) =>
  apiRequest('GET', `/api/questions/${id}/history`, HistoryResponse);

export const restoreVersion = (id: string, version: number) =>
  apiRequest('POST', `/api/questions/${id}/restore-version`, QuestionResponse, { version });

export const fetchDeletionImpact = (id: string) =>
  apiRequest('GET', `/api/questions/${id}/deletion-impact`, DeletionImpactResponse);

export const deleteQuestion = (id: string) =>
  apiRequest('POST', `/api/questions/${id}/delete`, z.null(), { confirm: true });

export const fetchNotes = (id: string) =>
  apiRequest('GET', `/api/questions/${id}/notes`, NotesResponse);

export const addNote = (id: string, body: string, labels: string[]) =>
  apiRequest('POST', `/api/questions/${id}/notes`, NotesResponse, { body, labels });

export const fetchReports = (id: string) =>
  apiRequest('GET', `/api/questions/${id}/reports`, ReportsResponse);

export const resolveReport = (reportId: string) =>
  apiRequest('POST', `/api/reports/${reportId}/resolve`, z.null(), {});

export const suggestFix = (id: string, instanceId: string) =>
  apiRequest('POST', `/api/questions/${id}/fix-suggestion`, FixSuggestionResponse, { instanceId });
