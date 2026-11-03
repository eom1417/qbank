import { ErrorResponse } from '../../../contracts/errors.js';
import {
  AuthStateView,
  DriverListResponse,
  ProviderStateResponse,
  type KitMethod,
} from '../../../contracts/providers.js';
import { apiRaw, apiRequest, ApiError } from '../../platform/api/client.js';

/** A failure the providers kit reported, with its own explanation (shown as is). */
export class KitError extends Error {}

export const fetchProviderState = () =>
  apiRequest('GET', '/api/providers/state', ProviderStateResponse);

export const fetchDrivers = () => apiRequest('GET', '/api/providers/drivers', DriverListResponse);

const kitMessage = (body: unknown): string | null => {
  const error = (body as { error?: { detail?: unknown; message?: unknown } } | null)?.error;
  const message = error?.detail ?? error?.message;
  return typeof message === 'string' ? message : null;
};

/** One kit method by its wire name; the kit's own error explanation reaches the user. */
export async function kitCall(method: KitMethod, input: unknown): Promise<unknown> {
  const response = await apiRaw('POST', `/api/providers/rpc/${method}`, input);
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body;
  const ours = ErrorResponse.safeParse(body);
  if (ours.success) throw new ApiError(ours.data.error.code, ours.data.error.fields);
  throw new KitError(kitMessage(body) ?? 'The AI provider could not do that.');
}

export const startSignIn = async (input: { instanceId: string; methodId?: string }) =>
  AuthStateView.parse(await kitCall('provider.auth.start', { ...input, callbackMode: 'client' }));

/** Live server-sent events (state changes, a sign-in flow); returns the closer. */
export function subscribe(path: string, onEvent: (data: unknown) => void): () => void {
  const source = new EventSource(path, { withCredentials: true });
  source.onmessage = (event: MessageEvent<string>) => onEvent(JSON.parse(event.data) as unknown);
  return () => source.close();
}

export const flowEventsPath = (instanceId: string) =>
  `/api/providers/events/provider.auth.subscribe?input=${encodeURIComponent(JSON.stringify({ instanceId }))}`;
