import {
  AnalyticsSummary,
  ImportQualityResponse,
  SearchResponse,
  SessionHistoryResponse,
  SuggestionResponse,
  TrendResponse,
  type SearchQuery,
} from '../../../contracts/analytics.js';
import { apiRequest } from '../../platform/api/client.js';

const bankQuery = (bankId: string) => (bankId ? `?bankId=${bankId}` : '');

export const fetchSummary = (bankId: string) =>
  apiRequest('GET', `/api/analytics/summary${bankQuery(bankId)}`, AnalyticsSummary);

export const fetchTrend = (bankId: string) =>
  apiRequest('GET', `/api/analytics/trend${bankQuery(bankId)}`, TrendResponse);

export const fetchHistory = (bankId: string, mode: string) => {
  const params = new URLSearchParams({ ...(bankId ? { bankId } : {}), ...(mode ? { mode } : {}) });
  return apiRequest('GET', `/api/analytics/sessions?${params.toString()}`, SessionHistoryResponse);
};

export const fetchImportQuality = (bankId: string) =>
  apiRequest('GET', `/api/analytics/imports/${bankId}`, ImportQualityResponse);

export const fetchSuggestion = (bankId: string) =>
  apiRequest('GET', `/api/analytics/suggestion${bankQuery(bankId)}`, SuggestionResponse);

export const searchQuestions = (query: SearchQuery) => {
  const params = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
  );
  return apiRequest('GET', `/api/search?${params.toString()}`, SearchResponse);
};
