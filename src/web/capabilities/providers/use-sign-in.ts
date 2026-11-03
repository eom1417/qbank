import { useEffect, useState } from 'react';
import { AuthStateView } from '../../../contracts/providers.js';
import { flowEventsPath, kitCall, startSignIn, subscribe } from './api.js';

const FINISHED = new Set(['succeeded', 'failed', 'cancelled']);

/**
 * One sign-in flow of an instance (the kit's ProviderAuthService): start it, follow its live
 * state, finish it with the callback address, answer a credentials prompt, or cancel it.
 */
export function useSignIn(instanceId: string, onError: (error: unknown) => void) {
  const [flow, setFlow] = useState<AuthStateView | null>(null);
  const flowId = flow && !FINISHED.has(flow.phase) ? flow.flowId : null;
  useEffect(() => {
    if (!flowId) return;
    return subscribe(flowEventsPath(instanceId), (event) => {
      const next = AuthStateView.safeParse(event);
      if (next.success && next.data.flowId === flowId) setFlow(next.data);
    });
  }, [instanceId, flowId]);
  const act = (work: () => Promise<unknown>) =>
    work()
      .then((state) => {
        const parsed = AuthStateView.safeParse(state);
        if (parsed.success) setFlow(parsed.data);
      })
      .catch(onError);
  const ids = () => ({ instanceId, flowId: flow?.flowId ?? '' });
  return {
    flow,
    start: (methodId?: string) =>
      act(() => startSignIn({ instanceId, ...(methodId ? { methodId } : {}) })),
    complete: (callbackUrl: string) =>
      act(() => kitCall('provider.auth.complete', { ...ids(), callbackUrl })),
    respond: (interactionId: string, values: Record<string, string>) =>
      act(() =>
        kitCall('provider.auth.respond', {
          ...ids(),
          interactionId,
          response: { type: 'credentials', values },
        }),
      ),
    cancel: () => act(() => kitCall('provider.auth.cancel', ids())),
    close: () => setFlow(null),
  };
}

export type SignIn = ReturnType<typeof useSignIn>;
