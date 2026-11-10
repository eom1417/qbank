/**
 * The uptime ping (M32): while the server runs it calls the owner's uptime service every few
 * minutes; when the calls stop, that service alerts the owner. A failed ping is only logged:
 * it never stops or slows the server.
 */
export interface HeartbeatOptions {
  url: string;
  intervalMs?: number;
  timeoutMs?: number;
  send?: (url: string, signal: AbortSignal) => Promise<{ ok: boolean; status: number }>;
  warn: (message: string) => void;
}

const FIVE_MINUTES = 5 * 60_000;

const httpSend: NonNullable<HeartbeatOptions['send']> = (url, signal) =>
  fetch(url, { method: 'GET', signal });

/** One ping; resolves true when the service answered 2xx. Never throws. */
export async function ping(options: HeartbeatOptions): Promise<boolean> {
  const send = options.send ?? httpSend;
  try {
    const answer = await send(options.url, AbortSignal.timeout(options.timeoutMs ?? 10_000));
    if (!answer.ok) options.warn(`uptime ping answered ${answer.status}`);
    return answer.ok;
  } catch {
    options.warn('uptime ping failed (network or timeout)');
    return false;
  }
}

/** Pings now and then every interval; returns a stop function. The timer never keeps Node up. */
export function startHeartbeat(options: HeartbeatOptions): () => void {
  void ping(options);
  const timer = setInterval(() => void ping(options), options.intervalMs ?? FIVE_MINUTES);
  timer.unref();
  return () => clearInterval(timer);
}
