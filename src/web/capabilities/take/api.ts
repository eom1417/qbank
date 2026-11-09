import {
  StartAttemptResponse,
  TakeItemResponse,
  TakeLandingResponse,
  TakeResultResponse,
  TakeStateResponse,
} from '../../../contracts/take.js';
import { ApiError, apiRaw, apiRequest } from '../../platform/api/client.js';

/**
 * The take API (M30, DEC-39): a link opens the share with no account; starting gives an
 * attempt token, sent as a bearer token for everything after.
 */
const LINKS = '/api/take/v1/links';
const ATTEMPT = '/api/take/v1/attempt';

export interface StartInput {
  name: string;
  personId?: string;
  code?: string;
}

export const fetchLanding = (link: string) =>
  apiRequest('GET', `${LINKS}/${encodeURIComponent(link)}`, TakeLandingResponse);

export const startAttempt = (link: string, input: StartInput) =>
  apiRequest('POST', `${LINKS}/${encodeURIComponent(link)}/attempts`, StartAttemptResponse, input);

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/** Everything about one attempt, called with its token. */
export function attemptApi(token: string) {
  const auth = bearer(token);
  const item = (position: number) => `${ATTEMPT}/items/${position}`;
  return {
    state: () => apiRequest('GET', ATTEMPT, TakeStateResponse, undefined, auth),
    open: (position: number) =>
      apiRequest('GET', item(position), TakeItemResponse, undefined, auth),
    choose: (position: number, chosen: string[]) =>
      apiRequest('PUT', item(position), TakeItemResponse, { chosen }, auth),
    flag: (position: number, flagged: boolean) =>
      apiRequest('POST', `${item(position)}/flag`, TakeItemResponse, { flagged }, auth),
    submit: () => apiRequest('POST', `${ATTEMPT}/submit`, TakeResultResponse, undefined, auth),
    result: () => apiRequest('GET', `${ATTEMPT}/result`, TakeResultResponse, undefined, auth),
    /** A picture needs the token too, so it comes as a blob, not as a plain image address. */
    picture: async (id: string) => {
      const response = await apiRaw('GET', `${ATTEMPT}/pictures/${id}`, undefined, auth);
      if (!response.ok) throw new ApiError(response.status === 404 ? 'not_found' : 'internal');
      return response.blob();
    },
  };
}

export type AttemptApi = ReturnType<typeof attemptApi>;
