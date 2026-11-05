import type { AiHostsConfig } from '../config/index.js';
import { createAiHostClient, type AiHostClient } from './client.js';
import { startSignInRefresh } from './keep-alive.js';
import { createAiHostPool } from './pool.js';
import { createRoutedAiHostClient } from './routed-client.js';

/** The AI hosts of this install, as QBank reaches them (DEC-30, DEC-35). */
export interface AiHosts {
  client: AiHostClient;
  /** True when every account has its own host (and so its own sign-ins). */
  perAccount: boolean;
  /** Whether any host can be reached at all (a single host needs its token). */
  configured: boolean;
  /**
   * Whether the account has providers to look at without starting anything: an account that
   * never opened its providers has no host folder, and browsing must not start one for it.
   */
  isSetUp(accountId: string): Promise<boolean>;
  /** Stops the account's host and deletes its sign-ins; nothing to do with a single host. */
  forget(accountId: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * One host for the install (`single`: local mode, or the roll-back switch), or one per account,
 * started on demand (`per_account`). Both are reached through the same `AiHostClient`.
 */
export function createAiHosts(
  single: { url: string; token: string | null },
  hosts: AiHostsConfig,
): AiHosts {
  if (hosts.mode === 'single')
    return {
      client: createAiHostClient(single),
      perAccount: false,
      configured: single.token !== null,
      isSetUp: async () => true,
      forget: async () => undefined,
      close: async () => undefined,
    };
  const pool = createAiHostPool(hosts);
  const stopRefresh = startSignInRefresh(pool, hosts.refreshMs);
  return {
    client: createRoutedAiHostClient(pool),
    perAccount: true,
    configured: true,
    isSetUp: pool.isSetUp,
    forget: pool.forget,
    close: async () => {
      stopRefresh();
      await pool.close();
    },
  };
}
