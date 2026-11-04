import { useQuery } from '../../platform/api/use-query.js';
import { fetchProviderState } from './api.js';

/**
 * The provider instances that can run a question now: on and signed in (the AI providers kit).
 * Shared by every screen that lets the user pick their AI.
 */
export function useReadyProviders() {
  const { state } = useQuery(fetchProviderState);
  if (state.status !== 'ready') return [];
  return state.data.providers
    .filter((p) => p.enabled && p.auth.status === 'authenticated')
    .map((p) => ({ value: p.instanceId, label: p.displayName ?? p.driver }));
}
