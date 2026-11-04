import { z } from 'zod';
import {
  DuplicatePairsResponse,
  TransferResponse,
  type PairDecisionRequest,
  type TransferRequest,
} from '../../../contracts/duplicates.js';
import { QuestionResponse } from '../../../contracts/questions.js';
import { apiRequest } from '../../platform/api/client.js';

export const fetchPairs = (bankId: string) =>
  apiRequest('GET', `/api/banks/${bankId}/duplicates`, DuplicatePairsResponse);

export const decidePair = (pairId: string, decision: PairDecisionRequest) =>
  apiRequest('POST', `/api/duplicates/${pairId}/decision`, z.null(), decision);

export const transfer = (request: TransferRequest) =>
  apiRequest('POST', '/api/questions/transfer', TransferResponse, request);

export const chooseReimport = (id: string, use: 'new' | 'mine') =>
  apiRequest('POST', `/api/questions/${id}/reimport-choice`, QuestionResponse, { use });
