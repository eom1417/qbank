import { AppError } from '../errors/index.js';

/** A reply from the AI host: its status and JSON body, passed on as they are. */
interface HostReply {
  status: number;
  body: unknown;
}

export interface AiHostClient {
  /** `POST /rpc/<method>`: one kit provider method. */
  call(method: string, input: unknown, ownerSession: string): Promise<HostReply>;
  /** `GET <path>`: a snapshot (`/state`). */
  read(path: string, ownerSession: string): Promise<HostReply>;
  /** `GET <path>` as a live event stream (`/state/events`, `/events/<method>`). */
  open(path: string, ownerSession: string, signal: AbortSignal): Promise<Response>;
}

/**
 * The only way QBank reaches the vendored T3 AI Providers Kit (ai-host/, loopback, token). When
 * the host is not configured or not running, every call fails as `ai_host_unavailable`.
 */
export function createAiHostClient(settings: { url: string; token: string | null }): AiHostClient {
  const request = async (path: string, ownerSession: string, init: RequestInit = {}) => {
    if (!settings.token) throw new AppError('ai_host_unavailable');
    const headers = {
      authorization: `Bearer ${settings.token}`,
      'x-owner-session': ownerSession,
      'content-type': 'application/json',
    };
    try {
      return await fetch(new URL(path, settings.url), { ...init, headers });
    } catch {
      throw new AppError('ai_host_unavailable');
    }
  };
  const reply = async (response: Response): Promise<HostReply> => ({
    status: response.status,
    body: (await response.json()) as unknown,
  });
  return {
    call: async (method, input, ownerSession) =>
      reply(
        await request(`/rpc/${encodeURIComponent(method)}`, ownerSession, {
          method: 'POST',
          body: JSON.stringify(input ?? {}),
        }),
      ),
    read: async (path, ownerSession) => reply(await request(path, ownerSession)),
    open: (path, ownerSession, signal) => request(path, ownerSession, { signal }),
  };
}
