import {
  BankListResponse,
  BankResponse,
  type CreateBankRequest,
} from '../../../contracts/library.js';
import { apiRequest } from '../../platform/api/client.js';

export const fetchBanks = () => apiRequest('GET', '/api/banks', BankListResponse);

export const fetchBank = (bankId: string) =>
  apiRequest('GET', `/api/banks/${encodeURIComponent(bankId)}`, BankResponse);

export const createBank = (input: Partial<CreateBankRequest>) =>
  apiRequest('POST', '/api/banks', BankResponse, input);
