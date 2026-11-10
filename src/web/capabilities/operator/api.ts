import { z } from 'zod';
import {
  FeedbackListResponse,
  QueueResponse,
  ResetLinkResponse,
  ResetRequestListResponse,
  ServerStatusResponse,
  type FeedbackRequest,
} from '../../../contracts/operator.js';
import { apiRequest } from '../../platform/api/client.js';

/** The operator console's server calls (DEC-40); a non-operator gets 403 `operator_only`. */
export const fetchFeedback = () =>
  apiRequest('GET', '/api/operator/feedback', FeedbackListResponse);

export const closeFeedback = (id: string) =>
  apiRequest('POST', `/api/operator/feedback/${encodeURIComponent(id)}/close`, z.unknown());

export const fetchResets = () =>
  apiRequest('GET', '/api/operator/resets', ResetRequestListResponse);

/** Returns the link to pass on by hand; a new one when the last has expired (`fresh`). */
export const resetLink = (accountId: string) =>
  apiRequest(
    'POST',
    `/api/operator/resets/${encodeURIComponent(accountId)}/link`,
    ResetLinkResponse,
  );

/** The server's own health (M32): the last automatic backup, or null if none ran yet. */
export const fetchStatus = () => apiRequest('GET', '/api/operator/status', ServerStatusResponse);

export const fetchQueue = () => apiRequest('GET', '/api/operator/queue', QueueResponse);

/** Any signed-in user's note to the operator (accounts mode). */
export const sendFeedback = (body: FeedbackRequest) =>
  apiRequest('POST', '/api/feedback', z.unknown(), body);
