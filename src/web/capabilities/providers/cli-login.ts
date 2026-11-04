import { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  CliLoginView,
  type CliLoginMethod,
  type CliProvider,
} from '../../../contracts/providers.js';
import { apiRequest } from '../../platform/api/client.js';
import { refreshInstance } from './instances.js';

const path = (id: string, action = '') =>
  `/api/providers/login/${encodeURIComponent(id)}${action ? `/${action}` : ''}`;

const start = (method: CliLoginMethod, secret?: string) =>
  apiRequest(
    'POST',
    '/api/providers/login',
    CliLoginView,
    secret ? { method, secret } : { method },
  );

export const cliLogout = (provider: CliProvider) =>
  apiRequest('POST', '/api/providers/logout', z.object({ signedOut: z.boolean() }), { provider });

const ACTIVE = new Set(['starting', 'waiting', 'verifying']);
const POLL_MS = 1500;

/**
 * One sign-in through a provider's official CLI, followed until it ends; when it succeeds the
 * provider is checked again so its card shows the account at once.
 */
export function useCliLogin(instanceId: string, onError: (error: unknown) => void) {
  const [login, setLogin] = useState<CliLoginView | null>(null);
  const active = login !== null && ACTIVE.has(login.status);
  useEffect(() => {
    if (!login || !active) return;
    const timer = setTimeout(
      () => void apiRequest('GET', path(login.id), CliLoginView).then(setLogin).catch(onError),
      POLL_MS,
    );
    return () => clearTimeout(timer);
  }, [login, active, onError]);
  const done = login?.status === 'done';
  useEffect(() => {
    if (done) void refreshInstance(instanceId).catch(onError);
  }, [done, instanceId, onError]);
  const run = (task: Promise<CliLoginView>) => task.then(setLogin).catch(onError);
  return {
    login,
    active,
    start: (method: CliLoginMethod, secret?: string) => run(start(method, secret)),
    sendCode: (id: string, code: string) =>
      run(apiRequest('POST', path(id, 'code'), CliLoginView, { code })),
    cancel: (id: string) => run(apiRequest('POST', path(id, 'cancel'), CliLoginView, {})),
    close: () => setLogin(null),
  };
}

export type CliLogin = ReturnType<typeof useCliLogin>;
