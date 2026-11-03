import { useEffect, useState } from 'react';
import {
  ProviderStateResponse,
  ProviderView,
  type InstanceConfig,
} from '../../../contracts/providers.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';
import { fetchProviderState, subscribe } from './api.js';

type State =
  | { status: 'loading' }
  | { status: 'error'; error: MessageKey }
  | { status: 'ready'; providers: ProviderView[]; instances: Record<string, InstanceConfig> };

/** Provider statuses arrive as the kit sends them; anything else in the stream is ignored here. */
function providersFrom(event: unknown): ProviderView[] | null {
  const typed = event as { type?: unknown; payload?: { providers?: unknown } };
  if (typed.type !== 'providerStatuses') return null;
  const parsed = ProviderView.array().safeParse(typed.payload?.providers);
  return parsed.success ? parsed.data : null;
}

/** Instance configs arrive with each settings write (the kit's `settingsUpdated`). */
function instancesFrom(event: unknown): Record<string, InstanceConfig> | null {
  const typed = event as { type?: unknown; payload?: { settings?: unknown } };
  if (typed.type !== 'settingsUpdated') return null;
  const parsed = ProviderStateResponse.shape.settings.safeParse(typed.payload?.settings);
  return parsed.success ? (parsed.data.providerInstances ?? {}) : null;
}

/** Every provider instance with its status, sign-in, models and limits, kept live. */
export function useProviderState() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    fetchProviderState().then(
      (data) =>
        active &&
        setState({
          status: 'ready',
          providers: data.providers,
          instances: data.settings.providerInstances ?? {},
        }),
      (error: unknown) => active && setState({ status: 'error', error: errorMessageKey(error) }),
    );
    const close = subscribe('/api/providers/state/events', (event) => {
      const providers = providersFrom(event);
      const instances = instancesFrom(event);
      if (!active) return;
      if (providers)
        setState((current) => ({
          status: 'ready',
          providers,
          instances: current.status === 'ready' ? current.instances : {},
        }));
      if (instances)
        setState((current) => (current.status === 'ready' ? { ...current, instances } : current));
    });
    return () => {
      active = false;
      close();
    };
  }, [version]);
  return { state, reload: () => setVersion((v) => v + 1) };
}
