import type { AiTarget } from '../../../contracts/providers.js';
import { ReportsResponse } from '../../../contracts/review.js';
import {
  ActiveSessionsResponse,
  AnswerImpactResponse,
  DueResponse,
  TopicsResponse,
  type MixShares,
  ExamStateResponse,
  type ExamTiming,
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

export const previewStudy = (scope: StudyScope, kind: StudyKind, shares?: MixShares) =>
  apiRequest('POST', '/api/study/preview', PreviewResponse, {
    scope,
    kind,
    ...(shares ? { shares } : {}),
  });

export const startStudy = (scope: StudyScope, kind: StudyKind, size: number, shares?: MixShares) =>
  apiRequest('POST', '/api/study/sessions', SessionResponse, {
    scope,
    kind,
    size,
    mode: 'tutor',
    ...(shares && kind === 'smart_mix' ? { shares } : {}),
  });

export const fetchDue = (bankIds: readonly string[]) =>
  apiRequest('GET', `/api/study/due?bankIds=${bankIds.join(',')}`, DueResponse);

export const fetchTopics = (bankIds: readonly string[]) =>
  apiRequest('GET', `/api/study/topics?bankIds=${bankIds.join(',')}`, TopicsResponse);

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

export const explainWithAi = (id: string, position: number, target: AiTarget) =>
  apiRequest(
    'POST',
    `${session(id)}/items/${position}/ai-explanation`,
    AiExplanationResponse,
    target,
  );

export const setMark = (questionId: string, mark: { flagged?: boolean; favorite?: boolean }) =>
  apiRequest('PUT', `/api/questions/${questionId}/mark`, MarkResponse, mark);

export const reportQuestion = (questionId: string, kind: string) =>
  apiRequest('POST', `/api/questions/${questionId}/reports`, ReportsResponse, { kind });

export const startExam = (scope: StudyScope, kind: StudyKind, size: number, timing: ExamTiming) =>
  apiRequest('POST', '/api/study/sessions', SessionResponse, {
    scope,
    kind,
    size,
    mode: 'exam',
    timing,
  });

export const fetchExamState = (id: string) =>
  apiRequest('GET', `${session(id)}/exam`, ExamStateResponse);

export const openExamItem = (id: string, position: number) =>
  apiRequest('POST', `${session(id)}/items/${position}/open`, ItemResponse, {});

export const saveChoice = (id: string, position: number, chosen: string[]) =>
  apiRequest('PUT', `${session(id)}/items/${position}/choice`, ItemResponse, { chosen });

export const flagExamItem = (id: string, position: number, flagged: boolean) =>
  apiRequest('PUT', `${session(id)}/items/${position}/flag`, ItemResponse, { flagged });

export const submitExam = (id: string) =>
  apiRequest('POST', `${session(id)}/submit`, SessionResponse, { confirm: true });

export const fetchAnswerImpact = (questionId: string, answers: readonly string[]) =>
  apiRequest(
    'GET',
    `/api/study/answer-impact?questionId=${questionId}&answers=${answers.join(',')}`,
    AnswerImpactResponse,
  );
