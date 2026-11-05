import { createAiHostClient } from './client.js';
import type { AiHostPool } from './pool.js';

/**
 * Keeps every account's provider sign-ins fresh (DEC-35). A provider renews its short-lived
 * token when its tool runs; an account away for days must not come back to a lapsed one. So,
 * one account at a time, a host that is not running is started, asked to check its providers
 * (which renews their tokens), and stopped again. Running hosts renew on their own.
 */
export async function refreshSignIns(pool: AiHostPool): Promise<number> {
  let refreshed = 0;
  const running = new Set(pool.running());
  for (const accountId of await pool.setUpAccounts()) {
    if (running.has(accountId)) continue;
    const host = await pool.lease(accountId).catch(() => null);
    if (!host) continue;
    const owner = `account:${accountId}`;
    await createAiHostClient(host)
      .call('server.refreshProviders', {}, owner)
      .then(() => (refreshed += 1))
      .catch(() => undefined);
    host.release();
    await pool.rest(accountId);
  }
  return refreshed;
}

/** Runs the refresh every `everyMs` until stopped; one run at a time. */
export function startSignInRefresh(pool: AiHostPool, everyMs: number) {
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    void refreshSignIns(pool).finally(() => (busy = false));
  }, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}
