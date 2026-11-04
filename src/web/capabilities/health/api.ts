import { HealthResponse } from '../../../contracts/health.js';
import { apiRequest } from '../../platform/api/client.js';

export const fetchHealth = () => apiRequest('GET', '/api/health/details', HealthResponse);
