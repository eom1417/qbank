import { z } from 'zod';
import {
  AiSettings,
  CheckResponse,
  EstimateResponse,
  ListModelsResponse,
  ProviderListResponse,
  ProviderResponse,
  TrialResponse,
  type CreateProviderRequest,
  type EstimateRequest,
  type ListModelsRequest,
  type UpdateAiSettingsRequest,
  type UpdateProviderRequest,
} from '../../../contracts/ai.js';
import { apiRequest } from '../../platform/api/client.js';

const providerPath = (id: string, action = '') => `/api/ai/providers/${id}${action}`;

export const fetchProviders = () => apiRequest('GET', '/api/ai/providers', ProviderListResponse);

export const createProvider = (body: CreateProviderRequest) =>
  apiRequest('POST', '/api/ai/providers', ProviderResponse, body);

export const updateProvider = (id: string, body: UpdateProviderRequest) =>
  apiRequest('PATCH', providerPath(id), ProviderResponse, body);

export const deleteProvider = (id: string) => apiRequest('DELETE', providerPath(id), z.null());

export const makeDefault = (id: string) =>
  apiRequest('POST', providerPath(id, '/default'), z.null());

export const checkProvider = (id: string) =>
  apiRequest('POST', providerPath(id, '/check'), CheckResponse);

export const runTrial = (id: string) =>
  apiRequest('POST', providerPath(id, '/trial'), TrialResponse);

export const fetchAiSettings = () => apiRequest('GET', '/api/ai/settings', AiSettings);

export const saveAiSettings = (body: UpdateAiSettingsRequest) =>
  apiRequest('PATCH', '/api/ai/settings', AiSettings, body);

export const estimateTask = (body: EstimateRequest) =>
  apiRequest('POST', '/api/ai/estimate', EstimateResponse, body);

/** Checks a key and lists its models without saving anything. */
export const listModels = (body: ListModelsRequest) =>
  apiRequest('POST', '/api/ai/models', ListModelsResponse, body);
