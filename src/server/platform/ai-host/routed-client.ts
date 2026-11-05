import { AppError } from '../errors/index.js';
import { createAiHostClient, type AiHostClient } from './client.js';
import type { HostLease } from './pool.js';

/** The account a request belongs to: QBank always says `account:<id>` (providers' `ownerOf`). */
function accountOf(ownerSession: string): string {
  const match = /^account:(.+)$/.exec(ownerSession);
  if (!match?.[1]) throw new AppError('ai_host_unavailable');
  return match[1];
}

/**
 * The AI host client for one host per account (DEC-35): every call goes to the host of the
 * account that makes it, and to no other. Callers keep the same `AiHostClient`; a call without
 * an account is refused. The host stays leased while the call runs, and for a live stream until
 * its caller goes away.
 */
export function createRoutedAiHostClient(hosts: {
  lease(accountId: string): Promise<HostLease>;
}): AiHostClient {
  const withHost = async <T>(
    ownerSession: string,
    work: (client: AiHostClient) => Promise<T>,
  ): Promise<T> => {
    const host = await hosts.lease(accountOf(ownerSession));
    try {
      return await work(createAiHostClient(host));
    } finally {
      host.release();
    }
  };
  return {
    call: (method, input, owner) => withHost(owner, (c) => c.call(method, input, owner)),
    ask: (input, owner) => withHost(owner, (c) => c.ask(input, owner)),
    post: (path, input, owner) => withHost(owner, (c) => c.post(path, input, owner)),
    read: (path, owner) => withHost(owner, (c) => c.read(path, owner)),
    async open(path, owner, signal) {
      const host = await hosts.lease(accountOf(owner));
      if (signal.aborted) host.release();
      else signal.addEventListener('abort', host.release, { once: true });
      try {
        return await createAiHostClient(host).open(path, owner, signal);
      } catch (error) {
        host.release();
        throw error;
      }
    },
  };
}
