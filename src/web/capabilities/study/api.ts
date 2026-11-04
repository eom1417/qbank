import { ReportsResponse } from '../../../contracts/review.js';
import {
  ActiveSessionsResponse,
  AiExplanationResponse,
  ItemResponse,
  MarkResponse,
  PreviewResponse,
  SessionResponse,
  SummaryResponse,
  type StudyKind,
  type StudyScope,
} from '../../../contracts/study.js';
import { apiRequest } from '../../platform/api/client.js';

const session = (id: string) => `/api/study/sessions/${id}`;

export const previewStudy = (scope: StudyScope, kind: StudyKind) =>
  apiRequest('POST', '/api/study/preview', PreviewResponse, { scope, kind });

export const startStudy = (scope: StudyScope, kind: StudyKind, size: number) =>
  apiRequest('POST', '/api/study/sessions', SessionResponse, { scope, kind, size, mode: 'tutor' });

export const fetchActiveSessions = () =>
  apiRequest('GET', '/api/study/sessions', ActiveSessionsResponse);

export const fetchSession = (id: string) => apiRequest('GET', session(id), SessionResponse);

export const fetchItem = (id: string, position: number) =>
  apiRequest('GET', `${session(id)}/items/${position}`, ItemResponse);

export const sendAnswer = (id: string, position: number, chosen: string[], seconds: number) =>
  apiRequest('POST', `${session(id)}/items/${position}/answer`, ItemResponse, { chosen, seconds });

export const savePosition = (id: string, position: number) =>
  apiRequest('POST', `${session(id)}/position`, SessionResponse, { position });

export const finishStudy = (id: string) =>
  apiRequest('POST', `${session(id)}/finish`, SessionResponse, {});

export const fetchSummary = (id: string) =>
  apiRequest('GET', `${session(id)}/summary`, SummaryResponse);

export const retryWrong = (id: string) =>
  apiRequest('POST', `${session(id)}/retry-wrong`, SessionResponse, {});

export const explainWithAi = (id: string, position: number, instanceId: string) =>
  apiRequest('POST', `${session(id)}/items/${position}/ai-explanation`, AiExplanationResponse, {
    instanceId,
  });

export const setMark = (questionId: string, mark: { flagged?: boolean; favorite?: boolean }) =>
  apiRequest('PUT', `/api/questions/${questionId}/mark`, MarkResponse, mark);

export const reportQuestion = (questionId: string, kind: string) =>
  apiRequest('POST', `/api/questions/${questionId}/reports`, ReportsResponse, { kind });
