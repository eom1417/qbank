import { afterEach, describe, expect, it, vi } from 'vitest';
import { ping, startHeartbeat } from '../../../src/server/platform/heartbeat.js';

const URL = 'https://hc-ping.example/abc';

describe('uptime heartbeat (M32)', () => {
  afterEach(() => vi.useRealTimers());

  it('pings at once and then every interval, and stops when asked', async () => {
    vi.useFakeTimers();
    const send = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
    const stop = startHeartbeat({ url: URL, intervalMs: 1000, send, warn: () => undefined });
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(send).toHaveBeenCalledTimes(4);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(4);
    expect(send).toHaveBeenCalledWith(URL, expect.any(AbortSignal));
  });

  it('only warns when the service refuses or cannot be reached, and never throws', async () => {
    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);
    const refused = () => Promise.resolve({ ok: false, status: 503 });
    const down = () => Promise.reject(new Error('ECONNREFUSED'));
    expect(await ping({ url: URL, send: refused, warn })).toBe(false);
    expect(await ping({ url: URL, send: down, warn })).toBe(false);
    expect(warnings).toEqual([
      'uptime ping answered 503',
      'uptime ping failed (network or timeout)',
    ]);
  });
});
